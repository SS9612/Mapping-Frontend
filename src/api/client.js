import axios from "axios";
import { isValidToken, isTokenExpired } from "../utils/tokenUtils";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  timeout: 30000,
});

// Add token to requests and validate before sending
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      // Validate token before adding to request
      if (!isValidToken(token) || isTokenExpired(token)) {
        // Token is invalid or expired, clear it
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        // Redirect to login if not already there
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(new Error("Token expired or invalid"));
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle responses and errors
client.interceptors.response.use(
  (response) => {
    // Extract data from ApiResponse wrapper if present
    if (response.data?.data !== undefined && response.data?.success !== undefined) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  async (error) => {
    // Handle 401 responses (unauthorized)
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("username");

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    // Retry logic for network errors
    if (!error.response && error.config && !error.config.__isRetryRequest) {
      error.config.__isRetryRequest = true;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return client.request(error.config);
    }

    return Promise.reject(error);
  }
);

export default client;
