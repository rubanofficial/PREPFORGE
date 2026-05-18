import User from '../models/User.js'
import { generateToken } from '../utils/jwt.js'
import { asyncHandler, AppError } from '../utils/errorHandler.js'

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req, res, next) => {
    const { name, email, password, passwordConfirm } = req.body

    // Validate input
    if (!name || !email || !password || !passwordConfirm) {
        return next(new AppError('Please provide all required fields', 400))
    }

    // Check if passwords match
    if (password !== passwordConfirm) {
        return next(new AppError('Passwords do not match', 400))
    }

    // Check if user already exists
    let user = await User.findOne({ email })
    if (user) {
        return next(new AppError('User already exists with that email', 409))
    }

    // Create new user
    user = await User.create({
        name,
        email,
        password,
    })

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
            token,
        },
    })
})

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body

    // Validate input
    if (!email || !password) {
        return next(new AppError('Please provide email and password', 400))
    }

    // Find user and include password field (normally excluded)
    const user = await User.findOne({ email }).select('+password')

    // Check if user exists
    if (!user) {
        return next(new AppError('Invalid email or password', 401))
    }

    // Check if password matches
    const isPasswordCorrect = await user.matchPassword(password)
    if (!isPasswordCorrect) {
        return next(new AppError('Invalid email or password', 401))
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
