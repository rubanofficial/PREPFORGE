# Setup Guide for PrepForge Pro

## 🎯 One-Time Setup (Do This Once)

### Step 1: Install Dependencies

**Backend Setup:**
```bash
cd server
npm install
```

**Frontend Setup:**
```bash
cd client
npm install
```

### Step 2: Environment Variables

**Backend (.env):**
```bash
# Create .env file in server/ directory
MONGODB_URI=mongodb://localhost:27017/prepforge
JWT_SECRET=prepforge_super_secret_key_change_in_production
JWT_EXPIRE=7d
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

**Frontend (.env):**
```bash
# Create .env file in client/ directory
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 🚀 Daily Development (Do This Every Session)

### Start Backend Server
```bash
cd server
npm run dev
```
✅ You should see:
```
🚀 Server running on port 5000
📡 Socket.io server active
```

### Start Frontend Server (New Terminal)
```bash
cd client
npm run dev
```
✅ You should see:
```
VITE v5.x.x ready in XX ms
➜  Local:   http://localhost:5173/
```

### Test Everything Works
```bash
# In another terminal, test health check
curl http://localhost:5000/api/health

# Response should be:
# {"status":"Server is running"}
```

**If you see this, Phase 1 setup is complete! ✅**

---

## 📱 Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

---

## 🆘 Common Issues

### "Module not found" error
```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "MongoDB connection failed"
```bash
# Ensure MongoDB is running
# Windows: Check Services or run MongoDB locally
# macOS: brew services start mongodb-community
# Linux: sudo systemctl start mongod
```

### "Port 5000 already in use"
```bash
# Find and kill process
# Windows
netstat -ano | findstr :5000
taskkill /PID [PID] /F

# macOS/Linux
lsof -i :5000
kill -9 [PID]
```

---

## ✨ What's Included

✅ Complete folder structure  
✅ Frontend with React + Vite  
✅ Backend with Express  
✅ Tailwind CSS configured  
✅ Redux store setup  
✅ API client with interceptors  
✅ Socket.io ready  
✅ MongoDB connection  
✅ Environment variables  
✅ Hot reload (nodemon)  

---

## 📝 Project Files Overview

### Frontend Key Files
- `client/src/main.jsx` - React entry point
- `client/src/app/App.jsx` - Root component
- `client/src/app/store.js` - Redux store
- `client/src/services/apiClient.js` - API configuration
- `client/vite.config.js` - Vite configuration
- `client/tailwind.config.js` - Tailwind CSS config

### Backend Key Files
- `server/src/server.js` - Express server
- `server/src/config/database.js` - MongoDB connection
- `server/src/utils/jwt.js` - JWT token handling
- `server/package.json` - Dependencies

---

**Next Step: Wait for confirmation that this setup works before moving to Phase 2: Authentication System**
