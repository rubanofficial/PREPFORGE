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

// Parse CORS origins from environment variable
const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:5173']

const corsOptions = {
    origin: corsOrigins,
    credentials: true,
}

const io = new SocketServer(httpServer, {
    cors: corsOptions,
})

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

httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`📡 Socket.io server active`)
})

export { app, io }
