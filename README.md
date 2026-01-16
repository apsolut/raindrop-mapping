# Raindrop.io Collection Mapper

Export your Raindrop.io bookmarks with full collection hierarchy and group context.

## Quick Start

```bash
npm install
cp .env.example .env  # Add your RAINDROP_TOKEN
npm start
```

## Output Files

When you run the script, it generates:

- `collections.csv` - All collections with hierarchy metadata
- `all_raindrops_with_paths.csv` - All bookmarks with collection context

**Note:** These files contain your personal data and are gitignored. Example files with generic data are provided:
- `collections.csv.example` - Sample collection structure
- `all_raindrops_with_paths.csv.example` - Sample bookmarks (Wikipedia, YouTube, GitHub, etc.)

## Hierarchy Structure

**Groups do NOT nest.** Only collections nest.

```
Group (flat, sidebar label only)
└── Collection (can nest)
    └── SubCollection (can nest)
        └── SubSubCollection (etc.)
```

Example `fullPath`: `Inspiration / Inspiration / Aleksandar / Websites`
```
Inspiration          ← Group (sidebar category)
└── Inspiration      ← Root collection
    └── Aleksandar      ← Child collection
        └── Websites ← Grandchild collection
```

## CSV Columns

### collections.csv

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | Unique collection ID |
| `title` | String | Collection name |
| `parentId` | Integer/Empty | Parent collection ID (empty = root level) |
| `collectionPath` | String | Hierarchy path without group |
| `fullPath` | String | Full path with group prefix |
| `rootCollection` | String | Top-level ancestor name |
| `group` | String | Sidebar group (root collections only) |

### all_raindrops_with_paths.csv

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer | Unique bookmark ID |
| `title` | String | Bookmark title |
| `url` | String | Bookmarked URL |
| `note` | String | User notes |
| `excerpt` | String | Page description |
| `tags` | String | Comma-separated tags |
| `created` | ISO DateTime | Creation timestamp |
| `cover` | String | Thumbnail URL |
| `favorite` | Boolean | Favorite flag |
| `collection_id` | Integer | Parent collection ID |
| `collection_title` | String | Parent collection name |
| `full_path` | String | Full hierarchy with group prefix |
| `root_collection` | String | Top-level ancestor name |
| `group` | String | Sidebar group name |

## Import Logic

When importing into another system:

1. **Build hierarchy** using `parentId` → links collections to their parents
2. **Categorize** using `group` → optional sidebar category (only on root collections)
3. **Display breadcrumbs** using `fullPath` / `full_path` → ready-made path string

### Key Points

- `parentId` empty = root-level collection
- `group` is a flat label, NOT a nestable folder
- `fullPath` = `{group} / {collectionPath}`
- Groups organize root collections in the Raindrop.io sidebar
- Multiple root collections can share the same group

## Environment Variables

```env
RAINDROP_TOKEN=your_token_here
RAINDROP_API_BASE=https://api.raindrop.io/rest/v1  # optional
```

Get your token from: https://app.raindrop.io/settings/integrations

## See Also

- `GUIDE.md` - Detailed CSV documentation with query examples
