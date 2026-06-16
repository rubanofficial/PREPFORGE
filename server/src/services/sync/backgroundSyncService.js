import leetcodeProvider from '../providers/leetcodeProvider.js';
import { normalizeSubmission, buildProblemDocument } from '../normalization/normalizeAcceptedProblems.js';
import Problem from '../../models/Problem.js';
import SyncJob from '../../models/SyncJob.js';
import User from '../../models/User.js';
import { getIO } from '../../socketManager.js';

/**
 * BACKGROUND SYNC SERVICE
 *
 * The Alfa LeetCode API returns ALL accepted submissions in ONE response
 * (the skip/offset param is ignored — no real server-side pagination).
 *
 * ARCHITECTURE (single-fetch, no loop):
 *  1. Fetch ALL submissions in one call
 *  2. If incremental: filter to only submissions newer than watermark timestamp
 *  3. Normalize + deduplicate + insert, emitting socket progress every 5 items
 *  4. Emit sync-complete / sync-failed
 *  5. Stamp User.lastLeetcodeSyncAt as new watermark on success
 */

/**
 * Start background sync for a user.
 * Called from startBackgroundSync controller (fire-and-forget).
 *
 * @param {string}    syncJobId      - SyncJob document _id
 * @param {string}    username       - LeetCode username
 * @param {string}    userId         - MongoDB User _id
 * @param {Date|null} sinceTimestamp - Watermark for incremental sync (null = full)
 * @param {string}    syncMode       - 'full' | 'incremental'
 */
export async function startBackgroundSync(syncJobId, username, userId, sinceTimestamp = null, syncMode = 'full') {
  const syncStartedAt = new Date();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 BACKGROUND SYNC STARTED`);
  console.log(`   SyncJob ID : ${syncJobId}`);
  console.log(`   Username   : ${username}`);
  console.log(`   User ID    : ${userId}`);
  console.log(`   Sync Mode  : ${syncMode.toUpperCase()}`);
  console.log(`   Since      : ${sinceTimestamp ? sinceTimestamp.toISOString() : 'beginning of time (full sync)'}`);
  console.log(`${'='.repeat(70)}\n`);

  try {
    // Mark the job active
    await SyncJob.findByIdAndUpdate(syncJobId, {
      status: 'active',
      syncMode,
      syncFrom: sinceTimestamp || null,
    });

    // ── STEP 1: Fetch ALL submissions (single API call) ──────────────────────
    console.log(`[STEP 1/3] 📡 Fetching all submissions from provider...`);
    const providerResponse = await leetcodeProvider.fetchAcceptedProblems(username);

    if (providerResponse.error) {
      if (providerResponse.error === 'NO_SUBMISSIONS') {
        console.log(`⚠️  User has no solved problems — marking complete`);
        await SyncJob.findByIdAndUpdate(syncJobId, {
          status: 'completed',
          completedAt: new Date(),
          'progress.totalExpected': 0,
        });
        getIO()?.to(userId.toString()).emit('sync-complete', {
          status: 'completed',
          progress: { expectedProblems: 0, fetchedFromProvider: 0, insertedToDatabase: 0, duplicatesSkipped: 0, failedToProcess: 0 },
          progressPercent: 100,
        });
        await User.findByIdAndUpdate(userId, { lastLeetcodeSyncAt: syncStartedAt });
        return;
      }
      throw new Error(`Provider fetch failed: ${providerResponse.message}`);
    }

    let allSubmissions = providerResponse.data?.submissions ?? [];
    const totalFetched = allSubmissions.length;
    console.log(`✅ Fetched ${totalFetched} submissions from provider`);

    await SyncJob.findByIdAndUpdate(syncJobId, {
      'progress.totalExpected': totalFetched,
      'metadata.apiEndpoint': 'https://alfa-leetcode-api.onrender.com',
    });

    if (totalFetched === 0) {
      console.log(`⚠️  No submissions — marking complete`);
      await SyncJob.findByIdAndUpdate(syncJobId, { status: 'completed', completedAt: new Date() });
      getIO()?.to(userId.toString()).emit('sync-complete', {
        status: 'completed',
        progress: { expectedProblems: 0, fetchedFromProvider: 0, insertedToDatabase: 0, duplicatesSkipped: 0, failedToProcess: 0 },
        progressPercent: 100,
      });
      await User.findByIdAndUpdate(userId, { lastLeetcodeSyncAt: syncStartedAt });
      return;
    }

    // ── STEP 2: Apply incremental watermark filter ────────────────────────────
    if (sinceTimestamp) {
      console.log(`[STEP 2/3] 🔵 INCREMENTAL: filtering submissions after ${sinceTimestamp.toISOString()}`);
      const before = allSubmissions.length;
      allSubmissions = allSubmissions.filter((sub) => {
        // timestamp is a Unix seconds string
        const ts = sub.timestamp
          ? new Date(parseInt(sub.timestamp) * 1000)
          : new Date(sub.solvedAt || 0);
        return ts > sinceTimestamp;
      });
      console.log(`✅ Delta: ${before} total → ${allSubmissions.length} new (${before - allSubmissions.length} already synced)`);
    } else {
      console.log(`[STEP 2/3] 🟢 FULL SYNC: processing all ${allSubmissions.length} submissions`);
    }

    if (allSubmissions.length === 0) {
      console.log(`✅ Nothing new since last sync — marking complete`);
      await SyncJob.findByIdAndUpdate(syncJobId, { status: 'completed', completedAt: new Date() });
      getIO()?.to(userId.toString()).emit('sync-complete', {
        status: 'completed',
        progress: { expectedProblems: 0, fetchedFromProvider: 0, insertedToDatabase: 0, duplicatesSkipped: 0, failedToProcess: 0 },
        progressPercent: 100,
      });
      await User.findByIdAndUpdate(userId, { lastLeetcodeSyncAt: syncStartedAt });
      return;
    }

    // ── STEP 3: Normalize → deduplicate → insert ──────────────────────────────
    console.log(`\n[STEP 3/3] 💾 Normalizing & inserting ${allSubmissions.length} submissions...`);
    const { inserted, duplicates, failed } = await processSubmissions(syncJobId, userId, allSubmissions);

    // ── DONE ──────────────────────────────────────────────────────────────────
    console.log(`\n✅ SYNC COMPLETE — inserted: ${inserted}, duplicates: ${duplicates}, failed: ${failed}`);

    await SyncJob.findByIdAndUpdate(syncJobId, {
      status: 'completed',
      completedAt: new Date(),
      'progress.processed': allSubmissions.length,
      'progress.inserted': inserted,
      'progress.duplicates': duplicates,
      'progress.failed': failed,
    });

    getIO()?.to(userId.toString()).emit('sync-complete', {
      status: 'completed',
      progress: {
        expectedProblems: allSubmissions.length,
        fetchedFromProvider: allSubmissions.length,
        insertedToDatabase: inserted,
        duplicatesSkipped: duplicates,
        failedToProcess: failed,
      },
      progressPercent: 100,
    });

    // Stamp watermark using the time the sync STARTED (not now),
    // so any problems solved mid-sync are caught on the next incremental run.
    await User.findByIdAndUpdate(userId, { lastLeetcodeSyncAt: syncStartedAt });
    console.log(`✅ Watermark stamped: ${syncStartedAt.toISOString()}`);

  } catch (error) {
    console.error(`❌ BACKGROUND SYNC FAILED: ${error.message}`);
    await SyncJob.findByIdAndUpdate(syncJobId, {
      status: 'failed',
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN',
        timestamp: new Date(),
      },
    });
    getIO()?.to(userId.toString()).emit('sync-failed', {
      status: 'failed',
      error: error.message,
      progressPercent: 0,
    });
    // Do NOT stamp watermark on failure — next sync retries from same point
  }
}

/**
 * Normalize, deduplicate, and insert a list of raw submissions.
 * Emits sync-progress socket events every 5 items so the UI bar moves.
 *
 * Uses normalizeSubmission (per-item) not normalizeAcceptedProblems (full response).
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
      // Use the per-item normalizer (not the full-response wrapper)
      const normalized = normalizeSubmission(submission, i);

      if (!normalized) {
        failed++;
        continue;
      }

      // Skip within-run duplicates (same problem solved multiple times)
      if (seenSlugs.has(normalized.titleSlug)) {
        duplicates++;
        continue;
      }
      seenSlugs.add(normalized.titleSlug);

      // Build the full MongoDB document (adds userId, platform, etc.)
      const doc = buildProblemDocument({ ...normalized, userId }, userId);

      // DB-level dedup: skip if already stored
      const exists = await Problem.findOne({ userId, titleSlug: normalized.titleSlug }).select('_id').lean();
      if (exists) {
        duplicates++;
        continue;
      }

      await Problem.create(doc);
      inserted++;

    } catch (err) {
      console.warn(`      ❌ Submission ${i} error:`, err.message);
      failed++;
    }

    // Emit progress every 5 items and on the very last item
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

      // Also persist progress to DB for REST-polling fallback
      await SyncJob.findByIdAndUpdate(syncJobId, {
        'progress.processed': i + 1,
        'progress.inserted': inserted,
        'progress.duplicates': duplicates,
        'progress.failed': failed,
      });
    }
  }

  console.log(`\n📊 PROCESS COMPLETE: inserted=${inserted} duplicates=${duplicates} failed=${failed}`);
  return { inserted, duplicates, failed };
}

export default {
  startBackgroundSync,
  processSubmissions,
};
