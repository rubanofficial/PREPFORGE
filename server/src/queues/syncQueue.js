import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';


const syncQueue = new Queue('sync', {
  connection: createRedisConnection('SyncQueue'),
  defaultJobOptions: {
    // Retry policy — handled at the queue level so every job gets it automatically
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s → 10s → 20s between retries
    },

    // Auto-cleanup to prevent Redis memory bloat
    removeOnComplete: {
      age: 3600 * 24,       // 1 day
      count: 100,           // Keep last 100 completed
    },
    removeOnFail: {
      age: 3600 * 24 * 7,  // 7 days
      count: 50,            // Keep last 50 failed
    },
  },
});

// ============================================================================
// QUEUE EVENTS (logging only)
// ============================================================================
syncQueue.on('error', (err) => {
  console.error('❌ Sync Queue Error:', err.message);
});

/**
 * Gracefully close the queue connection.
 * Call this during server shutdown to allow pending operations to complete.
 */
export async function closeSyncQueue() {
  console.log('📦 Sync Queue: Closing...');
  await syncQueue.close();
  console.log('✅ Sync Queue: Closed');
}

export default syncQueue;
