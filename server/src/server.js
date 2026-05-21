import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import connectDB from './config/database.js'
import authRoutes from './routes/authRoutes.js'
import leetcodeRoutes from './routes/leetcodeRoutes.js'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const io = new SocketServer(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        credentials: true,
    },
})

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}))
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

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`)
    })
})

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack)

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

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

export { app, io }
