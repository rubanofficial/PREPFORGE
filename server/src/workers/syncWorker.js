import { Worker } from 'bullmq';
import redisConnection from '../config/redis.js';
import backgroundSyncService from '../services/sync/backgroundSyncService.js';
import deepSyncService from '../services/sync/deepSyncService.js';
import SyncJob from '../models/SyncJob.js';
import User from '../models/User.js';

/**
 * SYNC WORKER — CONSUMER SIDE
 *
 * ============================================================================
 * WHAT THIS FILE DOES
 * ============================================================================
 * Listens to the 'sync' BullMQ queue and processes jobs. When a job arrives:
 *
 *   1. Resets SyncJob to 'pending' if this is a retry
 *   2. Calls startBackgroundSync() or performDeepSync() (your existing code)
 *   3. If successful → BullMQ marks job completed
 *   4. If failed     → BullMQ retries (up to 3 times with exponential backoff)
 *   5. If all retries exhausted → job stays 'failed' in both Redis + SyncJob
 *
 * ============================================================================
 * WHY THE WORKER IS SEPARATE FROM THE QUEUE
 * ============================================================================
 * - Queue  (syncQueue.js):  Producer side — just adds jobs
 * - Worker (this file):     Consumer side — processes jobs
 * - They could run in different processes/containers later
 * - For now they live in the same process, sharing the Redis connection
 *
 * ============================================================================
 * RETRY BEHAVIOR
 * ============================================================================
 * BullMQ re-queues the job automatically when the processor throws.
 * The Queue config (syncQueue.js) defines:
 *   - attempts: 3              → 3 total tries (1 initial + 2 retries)
 *   - backoff: { type: 'exponential', delay: 5000 } → waits 5s → 10s → 20s
 *
 * On retry, this worker resets SyncJob.status back to 'pending' so the
 * sync service can re-run cleanly.
 * ============================================================================
 */

let workerInstance = null;

/**
 * Start the BullMQ sync worker.
 *
 * Call this once at server startup (from server.js).
 * The worker runs forever until closeSyncWorker() is called.
 *
 * @returns {Worker} The BullMQ Worker instance
 */
export function startSyncWorker() {
  if (workerInstance) {
    console.log('⚠️  Sync Worker: Already running, skipping duplicate start');
    return workerInstance;
  }

  console.log('🚀 Sync Worker: Starting...');

  workerInstance = new Worker(
    'sync',                    // Queue name — must match syncQueue.js
    async (job) => {           // Processor function
      const {
        syncJobId,
        username,
        userId,
        lastSolvedCount = 0,
        syncMode = 'full',
        syncType = 'delta',    // 'delta' or 'deep'
      } = job.data;

      // ── RETRY: Reset SyncJob to 'pending' if this is a re-run ──────────
      if (job.attemptsMade > 0) {
        console.log(`🔄 SYNC WORKER: Retry #${job.attemptsMade} for job ${syncJobId} — resetting SyncJob to pending`);
        await SyncJob.findByIdAndUpdate(syncJobId, {
          status: 'pending',
          $unset: { error: '' },
        });
      }

      console.log(`\n${'='.repeat(70)}`);
      console.log(`🔄 BULLMQ WORKER: Processing sync job`);
      console.log(`   SyncJob ID  : ${syncJobId}`);
      console.log(`   Username    : ${username}`);
      console.log(`   User ID     : ${userId}`);
      console.log(`   Sync Type   : ${syncType}`);
      console.log(`   Sync Mode   : ${syncMode}`);
      console.log(`   Attempt     : ${job.attemptsMade + 1}/${job.opts.attempts || 3}`);
      console.log(`${'='.repeat(70)}\n`);

      if (syncType === 'deep') {
        // ── DEEP SYNC: Requires encrypted session ────────────────────────
        const user = await User.findById(userId).select('encryptedLeetCodeSession');
        if (!user) {
          throw new Error(`User not found: ${userId}`);
        }
        if (!user.encryptedLeetCodeSession) {
          throw new Error(`No encrypted session found for user ${userId}. Please store session first.`);
        }

        const result = await deepSyncService.performDeepSync(
          userId.toString(),
          user.encryptedLeetCodeSession,
          syncJobId
        );

        if (!result) {
          throw new Error('Deep sync returned null — check logs for details');
        }

        return result;
      } else {
        // ── DELTA SYNC: Uses public LeetCode API ─────────────────────────
        await backgroundSyncService.startBackgroundSync(
          syncJobId,
          username,
          userId,
          lastSolvedCount,
          syncMode
        );

        return { success: true, syncJobId };
      }
    },
    {
      // Worker configuration
      connection: redisConnection,
      concurrency: 3,            // Process up to 3 syncs simultaneously
      lockDuration: 30000,       // 30s lock — job can't be stolen if still processing
      stalledInterval: 15000,    // Check every 15s for stalled jobs
      maxStalledCount: 2,       // After 2 stalls, mark as failed
    }
  );

  // ── WORKER EVENTS ──────────────────────────────────────────────────────

  workerInstance.on('completed', (job, returnValue) => {
    console.log(`\n✅ BULLMQ WORKER: Job ${job.id} completed successfully`);
    console.log(`   SyncJob ID: ${job.data.syncJobId}`);
    if (returnValue?.metrics) {
      console.log(`   Metrics:`, returnValue.metrics);
    }
    console.log('');
  });

  workerInstance.on('failed', async (job, error) => {
    console.error(`\n❌ BULLMQ WORKER: Job ${job.id} failed after ${job.attemptsMade} attempts`);
    console.error(`   SyncJob ID: ${job.data.syncJobId}`);
    console.error(`   Error     : ${error.message}`);

    // ── FINAL FAILURE: All retries exhausted ─────────────────────────────
    // Mark SyncJob as failed if it was a final failure (all retries used up).
    // The sync service already marks it on first failure, but on subsequent
    // retries the status gets reset to 'pending'. This ensures it ends as 'failed'.
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      console.error(`   ➜ Final failure — all ${job.opts.attempts || 3} attempts exhausted`);
      try {
        await SyncJob.findByIdAndUpdate(job.data.syncJobId, {
          status: 'failed',
          error: {
            message: error.message,
            code: error.code || 'WORKER_EXHAUSTED',
            timestamp: new Date(),
          },
        });
      } catch (dbError) {
        console.error(`   ❌ Could not update SyncJob: ${dbError.message}`);
      }
    }

    console.error('');
  });

  workerInstance.on('active', (job) => {
    console.log(`   ▶ Worker started processing job ${job.id} (SyncJob: ${job.data.syncJobId})`);
  });

  workerInstance.on('error', (err) => {
    console.error('❌ SYNC WORKER: Unexpected error:', err.message);
  });

  console.log('✅ Sync Worker: Started and listening for jobs');
  return workerInstance;
}

/**
 * Gracefully shut down the worker.
 * Call this during server shutdown to complete in-progress jobs.
 */
export async function closeSyncWorker() {
  if (workerInstance) {
    console.log('🛑 Sync Worker: Closing...');
    await workerInstance.close();
    workerInstance = null;
    console.log('✅ Sync Worker: Closed');
  }
}
