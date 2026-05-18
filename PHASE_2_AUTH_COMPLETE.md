# PrepForge Pro - Phase 2: Authentication System Complete

## 📋 What Has Been Implemented

### 1. ✅ User Model (`server/src/models/User.js`)
- User schema with name, email, password
- Email validation and uniqueness
- Password hashing with bcryptjs (before saving)
- Password comparison method for login
- Timestamps for tracking creation/updates

### 2. ✅ Authentication Controller (`server/src/controllers/authController.js`)
- `register()` - Create new user account
- `login()` - Authenticate user and issue JWT token
- `getProfile()` - Get logged-in user details (protected)
- `logout()` - Clear session (frontend removes token)

### 3. ✅ Authentication Routes (`server/src/routes/authRoutes.js`)
- `POST /api/auth/register` - Public
- `POST /api/auth/login` - Public
- `GET /api/auth/profile` - Protected
- `POST /api/auth/logout` - Protected

### 4. ✅ Authentication Middleware (`server/src/middleware/authMiddleware.js`)
- `protect()` - Verify JWT token in Authorization header
- `authorize()` - Role-based access control (for future)

### 5. ✅ JWT Utilities (`server/src/utils/jwt.js`)
- Token generation with user ID
- Token verification
- Token decoding

### 6. ✅ Error Handling (`server/src/utils/errorHandler.js`)
- Custom `AppError` class
- `asyncHandler` for wrapping async functions

---

## 🔐 Complete Authentication Flow Explained

### **Part 1: User Registration Flow**

#### Step-by-Step:
```
1. User submits form: { name, email, password, passwordConfirm }
        ↓
2. POST /api/auth/register request sent to backend
        ↓
3. Server receives request in authController.register()
        ↓
4. Validate: All fields provided? Passwords match?
        ↓
5. Check: Does user already exist with this email?
        ↓
6. Create user: User.create({ name, email, password })
        ↓
7. Mongoose calls userSchema.pre('save') middleware:
   - Password gets hashed with bcryptjs
   - Original password replaced with hash
        ↓
8. Generate JWT token: generateToken(user._id)
        ↓
9. Send back: { token, userId, email, name }
        ↓
10. Frontend stores token in localStorage
        ↓
11. Registration complete! ✅
```

#### What Happens When Password Gets Hashed:

**Original password:** `"MyPassword123"`

**Hashing process:**
```javascript
// Generate salt
salt = await bcryptjs.genSalt(10)
// Salt looks like: "$2b$10$K1.aV5l5sxmRxQ1J2k3p2O"

// Hash password with salt
hashedPassword = await bcryptjs.hash("MyPassword123", salt)
// Result looks like: "$2b$10$K1.aV5l5sxmRxQ1J2k3p2OXmRxQ1J2k3p2OXmRxQ1J2k3p2OX"
```

**In database:** Only the hashed version is stored, never the original!

---

### **Part 2: User Login Flow**

#### Step-by-Step:
```
1. User submits form: { email, password }
        ↓
2. POST /api/auth/login request sent to backend
        ↓
3. Server receives request in authController.login()
        ↓
4. Validate: Both email and password provided?
        ↓
5. Find user by email in database
   Note: Using .select('+password') to get hashed password
        ↓
6. Check: User found?
        ↓
7. Compare passwords:
   - enteredPassword: "MyPassword123"
   - storedHashedPassword: "$2b$10$..."
   - Use bcryptjs.compare() to check if they match
        ↓
8. If passwords don't match:
   Return error: "Invalid email or password" (401)
        ↓
9. If passwords match:
   Generate JWT token: generateToken(user._id)
   Token contains: { userId, iat, exp }
        ↓
10. Send back: { token, userId, email, name }
        ↓
11. Frontend stores token in localStorage
        ↓
12. Now user is "logged in" ✅
```

#### Example Token:
```javascript
// JWT has 3 parts separated by dots:
// header.payload.signature

// Decoded (readable):
{
  "userId": "507f1f77bcf86cd799439011",
  "iat": 1671234567,        // issued at (timestamp)
  "exp": 1671839367         // expires at (timestamp)
}
```

---

### **Part 3: Making Protected Requests**

#### How to Access Protected Routes:

**Every request to protected routes MUST include JWT token in header:**

```javascript
// Frontend code:
const response = await fetch('http://localhost:5000/api/auth/profile', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token  // <-- Must include!
  }
})
```

#### What Happens on Backend:

```
1. Frontend sends: GET /api/auth/profile
   With header: "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
        ↓
2. Server receives request
        ↓
3. Express calls middleware: protect()
        ↓
4. Middleware checks Authorization header:
   if (!authHeader || !authHeader.startsWith('Bearer '))
     return error: "No token provided"
        ↓
5. Extract token from "Bearer <token>"
   token = authHeader.slice(7)
   Result: "eyJhbGciOiJIUzI1NiIs..."
        ↓
6. Verify token with JWT secret:
   const decoded = verifyToken(token)
   If invalid: return error: "Invalid or expired token"
   If valid: decoded = { userId, iat, exp }
        ↓
7. Attach to request:
   req.user = { userId, iat, exp }
        ↓
8. Call next() to continue to controller
        ↓
9. Controller has access to req.user
   Can do: const user = await User.findById(req.user.userId)
        ↓
10. Return user profile data ✅
```

---

## 🛡️ Why Each Component Exists

### **User Model**
```javascript
// Defines the structure of user data
// Enforces validation rules
// Handles password hashing automatically
```

**Why it's needed:**
- ✅ Consistency: All users have same fields
- ✅ Validation: Email format, password length checked
- ✅ Security: Password hashing before storage

---

### **Password Hashing**
```javascript
// Original: "MyPassword123"
// Hashed:   "$2b$10$K1.aV5l5sxmRxQ1J2k3p2OXmRxQ1J2k3p2OXmRxQ1..."
```

**Why it's critical:**
- ❌ If database is hacked, attacker doesn't get passwords
- ❌ Hashes can't be reversed to get original password
- ❌ Each password hashes differently (thanks to salt)

**Example:**
```
Original passwords: "password123", "password123"
Hashed:            "$2b$10$abc123...", "$2b$10$xyz789..."
                   ^ Different! (because of different salts)
```

---

### **JWT Token**
```javascript
// Token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOi..."
// Token contains: { userId, issued_at, expires_at }
// Token is SIGNED with JWT_SECRET (backend only knows this)
```

**Why JWT is used:**
- ✅ Stateless: Backend doesn't store sessions
- ✅ Scalable: Works across multiple servers
- ✅ Secure: Can't be forged without JWT_SECRET
- ✅ Expiring: Automatically invalid after 7 days

**Token Flow:**
```
1. Backend signs token with JWT_SECRET (only backend knows)
2. Backend sends token to frontend
3. Frontend stores token and sends it with every request
4. Backend verifies token using same JWT_SECRET
5. If someone tries to fake token → verification fails
```

---

### **Middleware Protection**
```javascript
// Middleware runs BEFORE controller
// If no valid token → request stops here
// If valid token → continues to controller
```

**Why middleware:**
- ✅ Reusable: Protects multiple routes with same code
- ✅ Chainable: Can use multiple middlewares
- ✅ Secure: Validates before controller even runs

---

## 📊 Database Schema Explained

### User Model Fields:

```javascript
{
  name: String,           // User's full name
  email: String,          // Unique identifier for login
  password: String,       // Hashed password (NOT original!)
  createdAt: Date,        // When account was created
  updatedAt: Date         // When profile last updated
}
```

### Data Storage Example:

**Frontend submits:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Stored in MongoDB:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "$2b$10$K1.aV5l5sxmRxQ1J2k3p2OXmRxQ1J2k3p2OXmRxQ1J2k3p2OX",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

---

## 🧪 Testing the Authentication System

### **Test 1: Register a New User**

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

**Expected response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### **Test 2: Login User**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Password123"
  }'
```

**Expected response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### **Test 3: Get Protected Profile (With Token)**

Save token from login response, then:

```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Expected response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### **Test 4: Try Protected Route Without Token**

```bash
curl -X GET http://localhost:5000/api/auth/profile
```

**Expected response (401):**
```json
{
  "success": false,
  "message": "No token provided. Please login"
}
```

---

### **Test 5: Try Protected Route With Invalid Token**

```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer invalid_token_here"
```

**Expected response (401):**
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

---

## 🔒 Security Best Practices Implemented

### 1. **Password Hashing**
- ✅ Used bcryptjs with salt (10 rounds)
- ✅ Never store plain text passwords
- ✅ Hash verified during login with compare()

### 2. **JWT Security**
- ✅ Token signed with secret (only backend knows)
- ✅ Token expires after 7 days
- ✅ Token verification on every protected route

### 3. **Input Validation**
- ✅ Email format validated
- ✅ Password minimum length (6 chars)
- ✅ Required fields checked
- ✅ Passwords must match on register

### 4. **Error Messages**
- ✅ Generic "Invalid email or password" (don't reveal if email exists)
- ✅ Prevents user enumeration attacks

### 5. **CORS Protection**
- ✅ Only allow requests from frontend URL
- ✅ Prevents unauthorized domains from accessing API

---

## 📁 Files Created/Modified

### New Files:
```
server/src/models/User.js
server/src/controllers/authController.js
server/src/routes/authRoutes.js
```

### Modified Files:
```
server/src/middleware/authMiddleware.js   (replaced placeholder)
server/src/server.js                       (added auth routes)
```

### Existing (Already Set Up):
```
server/src/utils/jwt.js
server/src/utils/errorHandler.js
```

---

## 🚀 How to Run & Test

### Start Backend:
```bash
cd server
npm run dev
```

### Test Endpoints:
Use Postman, cURL, or any HTTP client with the test examples above.

---

## 🔄 Error Handling Examples

### Validation Errors (400):
```json
{
  "success": false,
  "message": "Please provide all required fields"
}
```

### Authentication Errors (401):
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

### Conflict Errors (409):
```json
{
  "success": false,
  "message": "User already exists with that email"
}
```

---

## 📚 Key Concepts Summary

| Concept | Purpose | Implementation |
|---------|---------|-----------------|
| **User Model** | Define user data structure | Mongoose schema with validation |
| **Password Hashing** | Secure password storage | bcryptjs with 10 salt rounds |
| **JWT Token** | Stateless authentication | Signed with JWT_SECRET, expires in 7d |
| **Middleware** | Protect routes | Check token in Authorization header |
| **Async/Await** | Handle async operations | All database queries use async/await |
| **Error Handling** | Graceful error responses | Try/catch + custom AppError class |

---

## ✅ Phase 2 Checklist

- [x] User model with password hashing
- [x] Register endpoint with validation
- [x] Login endpoint with JWT token generation
- [x] Protected routes with JWT middleware
- [x] Profile endpoint (protected)
- [x] Error handling with proper status codes
- [x] Environment variables for JWT
- [x] Logout endpoint (frontend-side implementation)
- [x] Bearer token authentication
- [x] Complete documentation

---

## 🚧 What's Next (Phase 3)

After confirming authentication works:
- Create problem tracking model
- Create CRUD endpoints for problems
- Add problem controller & routes
- Link problems to users

---

**Phase 2: Authentication System Complete!** ✅

**To proceed, test all 5 test cases above and confirm they work!**
