import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import { fileURLToPath } from 'url'
import path from 'path'
import connectDB from './config/database.js'
import authRoutes from './routes/authRoutes.js'
import leetcodeRoutes from './routes/leetcodeRoutes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config()

const app = express()
const httpServer = createServer(app)
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : null

console.log('🔐 CORS Allowed Origins:', allowedOrigins || 'ALL')

const io = new SocketServer(httpServer, {
    cors: {
        origin: allowedOrigins || true,
        credentials: true,
    },
})

// Middleware
app.use(cors({
    origin: allowedOrigins || true,
    credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    next()
})

// Connect Database
await connectDB()

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' })
})

// Auth routes - MUST be before static middleware
app.use('/api/auth', authRoutes)

// LeetCode routes - MUST be before static middleware
app.use('/api/leetcode', leetcodeRoutes)


// Socket.io connection
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`)

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`)
    })
})

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('===== ERROR OCCURRED =====')
    console.error('Endpoint:', req.method, req.path)
    console.error('Error Message:', err.message)
    console.error('Error Stack:', err.stack)
    console.error('===== END ERROR =====')

    const statusCode = err.statusCode || 500
    const message = err.message || 'Something went wrong!'

    res.status(statusCode).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? err.message : {},
    })
})

const PORT = process.env.PORT || 5000

const server = httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`📡 Socket.io server active`)
})

// Handle server listen errors (e.g., EADDRINUSE) to log and exit
server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Exiting.`)
        // Exit so process manager (nodemon) can restart cleanly
        process.exit(1)
    }
    console.error('Server error:', err)
})

// Graceful shutdown handling for nodemon restarts
const gracefulShutdown = () => {
    console.log('⚠️  Shutting down gracefully...')
    server.close(() => {
        console.log('✅ Server closed')
        process.exit(0)
    })

    // Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
        console.error('❌ Forced shutdown after 10 seconds')
        process.exit(1)
    }, 10000)
}

// Nodemon sends SIGUSR2 on restart — ensure we close the server first so the
// port is freed before nodemon spawns the new process. Use once to avoid loops.
process.once('SIGUSR2', () => {
    console.log('SIGUSR2 received: nodemon restart requested')
    server.close(() => {
        console.log('Server closed for nodemon restart')
        process.kill(process.pid, 'SIGUSR2')
    })
})

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

export { app, io }
