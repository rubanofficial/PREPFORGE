import mongoose from 'mongoose';

const problemSchema = new mongoose.Schema({
    // Core problem information
    title: {
        type: String,
        required: true,
        index: true
    },
    titleSlug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    questionId: {
        type: String,
        sparse: true
    },

    // Platform identifier
    platform: {
        type: String,
        default: 'leetcode',
        enum: ['leetcode', 'codeforces', 'hackerrank']
    },

    // Difficulty classification
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        required: true,
        index: true
    },

    // When the user solved it
    solvedAt: {
        type: Date,
        required: true,
        index: true
    },

    // Owner of the submission
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Topic/Category classification
    topics: [{
        type: String,
        lowercase: true
    }],

    // Data structure/Algorithm pattern (for future recommendation engine)
    pattern: [{
        type: String,
        lowercase: true
    }],

    // Metadata
    submissionId: {
        type: String,
        sparse: true
    },
    language: {
        type: String,
        default: null
    },

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

// Index for common queries
problemSchema.index({ userId: 1, solvedAt: -1 });
problemSchema.index({ userId: 1, difficulty: 1 });
problemSchema.index({ userId: 1, topics: 1 });

export default mongoose.model('Problem', problemSchema);
