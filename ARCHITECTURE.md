# PrepForge Pro - Architecture Documentation

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                    (React + Vite + Tailwind)                    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   React Application                      │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │   Pages     │  │  Components  │  │   Layouts    │   │  │
│  │  │  (Routes)   │  │  (Reusable)  │  │  (Structure) │   │  │
│  │  └─────────────┘  └──────────────┘  └──────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │          Redux Store (Global State)             │   │  │
│  │  │  - Auth State    - User Preferences            │   │  │
│  │  │  - App Settings  - Cache                       │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌──────────────┐        ┌─────────────────────────┐   │  │
│  │  │ API Client   │        │   Socket.io Client      │   │  │
│  │  │ (Axios)      │        │   (Real-time)           │   │  │
│  │  │ + Intercept  │        │                         │   │  │
│  │  └──────────────┘        └─────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓ (HTTP/REST)
                           ↕ (Socket.io)
┌─────────────────────────────────────────────────────────────────┐
│                       SERVER LAYER                              │
│                   (Express.js + Node.js)                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              API Routes & Endpoints                      │  │
│  │  ├─ /api/auth          (Authentication)                 │  │
│  │  ├─ /api/problems      (Problem Tracking)               │  │
│  │  ├─ /api/dashboard     (Analytics)                      │  │
│  │  ├─ /api/recommendations (Smart Recommendations)        │  │
│  │  └─ /api/study-rooms   (Collaboration)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Middleware Layer                            │  │
│  │  ├─ Authentication (JWT Verification)                   │  │
│  │  ├─ Input Validation (Express Validator)                │  │
│  │  ├─ Error Handling (Custom Error Handler)               │  │
│  │  └─ CORS (Cross-Origin Resource Sharing)                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Controllers (Business Logic)                │  │
│  │  ├─ authController     (Handle auth requests)           │  │
│  │  ├─ problemController  (Handle problem requests)        │  │
│  │  └─ dashboardController (Handle dashboard requests)     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Services (Database Operations)                │  │
│  │  ├─ userService        (User DB operations)             │  │
│  │  ├─ problemService     (Problem DB operations)          │  │
│  │  └─ analyticsService   (Analytics calculations)         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Socket.io Server (Real-time Events)            │  │
│  │  ├─ joinStudyRoom                                        │  │
│  │  ├─ userTyping                                           │  │
│  │  ├─ problemSolved                                        │  │
│  │  └─ notificationUpdate                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓ (Mongoose)
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                             │
│                     (MongoDB + Mongoose)                        │
│                                                                 │
│  Collections (Models):                                          │
│  ├─ users           (User accounts & credentials)               │
│  ├─ problems        (DSA problems solved)                       │
│  ├─ submissions     (Problem submissions)                       │
│  ├─ studyRooms      (Collaborative study sessions)              │
│  ├─ recommendations (AI-generated suggestions)                  │
│  └─ analytics       (User analytics data)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### Request Flow (User Action → Database)

```
1. User Action (Click, Submit)
        ↓
2. React Component dispatches Redux action
        ↓
3. Redux Middleware (if needed)
        ↓
4. React Component calls apiClient.get/post/put/delete()
        ↓
5. Axios Request Interceptor adds JWT token
        ↓
6. HTTP Request sent to Express Server
        ↓
7. Express Route Handler (in routes/)
        ↓
8. Middleware Processing (auth verification, validation)
        ↓
9. Controller receives request & calls Service
        ↓
10. Service queries/updates MongoDB
        ↓
11. Mongoose executes database operation
        ↓
12. Result returned through layers
        ↓
13. Controller formats response
        ↓
14. Express sends HTTP Response
        ↓
15. Axios Response Interceptor processes response
        ↓
16. Redux Dispatch with response data
        ↓
17. React Component re-renders with new data
```

---

## Request Handler Example

### Frontend to Backend Flow

**Frontend (React Component):**
```javascript
// Step 1: Component makes API call
import apiClient from '@/services/apiClient'
import { useDispatch } from 'react-redux'

function ProblemList() {
  const dispatch = useDispatch()
  
  // Step 2: Call API
  const fetchProblems = async () => {
    try {
      const response = await apiClient.get('/problems')
      // Step 3: Dispatch to Redux
      dispatch(setProblems(response.data))
    } catch (error) {
      console.error(error)
    }
  }
}
```

**Backend (Express Handler):**
```javascript
// Step 1: Route receives request
router.get('/problems', protect, getProblemsList)

// Step 2: Middleware runs (protect middleware verifies JWT)
export const protect = (req, res, next) => {
  // Verify JWT token
  req.user = verifyToken(token)
  next()
}

// Step 3: Controller handles request
export const getProblemsList = async (req, res) => {
  try {
    // Step 4: Call Service layer
    const problems = await problemService.getUserProblems(req.user.id)
    
    // Step 5: Return response
    res.json({ success: true, data: problems })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// Step 4: Service queries database
export const getUserProblems = async (userId) => {
  // Query MongoDB via Mongoose
  return await Problem.find({ userId }).sort({ createdAt: -1 })
}
```

**Frontend Receives Response:**
```javascript
// Step 5: Redux receives data
const problemsSlice = createSlice({
  name: 'problems',
  initialState: { list: [] },
  reducers: {
    setProblems: (state, action) => {
      state.list = action.payload
    }
  }
})

// Step 6: Component re-renders with new data
function ProblemList() {
  const problems = useSelector(state => state.problems.list)
  return <div>{problems.map(p => <p key={p.id}>{p.name}</p>)}</div>
}
```

---

## File Organization Principles

### Frontend Organization
```
By Feature (Feature-First):
features/
├── auth/
│   ├── components/
│   ├── slice.js (Redux)
│   └── authAPI.js
├── problems/
│   ├── components/
│   ├── slice.js
│   └── problemsAPI.js
└── dashboard/
    ├── components/
    ├── slice.js
    └── dashboardAPI.js

Shared:
components/    → Reusable UI components
hooks/         → Custom hooks
utils/         → Helper functions
services/      → API client setup
```

### Backend Organization
```
By Responsibility (Layer-First):
routes/        → Define endpoints
controllers/   → Handle requests
services/      → Business logic
models/        → Database schemas
middleware/    → Pre/post processing
validators/    → Input validation
utils/         → Helpers
```

---

## Environment Variables Explanation

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api
  ↳ Base URL for all API requests (used in apiClient.js)

VITE_SOCKET_URL=http://localhost:5000
  ↳ Socket.io server URL for real-time connections
```

### Backend (.env)
```
MONGODB_URI=mongodb://localhost:27017/prepforge
  ↳ MongoDB connection string
  ↳ Format: mongodb://host:port/database

JWT_SECRET=your_secret_key
  ↳ Secret key for signing JWT tokens
  ↳ Change in production!

JWT_EXPIRE=7d
  ↳ Token expiration time (7 days)

NODE_ENV=development
  ↳ Environment (development, production, testing)

PORT=5000
  ↳ Server port

CORS_ORIGIN=http://localhost:5173
  ↳ Frontend URL allowed to make requests
  ↳ In production, change to your domain
```

---

## Security Architecture

### Authentication Flow
```
1. User enters credentials
        ↓
2. Frontend sends to /auth/login
        ↓
3. Backend verifies password with bcryptjs.compare()
        ↓
4. If valid, generate JWT token with user ID
        ↓
5. Send token to frontend
        ↓
6. Frontend stores token in localStorage
        ↓
7. Every request includes token in Authorization header
        ↓
8. Backend middleware verifies token
        ↓
9. If valid, attach user to request
        ↓
10. Proceed to controller
```

### Token Format
```
Header:    Authorization: Bearer <token>

Token contains:
{
  "userId": "507f1f77bcf86cd799439011",
  "iat": 1671234567,           // issued at
  "exp": 1671839367            // expires at
}
```

---

## Scaling Considerations

### Current (Phase 1)
- ✅ Monolithic structure
- ✅ Simple REST API
- ✅ Single database

### Future Improvements
- Microservices separation
- API Gateway
- Database replication
- Redis caching
- Message queues (Bull)
- CDN for static assets
- Load balancing

---

## Development Best Practices

### Frontend
1. ✅ Always use `apiClient` for API calls
2. ✅ Redux for global state only
3. ✅ Component names are PascalCase
4. ✅ Use custom hooks for logic reuse
5. ✅ Prop types for component contracts

### Backend
1. ✅ Always use `asyncHandler` for controllers
2. ✅ Never return passwords or sensitive data
3. ✅ Validate all inputs
4. ✅ Use meaningful error messages
5. ✅ Log important events

---

**This architecture supports all 11 phases of PrepForge Pro development!**
