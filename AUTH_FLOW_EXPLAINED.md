# Complete Authentication Flow Explanation

## 🔐 What is Authentication?

**Authentication** = Verifying who you are (proving your identity)

Think of it like showing your ID card:
- ✅ You show ID → Guard verifies it's real
- ✅ Guard lets you pass
- ❌ No ID → Guard won't let you pass
- ❌ Fake ID → Guard detects it's fake

---

## 🌍 How JWT Works (Step-by-Step)

### **Step 1: Initial Setup**

Backend has a secret key (only backend knows):
```
JWT_SECRET = "prepforge_dev_secret_key_change_in_production"
```

This secret is used to "sign" (create) and "verify" (check) tokens.

---

### **Step 2: User Registers**

```
User submits: { name, email, password }
         ↓
Backend receives → Validates → Hashes password → Stores in DB
         ↓
Backend creates JWT token:
  - Payload: { userId: "123", iat: 1671234567, exp: 1671839367 }
  - Signed with: JWT_SECRET
  - Result: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2..."
         ↓
Backend sends token to frontend
         ↓
Frontend stores token in localStorage
```

---

### **Step 3: User Makes Request to Protected Route**

```
Frontend has token in localStorage:
  token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
         ↓
Frontend makes request with token in header:
  GET /api/auth/profile
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
         ↓
Backend receives request
         ↓
Middleware (protect) runs:
  1. Extract token from header
  2. Verify token using JWT_SECRET
  3. Decode token to get userId
  4. Attach userId to request: req.user = { userId }
         ↓
If token is valid: Continue to controller
If token is invalid: Return 401 error
```

---

### **Step 4: Token Expires**

```
Token created at:  Jan 15, 2024 10:30:00
Expires in 7 days: Jan 22, 2024 10:30:00
         ↓
After Jan 22: Token is "expired"
         ↓
If user tries to use expired token:
  Backend checks: exp < now?
  Result: YES → Return 401: "Invalid or expired token"
         ↓
User must login again to get new token
```

---

## 🔑 JWT Token Structure

A JWT token has 3 parts separated by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJ1c2VySWQiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJpYXQiOjE2NzEyMzQ1NjcsImV4cCI6MTY3MTgzOTM2N30.
K1.aV5l5sxmRxQ1J2k3p2OXmRxQ1J2k3p2OXmRxQ1J2k3p2OX

^                                                  ^                                                  ^
HEADER                                             PAYLOAD                                           SIGNATURE
```

### **Part 1: Header**
```json
{
  "alg": "HS256",    // Hashing algorithm
  "typ": "JWT"       // Token type
}
```

### **Part 2: Payload (Readable!)**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "iat": 1671234567,          // Issued at (Unix timestamp)
  "exp": 1671839367           // Expires at (Unix timestamp)
}
```

### **Part 3: Signature**
```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  JWT_SECRET
)
```

**Important:** The signature proves the token wasn't modified!

If someone tries to change the payload:
```
Original token:  header.{userId:123}.signature
Modified token:  header.{userId:456}.signature
         ↓
Backend recalculates signature using original data
         ↓
Signatures don't match → Token is INVALID
```

---

## 🔒 Password Hashing vs Encryption

### **Hashing (One-way - What We Use)**
```
"MyPassword123" → Hash Function → "$2b$10$K1.aV5l5sxmRxQ1J..."
                                   ↑ Can't be reversed!

To verify: bcryptjs.compare("MyPassword123", "$2b$10$K1...")
           → Hash it again and check if results match
```

**Why hashing:**
- ✅ Even if database is hacked, passwords are unreadable
- ❌ Can't convert hash back to password
- ✅ Same password gives different hash each time (thanks to salt)

### **Encryption (Two-way - What We Don't Use)**
```
"MyPassword123" → Encrypt → "aB3$7xK@" (with key)
"aB3$7xK@" → Decrypt → "MyPassword123" (with key)
```

**Why NOT encryption:**
- ❌ If attacker gets decryption key, all passwords revealed
- ❌ More complex and risky

---

## 🧂 What is Salt in Hashing?

### Without Salt:
```
User 1: "password" → Hash → "$2b$10$abc123..."
User 2: "password" → Hash → "$2b$10$abc123..."
                               ^ SAME HASH!
         
If attacker sees same hash twice:
  They know both users have same password!
```

### With Salt (What bcryptjs Does):
```
User 1: "password" + Salt1 → Hash → "$2b$10$abc123..."
User 2: "password" + Salt2 → Hash → "$2b$10$xyz789..."
                              ^ DIFFERENT HASH (same password!)

Even if attacker sees both hashes:
  They don't know the passwords are the same!
```

**How salt works:**
```javascript
// bcryptjs.genSalt(10) generates random salt
// "10" means 10 rounds of hashing (more secure but slower)
// Default: takes ~0.1 seconds to hash password

const salt = await bcryptjs.genSalt(10)
// Result: "$2b$10$K1.aV5l5sxmRxQ1J2k3p2O"

const hash = await bcryptjs.hash("password", salt)
// Result: "$2b$10$K1.aV5l5sxmRxQ1J2k3p2OXmRxQ1J2k3p2OX..."
```

---

## 🚦 Complete Request Flow Diagram

### **Flow 1: Register & Get Token**

```
┌──────────────┐
│   Frontend   │
│   Browser    │
└──────┬───────┘
       │ 1. User fills form & clicks Register
       │
       ├─────────────────────────┐
       │ name, email, password   │
       │                         │
       ↓                         ↓
┌──────────────────────────────────────────┐
│         Express Server                   │
│  POST /api/auth/register                 │
├──────────────────────────────────────────┤
│  2. Validate input                       │
│     - All fields provided?               │
│     - Passwords match?                   │
│     - Valid email format?                │
│                                          │
│  3. Check database                       │
│     - User already exists?               │
│                                          │
│  4. Hash password                        │
│     bcryptjs.hash(password, salt)        │
│                                          │
│  5. Create user in DB                    │
│     User.create({ name, email, hash })  │
│                                          │
│  6. Generate JWT token                   │
│     jwt.sign({ userId }, JWT_SECRET)    │
│                                          │
│  7. Send response                        │
│     { token, userId, name, email }       │
└─────────────┬──────────────────────────┘
              │
              ↓
┌──────────────────────────┐
│   Frontend/localStorage  │
│                          │
│  token: "eyJhbGc..."    │
│  stored ✅               │
└──────────────────────────┘
```

### **Flow 2: Login & Get Token**

```
┌──────────────┐
│   Frontend   │
│   Browser    │
└──────┬───────┘
       │ 1. User enters email & password
       │
       ├────────────────────┐
       │ email, password    │
       │                    │
       ↓                    ↓
┌──────────────────────────────────────────┐
│         Express Server                   │
│  POST /api/auth/login                    │
├──────────────────────────────────────────┤
│  2. Validate input                       │
│     - Both fields provided?              │
│                                          │
│  3. Find user by email                   │
│     User.findOne({ email })              │
│                                          │
│  4. Compare passwords                    │
│     bcryptjs.compare(                    │
│       enteredPassword,                   │
│       storedHash                         │
│     )                                    │
│                                          │
│  5. If passwords match:                  │
│     Generate JWT token                   │
│     jwt.sign({ userId }, JWT_SECRET)     │
│                                          │
│  6. Send response                        │
│     { token, userId, name, email }       │
│                                          │
│  Or return 401 if password wrong         │
└─────────────┬──────────────────────────┘
              │
              ↓
┌──────────────────────────┐
│   Frontend/localStorage  │
│                          │
│  token: "eyJhbGc..."    │
│  stored ✅               │
└──────────────────────────┘
```

### **Flow 3: Access Protected Route**

```
┌──────────────┐
│   Frontend   │
│   Browser    │
└──────┬───────┘
       │ 1. Make request with token
       │
       ├─────────────────────────────────┐
       │ GET /api/auth/profile           │
       │ Authorization: Bearer eyJhbGc..│
       │                                 │
       ↓                                 ↓
┌──────────────────────────────────────────┐
│  Express Middleware: protect()           │
├──────────────────────────────────────────┤
│  2. Get Authorization header             │
│     authHeader = "Bearer eyJhbGc..."     │
│                                          │
│  3. Extract token                        │
│     token = "eyJhbGc..."                 │
│                                          │
│  4. Verify token                         │
│     jwt.verify(token, JWT_SECRET)        │
│     ├─ Valid? ✅                         │
│     │  decoded = { userId, iat, exp }   │
│     │  req.user = decoded                │
│     │  → Continue to controller          │
│     │                                    │
│     └─ Invalid? ❌                       │
│        → Return 401 error                │
│        → Stop here, don't continue       │
│                                          │
│  5. Controller receives request          │
│     const user = await User.findById(    │
│       req.user.userId  ← From middleware │
│     )                                    │
│                                          │
│  6. Send user profile                    │
│     { userId, name, email, createdAt }   │
└─────────────┬──────────────────────────┘
              │
              ↓
┌──────────────────────────┐
│   Frontend               │
│                          │
│  Receive user profile    │
│  Display in app ✅       │
└──────────────────────────┘
```

---

## 🛡️ Security Comparison

### **❌ Storing Passwords as Plain Text**
```
Database hacked:
  → Attacker sees all passwords
  → Can login to any user account
  → Can use password on other sites (people reuse passwords)
  → DISASTER! 💥
```

### **❌ Using Simple Encryption**
```
Database + key hacked:
  → Attacker decrypts passwords
  → Same problem as plain text
  → DISASTER! 💥
```

### **✅ Using bcryptjs Hashing (What We Do)**
```
Database hacked:
  → Attacker sees hashes only
  → Can't reverse hash to get password
  → Can't login without password
  → Might try brute force attack (will take 100+ years)
  → SECURE! ✅
```

---

## 📱 Token Flow in App

### **User Perspective:**
```
1. User registers → Gets token
2. Token stored in browser (localStorage)
3. User can access protected pages
4. User closes browser
5. Token still in localStorage (survives page reload)
6. User opens app again → Still logged in ✅
7. Token expires (after 7 days)
8. User tries to access protected page → 401 error
9. User logs in again → Gets new token
```

### **Behind the Scenes:**
```
Every protected request:
  ├─ Get token from localStorage
  ├─ Add to Authorization header
  ├─ Send request
  ├─ Backend verifies token
  ├─ If valid: Return data
  └─ If invalid: Return 401

If 401 error:
  ├─ Frontend knows token expired
  ├─ Remove token from localStorage
  ├─ Redirect to login page
  └─ User must login again
```

---

## 🔄 Key Difference: Stateless vs Stateful

### **Stateful Authentication (Sessions - Traditional)**
```
1. User logs in
2. Server creates session, stores in memory/DB
3. Server sends session ID to browser
4. Browser sends session ID with every request
5. Server looks up session to verify user
6. Server must store all sessions
7. Doesn't scale well (server memory/database grows)
```

### **Stateless Authentication (JWT - What We Use)**
```
1. User logs in
2. Server creates JWT token
3. Server sends token to browser
4. Browser sends token with every request
5. Server verifies token using secret
6. Server doesn't store anything
7. Scales perfectly (multiple servers work independently)
```

---

## ✅ Why Our Implementation is Secure

| Feature | Why Secure |
|---------|-----------|
| **Password Hashing** | Passwords unreadable if DB hacked |
| **Salt** | Same password gives different hash |
| **JWT Token** | Can't be forged without JWT_SECRET |
| **Token Expiration** | Invalid after 7 days |
| **Bearer Token** | Only in Authorization header |
| **CORS Protection** | Only frontend domain can call API |
| **Generic Error Messages** | Can't tell if email exists |

---

**You now understand the complete authentication system!** 🎓
