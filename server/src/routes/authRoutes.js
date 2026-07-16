import express from 'express'
import {
    register,
    login,
    getProfile,
    logout,
    debugListUsers,
} from '../controllers/authController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

// Public routes
router.post('/register', register)
router.post('/login', login)

// Debug route — only available in non-production environments
// !!! Never expose user data via a public route in production !!!
if (process.env.NODE_ENV !== 'production') {
    router.get('/debug/users', debugListUsers)
}

// Protected routes
router.get('/profile', protect, getProfile)
router.post('/logout', protect, logout)

export default router
