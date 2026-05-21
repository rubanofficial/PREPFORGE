import leetcodeProvider from '../providers/leetcodeProvider.js';
import { normalizeAcceptedProblems, buildProblemDocument } from '../normalization/normalizeAcceptedProblems.js';
import Problem from '../../models/Problem.js';
import SyncJob from '../../models/SyncJob.js';

/**
 * BACKGROUND SYNC SERVICE
 *
 * Handles background LeetCode syncing with batch processing.
 *
 * ARCHITECTURE PHILOSOPHY:
 * - "YouTube Video Processing" style
 * - User clicks sync → immediate response
 * - Background worker processes independently
 * - Progress updates continuously
 * - Never blocks request lifecycle
 *
 * WHY BACKGROUND PROCESSING?
 * 1. SCALABILITY: Multiple users can sync simultaneously
 * 2. UX: Immediate response to user (no timeout waiting)
 * 3. RESILIENCE: Sync can continue even if user closes browser
 * 4. RESOURCE EFFICIENCY: Server threads not blocked
 * 5. FOUNDATION: Can upgrade to queue systems (BullMQ, RabbitMQ) later
 *
 * HOW IT WORKS:
 * 1. Create SyncJob in 'pending' state
 * 2. Spawn background task (NOT awaited in request)
 * 3. Task fetches batches: skip=0, 20, 40, 60...
 * 4. Each batch updates SyncJob progress
 * 5. When no more batches, mark 'completed'
 *
 * BATCH STRATEGY:
 * - Fixed batch size: 20 items per fetch
 * - Pagination: skip = batchNumber * 20
 * - Termination: When provider returns < 20 items OR provider error (timeout)
 * - Never overwrites problems (deduplication before insert)
 */

// Configuration
const BATCH_SIZE = 20; // Alfa API default and recommended
const BATCH_DELAY = 500; // ms between batches (provider-friendly)

/**
 * Start background sync for a user
 *
 * RETURNS IMMEDIATELY - does NOT wait for sync to complete
 *
 * @param {string} syncJobId - ID of the SyncJob to process
 * @param {string} username - LeetCode username
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function startBackgroundSync(syncJobId, username, userId) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 BACKGROUND SYNC STARTED`);
  console.log(`   SyncJob ID: ${syncJobId}`);
  console.log(`   Username: ${username}`);
  console.log(`   User ID: ${userId}`);
  console.log(`${'='.repeat(70)}\n`);

  try {
    // Update sync job to 'active'
    await SyncJob.findByIdAndUpdate(syncJobId, { status: 'active' });

    // Fetch initial stats to know total expected
    console.log(`[STEP 1/2] 📊 Fetching stats to get totalExpected...`);
    const statsResponse = await leetcodeProvider.fetchSolvedStats(username);

    if (statsResponse.error) {
      throw new Error(`Stats fetch failed: ${statsResponse.message}`);
    }

    const totalExpected = statsResponse.data.totalSolved;
    console.log(`✅ Total expected: ${totalExpected}`);

    // Update job with expected count
    await SyncJob.findByIdAndUpdate(syncJobId, {
      'progress.totalExpected': totalExpected,
      'metadata.apiEndpoint': 'https://alfa-leetcode-api.onrender.com'
    });

    if (totalExpected === 0) {
      console.log(`⚠️  User has no solved problems - marking complete`);
      await SyncJob.findByIdAndUpdate(syncJobId, {
        status: 'completed',
        completedAt: new Date()
      });
      return;
    }

    // Begin batch processing
    console.log(`\n[STEP 2/2] 🔄 Starting batch processing (batch size: ${BATCH_SIZE})...\n`);
    await processBatchesUntilComplete(syncJobId, username, userId);

    // Mark as completed
    console.log(`\n✅ SYNC COMPLETE`);
    await SyncJob.findByIdAndUpdate(syncJobId, {
      status: 'completed',
      completedAt: new Date()
    });

  } catch (error) {
    console.error(`❌ BACKGROUND SYNC FAILED: ${error.message}`);
    await SyncJob.findByIdAndUpdate(syncJobId, {
      status: 'failed',
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN',
        timestamp: new Date()
      }
    });
  }
}

/**
 * Process batches until provider returns empty or fewer than batch size
 *
 * BATCHING STRATEGY:
 * - Batch 1: skip=0, limit=20
 * - Batch 2: skip=20, limit=20
 * - Batch 3: skip=40, limit=20
 * - Continue until: provider returns 0 OR <20 items
 *
 * @param {string} syncJobId - SyncJob document ID
 * @param {string} username - LeetCode username
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<void>}
 */
async function processBatchesUntilComplete(syncJobId, username, userId) {
  let skip = 0;
  let batchNum = 1;
  let hasMore = true;
  let totalProcessed = 0;

  while (hasMore) {
    console.log(`\n📥 BATCH ${batchNum}: skip=${skip}, limit=${BATCH_SIZE}`);

    try {
      // Fetch batch from provider
      const providerResponse = await leetcodeProvider.fetchAcceptedProblems(
        username,
        BATCH_SIZE,
        skip
      );

      // Check for provider errors
      if (providerResponse.error) {
        console.error(`❌ Provider error: ${providerResponse.message}`);

        // If timeout/network error, mark as completed with what we have
        if (
          providerResponse.error === 'TIMEOUT' ||
          providerResponse.error === 'NETWORK_ERROR'
        ) {
          console.log(`⚠️  Provider error - stopping batch processing`);
          hasMore = false;
          break;
        }

        // For other errors, throw and mark sync as failed
        throw new Error(providerResponse.message);
      }

      const submissions = providerResponse.data.submissions || [];
      const batchSize = submissions.length;

      if (batchSize === 0) {
        console.log(`   ✨ No more submissions - end of results`);
        hasMore = false;
        break;
      }

      console.log(`   ✅ Received ${batchSize} submissions`);

      // Process and insert batch
      const batchResults = await processBatch(
        syncJobId,
        userId,
        submissions,
        batchNum
      );

      totalProcessed += batchResults.processed;

      // Update sync job progress
      const updatedJob = await SyncJob.findById(syncJobId);
      await SyncJob.findByIdAndUpdate(syncJobId, {
        'progress.batchesProcessed': batchNum,
        'progress.processed':
          updatedJob.progress.processed + batchResults.processed,
        'progress.inserted':
          updatedJob.progress.inserted + batchResults.inserted,
        'progress.duplicates':
          updatedJob.progress.duplicates + batchResults.duplicates,
        'progress.failed':
          updatedJob.progress.failed + batchResults.failed,
        'metadata.lastBatchSize': batchSize,
        'metadata.lastBatchSkip': skip,
        'metadata.lastBatchAt': new Date()
      });

      console.log(`   📊 Progress:`, {
        inserted: batchResults.inserted,
        duplicates: batchResults.duplicates,
        failed: batchResults.failed
      });

      // Check if we got fewer items than requested (pagination end)
      if (batchSize < BATCH_SIZE) {
        console.log(
          `   ✨ Received ${batchSize} < ${BATCH_SIZE} - end of results`
        );
        hasMore = false;
        break;
      }

      // Move to next batch
      skip += BATCH_SIZE;
      batchNum++;

      // Rate limiting - be nice to provider
      console.log(`   ⏳ Waiting ${BATCH_DELAY}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));

    } catch (error) {
      console.error(`❌ Batch ${batchNum} failed: ${error.message}`);
      throw error;
    }
  }

  console.log(`\n📊 SYNC STATISTICS:`);
  console.log(`   Total batches: ${batchNum - 1}`);
  console.log(`   Total processed: ${totalProcessed}`);
}

/**
 * Process single batch: normalize, deduplicate, insert
 *
 * DEDUPLICATION STRATEGY:
 * - MongoDB unique index on (userId, titleSlug)
 * - Check existing before insert
 * - Never delete problems (preserve history)
 * - If duplicate: skip insert, increment duplicates counter
 *
 * @param {string} syncJobId - SyncJob document ID
 * @param {string} userId - MongoDB user ID
 * @param {Array} submissions - Raw submissions from provider
 * @param {number} batchNum - Which batch number this is
 * @returns {Promise<Object>} { processed, inserted, duplicates, failed }
 */
async function processBatch(syncJobId, userId, submissions, batchNum) {
  console.log(`   🔄 Processing ${submissions.length} submissions...`);

  let inserted = 0;
  let duplicates = 0;
  let failed = 0;
  let processed = 0;

  for (const submission of submissions) {
    try {
      // Normalize submission to problem document
      const normalized = normalizeAcceptedProblems([submission], userId);

      if (!normalized || normalized.length === 0) {
        console.warn(`      ⚠️  Could not normalize submission:`, submission);
        failed++;
        continue;
      }

      processed++;

      const problemDoc = normalized[0];

      // Check if already exists (deduplication)
      const existing = await Problem.findOne({
        userId: userId,
        titleSlug: problemDoc.titleSlug
      });

      if (existing) {
        duplicates++;
        continue; // Skip - already have this problem
      }

      // Insert new problem
      await Problem.create(problemDoc);
      inserted++;

    } catch (error) {
      console.warn(`      ❌ Error processing submission:`, error.message);
      failed++;
    }
  }

  return {
    processed,
    inserted,
    duplicates,
    failed
  };
}

export default {
  startBackgroundSync,
  processBatchesUntilComplete,
  processBatch
};
