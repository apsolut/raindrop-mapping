// src/raindrops.js - Raindrop CSV fetching and parsing
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import { getRaw } from './api.js';

/**
 * Fetch CSV export for a specific collection
 * @param {number|string} collectionId
 * @returns {Promise<string>} Raw CSV content
 */
export async function fetchCollectionCsv(collectionId) {
  return getRaw(`/raindrops/${collectionId}/export.csv`);
}

/**
 * Sanitize a string value for CSV safety
 * Replaces newlines and other problematic characters with spaces
 * @param {string} value
 * @returns {string}
 */
function sanitizeValue(value) {
  if (typeof value !== 'string') return value;
  // Replace newlines, carriage returns, and tabs with spaces
  // Also collapse multiple spaces into one
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize all string fields in a row object
 * @param {object} row
 * @returns {object}
 */
function sanitizeRow(row) {
  const sanitized = {};
  for (const [key, value] of Object.entries(row)) {
    sanitized[key] = sanitizeValue(value);
  }
  return sanitized;
}

/**
 * Parse CSV string into array of objects
 * @param {string} csvContent
 * @returns {Promise<Array>}
 */
export function parseCsv(csvContent) {
  return new Promise((resolve, reject) => {
    const results = [];

    const stream = Readable.from(csvContent);
    stream
      .pipe(csvParser())
      .on('data', (row) => results.push(sanitizeRow(row)))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

/**
 * Fetch and parse raindrops for a collection, adding collection metadata
 * @param {number|string} collectionId
 * @param {string} collectionTitle
 * @param {string} fullPath - Full path with group prefix
 * @param {string} rootCollection
 * @param {string} group - The group this collection belongs to
 * @returns {Promise<Array>}
 */
export async function fetchCollectionRaindrops(
  collectionId,
  collectionTitle,
  fullPath,
  rootCollection,
  group
) {
  try {
    const csvContent = await fetchCollectionCsv(collectionId);

    // Handle empty collections
    if (!csvContent || csvContent.trim() === '') {
      return [];
    }

    const rows = await parseCsv(csvContent);

    // Add collection metadata to each row
    return rows.map((row) => ({
      ...row,
      collection_id: collectionId,
      collection_title: collectionTitle,
      full_path: fullPath,
      root_collection: rootCollection,
      group: group,
    }));
  } catch (error) {
    // Handle 404 or empty collections gracefully
    if (error.response?.status === 404) {
      console.warn(`  Warning: Collection ${collectionId} not found or empty`);
      return [];
    }
    throw error;
  }
}

/**
 * Fetch raindrops from all collections
 * @param {Map} collectionMap
 * @param {Map} fullPaths - Full paths with group prefix
 * @param {Map} roots
 * @param {Map} groups - collectionId -> groupTitle
 * @returns {Promise<Array>} All raindrops with collection metadata
 */
export async function fetchAllRaindrops(collectionMap, fullPaths, roots, groups) {
  const allRaindrops = [];
  const seenIds = new Set(); // For deduplication

  const collectionIds = Array.from(collectionMap.keys());
  console.log(`\nFetching raindrops from ${collectionIds.length} collections...`);

  let processed = 0;
  let totalRaindrops = 0;

  for (const id of collectionIds) {
    const node = collectionMap.get(id);
    const fullPath = fullPaths.get(id);
    const root = roots.get(id);
    const group = groups.get(id) || '';

    processed++;
    console.log(`  [${processed}/${collectionIds.length}] Processing: ${fullPath}`);

    try {
      const raindrops = await fetchCollectionRaindrops(id, node.title, fullPath, root, group);

      // Deduplicate by raindrop id
      for (const raindrop of raindrops) {
        const raindropId = raindrop.id || raindrop._id;
        if (raindropId && seenIds.has(raindropId)) {
          continue; // Skip duplicate
        }
        if (raindropId) {
          seenIds.add(raindropId);
        }
        allRaindrops.push(raindrop);
        totalRaindrops++;
      }

      if (raindrops.length > 0) {
        console.log(`    Found ${raindrops.length} raindrops`);
      }
    } catch (error) {
      console.error(`    Error fetching collection ${id}: ${error.message}`);
    }
  }

  console.log(`\nTotal unique raindrops: ${totalRaindrops}`);
  return allRaindrops;
}
