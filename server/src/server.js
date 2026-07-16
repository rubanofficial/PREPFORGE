import './config/env.js'  // MUST be first — loads .env before any other module reads process.env
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import connectDB from './config/database.js'
import authRoutes from './routes/authRoutes.js'
import leetcodeRoutes from './routes/leetcodeRoutes.js'
import { setIO } from './socketManager.js'
import { startSyncWorker } from './workers/syncWorker.js'

// dotenv.config() is now called in config/env.js (imported first above)

const app = express()
const httpServer = createServer(app)

// ── Trust Proxy ──────────────────────────────────────────────────────────
// Required when running behind a reverse proxy (Render, Nginx, etc.):
//   - Ensures req.ip reflects the true client IP (not the proxy's IP)
//   - Enables correct secure cookie behavior behind HTTPS proxies
//   - Used by express-rate-limit and helmet to derive accurate client info
app.set('trust proxy', 1)

// ── Security Headers (Helmet) ────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin for frontend
    contentSecurityPolicy: false, // Disabled for API server (handled by frontend if needed)
}))

// ── CORS Configuration ──────────────────────────────────────────────────
// Parse CORS origins from environment variable
const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:5173']

const corsOptions = {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200, // For legacy browser (IE11) + some Axios preflight compatibility
}

const io = new SocketServer(httpServer, {
    cors: corsOptions,
})

// Register io in socketManager so services can emit without circular imports
setIO(io)

// Middleware
app.use(cors(corsOptions))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Connect Database
await connectDB()

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' })
})

// Auth routes
app.use('/api/auth', authRoutes)

// LeetCode routes
app.use('/api/leetcode', leetcodeRoutes)

// Socket.io connection
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`)

    // Client emits this right after connecting so we can route sync events
    // to the correct user's private room (keyed by userId string).
    socket.on('join-user-room', (userId) => {
        if (userId && typeof userId === 'string') {
            socket.join(userId)
            console.log(`🔌 Socket ${socket.id} joined room: ${userId}`)
        }
    })

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`)
    })
})

// ── Global Error Handling Middleware ─────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${err.name}: ${err.message}`)
    if (process.env.NODE_ENV === 'development') {
        console.error(err.stack)
    }

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: Object.values(err.errors).map(e => e.message).join(', '),
            error: process.env.NODE_ENV === 'development' ? err.message : {},
        })
    }

    // Handle Mongoose duplicate key errors
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0]
        return res.status(409).json({
            success: false,
            message: `Duplicate value for ${field}. This ${field} is already taken.`,
            error: process.env.NODE_ENV === 'development' ? err.message : {},
        })
    }

    // Handle Mongoose cast errors (invalid ObjectId, etc.)
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: `Invalid ${err.path}: ${err.value}`,
            error: process.env.NODE_ENV === 'development' ? err.message : {},
        })
    }

    const statusCode = err.statusCode || 500
    const message = err.message || 'Something went wrong!'

    res.status(statusCode).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? err.message : {},
    })
})

const PORT = process.env.PORT || 5000

httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`📡 Socket.io server active`)
    console.log(`🔗 CORS origins: ${corsOrigins.join(', ')}`)

    // Start the BullMQ sync worker to process queued sync jobs
    startSyncWorker()
})

export { app, io }
