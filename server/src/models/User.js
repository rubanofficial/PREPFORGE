import mongoose from 'mongoose'
import bcryptjs from 'bcryptjs'

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please provide a name'],
            trim: true,
            maxlength: [50, 'Name cannot exceed 50 characters'],
        },
        username: {
            type: String,
            required: [true, 'Please provide a username'],
            unique: true,
            lowercase: true,
            trim: true,
            minlength: [3, 'Username must be at least 3 characters'],
            maxlength: [30, 'Username cannot exceed 30 characters'],
            match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore, and dash'],
        },
        email: {
            type: String,
            required: [true, 'Please provide an email'],
            unique: true,
            lowercase: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                'Please provide a valid email address',
            ],
        },
        password: {
            type: String,
            required: [true, 'Please provide a password'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false, // Don't return password by default
        },
        // ===== LEETCODE INTEGRATION =====
        // Optional: User's LeetCode username for authenticated syncing
        leetcodeUsername: {
            type: String,
            trim: true,
            lowercase: true,
            sparse: true, // Allow multiple null values
        },
        // Encrypted LEETCODE_SESSION cookie for authenticated API access
        // Never returned in API responses
        // Only used for background sync operations
        encryptedLeetCodeSession: {
            type: String,
            select: false, // Never return this by default
            sparse: true,
        },
        // Timestamp when session was last synced
        lastLeetcodeSyncAt: {
            type: Date,
            default: null,
        },
        // Number of solved problems recorded at the last successful sync.
        // Used to compute the delta: currentSolvedCount - lastSolvedCount = newProblems
        lastSolvedCount: {
            type: Number,
            default: 0,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
)

// Hash password before saving to database
userSchema.pre('save', async function (next) {
    // Only hash if password is modified
    if (!this.isModified('password')) return next()

    try {
        // Generate salt for hashing
        const salt = await bcryptjs.genSalt(10)
        // Hash password with salt
        this.password = await bcryptjs.hash(this.password, salt)
        next()
    } catch (error) {
        next(error)
    }
})

// Method to compare passwords during login
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcryptjs.compare(enteredPassword, this.password)
}

export default mongoose.model('User', userSchema)
