// Centralized API base URL configuration
// Prefer environment variable if provided; fallback based on environment
const getApiBaseUrl = () => {
  // If REACT_APP_API_URL is explicitly set, use it
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // In production (when not localhost), use the production backend URL
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://practice2panel-7bj2.onrender.com';
  }
  
  // Default to localhost for development
  return 'http://localhost:5000';
};

export const API_BASE_URL = getApiBaseUrl();


