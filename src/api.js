// src/api.js - API client with error handling and rate limiting
import axios from 'axios';
import https from 'https';
import { config } from './config.js';

// Create HTTPS agent (handles SSL cert issues on some Windows setups)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const client = axios.create({
  baseURL: config.apiBase,
  headers: {
    Authorization: `Bearer ${config.token}`,
  },
  httpsAgent,
});

// Simple delay helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Make an API request with retry logic and rate limiting
 * @param {string} method - HTTP method
 * @param {string} url - API endpoint
 * @param {object} options - Axios options
 * @returns {Promise<any>} Response data
 */
export async function apiRequest(method, url, options = {}) {
  let lastError;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      // Rate limiting delay
      if (attempt > 1) {
        const retryWait = config.retryDelay * Math.pow(2, attempt - 1);
        console.log(`  Retry ${attempt}/${config.maxRetries} after ${retryWait}ms...`);
        await delay(retryWait);
      }

      const response = await client.request({
        method,
        url,
        ...options,
      });

      // Small delay between successful requests for rate limiting
      await delay(config.requestDelay);

      return response.data;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;

      // Handle specific HTTP errors
      if (status === 401) {
        console.error('Error 401: Unauthorized - Check your RAINDROP_TOKEN');
        throw error;
      }

      if (status === 429) {
        console.warn(`Warning: Rate limited (429). Waiting before retry...`);
        await delay(5000); // Extra delay for rate limiting
        continue;
      }

      if (status >= 500) {
        console.warn(`Warning: Server error (${status}). Retrying...`);
        continue;
      }

      // For other errors, throw immediately
      throw error;
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * GET request helper
 */
export async function get(url, options = {}) {
  return apiRequest('GET', url, options);
}

/**
 * Get raw response (for CSV downloads)
 */
export async function getRaw(url) {
  let lastError;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        const retryWait = config.retryDelay * Math.pow(2, attempt - 1);
        console.log(`  Retry ${attempt}/${config.maxRetries} after ${retryWait}ms...`);
        await delay(retryWait);
      }

      const response = await client.get(url, {
        responseType: 'text',
      });

      await delay(config.requestDelay);
      return response.data;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;

      if (status === 401) {
        console.error('Error 401: Unauthorized - Check your RAINDROP_TOKEN');
        throw error;
      }

      if (status === 429) {
        console.warn(`Warning: Rate limited (429). Waiting before retry...`);
        await delay(5000);
        continue;
      }

      if (status >= 500) {
        console.warn(`Warning: Server error (${status}). Retrying...`);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}
