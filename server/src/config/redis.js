import IORedis from 'ioredis';

/**
 * REDIS CONNECTION CONFIGURATION
 *
 * ============================================================================
 * WHY THIS FILE EXISTS
 * ============================================================================
 * BullMQ requires Redis to operate. Both the Queue (producer) and Worker
 * (consumer) need a Redis connection. This module:
 *
 *   1. Creates a single IORedis instance shared by Queue + Worker
 *      (BullMQ best practice — avoids opening multiple connections)
 *   2. Configures TLS automatically when connecting to Upstash
 *   3. Configures reconnection behavior for production reliability
 *   4. Falls back to localhost:6379 for local development
 *
 * ============================================================================
 * ENVIRONMENT VARIABLES
 * ============================================================================
 *   REDIS_URL  — Full Redis URL (required for Upstash; optional for local)
 *
 *                LOCAL:    redis://localhost:6379
 *                UPSTASH:  rediss://default:<token>@<endpoint>.upstash.io:6379
 *                          ^^^^^^ double-s = TLS enabled
 *
 *   REDIS_HOST     — Hostname override (default: localhost)   ← local dev only
 *   REDIS_PORT     — Port override    (default: 6379)         ← local dev only
 *   REDIS_PASSWORD — Password override                        ← local dev only
 *
 * ============================================================================
 * UPSTASH-SPECIFIC CHANGES vs. ORIGINAL (LOCAL DOCKER) CONFIG
 * ============================================================================
 *
 *  1. tls: {}
 *     ─────────────────────────────────────────────────────────────────────
 *     WHY:  Upstash mandates encrypted connections. Without this, the TCP
 *           handshake completes but Upstash immediately drops the connection
 *           because it only accepts TLS traffic on port 6379.
 *     HOW:  We detect TLS by checking if the URL starts with "rediss://"
 *           (double-s). This keeps local Docker connections working with
 *           "redis://" (single-s) because tls is NOT added in that path.
 *     IF SKIPPED: You'll get "Connection closed" or "ECONNRESET" errors
 *           within milliseconds of connecting. BullMQ jobs will never be
 *           stored, workers will never receive jobs.
 *
 *  2. lazyConnect: true
 *     ─────────────────────────────────────────────────────────────────────
 *     WHY:  IORedis normally connects immediately when the instance is
 *           created (at module import time). With lazyConnect, it waits
 *           until the first actual command. This prevents the app from
 *           crashing during startup if Upstash is briefly unavailable,
 *           and gives dotenv() time to load before the connection fires.
 *     HOW:  BullMQ internally calls .connect() when it first uses the
 *           connection object — no manual call needed from our side.
 *     IF SKIPPED: Possible race condition on startup; minor, but lazyConnect
 *           is the recommended pattern for managed cloud Redis.
 *
 *  3. connectTimeout: 10000  (10 seconds)
 *     ─────────────────────────────────────────────────────────────────────
 *     WHY:  Upstash free-tier databases "sleep" after inactivity. The first
 *           connection after sleep can take 3–8 seconds to wake up. The
 *           IORedis default timeout is 10000ms, which is fine, but we make
 *           it explicit here so it's visible and can be tuned.
 *     IF SKIPPED: On cold-start deployments, the connection may timeout
 *           before Upstash wakes, causing BullMQ to throw on first use.
 *
 *  4. maxRetriesPerRequest: null
 *     ─────────────────────────────────────────────────────────────────────
 *     WHY:  This is a BullMQ HARD REQUIREMENT (unchanged from original).
 *           BullMQ uses long-polling (BLPOP) internally for job delivery.
 *           If IORedis retries on its own, it breaks BullMQ's flow control.
 *           Setting this to null tells IORedis "never retry commands" —
 *           BullMQ manages all retries itself via its own retry strategy.
 *     IF SKIPPED: BullMQ throws "MaxRetriesPerRequestError" immediately
 *           on startup. Queues and workers WILL NOT function.
 *
 *  5. enableReadyCheck: false
 *     ─────────────────────────────────────────────────────────────────────
 *     WHY:  Also a BullMQ HARD REQUIREMENT (unchanged from original).
 *           When true, IORedis sends "INFO" commands to verify the server
 *           is ready before processing commands. BullMQ issues commands
 *           during connection setup; the "ready check" races with BullMQ's
 *           own setup and causes "Stream isn't writeable" errors.
 *     IF SKIPPED: BullMQ may throw errors during initial connection setup,
 *           especially under load or on slow cloud connections.
 *
 * ============================================================================
 * RECONNECTION STRATEGY
 * ============================================================================
 *   Exponential backoff: 2s → 4s → 6s → ... → 10s (capped)
 *   Max 10 attempts before giving up.
 *
 *   With Upstash this covers:
 *     - Free-tier cold starts (database sleeping)
 *     - Brief network interruptions in the cloud
 *     - Deployment rolling restarts
 * ============================================================================
 */

/**
 * Shared retry strategy for both URL-based and host-based connections.
 * Uses capped exponential backoff — returns null after 10 attempts to
 * stop retrying (IORedis then emits an 'error' event).
 */
function retryStrategy(times) {
  if (times > 10) {
    console.error('❌ Redis: Max retry attempts reached (10). Giving up.');
    return null; // Stop retrying; IORedis emits 'error'
  }
  const delay = Math.min(times * 2000, 10000); // 2s → 4s → ... → 10s
  console.log(`🔄 Redis: Reconnecting (attempt ${times}/10) in ${delay}ms...`);
  return delay;
}

function createRedisConnection() {
  // ── PRIORITY PATH: REDIS_URL is set (covers Upstash + Render + Railway) ──
  if (process.env.REDIS_URL) {
    const url = process.env.REDIS_URL;

    // Detect Upstash (or any TLS Redis) by the "rediss://" scheme.
    // "rediss" (double-s) is the IANA-registered scheme for Redis over TLS.
    // Local Docker uses "redis://" (single-s) — no TLS needed there.
    const isTLS = url.startsWith('rediss://');

    console.log(`📦 Redis: Connecting via REDIS_URL ${isTLS ? '(TLS/Upstash)' : '(plain)'}`);

    return new IORedis(url, {
      // ── BullMQ hard requirements ─────────────────────────────────────
      maxRetriesPerRequest: null,   // BullMQ manages retries; IORedis must not
      enableReadyCheck: false,      // Prevents race with BullMQ's setup sequence

      // ── TLS: Required for Upstash; skipped for plain redis:// ────────
      // Passing an empty object `{}` tells IORedis to use Node's built-in
      // TLS with default CA verification. Upstash uses valid Let's Encrypt
      // certificates, so no rejectUnauthorized override is needed.
      ...(isTLS && { tls: {} }),

      // ── Cloud-friendly connection settings ───────────────────────────
      lazyConnect: true,            // Don't connect at import time — wait for first use
      connectTimeout: 10000,        // 10s — covers Upstash free-tier cold-start wake

      // ── Reconnection ─────────────────────────────────────────────────
      retryStrategy,
    });
  }

  // ── FALLBACK PATH: Individual env vars or localhost defaults ──────────────
  // Used for local development when REDIS_URL is not set.
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT, 10) || 6379;
  const password = process.env.REDIS_PASSWORD || undefined;

  console.log(`📦 Redis: Connecting to ${host}:${port} (no TLS)`);

  return new IORedis({
    host,
    port,
    password,

    // ── BullMQ hard requirements (same as above) ──────────────────────
    maxRetriesPerRequest: null,
    enableReadyCheck: false,

    // ── Reconnection ─────────────────────────────────────────────────
    retryStrategy,
  });
}

// ── Create and export the singleton connection ────────────────────────────────
// Both syncQueue.js and syncWorker.js import this exact object.
// BullMQ does NOT accept separate connection options per command — it reuses
// this connection for all Lua scripts, BLPOP polling, and key operations.
const connection = createRedisConnection();

connection.on('connect', () => {
  console.log('✅ Redis: Connected successfully');
});

connection.on('ready', () => {
  console.log('✅ Redis: Connection ready — BullMQ can now accept jobs');
});

connection.on('error', (err) => {
  // Log but don't crash — retryStrategy handles reconnection automatically.
  // BullMQ also listens to this event and pauses job processing until
  // the connection recovers.
  console.error('❌ Redis: Connection error:', err.message);
});

connection.on('close', () => {
  console.warn('⚠️  Redis: Connection closed');
});

connection.on('reconnecting', () => {
  console.log('🔄 Redis: Reconnecting...');
});

export default connection;
