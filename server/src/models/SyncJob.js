import mongoose from 'mongoose';


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

    // Sync mode: 'full' on first sync, 'incremental' on subsequent syncs
    syncMode: {
        type: String,
        enum: ['full', 'incremental'],
        default: 'full'
    },

    // Watermark timestamp used for incremental sync (null for full syncs)
    syncFrom: {
        type: Date,
        default: null
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
