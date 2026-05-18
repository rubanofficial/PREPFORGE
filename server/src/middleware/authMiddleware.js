import { verifyToken } from '../utils/jwt.js'
import { AppError } from '../utils/errorHandler.js'

// Middleware to verify JWT token and protect routes
export const protect = (req, res, next) => {
    try {
        // Get token from Authorization header
        // Expected format: "Bearer <token>"
        const authHeader = req.headers.authorization

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AppError('No token provided. Please login', 401))
        }

        // Extract token from "Bearer <token>"
        const token = authHeader.slice(7)

        // Verify token
        const decoded = verifyToken(token)

        // Attach user info to request object
        req.user = decoded

        next()
    } catch (error) {
        // Token is invalid or expired
        return next(new AppError('Invalid or expired token', 401))
    }
}

// Optional: Middleware to check if user is admin (for future use)
export const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('User not authenticated', 401))
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(new AppError('Not authorized to access this route', 403))
        }

        next()
    }
}
