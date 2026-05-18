# Authentication API Testing Guide

## 🚀 Quick Start

### Prerequisites:
- Backend running: `npm run dev`
- MongoDB running locally
- A terminal or Postman

---

## 📝 Test Endpoints (Copy & Paste Ready)

### **1. Register New User**

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

**Expected Status:** 201 (Created)

**Save the token from response!**

---

### **2. Login User**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Password123"
  }'
```

**Expected Status:** 200 (OK)

**Copy the token from response**

---

### **3. Get Profile (Protected Route)**

Replace `YOUR_TOKEN_HERE` with the token from login:

```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Status:** 200 (OK)

---

### **4. Logout User**

```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Status:** 200 (OK)

---

## ❌ Error Test Cases

### **Test: No Token**
```bash
curl -X GET http://localhost:5000/api/auth/profile
```
**Expected:** 401 - "No token provided. Please login"

---

### **Test: Invalid Token**
```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer invalid_token_xyz"
```
**Expected:** 401 - "Invalid or expired token"

---

### **Test: Wrong Password**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "WrongPassword"
  }'
```
**Expected:** 401 - "Invalid email or password"

---

### **Test: Duplicate Email**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Another Person",
    "email": "john@example.com",
    "password": "Password123",
    "passwordConfirm": "Password123"
  }'
```
**Expected:** 409 - "User already exists with that email"

---

### **Test: Passwords Don't Match**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "Password123",
    "passwordConfirm": "DifferentPassword"
  }'
```
**Expected:** 400 - "Passwords do not match"

---

### **Test: Missing Required Fields**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe"
  }'
```
**Expected:** 400 - "Please provide all required fields"

---

## 🧪 Postman Alternative

If you prefer Postman instead of cURL:

1. Create new request
2. Method: POST
3. URL: http://localhost:5000/api/auth/register
4. Body (raw JSON):
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password123",
  "passwordConfirm": "Password123"
}
```
5. Send

For protected routes:
1. Method: GET
2. URL: http://localhost:5000/api/auth/profile
3. Headers: Add `Authorization: Bearer YOUR_TOKEN`
4. Send

---

## 📊 Response Examples

### Success Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJpYXQiOjE2NzEyMzQ1NjcsImV4cCI6MTY3MTgzOTM2N30.K1.aV5l5sxmRxQ1J2k3p2O..."
  }
}
```

### Error Response:
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

## ✅ Test Checklist

Run these in order:

- [ ] 1. Register new user → Get token
- [ ] 2. Login → Get new token
- [ ] 3. Get profile with token → See user data
- [ ] 4. Logout → Success
- [ ] 5. Try protected route without token → 401 error
- [ ] 6. Try protected route with invalid token → 401 error

**If all tests pass, authentication is working!** ✅

---

## 💡 Tips

### Save Token to Variable (Linux/Mac):
```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"Password123"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Use token in next request
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer $TOKEN"
```

### Pretty Print JSON (Linux/Mac):
```bash
curl http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

---

**You're ready to test!** 🚀
