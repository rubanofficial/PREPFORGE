# PrepForge Pro - Frontend Architecture Guide

Welcome to the frontend architecture documentation for PrepForge Pro. This guide is designed to help you understand *why* the frontend was built this way, *how* the different pieces fit together, and *how* to extend it in the future.

## 1. High-Level Architecture Overview

This project is built using the **Vite + React + React Router + Redux Toolkit** stack. It is a "Single Page Application" (SPA). We chose this stack because it offers excellent performance, a great developer experience, and standard patterns for scaling.

### Core Technologies:
*   **Vite**: The build tool and development server. It's much faster than Create React App (CRA) because it uses native ES modules during development.
*   **React (v18)**: The core UI library.
*   **React Router (v6)**: Handles navigation without reloading the page.
*   **Redux Toolkit (RTK)**: The modern, standard way to write Redux logic for global state management.
*   **Tailwind CSS**: A utility-first CSS framework used for styling.
*   **Axios**: A promise-based HTTP client for making API requests to your backend.
*   **Recharts**: A composable charting library built on React components for our analytics dashboards.
*   **Lucide React**: A beautiful, consistent icon library.

---

## 2. Directory Structure Explained

The folder structure inside `src/` is designed for a "feature-based" architecture, which scales much better than organizing files strictly by type.

```text
src/
├── api/          # Network layer configuration
├── app/          # Global application setup (Redux store)
├── components/   # Reusable UI building blocks
├── features/     # Feature-specific Redux slices and logic
├── layouts/      # Structural wrapper components
├── pages/        # Full views mapping to routes
├── hooks/        # Custom React hooks (empty for now, for future use)
├── services/     # Generic non-Redux API services (if needed)
├── utils/        # Helper functions and constants
├── App.jsx       # The main routing configuration
├── main.jsx      # The React application entry point
└── index.css     # Global CSS and Tailwind directives
```

### Why this structure?
If you want to understand how authentication works, you don't have to look in 5 different folders. You look at `src/features/auth/authSlice.js` for the state, `src/pages/LoginPage.jsx` for the UI, and `src/api/axios.js` for the network interceptors. It keeps related concepts organized.

---

## 3. The API Layer (`src/api/axios.js`)

Instead of calling `fetch()` or `axios.get()` with the full URL and headers in every component, we created a centralized Axios instance.

### Key Concepts:
*   **Base URL**: It automatically points to `http://localhost:5000/api` (or a `.env` variable if deployed).
*   **Request Interceptor**: Before *every* API request leaves the frontend, this interceptor checks `localStorage` for a JWT token. If it finds one, it automatically attaches it as an `Authorization: Bearer <token>` header. This means you never have to manually attach tokens in your components.
*   **Response Interceptor**: When the backend responds with an error, this interceptor catches it. Specifically, if it sees a `401 Unauthorized` status (meaning the token expired or is invalid), it automatically clears the token and redirects the user to the login page.

---

## 4. State Management (`src/features/` & `src/app/store.js`)

We use **Redux Toolkit (RTK)** to manage global state. Global state is data that needs to be accessed by many different components (like the logged-in user's details, or the progress of a background deep sync).

### The Store (`src/app/store.js`)
Think of the Store as the central brain of the application. It combines all the different "slices" of state into one big object.

### The Slices (`src/features/.../*Slice.js`)
A "slice" represents a specific domain of data. We created four slices:
1.  **`authSlice`**: Manages `user` object, `token`, and `isAuthenticated` boolean. It handles actions like `loginSuccess` and `logout`.
2.  **`syncSlice`**: Manages the status of the background LeetCode sync (e.g., `status: 'active'`, `progressPercent: 60`). This is crucial because a deep sync takes time, and we need the whole app to know its progress.
3.  **`problemSlice`**: Stores the list of fetched problems, pagination info, and current filter settings.
4.  **`analyticsSlice`**: Stores the aggregated statistics (total solved, difficulty breakdown) used by the dashboard charts.

**How to use state in a component:**
*   To *read* data: `const { user } = useSelector((state) => state.auth);`
*   To *update* data: `const dispatch = useDispatch(); dispatch(startSync('job123'));`

---

## 5. Routing and Layouts (`src/App.jsx` & `src/layouts/MainLayout.jsx`)

### React Router configuration (`App.jsx`)
We defined two types of routes:
1.  **Public Routes**: `/login` and `/register`. Anyone can access these.
2.  **Protected Routes**: Everything inside the `<ProtectedRoute>` wrapper. If a user without a token tries to access `/dashboard`, they are immediately redirected to `/login`.

### MainLayout (`MainLayout.jsx`)
Instead of copying and pasting the Sidebar and Navbar into every page, we use a Layout component.
The `MainLayout` renders the `Sidebar` on the left, the `Navbar` on top, and an `<Outlet />` in the middle. 
React Router replaces the `<Outlet />` with whatever page the user is currently viewing (e.g., `DashboardPage` or `SyncPage`). This keeps the code DRY (Don't Repeat Yourself).

---

## 6. Reusable UI Components (`src/components/UI/`)

We built several generic components to ensure visual consistency and speed up future development:

*   **`StatCard.jsx`**: The small metric cards on the dashboard (e.g., "Total Solved"). You just pass it a `title`, `value`, and an `icon`, and it renders perfectly.
*   **`SyncProgressCard.jsx`**: A specialized component that takes the sync state (`status`, `progressPercent`) and renders a beautiful progress bar with dynamic colors (blue for active, green for success, red for failed).
*   **`ProblemTable.jsx`**: A data table specifically styled for LeetCode problems, with dynamic color-coding for difficulties (Easy=Green, Medium=Yellow, Hard=Red).

---

## 7. Theming and Styling (Tailwind CSS)

We configured a custom Dark Theme designed to feel like a premium developer tool (inspired by GitHub, Vercel, and Linear).

### How it works:
1.  **`src/index.css`**: We defined standard CSS variables in the `:root` scope (e.g., `--background: #09090b;`).
2.  **`tailwind.config.js`**: We mapped Tailwind utility classes to those CSS variables. 

Instead of writing `className="bg-[#09090b]"`, we mapped it so you can write `className="bg-background"`. This makes the code much cleaner and makes it incredibly easy to implement a Light Mode switch in the future (you would just change the CSS variables in `index.css`).

### Key Color Mappings:
*   `bg-background`: The main very dark slate color.
*   `bg-surface`: Slightly lighter, used for cards and sidebars to create depth.
*   `text-primary`: The main accent blue.
*   `text-textMain` / `text-textMuted`: Standardized text colors for high and low emphasis.

---

## 8. Next Steps for You

As you continue building PrepForge Pro, here is how you interact with this architecture:

1.  **To add a new API call**: Write an async thunk inside a Redux slice (e.g., `features/problem/problemSlice.js`) that uses the `api/axios.js` instance to fetch data from your backend.
2.  **To add a new page**: 
    *   Create `NewPage.jsx` in `src/pages/`.
    *   Add it to `src/App.jsx` inside the `<MainLayout>` routes.
    *   Add a link to it in `src/components/Sidebar.jsx`.
3.  **To build a new chart**: Look at how Recharts is used in `src/pages/AnalyticsPage.jsx` (e.g., the `RadarChart` or `BarChart`). Copy that pattern and feed it real data from your Redux store.

This foundation is built to handle the complex, backend-heavy nature of your placement intelligence platform while keeping the frontend code organized and professional.
