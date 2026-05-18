// Backend README

# Backend Structure - ExpressJS + MongoDB

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB running locally or connection string ready

### Installation

```bash
npm install
```

### Environment Variables

Create `.env` file with:
```
MONGODB_URI=mongodb://localhost:27017/prepforge
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

### Running

```bash
npm run dev      # Development with nodemon
npm start        # Production
```

## Folder Structure

- `config/` - Database and app configuration
- `controllers/` - Request handlers
- `middleware/` - Express middleware (auth, validation)
- `models/` - Mongoose schemas
- `routes/` - API endpoints
- `services/` - Business logic & database operations
- `sockets/` - Socket.io event handlers
- `utils/` - Helper functions (JWT, errors)
- `validators/` - Input validation schemas

## API Response Format

All endpoints return:
```json
{
  "success": true/false,
  "data": {},
  "message": "Optional message",
  "error": "Optional error details"
}
```

## Future Phases

- Phase 2: Authentication & User Management
- Phase 3: Problem Tracker CRUD
- Phase 4: Dashboard & Analytics
- Phase 5: Recommendation Engine
