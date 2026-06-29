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
 *   2. Configures reconnection behavior for production reliability
 *   3. Falls back to localhost:6379 for development
 *   4. Reads REDIS_URL env var for one-line production setup (Render, Railway, etc.)
 *
 * ============================================================================
 * ENVIRONMENT VARIABLES (all optional):
 * ============================================================================
 *   REDIS_URL       - Full Redis URL (takes priority over individual vars)
 *                     Example: redis://default:password@host:6379
 *
 *   REDIS_HOST      - Redis server hostname (default: localhost)
 *   REDIS_PORT      - Redis server port (default: 6379)
 *   REDIS_PASSWORD  - Redis password (default: none)
 *
 * ============================================================================
 * RECONNECTION STRATEGY
 * ============================================================================
 *   maxRetryAttempts: 10  — Try to reconnect 10 times before giving up
 *   retryDelay: 2000      — Wait 2 seconds between retries
 *
 *   This means if Redis restarts, the queue and worker will automatically
 *   reconnect within ~20 seconds without any manual intervention.
 * ============================================================================
 */

function createRedisConnection() {
  // If REDIS_URL is provided (e.g., Render.com Redis, Redis Cloud), use it directly
  if (process.env.REDIS_URL) {
    console.log('📦 Redis: Connecting via REDIS_URL');
    return new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,  // BullMQ manages retries itself
      enableReadyCheck: false,     // Let BullMQ handle readiness
      retryStrategy: (times) => {
        if (times > 10) {
          console.error('❌ Redis: Max retry attempts reached (10)');
          return null; // Give up
        }
        const delay = Math.min(times * 2000, 10000);
        console.log(`🔄 Redis: Reconnecting (attempt ${times}/${10}) in ${delay}ms...`);
        return delay;
      },
    });
  }

  // Fall back to individual env vars or localhost defaults
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT, 10) || 6379;
  const password = process.env.REDIS_PASSWORD || undefined;

  console.log(`📦 Redis: Connecting to ${host}:${port}`);

  return new IORedis({
    host,
    port,
    password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 10) {
        console.error('❌ Redis: Max retry attempts reached (10)');
        return null;
      }
      const delay = Math.min(times * 2000, 10000);
      console.log(`🔄 Redis: Reconnecting (attempt ${times}/${10}) in ${delay}ms...`);
      return delay;
    },
  });
}

// Create and export a singleton connection
const connection = createRedisConnection();

connection.on('connect', () => {
  console.log('✅ Redis: Connected successfully');
});

connection.on('error', (err) => {
  console.error('❌ Redis: Connection error:', err.message);
});

connection.on('close', () => {
  console.warn('⚠️  Redis: Connection closed');
});

connection.on('reconnecting', () => {
  console.log('🔄 Redis: Reconnecting...');
});

export default connection;
