// src/index.js - Main entry point
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import { config, validateConfig } from './config.js';
import { loadCollections } from './collections.js';
import { fetchAllRaindrops } from './raindrops.js';

/**
 * Write collections mapping to CSV
 */
async function writeCollectionsCsv(collectionMap, paths, fullPaths, roots, groups) {
  const records = [];

  for (const [id, node] of collectionMap.entries()) {
    records.push({
      id,
      title: node.title,
      parentId: node.parentId || '',
      collectionPath: paths.get(id),
      fullPath: fullPaths.get(id),
      rootCollection: roots.get(id),
      group: groups.get(id) || '',
    });
  }

  const csvWriter = createCsvWriter({
    path: config.collectionsFile,
    header: [
      { id: 'id', title: 'id' },
      { id: 'title', title: 'title' },
      { id: 'parentId', title: 'parentId' },
      { id: 'collectionPath', title: 'collectionPath' },
      { id: 'fullPath', title: 'fullPath' },
      { id: 'rootCollection', title: 'rootCollection' },
      { id: 'group', title: 'group' },
    ],
  });

  await csvWriter.writeRecords(records);
  console.log(`\nWrote ${records.length} collections to ${config.collectionsFile}`);
}

/**
 * Write all raindrops to CSV with collection metadata
 */
async function writeRaindropsCsv(raindrops) {
  if (raindrops.length === 0) {
    console.log('No raindrops to write');
    return;
  }

  // Get all unique headers from the data
  const headerSet = new Set();
  for (const row of raindrops) {
    Object.keys(row).forEach((key) => headerSet.add(key));
  }

  // Ensure our added columns are at the end
  const customColumns = ['collection_id', 'collection_title', 'full_path', 'root_collection', 'group'];
  customColumns.forEach((col) => headerSet.delete(col));

  const headers = [...headerSet, ...customColumns];

  const csvWriter = createCsvWriter({
    path: config.raindropsFile,
    header: headers.map((h) => ({ id: h, title: h })),
  });

  await csvWriter.writeRecords(raindrops);
  console.log(`Wrote ${raindrops.length} raindrops to ${config.raindropsFile}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('Raindrop.io Collection Mapper');
  console.log('=============================\n');

  // Validate configuration
  validateConfig();

  try {
    // Step 1: Load all collections and build hierarchy
    const { map, paths, fullPaths, roots, groups } = await loadCollections();

    // Step 2: Write collections mapping
    await writeCollectionsCsv(map, paths, fullPaths, roots, groups);

    // Step 3: Fetch all raindrops with collection metadata
    const allRaindrops = await fetchAllRaindrops(map, fullPaths, roots, groups);

    // Step 4: Write merged raindrops CSV
    await writeRaindropsCsv(allRaindrops);

    console.log('\nDone!');
  } catch (error) {
    console.error('\nFatal error:', error.message);
    if (error.response?.data) {
      console.error('API response:', error.response.data);
    }
    process.exit(1);
  }
}

main();
