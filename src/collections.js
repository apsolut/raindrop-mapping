// src/collections.js - Collection fetching and tree building
import { get } from './api.js';

/**
 * Fetch all root-level collections
 */
export async function fetchRootCollections() {
  const data = await get('/collections');
  return data.items || [];
}

/**
 * Fetch all nested/child collections
 */
export async function fetchChildCollections() {
  const data = await get('/collections/childrens');
  return data.items || [];
}

/**
 * Fetch user groups from /user endpoint
 * Groups organize collections into categories like "Work", "Discovery", etc.
 */
export async function fetchGroups() {
  const data = await get('/user');
  return data.user?.groups || [];
}

/**
 * Build a map of collectionId -> groupTitle
 * @param {Array} groups - Array of group objects from API
 * @returns {Map} collectionId -> groupTitle
 */
export function buildGroupMap(groups) {
  const map = new Map();
  for (const group of groups) {
    const groupTitle = group.title || '';
    for (const collectionId of group.collections || []) {
      map.set(collectionId, groupTitle);
    }
  }
  return map;
}

/**
 * Build a map of collection id -> { id, title, parentId }
 * @param {Array} rootCollections
 * @param {Array} childCollections
 * @returns {Map}
 */
export function buildCollectionMap(rootCollections, childCollections) {
  const map = new Map();

  function addCollection(col, defaultParentId = null) {
    const id = col._id || col.id;

    // Extract parent ID from various formats Raindrop might use
    let parentId = defaultParentId;
    if (col.parent) {
      parentId = col.parent.$id || col.parent._id || col.parent.id || col.parent;
      if (typeof parentId === 'object') parentId = null;
    }

    map.set(id, {
      id,
      title: col.title,
      parentId: parentId || null,
    });
  }

  // Add root collections (no parent)
  rootCollections.forEach((c) => addCollection(c, null));

  // Add child collections
  childCollections.forEach((c) => addCollection(c));

  return map;
}

/**
 * Compute full paths for all collections
 * @param {Map} collectionMap
 * @returns {Map} id -> full path string
 */
export function computeCollectionPaths(collectionMap) {
  const pathCache = new Map();

  function getPath(id) {
    if (pathCache.has(id)) return pathCache.get(id);

    const node = collectionMap.get(id);
    if (!node) return '';

    // No parent = root level
    if (!node.parentId || !collectionMap.has(node.parentId)) {
      pathCache.set(id, node.title);
      return node.title;
    }

    // Build path from parent
    const parentPath = getPath(node.parentId);
    const fullPath = `${parentPath} / ${node.title}`;
    pathCache.set(id, fullPath);
    return fullPath;
  }

  // Compute paths for all collections
  for (const id of collectionMap.keys()) {
    getPath(id);
  }

  return pathCache;
}

/**
 * Compute root collection (top ancestor) for each collection
 * @param {Map} collectionMap
 * @returns {Map} id -> root collection title
 */
export function computeRootCollections(collectionMap) {
  const rootCache = new Map();

  function getRoot(id) {
    if (rootCache.has(id)) return rootCache.get(id);

    const node = collectionMap.get(id);
    if (!node) return '';

    // No parent = this IS the root
    if (!node.parentId || !collectionMap.has(node.parentId)) {
      rootCache.set(id, node.title);
      return node.title;
    }

    // Get root from parent
    const root = getRoot(node.parentId);
    rootCache.set(id, root);
    return root;
  }

  // Compute roots for all collections
  for (const id of collectionMap.keys()) {
    getRoot(id);
  }

  return rootCache;
}

/**
 * Compute root collection ID (top ancestor ID) for each collection
 * @param {Map} collectionMap
 * @returns {Map} id -> root collection ID
 */
export function computeRootCollectionIds(collectionMap) {
  const rootIdCache = new Map();

  function getRootId(id) {
    if (rootIdCache.has(id)) return rootIdCache.get(id);

    const node = collectionMap.get(id);
    if (!node) return null;

    // No parent = this IS the root
    if (!node.parentId || !collectionMap.has(node.parentId)) {
      rootIdCache.set(id, id);
      return id;
    }

    // Get root ID from parent
    const rootId = getRootId(node.parentId);
    rootIdCache.set(id, rootId);
    return rootId;
  }

  // Compute root IDs for all collections
  for (const id of collectionMap.keys()) {
    getRootId(id);
  }

  return rootIdCache;
}

/**
 * Compute full paths with group prefix for all collections
 * @param {Map} paths - collection paths
 * @param {Map} rootIds - root collection IDs
 * @param {Map} groups - group map (root collection ID -> group title)
 * @returns {Map} id -> full path with group prefix
 */
export function computeFullPaths(paths, rootIds, groups) {
  const fullPaths = new Map();

  for (const [id, path] of paths.entries()) {
    const rootId = rootIds.get(id);
    const group = rootId ? groups.get(rootId) : '';

    if (group) {
      fullPaths.set(id, `${group} / ${path}`);
    } else {
      fullPaths.set(id, path);
    }
  }

  return fullPaths;
}

/**
 * Fetch and build complete collection data
 * @returns {Promise<{map: Map, paths: Map, fullPaths: Map, roots: Map, groups: Map}>}
 */
export async function loadCollections() {
  console.log('Fetching collections and groups...');

  const [rootCollections, childCollections, groupsData] = await Promise.all([
    fetchRootCollections(),
    fetchChildCollections(),
    fetchGroups(),
  ]);

  console.log(`  Found ${rootCollections.length} root collections`);
  console.log(`  Found ${childCollections.length} child collections`);
  console.log(`  Found ${groupsData.length} groups`);

  const map = buildCollectionMap(rootCollections, childCollections);

  // Check for orphaned collections (parent ID exists but parent not in map)
  const orphans = [];
  for (const [id, node] of map.entries()) {
    if (node.parentId && !map.has(node.parentId)) {
      orphans.push({ id, title: node.title, missingParentId: node.parentId });
    }
  }
  if (orphans.length > 0) {
    console.warn(`\n  WARNING: Found ${orphans.length} orphaned collections (missing parent):`);
    orphans.forEach(o => console.warn(`    - "${o.title}" (id=${o.id}) missing parent ${o.missingParentId}`));
    console.log('');
  }

  const paths = computeCollectionPaths(map);
  const roots = computeRootCollections(map);
  const rootIds = computeRootCollectionIds(map);
  const groups = buildGroupMap(groupsData);
  const fullPaths = computeFullPaths(paths, rootIds, groups);

  console.log(`  Total: ${map.size} collections`);

  // Debug: show hierarchy depth analysis (using fullPaths now)
  const depthCounts = new Map();
  for (const [id, path] of fullPaths.entries()) {
    const depth = (path.match(/ \/ /g) || []).length + 1;
    depthCounts.set(depth, (depthCounts.get(depth) || 0) + 1);
  }
  console.log('\n  Hierarchy depth analysis (with group prefix):');
  for (const [depth, count] of [...depthCounts.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`    Level ${depth}: ${count} collections`);
  }

  // Debug: show sample full paths at each depth
  console.log('\n  Sample full paths by depth:');
  const shownDepths = new Set();
  for (const [id, path] of fullPaths.entries()) {
    const depth = (path.match(/ \/ /g) || []).length + 1;
    if (!shownDepths.has(depth)) {
      shownDepths.add(depth);
      console.log(`    Level ${depth}: ${path}`);
    }
  }
  console.log('');

  return { map, paths, fullPaths, roots, groups };
}
