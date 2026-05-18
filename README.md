# PrepForge Pro - Placement Preparation Platform

## 📋 Project Overview

PrepForge Pro is a full-stack MERN application designed to help students prepare for placements by tracking DSA problems, analyzing weak topics, receiving smart recommendations, and more.

---

## 🏗️ Project Structure

### Root Structure
```
PREPFORGE/
├── client/          # React + Vite frontend
├── server/          # Express + Node.js backend
└── README.md
```

### Frontend Structure (`client/src/`)
```
src/
├── api/             # API endpoints definitions & constants
├── app/             # Redux store & main App component
├── components/      # Reusable UI components
├── features/        # Feature-specific Redux slices
├── hooks/           # Custom React hooks
├── layouts/         # Layout components (Navbar, Sidebar, etc)
├── pages/           # Page components (HomePage, Dashboard, etc)
├── routes/          # Routing configuration
├── services/        # API service layer (apiClient, socket)
├── utils/           # Utility functions (validation, date, etc)
├── charts/          # Chart & graph components
├── index.css        # Global styles with Tailwind
└── main.jsx         # React entry point
```

### Backend Structure (`server/src/`)
```
src/
├── config/          # Database & environment configuration
├── controllers/     # Request handlers (business logic)
├── middleware/      # Express middleware (auth, validation, etc)
├── models/          # Mongoose schemas & models
├── routes/          # API route definitions
├── services/        # Business logic & database operations
├── sockets/         # Socket.io event handlers
├── utils/           # Utility functions (JWT, error handling)
├── validators/      # Input validation schemas
└── server.js        # Express server entry point
```

---

## 📦 Package Explanations

### Frontend (`client/package.json`)
| Package | Purpose |
|---------|---------|
| **react** | UI library |
| **vite** | Lightning-fast build tool & dev server |
| **react-router-dom** | Client-side routing |
| **@reduxjs/toolkit** | State management (simpler Redux) |
| **react-redux** | React bindings for Redux |
| **axios** | HTTP client for API calls |
| **@tanstack/react-query** | Server state management & caching |
| **recharts** | Charts & graphs for analytics |
| **socket.io-client** | Real-time communication |
| **tailwindcss** | Utility-first CSS framework |

### Backend (`server/package.json`)
| Package | Purpose |
|---------|---------|
| **express** | Web framework for REST APIs |
| **mongoose** | MongoDB object modeling |
| **jsonwebtoken** | JWT token generation & verification |
| **bcryptjs** | Password hashing & encryption |
| **dotenv** | Environment variable management |
| **socket.io** | Real-time bidirectional communication |
| **node-cron** | Task scheduling (revision reminders) |
| **cors** | Cross-Origin Resource Sharing |
| **express-validator** | Request validation middleware |
| **nodemon** | Auto-restart server on code changes |

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v18+)
- MongoDB (local or Atlas)
- npm or yarn

### Step 1: Frontend Setup

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Start development server (runs on http://localhost:5173)
npm run dev
```

**Environment Variables** (`client/.env`):
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### Step 2: Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env with your MongoDB connection string
# Example: MONGODB_URI=mongodb://localhost:27017/prepforge

# Start development server (runs on http://localhost:5000)
npm run dev
```

**Environment Variables** (`server/.env`):
```
MONGODB_URI=mongodb://localhost:27017/prepforge
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRE=7d
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

### Step 3: Run Both Simultaneously

**Terminal 1 (Backend):**
```bash
cd server
npm run dev
# Expected output: 🚀 Server running on port 5000
```

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
# Expected output: VITE v5.x.x ready in XX ms
```

**Test Health Check:**
```bash
curl http://localhost:5000/api/health
# Response: {"status": "Server is running"}
```

---

## 🔄 How Frontend & Backend Communicate

### 1. **REST API Communication**
```
Frontend (axios) → Backend (Express routes) → MongoDB
```

**Example Flow:**
```javascript
// Frontend: src/services/apiClient.js
apiClient.get('/problems')  // Calls: http://localhost:5000/api/problems

// Backend: src/routes/problems.js
router.get('/problems', getProblemsList)
```

### 2. **Real-Time Communication (Socket.io)**
```
Frontend (socket.io-client) ↔ Backend (socket.io) 
```

**Use Case:** Real-time study room updates, notifications
```javascript
// Frontend establishes connection
const socket = io(VITE_SOCKET_URL)
socket.emit('joinStudyRoom', roomId)

// Backend listens
socket.on('joinStudyRoom', (roomId) => {
  // Handle room join
})
```

### 3. **Request Flow Diagram**
```
┌─────────────────┐
│   React App     │
│   (Frontend)    │
└────────┬────────┘
         │ HTTP Request (Axios)
         ↓
┌─────────────────────────────────┐
│    Express Server               │
│  - Route Handler                │
│  - Middleware (Auth, Validate)  │
│  - Business Logic               │
└────────┬────────────────────────┘
         │ Query/Update
         ↓
┌─────────────────┐
│    MongoDB      │
│   Database      │
└─────────────────┘
```

---

## 🗂️ Why Each Folder Exists

### Frontend Folders

| Folder | Purpose |
|--------|---------|
| **api/** | Centralized API endpoint constants (no hardcoded URLs) |
| **app/** | Redux store & root App component |
| **components/** | Reusable UI widgets (Button, Card, Input, etc) |
| **features/** | Redux slices for different features (auth, problems) |
| **hooks/** | Custom React hooks (useAuth, useFetch, etc) |
| **layouts/** | Container components (Header, Sidebar, Footer) |
| **pages/** | Full page components (routable) |
| **routes/** | Route definitions & protection logic |
| **services/** | API client & Socket.io setup |
| **utils/** | Helper functions (date, validation, formatting) |
| **charts/** | Recharts components for analytics |

### Backend Folders

| Folder | Purpose |
|--------|---------|
| **config/** | Database connection, environment setup |
| **controllers/** | Request handlers (GET, POST, etc) |
| **middleware/** | Auth verification, input validation |
| **models/** | Mongoose schemas (User, Problem, etc) |
| **routes/** | API endpoints organization |
| **services/** | Database operations & business logic |
| **sockets/** | Real-time event handlers |
| **utils/** | JWT, error handling, constants |
| **validators/** | Express validator schemas |

---

## 🔐 Architecture Principles

### 1. **Separation of Concerns**
- Controllers: Handle HTTP requests
- Services: Business logic & DB operations
- Routes: Endpoint definitions
- Models: Data structure definitions

### 2. **Frontend Architecture**
- **Components**: Presentational (dumb) and Container (smart)
- **Redux**: Global state (auth, user, app settings)
- **Hooks**: Custom logic reuse
- **Services**: API abstraction layer

### 3. **Error Handling**
```javascript
// Backend: All errors go through middleware
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ error: err.message })
})

// Frontend: Axios interceptor handles 401 (unauthorized)
apiClient.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }
})
```

### 4. **Environment Security**
- Never commit `.env` files
- Use `.env.example` for reference
- Different secrets for dev/prod
- JWT secret changes in production

---

## 📝 Development Workflow

### Making API Changes

1. **Backend**: Add route in `src/routes/`
2. **Backend**: Add controller in `src/controllers/`
3. **Frontend**: Add endpoint constant in `src/api/endpoints.js`
4. **Frontend**: Call API via `apiClient` from services

### Adding New Features

1. **Create folder** in `features/` (e.g., `problems/`)
2. **Create Redux slice** in `features/problems/slice.js`
3. **Create components** in `components/`
4. **Create pages** in `pages/` if route-specific
5. **Add route** in `routes/`

---

## 🧪 Testing API Endpoints

### Using cURL
```bash
# Health check
curl http://localhost:5000/api/health

# You'll add auth, problems, etc in next phases
```

### Using Postman
1. Create new request
2. Set URL: `http://localhost:5000/api/...`
3. Add headers: `Authorization: Bearer {token}`
4. Send request

---

## ✅ Phase 1 Checklist

- [x] Folder structure created
- [x] Dependencies installed
- [x] Tailwind CSS configured
- [x] Express server setup
- [x] MongoDB connection ready
- [x] Environment variables configured
- [x] Nodemon for hot reload
- [x] React app structure
- [x] Redux store setup
- [x] API client with interceptors

---

## 🚧 Next Phase: Authentication

After confirming this setup works, Phase 2 will include:
- User registration & login
- JWT token generation
- Protected routes
- Password hashing with bcryptjs
- Redux auth slice

---

## 📚 Useful Commands

```bash
# Frontend
npm run dev       # Start dev server
npm run build     # Build for production
npm run preview   # Preview production build

# Backend
npm run dev       # Start with nodemon
npm start         # Start without nodemon
```

---

## 💡 Tips

1. **Always use `async/await`** - No callback hell
2. **Create components small** - Easier to test & reuse
3. **Keep services separate** - API logic away from components
4. **Use Redux for global state only** - Not every state needs Redux
5. **Comment only complex logic** - Self-documenting code is best

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Windows: Find process using port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>
```

### MongoDB Connection Failed
- Ensure MongoDB is running locally
- Check connection string in `.env`
- Verify database name is correct

### CORS Errors
- Check `CORS_ORIGIN` in backend `.env`
- Ensure frontend URL matches exactly
- Use `credentials: true` in axios requests

---

**Ready to build? Confirm this setup is working before moving to Phase 2: Authentication!**
