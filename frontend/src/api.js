// Centralised API base URL.
// Set VITE_API_URL in frontend/.env to override for production.
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export default API;
