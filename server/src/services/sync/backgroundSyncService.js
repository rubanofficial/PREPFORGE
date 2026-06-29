import leetcodeProvider from '../providers/leetcodeProvider.js';
import { normalizeSubmission, buildProblemDocument } from '../normalization/normalizeAcceptedProblems.js';
import Problem from '../../models/Problem.js';
import SyncJob from '../../models/SyncJob.js';
import User from '../../models/User.js';
import { getIO } from '../../socketManager.js';

/**
 * BACKGROUND SYNC SERVICE — TRUE DELTA SYNC
 *
 * ============================================================
 * ARCHITECTURE: Count-Based Delta Synchronization
 * ============================================================
 *
 * OLD APPROACH (Full Sync + Dedup):
 *   1. Fetch all 317 submissions
 *   2. Compare each against MongoDB
 *   3. Insert the 3 new ones
 *   API calls: O(N) where N = total solved
 *
 * NEW APPROACH (True Delta Sync):
 *   1. Fetch solved COUNT (1 cheap call) → 317
 *   2. Read User.lastSolvedCount           → 314
 *   3. Compute delta                       → 3
 *   4. Fetch ONLY 3 newest submissions
 *   5. Insert those 3
 *   API calls: O(1) count call + O(delta) fetch
 *
 * For 314→317: fetches 3 items instead of 317.
 * That's a 99% reduction in API payload for typical incremental runs.
 *
 * IDEMPOTENCY (safety guarantee):
 *   Even after computing the delta, we still run Problem.findOne()
 *   before every insert, so running sync twice is always safe.
 *
 * EDGE CASES HANDLED:
 *   - First sync (lastSolvedCount = 0) → full fetch
 *   - No new problems (delta = 0)       → immediate complete
 *   - Count regression (reset/anomaly)  → full recovery sync
 */

/**
 * Start background sync for a user (fire-and-forget from controller).
 *
 * @param {string}    syncJobId        - SyncJob document _id
 * @param {string}    username         - LeetCode username
 * @param {string}    userId           - MongoDB User _id
 * @param {number}    lastSolvedCount  - Solved count from last successful sync (0 = first sync)
 * @param {string}    syncMode         - 'full' | 'incremental' (informational; actual mode derived from count)
 */
export async function startBackgroundSync(syncJobId, username, userId, lastSolvedCount = 0, syncMode = 'full') {
  const syncStartedAt = new Date();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 DELTA SYNC ENGINE — STARTED`);
  console.log(`   SyncJob ID         : ${syncJobId}`);
  console.log(`   Username           : ${username}`);
  console.log(`   Previous Solved    : ${lastSolvedCount}`);
  console.log(`${'='.repeat(70)}\n`);

  try {
    await SyncJob.findByIdAndUpdate(syncJobId, { status: 'active', syncMode });

    // ── STEP 1: Get current solved count (single cheap API call) ────────────
    console.log(`[STEP 1/3] 📊 Fetching current solved count...`);
    const countResponse = await leetcodeProvider.fetchSolvedCount(username);

    if (countResponse.error) {
      throw new Error(`Failed to fetch solved count: ${countResponse.message}`);
    }

    const currentSolvedCount = countResponse.data.totalSolved;

    // ── STEP 2: Compute delta ────────────────────────────────────────────────
    console.log(`[STEP 2/3] 🔢 Computing delta...`);
    console.log(`   Previous Solved Count : ${lastSolvedCount}`);
    console.log(`   Current Solved Count  : ${currentSolvedCount}`);

    let delta = currentSolvedCount - lastSolvedCount;
    let effectiveSyncMode = 'incremental';

    if (lastSolvedCount === 0) {
      // First-ever sync — fetch everything
      delta = currentSolvedCount;
      effectiveSyncMode = 'full';
      console.log(`   → FIRST SYNC: fetching all ${delta} problems`);
    } else if (delta === 0) {
      // Nothing new
      console.log(`   → NO NEW PROBLEMS: delta = 0, marking complete`);
      await _markComplete(syncJobId, userId, currentSolvedCount, syncStartedAt, { inserted: 0, duplicates: 0, failed: 0, total: 0 });
      return;
    } else if (delta < 0) {
      // Count went down — user account reset or API anomaly → full recovery sync
      console.log(`   → COUNT REGRESSION (${lastSolvedCount} → ${currentSolvedCount}): triggering full recovery sync`);
      delta = currentSolvedCount;
      effectiveSyncMode = 'full';
    } else {
      // Normal incremental
      console.log(`   → INCREMENTAL: fetching ${delta} new problem${delta !== 1 ? 's' : ''}`);
    }

    console.log(`   Delta : ${delta}`);
    console.log(`   Mode  : ${effectiveSyncMode.toUpperCase()}`);

    await SyncJob.findByIdAndUpdate(syncJobId, {
      syncMode: effectiveSyncMode,
      'progress.totalExpected': delta,
      'metadata.previousSolvedCount': lastSolvedCount,
      'metadata.currentSolvedCount': currentSolvedCount,
      'metadata.delta': delta,
    });

    if (delta === 0) {
      await _markComplete(syncJobId, userId, currentSolvedCount, syncStartedAt, { inserted: 0, duplicates: 0, failed: 0, total: 0 });
      return;
    }

    // ── STEP 3: Fetch ONLY the delta-many newest submissions ─────────────────
    console.log(`\n[STEP 3/3] 📡 Fetching ${delta} newest submissions...`);
    const providerResponse = await leetcodeProvider.fetchAcceptedProblems(username, delta);

    if (providerResponse.error) {
      if (providerResponse.error === 'NO_SUBMISSIONS') {
        await _markComplete(syncJobId, userId, currentSolvedCount, syncStartedAt, { inserted: 0, duplicates: 0, failed: 0, total: 0 });
        return;
      }
      throw new Error(`Submission fetch failed: ${providerResponse.message}`);
    }

    const submissions = providerResponse.data?.submissions ?? [];
    console.log(`✅ Received ${submissions.length} submissions from provider`);

    // Update totalExpected to the actual received count (in case API returned fewer)
    await SyncJob.findByIdAndUpdate(syncJobId, { 'progress.totalExpected': submissions.length });

    // ── STEP 4: Normalize → dedup → insert ──────────────────────────────────
    const results = await processSubmissions(syncJobId, userId, submissions);

    // ── DONE ─────────────────────────────────────────────────────────────────
    await _markComplete(syncJobId, userId, currentSolvedCount, syncStartedAt, {
      ...results,
      total: submissions.length,
    });

  } catch (error) {
    console.error(`❌ DELTA SYNC FAILED: ${error.message}`);
    await SyncJob.findByIdAndUpdate(syncJobId, {
      status: 'failed',
      error: { message: error.message, code: error.code || 'UNKNOWN', timestamp: new Date() },
    });
    getIO()?.to(userId.toString()).emit('sync-failed', {
      status: 'failed',
      error: error.message,
      progressPercent: 0,
    });
    // Do NOT update watermark or lastSolvedCount on failure — retry from same point
    // Re-throw so BullMQ knows this job failed and should be retried
    throw error;
  }
}

/**
 * Mark a sync job complete, stamp watermark, update lastSolvedCount, and emit socket event.
 *
 * @param {string} syncJobId
 * @param {string} userId
 * @param {number} currentSolvedCount - The LeetCode count to save as new watermark
 * @param {Date}   syncStartedAt
 * @param {{ inserted, duplicates, failed, total }} metrics
 */
async function _markComplete(syncJobId, userId, currentSolvedCount, syncStartedAt, metrics) {
  const { inserted, duplicates, failed, total } = metrics;

  console.log(`\n✅ SYNC COMPLETE`);
  console.log(`   Inserted   : ${inserted}`);
  console.log(`   Duplicates : ${duplicates}`);
  console.log(`   Failed     : ${failed}`);

  await SyncJob.findByIdAndUpdate(syncJobId, {
    status: 'completed',
    completedAt: new Date(),
    'progress.processed': total,
    'progress.inserted': inserted,
    'progress.duplicates': duplicates,
    'progress.failed': failed,
  });

  getIO()?.to(userId.toString()).emit('sync-complete', {
    status: 'completed',
    progress: {
      expectedProblems: total,
      fetchedFromProvider: total,
      insertedToDatabase: inserted,
      duplicatesSkipped: duplicates,
      failedToProcess: failed,
    },
    progressPercent: 100,
  });

  // Stamp BOTH watermarks — timestamp and solved count
  await User.findByIdAndUpdate(userId, {
    lastLeetcodeSyncAt: syncStartedAt,   // timestamp watermark (kept for compatibility)
    lastSolvedCount: currentSolvedCount, // count watermark (used by delta sync)
  });

  console.log(`✅ Watermark stamped: lastSolvedCount = ${currentSolvedCount}, lastLeetcodeSyncAt = ${syncStartedAt.toISOString()}`);
}

/**
 * Normalize, deduplicate, and insert a list of raw submissions.
 * Emits sync-progress socket events every 5 items so the UI bar moves.
 *
 * IDEMPOTENCY: Even though we only fetched delta items, we still call
 * Problem.findOne() before each insert — double-protection against duplication.
 *
 * @param {string} syncJobId
 * @param {string} userId
 * @param {Array}  submissions - raw submission objects from provider
 * @returns {Promise<{inserted: number, duplicates: number, failed: number}>}
 */
async function processSubmissions(syncJobId, userId, submissions) {
  let inserted = 0;
  let duplicates = 0;
  let failed = 0;
  const total = submissions.length;
  const seenSlugs = new Set(); // in-memory dedup within this run

  for (let i = 0; i < submissions.length; i++) {
    const submission = submissions[i];
    try {
      // Normalize using the per-item normalizer
      const normalized = normalizeSubmission(submission, i);
      if (!normalized) { failed++; continue; }

      // In-run dedup (same problem solved multiple times in the delta window)
      if (seenSlugs.has(normalized.titleSlug)) { duplicates++; continue; }
      seenSlugs.add(normalized.titleSlug);

      // Build the full MongoDB document
      const doc = buildProblemDocument({ ...normalized, userId }, userId);

      // DB-level idempotency check — safe to run sync twice
      const exists = await Problem.findOne({ userId, titleSlug: normalized.titleSlug }).select('_id').lean();
      if (exists) { duplicates++; continue; }

      await Problem.create(doc);
      inserted++;

    } catch (err) {
      console.warn(`      ❌ Submission ${i} error:`, err.message);
      failed++;
    }

    // Emit progress every 5 items and on the last item
    if ((i + 1) % 5 === 0 || i === total - 1) {
      const progressPercent = Math.min(Math.round(((i + 1) / total) * 99), 99);
      getIO()?.to(userId.toString()).emit('sync-progress', {
        status: 'active',
        progress: {
          expectedProblems: total,
          fetchedFromProvider: i + 1,
          insertedToDatabase: inserted,
          duplicatesSkipped: duplicates,
          failedToProcess: failed,
        },
        progressPercent,
      });

      // Persist progress to DB for REST-polling fallback
      await SyncJob.findByIdAndUpdate(syncJobId, {
        'progress.processed': i + 1,
        'progress.inserted': inserted,
        'progress.duplicates': duplicates,
        'progress.failed': failed,
      });
    }
  }

  console.log(`\n📊 INSERT COMPLETE: inserted=${inserted} duplicates=${duplicates} failed=${failed}`);
  return { inserted, duplicates, failed };
}

export default {
  startBackgroundSync,
  processSubmissions,
};
