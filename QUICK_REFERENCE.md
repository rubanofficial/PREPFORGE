# PrepForge Pro - Quick Reference Guide

## ⚡ Fast Commands Cheat Sheet

### Setup (First Time)
```bash
# Backend setup
cd server && npm install && cp .env.example .env

# Frontend setup  
cd client && npm install && cp .env.example .env
```

### Daily Development
```bash
# Terminal 1: Start Backend
cd server && npm run dev

# Terminal 2: Start Frontend
cd client && npm run dev

# Access Application
Frontend: http://localhost:5173
Backend API: http://localhost:5000/api
Health Check: curl http://localhost:5000/api/health
```

### Building
```bash
# Frontend Production Build
cd client && npm run build

# Backend doesn't need building (Node.js)
```

---

## 📍 File Locations Quick Reference

### Configuration Files
| What | Location |
|------|----------|
| Frontend Config | `client/vite.config.js` |
| Tailwind Config | `client/tailwind.config.js` |
| Backend Server | `server/src/server.js` |
| MongoDB Config | `server/src/config/database.js` |
| Frontend ENV | `client/.env` |
| Backend ENV | `server/.env` |

### Key Application Files
| Component | Location |
|-----------|----------|
| React Entry Point | `client/src/main.jsx` |
| Root React Component | `client/src/app/App.jsx` |
| Redux Store | `client/src/app/store.js` |
| API Client | `client/src/services/apiClient.js` |
| API Endpoints | `client/src/api/endpoints.js` |
| Homepage | `client/src/pages/HomePage.jsx` |
| Layout | `client/src/layouts/Layout.jsx` |
| Global Styles | `client/src/index.css` |

### Utilities
| Utility | Location |
|---------|----------|
| JWT Handler | `server/src/utils/jwt.js` |
| Error Handler | `server/src/utils/errorHandler.js` |
| Date Utils | `client/src/utils/dateUtils.js` |
| Validation Utils | `client/src/utils/validation.js` |

---

## 🔑 Environment Variables

### Backend (.env)
```
MONGODB_URI=mongodb://localhost:27017/prepforge
JWT_SECRET=prepforge_dev_secret_change_in_production
JWT_EXPIRE=7d
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 📦 Important Dependencies

### What Each Package Does

**Frontend:**
- `react` - UI rendering
- `vite` - Fast development
- `tailwindcss` - Styling
- `redux` - State management
- `axios` - API calls
- `socket.io-client` - Real-time

**Backend:**
- `express` - API framework
- `mongoose` - Database
- `jsonwebtoken` - Authentication
- `bcryptjs` - Password security
- `socket.io` - Real-time server
- `node-cron` - Scheduled tasks

---

## 🔐 Security Files

| File | Purpose |
|------|---------|
| `client/.gitignore` | Ignore node_modules & .env |
| `server/.gitignore` | Ignore node_modules & .env |
| `server/src/utils/jwt.js` | Token generation & verification |
| `client/src/services/apiClient.js` | Token in requests |

---

## 🚀 Adding New Features - Quick Steps

### Adding a Frontend Page
1. Create component: `client/src/pages/NewPage.jsx`
2. Add route: `client/src/app/App.jsx`
3. Add link: `client/src/layouts/Layout.jsx`

### Adding a Backend Route
1. Create controller: `server/src/controllers/newController.js`
2. Create route: `server/src/routes/newRoutes.js`
3. Import in: `server/src/server.js`

### Adding Redux State
1. Create slice: `client/src/features/newSlice.js`
2. Add to store: `client/src/app/store.js`
3. Use with: `useSelector` & `useDispatch`

---

## 🐛 Troubleshooting Quick Fixes

| Issue | Solution |
|-------|----------|
| Port 5000 in use | Change PORT in .env |
| Dependencies missing | Delete `node_modules` & run `npm install` |
| MongoDB not connecting | Check MONGODB_URI in .env |
| CORS error | Check CORS_ORIGIN matches frontend URL |
| Tailwind not working | Run `npm run dev` instead of `npm start` |
| Hot reload not working | Restart server with `npm run dev` |

---

## 📊 Project Stats

| Metric | Count |
|--------|-------|
| Frontend Folders | 11 |
| Backend Folders | 9 |
| Frontend Dependencies | 15 |
| Backend Dependencies | 10 |
| Configuration Files | 5 |
| Documentation Files | 5 |
| Example Files | 9 |

---

## 🎯 What Each Layer Does

```
Frontend Layer
├─ React Components → Display UI
├─ Redux Store → Global state
└─ API Client → Talk to backend

Middle Layer (Communication)
├─ HTTP Requests (REST API)
└─ Socket.io (Real-time)

Backend Layer
├─ Routes → Define endpoints
├─ Controllers → Handle requests
├─ Services → Business logic
└─ Database → Store data

Database Layer
└─ MongoDB → Persistent storage
```

---

## ✅ Before Moving to Phase 2

Make sure:
- [ ] Both `npm run dev` commands work
- [ ] Frontend loads at http://localhost:5173
- [ ] Health check works: `curl http://localhost:5000/api/health`
- [ ] No errors in console
- [ ] MongoDB connected message appears
- [ ] .env files created with proper values

---

## 📞 Common Commands

```bash
# Install all dependencies
npm install

# Start development
npm run dev

# Build for production
npm run build

# Check if port is in use
netstat -ano | findstr :5000  # Windows
lsof -i :5000                 # Mac/Linux

# Kill process on port
taskkill /PID <PID> /F        # Windows
kill -9 <PID>                 # Mac/Linux
```

---

## 🔄 File Modification Workflow

### When adding new API endpoint:
1. Backend: Add route in `routes/`
2. Backend: Add controller in `controllers/`
3. Backend: Add service in `services/`
4. Frontend: Add endpoint in `api/endpoints.js`
5. Frontend: Add API call in component or service
6. Frontend: Update Redux slice if needed

### When modifying database:
1. Backend: Update model in `models/`
2. Backend: Update service in `services/`
3. Backend: Update controller in `controllers/`
4. Backend: Run MongoDB migration (manual for now)
5. Frontend: Update API call if changed
6. Frontend: Update Redux if state changed

---

## 📚 Documentation Map

| Document | Purpose |
|----------|---------|
| `README.md` | Main overview & architecture |
| `SETUP_GUIDE.md` | Step-by-step setup |
| `ARCHITECTURE.md` | Detailed diagrams & flows |
| `PHASE_1_COMPLETE.md` | Phase 1 summary |
| `QUICK_REFERENCE.md` | This file |
| `client/README.md` | Frontend specifics |
| `server/README.md` | Backend specifics |

---

## 🎓 Key Concepts

### Separation of Concerns
- UI components don't know about databases
- Controllers don't know about HTTP
- Services don't know about Redux

### Request Path
```
Browser → React Component → Redux → API Client → Express → 
Controller → Service → Mongoose → MongoDB
```

### Response Path
```
MongoDB → Mongoose → Service → Controller → Express → 
API Client → Redux → React Component → Browser
```

### Real-time Path
```
Browser ← Socket.io ← Server ← Database
Browser → Socket.io → Server → Database
```

---

## 🚀 You're All Set!

**To start development:**
```bash
# Terminal 1
cd server && npm run dev

# Terminal 2 (new terminal)
cd client && npm run dev

# Open http://localhost:5173 in browser
```

**Phase 1 is complete! Ready for Phase 2: Authentication** ✅
