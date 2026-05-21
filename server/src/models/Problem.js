import mongoose from 'mongoose';

const problemSchema = new mongoose.Schema({
    // Problem identification
    title: {
        type: String,
        required: true
    },
    titleSlug: {
        type: String,
        required: true,
        lowercase: true
    },

    // Platform
    platform: {
        type: String,
        enum: ['leetcode', 'codeforces', 'hackerrank'],
        default: 'leetcode'
    },

    // Difficulty (optional - can be null initially, enriched later)
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard', null],
        default: null
    },

    // When user solved it
    solvedAt: {
        type: Date,
        required: true,
        index: true
    },

    // User ownership (reference)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Programming language used to solve (optional - can be enriched later)
    language: {
        type: String,
        lowercase: true,
        trim: true,
        sparse: true, // Allow null/undefined
    },

    // Topics (optional - can be enriched later)
    topics: [{
        type: String,
        lowercase: true
    }],

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Deduplication index: prevent same problem per user
// Unique combination of (userId, titleSlug)
problemSchema.index({ userId: 1, titleSlug: 1 }, { unique: true });

// Query optimization indexes
problemSchema.index({ userId: 1, solvedAt: -1 });
problemSchema.index({ userId: 1, difficulty: 1 });
problemSchema.index({ userId: 1, 'topics': 1 });

export default mongoose.model('Problem', problemSchema);
