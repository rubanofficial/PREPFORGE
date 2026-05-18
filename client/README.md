// Frontend README

# Frontend Structure - React + Vite + Tailwind

## Getting Started

### Prerequisites
- Node.js v18+

### Installation

```bash
npm install
```

### Environment Variables

Create `.env` file with:
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### Running

```bash
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
```

## Folder Structure

- `api/` - API endpoint constants
- `app/` - Redux store & root App component
- `components/` - Reusable UI components
- `features/` - Redux slices & feature-specific logic
- `hooks/` - Custom React hooks
- `layouts/` - Layout components (Header, Sidebar)
- `pages/` - Full page components
- `routes/` - Routing configuration
- `services/` - API client & Socket.io
- `utils/` - Helper functions
- `charts/` - Recharts components

## Development Guidelines

1. **Components** are small, reusable, and functional
2. **Redux** is used for global state (auth, user settings)
3. **Services** handle API calls via apiClient
4. **Utils** contain helper functions
5. **Always use async/await** for API calls

## API Integration

Import from `services/apiClient`:
```javascript
import apiClient from '@/services/apiClient'

const data = await apiClient.get('/endpoint')
```

## Tailwind CSS

Custom colors defined in `tailwind.config.js`:
- primary: #3b82f6 (Blue)
- secondary: #10b981 (Green)
- danger: #ef4444 (Red)
- warning: #f59e0b (Amber)

## Future Phases

- Phase 2: Authentication Pages (Login, Register)
- Phase 3: Problem Tracker Interface
- Phase 4: Dashboard & Analytics
- Phase 5: Recommendation Engine
