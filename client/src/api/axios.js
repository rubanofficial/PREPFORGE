/**
 * DEPRECATED — Use `services/apiClient.js` instead.
 *
 * This file is kept for backwards-compatibility in case any component
 * still imports from `api/axios`. Both instances share the same
 * VITE_API_URL → '/api' fallback strategy and auth interceptors.
 *
 * Prefer importing apiClient from '../services/apiClient' directly.
 */
export { default } from '../services/apiClient';
