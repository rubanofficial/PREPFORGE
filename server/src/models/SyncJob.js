import mongoose from 'mongoose';

/**
 * SYNC JOB MODEL
 * 
 * Tracks background LeetCode sync jobs.
 * 
 * WHY THIS MODEL EXISTS:
 * 1. ASYNC TRACKING: Background jobs need persistent state
 * 2. PROGRESS UPDATES: UI can poll status without blocking
 * 3. HISTORY: Audit trail of what was synced
 * 4. FAILURE RECOVERY: Can retry failed syncs
 * 5. SCALABILITY: Foundation for queue systems (BullMQ, RabbitMQ)
 * 
 * LIFECYCLE:
 * - Created: pending (user clicks sync)
 * - Processing: active (batches being fetched)
 * - Completed: completed (all batches done)
 * - Failed: failed (error occurred)
 */

const syncJobSchema = new mongoose.Schema({
    // User who triggered the sync
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // LeetCode username being synced
    username: {
        type: String,
        required: true,
        lowercase: true
    },

    // Status tracking
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'failed'],
        default: 'pending',
        index: true
    },

    // Error details (if failed)
    error: {
        message: String,
        code: String,
        timestamp: Date
    },

    // Progress metrics
    progress: {
        // How many items we expect (from initial stats fetch)
        totalExpected: {
            type: Number,
            default: 0
        },

        // Batches processed so far
        batchesProcessed: {
            type: Number,
            default: 0
        },

        // Total problems fetched from provider
        processed: {
            type: Number,
            default: 0
        },

        // Problems inserted into MongoDB
        inserted: {
            type: Number,
            default: 0
        },

        // Problems already existed (duplicates)
        duplicates: {
            type: Number,
            default: 0
        },

        // Problems that failed to process
        failed: {
            type: Number,
            default: 0
        }
    },

    // Timestamps
    startedAt: {
        type: Date,
        default: Date.now
    },

    completedAt: {
        type: Date,
        default: null
    },

    // Metadata for debugging
    metadata: {
        // Last batch info
        lastBatchSize: Number,
        lastBatchSkip: Number,
        lastBatchAt: Date,

        // Provider responses
        providerVersion: String,
        apiEndpoint: String
    }
}, { timestamps: true });

// Indexes for efficient queries
syncJobSchema.index({ userId: 1, createdAt: -1 });
syncJobSchema.index({ status: 1, createdAt: -1 });
syncJobSchema.index({ userId: 1, status: 1 });

export default mongoose.model('SyncJob', syncJobSchema);
