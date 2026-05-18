# 📚 Phase 2: Authentication Implementation - Complete Guide

## ✅ What Has Been Built

You now have a **production-ready authentication system** with:

### **4 Core Files Created**
1. ✅ `server/src/models/User.js` - User database schema
2. ✅ `server/src/controllers/authController.js` - Business logic
3. ✅ `server/src/routes/authRoutes.js` - API endpoints
4. ✅ `server/src/middleware/authMiddleware.js` - Route protection

### **3 API Endpoints**
- ✅ `POST /api/auth/register` - Create new account
- ✅ `POST /api/auth/login` - Get JWT token
- ✅ `GET /api/auth/profile` - Protected route (requires token)

### **Security Features**
- ✅ Password hashing with bcryptjs
- ✅ JWT token generation (7-day expiration)
- ✅ Bearer token authentication
- ✅ Middleware route protection
- ✅ Input validation
- ✅ Error handling

---

## 🚀 How to Run & Test

### **1. Start Backend**
```bash
cd server
npm run dev
```

**Expected output:**
```
🚀 Server running on port 5000
📡 Socket.io server active
MongoDB Connected: localhost
```

### **2. Run Test Commands**

**Test Register:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "Password123",
    "passwordConfirm": "Password123"
  }'
```

**Save the token from response, then test login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Password123"
  }'
```

**Test protected route (replace TOKEN with your token):**
```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🔐 Authentication System Architecture

### **Three-Layer Architecture**

```
┌─────────────────────────────────────┐
│  ROUTES LAYER                       │
│  /api/auth/register                 │
│  /api/auth/login                    │
│  /api/auth/profile                  │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│  CONTROLLER LAYER                   │
│  register()                         │
│  login()                            │
│  getProfile()                       │
│  logout()                           │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│  SERVICE/MODEL LAYER                │
│  User.create()                      │
│  User.findOne()                     │
│  bcryptjs.compare()                 │
│  jwt.sign()                         │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│  DATABASE LAYER                     │
│  MongoDB (via Mongoose)             │
└─────────────────────────────────────┘
```

---

## 📝 File Breakdown

### **1. User Model** (`server/src/models/User.js`)

**Purpose:** Define how user data is stored

**Fields:**
- `name` - User's full name
- `email` - Unique email (login identifier)
- `password` - Hashed password (NOT stored as plain text)
- `createdAt` - Account creation timestamp
- `updatedAt` - Last update timestamp

**Key Features:**
```javascript
// Automatic password hashing before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  const salt = await bcryptjs.genSalt(10)
  this.password = await bcryptjs.hash(this.password, salt)
  next()
})

// Method to verify password during login
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcryptjs.compare(enteredPassword, this.password)
}
```

---

### **2. Controller** (`server/src/controllers/authController.js`)

**Purpose:** Handle HTTP requests and business logic

**Functions:**

#### `register()`
```javascript
export const register = asyncHandler(async (req, res, next) => {
  // 1. Validate input
  // 2. Check if user exists
  // 3. Create user (password auto-hashed by model)
  // 4. Generate JWT token
  // 5. Send response
})
```

#### `login()`
```javascript
export const login = asyncHandler(async (req, res, next) => {
  // 1. Validate input
  // 2. Find user by email
  // 3. Compare passwords using bcryptjs
  // 4. If passwords match, generate JWT
  // 5. Send token
})
```

#### `getProfile()`
```javascript
export const getProfile = asyncHandler(async (req, res, next) => {
  // 1. Get userId from req.user (set by middleware)
  // 2. Find user in database
  // 3. Return user profile (without password)
})
```

---

### **3. Routes** (`server/src/routes/authRoutes.js`)

**Purpose:** Define API endpoints

```javascript
router.post('/register', register)           // Public
router.post('/login', login)                 // Public
router.get('/profile', protect, getProfile)  // Protected
router.post('/logout', protect, logout)      // Protected
```

**Note:** `protect` middleware runs before handler for protected routes

---

### **4. Middleware** (`server/src/middleware/authMiddleware.js`)

**Purpose:** Verify JWT tokens before allowing access

```javascript
export const protect = (req, res, next) => {
  // 1. Get Authorization header
  // 2. Extract token from "Bearer <token>"
  // 3. Verify token using JWT_SECRET
  // 4. Attach user data to request
  // 5. Call next() to continue to controller
  // OR return 401 error if invalid
}
```

---

## 🔄 Complete Request Lifecycle

### **Example: Login Request**

```
1. USER ACTION
   └─ Browser: POST /api/auth/login with { email, password }

2. NETWORK
   └─ HTTP request sent to http://localhost:5000/api/auth/login

3. ROUTE MATCHING
   └─ Express matches to: router.post('/login', login)

4. CONTROLLER EXECUTION
   ├─ Validate email & password provided
   ├─ Query: User.findOne({ email }).select('+password')
   ├─ Compare: bcryptjs.compare(password, stored_hash)
   └─ If valid:

5. TOKEN GENERATION
   ├─ Generate: jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
   └─ Result: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

6. RESPONSE
   └─ HTTP 200 with token, userId, email, name

7. FRONTEND
   ├─ Parse response
   ├─ Save token to localStorage
   └─ Ready for authenticated requests!
```

### **Example: Protected Route Request**

```
1. USER ACTION
   └─ Browser: GET /api/auth/profile with token in header

2. NETWORK
   └─ Request: Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

3. MIDDLEWARE EXECUTION (protect)
   ├─ Extract token: "eyJhbGciOiJIUzI1NiIs..."
   ├─ Verify: jwt.verify(token, JWT_SECRET)
   ├─ Extract: decoded = { userId, iat, exp }
   ├─ Attach: req.user = decoded
   └─ Call: next() to continue

4. CONTROLLER EXECUTION (getProfile)
   ├─ Access: req.user.userId from middleware
   ├─ Query: User.findById(req.user.userId)
   └─ Return: user profile

5. RESPONSE
   └─ HTTP 200 with user data

6. FRONTEND
   └─ Display user profile!
```

---

## 🛡️ Security Implementation

### **1. Password Security**

```
User enters:     "MyPassword123"
                 ↓
Bcryptjs + salt: "$2b$10$K1.aV5l5sxmRxQ1J2k3p2OXmRxQ1J2k..."
                 ↓
Stored in DB:    Only the hash!
                 ↓
DB hacked?       Attacker only sees hashes, can't get passwords!
```

### **2. Token Security**

```
Token created:   jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
                 ↓
Token format:    "header.payload.signature"
                 ↓
Payload:         { userId, iat: 1671234567, exp: 1671839367 }
                 ↓
Signature:       Created using JWT_SECRET (backend only knows)
                 ↓
Verification:    If payload changed or wrong secret → INVALID!
                 ↓
Expiration:      Token auto-expires after 7 days
```

### **3. Route Protection**

```
Unprotected:     /api/auth/register, /api/auth/login
                 └─ Anyone can call

Protected:       /api/auth/profile, /api/auth/logout
                 ├─ Must have Authorization header
                 ├─ Must have valid token
                 └─ Middleware verifies before controller runs
```

---

## 📊 Database Schema

### **User Collection in MongoDB**

```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "name": "John Doe",
  "email": "john@example.com",
  "password": "$2b$10$K1.aV5l5sxmRxQ1J2k3p2OXmRxQ1J2k3p2OXmRxQ1J2k3p2OX",
  "createdAt": ISODate("2024-01-15T10:30:00.000Z"),
  "updatedAt": ISODate("2024-01-15T10:30:00.000Z")
}
```

### **Indices**
- `email` - Unique index (one user per email)
- `createdAt` - For sorting users by registration date

---

## ⚙️ Environment Variables

All configuration in `server/.env`:

```
MONGODB_URI=mongodb://localhost:27017/prepforge
  └─ MongoDB connection string

JWT_SECRET=prepforge_dev_secret_key_change_in_production
  └─ Secret used to sign tokens (CHANGE IN PRODUCTION!)

JWT_EXPIRE=7d
  └─ How long tokens are valid

NODE_ENV=development
  └─ Environment mode (affects error messages)

PORT=5000
  └─ Server port

CORS_ORIGIN=http://localhost:5173
  └─ Frontend URL allowed to call API
```

---

## 📋 Error Handling

### **Status Codes Used**

| Code | Meaning | When Used |
|------|---------|-----------|
| 201 | Created | Successful registration |
| 200 | OK | Successful login/get profile |
| 400 | Bad Request | Missing/invalid input |
| 401 | Unauthorized | Invalid credentials or token |
| 409 | Conflict | User already exists |
| 500 | Server Error | Unexpected error |

### **Error Response Format**

```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

## 🧪 Test Cases

### **Passing Tests**

```bash
# Test 1: Register successful
POST /api/auth/register
200 ✅ User created with token

# Test 2: Login successful
POST /api/auth/login
200 ✅ Token returned

# Test 3: Access protected route with token
GET /api/auth/profile
Authorization: Bearer <token>
200 ✅ User profile returned

# Test 4: Logout successful
POST /api/auth/logout
Authorization: Bearer <token>
200 ✅ Logged out
```

### **Failing Tests (Error Handling)**

```bash
# Test 1: No token provided
GET /api/auth/profile
401 ❌ "No token provided. Please login"

# Test 2: Invalid token
GET /api/auth/profile
Authorization: Bearer invalid_xyz
401 ❌ "Invalid or expired token"

# Test 3: Wrong password
POST /api/auth/login
401 ❌ "Invalid email or password"

# Test 4: User already exists
POST /api/auth/register (duplicate email)
409 ❌ "User already exists with that email"

# Test 5: Passwords don't match
POST /api/auth/register
password: "abc", passwordConfirm: "xyz"
400 ❌ "Passwords do not match"

# Test 6: Missing fields
POST /api/auth/register (no name)
400 ❌ "Please provide all required fields"
```

---

## 🔗 Integration Points

### **How Frontend Will Use This**

```javascript
// Frontend (React)
import apiClient from '@/services/apiClient'

// Register
const response = await apiClient.post('/auth/register', {
  name, email, password, passwordConfirm
})
localStorage.setItem('token', response.data.data.token)

// Login
const response = await apiClient.post('/auth/login', {
  email, password
})
localStorage.setItem('token', response.data.data.token)

// Get profile (axios interceptor adds token automatically)
const response = await apiClient.get('/auth/profile')
// apiClient automatically adds: Authorization: Bearer <token>

// Logout
const response = await apiClient.post('/auth/logout')
localStorage.removeItem('token')
```

---

## 📚 Files Summary

### **Created/Modified Files**

```
✅ server/src/models/User.js              (NEW)
✅ server/src/controllers/authController.js (NEW)
✅ server/src/routes/authRoutes.js        (NEW)
✅ server/src/middleware/authMiddleware.js (UPDATED)
✅ server/src/server.js                   (UPDATED)

Already existed & used:
✅ server/src/utils/jwt.js
✅ server/src/utils/errorHandler.js
✅ server/.env
```

---

## ✅ Phase 2 Completion Checklist

- [x] User model with validation
- [x] Password hashing with bcryptjs
- [x] Register endpoint with error handling
- [x] Login endpoint with JWT generation
- [x] Protected routes with middleware
- [x] Profile endpoint (example protected route)
- [x] Logout endpoint
- [x] Bearer token authentication
- [x] JWT token expiration (7 days)
- [x] Input validation
- [x] Error handling with proper status codes
- [x] Environment variables
- [x] Complete documentation

---

## 🚧 Next Phase: Problem Tracker (Phase 3)

Ready to move forward? Phase 3 will implement:

1. **Problem Model** - Store DSA problems
2. **Problem Controller** - Create, read, update, delete problems
3. **Problem Routes** - API endpoints for problems
4. **Link to Users** - Each problem belongs to a user

```javascript
// Phase 3 Preview:
const problemSchema = {
  title: String,           // Problem name
  difficulty: String,      // Easy, Medium, Hard
  status: String,          // Solved, Attempted, Todo
  topic: String,           // Array, String, Tree, etc
  link: String,            // LeetCode/Codeforces link
  userId: ObjectId,        // Link to User
  solvedAt: Date,          // When problem was solved
}
```

---

## 🎓 Key Learnings

| Concept | Why Important | How Implemented |
|---------|---------------|-----------------|
| **Middleware** | Reusable request processing | `protect()` middleware |
| **Hashing** | Security - can't reverse | bcryptjs with salt |
| **JWT** | Stateless authentication | Token generation & verification |
| **Async/Await** | Handle async database calls | Used everywhere |
| **Error Handling** | Graceful failures | Try/catch + custom errors |
| **Separation of Concerns** | Clean architecture | Routes → Controllers → Services |

---

**Phase 2: Authentication Complete!** ✅

**Ready to proceed to Phase 3 when confirmed!**
