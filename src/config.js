// src/config.js - Configuration management
import 'dotenv/config';

export const config = {
  token: process.env.RAINDROP_TOKEN,
  apiBase: process.env.RAINDROP_API_BASE || 'https://api.raindrop.io/rest/v1',

  // Rate limiting
  requestDelay: 200, // ms between requests
  maxRetries: 3,
  retryDelay: 1000, // ms before retry (doubles each attempt)

  // Output files
  collectionsFile: 'collections.csv',
  raindropsFile: 'all_raindrops_with_paths.csv',
};

export function validateConfig() {
  if (!config.token) {
    console.error('Error: Missing RAINDROP_TOKEN in .env file');
    console.error('Get your token from: https://app.raindrop.io/settings/integrations');
    process.exit(1);
  }
}
