import User from '../models/User.js'
import { generateToken } from '../utils/jwt.js'
import { asyncHandler, AppError } from '../utils/errorHandler.js'

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req, res, next) => {
    const { name, email, username, password, passwordConfirm } = req.body
    
    console.log('=== REGISTER REQUEST ===')
    console.log('Body:', { name, email, username, passwordConfirm: passwordConfirm ? '***' : undefined })

    // Validate input
    if (!name || !email || !username || !password || !passwordConfirm) {
        console.log('Missing fields:', { name, email, username, password: !!password, passwordConfirm })
        return next(new AppError('Please provide all required fields', 400))
    }

    // Validate username format
    if (username.length < 3 || username.length > 30) {
        console.log('Invalid username length:', username.length)
        return next(new AppError('Username must be between 3 and 30 characters', 400))
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        console.log('Invalid username format:', username)
        return next(new AppError('Username can only contain letters, numbers, underscore, and dash', 400))
    }

    // Check if passwords match
    if (password !== passwordConfirm) {
        console.log('Passwords do not match')
        return next(new AppError('Passwords do not match', 400))
    }

    // Check if user already exists by email
    let user = await User.findOne({ email: email.toLowerCase() })
    if (user) {
        console.log('User already exists with email:', email)
        return next(new AppError('User already exists with that email', 409))
    }

    // Check if username is already taken
    user = await User.findOne({ username: username.toLowerCase() })
    if (user) {
        console.log('Username already taken:', username)
        return next(new AppError('Username is already taken', 409))
    }

    // Create new user
    user = await User.create({
        name,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password,
    })
    
    console.log('User created successfully:', user._id)

    // Generate JWT token
    const token = generateToken(user._id)

    // Send response
    res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
            userId: user._id,
            name: user.name,
            email: user.email,
            username: user.username,
            token,
        },
    })
    
    console.log('=== REGISTER SUCCESS ===')
})

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res, next) => {
    const { email, username, password } = req.body

    // Validate that either email or username is provided
    if ((!email && !username) || !password) {
        return next(new AppError('Please provide email or username and password', 400))
    }

    // Build search query - can login with EITHER email OR username
    let searchQuery = {}

    if (email && username) {
        // If both provided, search for either one
        searchQuery = {
            $or: [
                { email: email.toLowerCase() },
                { username: username.toLowerCase() }
            ]
        }
    } else if (email) {
        // Only email provided
        searchQuery = { email: email.toLowerCase() }
    } else if (username) {
        // Only username provided
        searchQuery = { username: username.toLowerCase() }
    }

    // Find user and include password field (normally excluded)
    const user = await User.findOne(searchQuery).select('+password')

    // Check if user exists
    if (!user) {
        const loginMethod = email ? `email "${email}"` : `username "${username}"`
        return next(new AppError(`No account found with ${loginMethod}`, 401))
    }

    // Check if password matches
    const isPasswordCorrect = await user.matchPassword(password)
    if (!isPasswordCorrect) {
        return next(new AppError('Password is incorrect', 401))
    }

    // Generate JWT token
    const token = generateToken(user._id)

    // Send response
    res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
            userId: user._id,
            name: user.name,
            email: user.email,
            username: user.username,
            token,
        },
    })
})

// @desc    Get current logged-in user profile
// @route   GET /api/auth/profile
// @access  Private (requires valid JWT token)
export const getProfile = asyncHandler(async (req, res, next) => {
    // req.user is set by authMiddleware
    const user = await User.findById(req.user.userId)

    if (!user) {
        return next(new AppError('User not found', 404))
    }

    res.status(200).json({
        success: true,
        data: {
            userId: user._id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
        },
    })
})

// @desc    Logout user (frontend removes token from localStorage)
// @route   POST /api/auth/logout
// @access  Private
export const logout = asyncHandler(async (req, res, next) => {
    // With JWT, logout is handled on frontend by removing token
    // Backend just confirms logout
    res.status(200).json({
        success: true,
        message: 'Logout successful',
    })
})

// @desc    DEBUG ONLY - List all users in database
// @route   GET /api/auth/debug/users
// @access  Public (remove this in production!)
export const debugListUsers = asyncHandler(async (req, res, next) => {
    const users = await User.find().select('-password')

    res.status(200).json({
        success: true,
        message: 'All users in database',
        count: users.length,
        data: users.map(user => ({
            _id: user._id,
            name: user.name,
            email: user.email,
            username: user.username,
            createdAt: user.createdAt
        }))
    })
})
