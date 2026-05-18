import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import connectDB from './src/config/database.js'

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

// Basic routes (will be expanded in next phases)
app.use('/api/auth', (req, res) => {
    res.json({ message: 'Auth routes coming soon' })
})

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
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : {},
    })
})

const PORT = process.env.PORT || 5000

httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`📡 Socket.io server active`)
})

export { app, io }
