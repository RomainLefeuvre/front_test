# Parquet Bloom Filter & Statistics Optimization

## Overview

This document explains how DuckDB uses Bloom filters, statistics, and filter pushdown to minimize data transfer when querying Parquet files over HTTP.

## Key Optimizations

### 1. Bloom Filters (`enable_parquet_bloom_filter=true`)

**What it does:**
- Bloom filters are probabilistic data structures stored in Parquet file metadata
- They can quickly determine if a value is **definitely NOT** in a row group
- Extremely efficient for equality predicates (`WHERE column = value`)

**How it works:**
```
Query: WHERE revision_swhid = 'abc123...'

1. DuckDB reads Parquet metadata (~few KB)
2. Checks Bloom filter for each row group
3. Bloom filter says "NO" → Skip entire row group (no download)
4. Bloom filter says "MAYBE" → Download and scan row group
```

**Benefits:**
- Eliminates row groups without downloading them
- Especially effective when searching for specific values in large datasets
- Minimal overhead (Bloom filters are small, ~1-2% of data size)

### 2. Statistics-Based Filtering (`force_statistics=true`)

**What it does:**
- Parquet files store min/max values for each column in each row group
- DuckDB uses these statistics to skip row groups that can't contain matching values

**How it works:**
```
Query: WHERE revision_swhid = 'abc123...'

Row Group 1: min='aaa000...', max='aaa999...' → Skip (value not in range)
Row Group 2: min='abc000...', max='abc999...' → Download (value might be here)
Row Group 3: min='bbb000...', max='bbb999...' → Skip (value not in range)
```

**Benefits:**
- Works for all comparison operators (=, <, >, <=, >=, BETWEEN)
- No false positives (unlike Bloom filters)
- Especially effective when data is sorted or clustered

### 3. Filter Pushdown (`force_pushdown=true`)

**What it does:**
- Pushes WHERE clause predicates down to the Parquet scan operator
- Filters are applied **before** decompression and deserialization

**How it works:**
```
Without pushdown:
1. Read all row groups
2. Decompress all data
3. Deserialize all rows
4. Apply WHERE filter
5. Return matching rows

With pushdown:
1. Apply Bloom filter → Skip row groups
2. Apply statistics → Skip more row groups
3. Read only matching row groups
4. Decompress only matching data
5. Deserialize only matching rows
6. Return matching rows
```

**Benefits:**
- Reduces CPU usage (less decompression)
- Reduces memory usage (less data in memory)
- Reduces network transfer (only matching row groups downloaded)

### 4. Column Projection

**What it does:**
- Only reads the columns specified in the SELECT clause
- Parquet is columnar, so each column is stored separately

**How it works:**
```
Query: SELECT revision_swhid, vulnerability_filename FROM ...

Parquet file columns:
- revision_swhid (read ✓)
- vulnerability_filename (read ✓)
- category (skip ✗)
- timestamp (skip ✗)
- other_data (skip ✗)
```

**Benefits:**
- Reduces network transfer (only needed columns downloaded)
- Reduces memory usage (less data in memory)
- Faster query execution (less data to process)

### 5. HTTP Range Requests

**What it does:**
- Uses HTTP Range headers to download only specific byte ranges
- Allows partial file downloads

**How it works:**
```
1. Download metadata (first ~few KB)
   GET /file.parquet
   Range: bytes=0-16384

2. Download matching row group 1
   GET /file.parquet
   Range: bytes=1048576-2097152

3. Download matching row group 5
   GET /file.parquet
   Range: bytes=5242880-6291456
```

**Benefits:**
- Only downloads needed data
- Can skip large portions of files
- Reduces bandwidth usage significantly

## Combined Effect

When all optimizations work together:

```
Example: Search for 1 commit in 158M commits across 100 Parquet files

Without optimizations:
- Download: 100 files × 500 MB = 50 GB
- Time: ~10 minutes (on fast connection)

With optimizations:
- Download metadata: 100 files × 10 KB = 1 MB
- Bloom filters eliminate: 95 files (no download)
- Statistics eliminate: 4 files (no download)
- Download matching row groups: 1 file × 5 MB = 5 MB
- Total download: 1 MB + 5 MB = 6 MB
- Time: ~1-2 seconds

Reduction: 50 GB → 6 MB (99.99% less data transferred!)
```

## Verification

### Check Network Tab in DevTools

Look for:
1. **Range requests**: `Range: bytes=X-Y` in request headers
2. **Partial content**: `206 Partial Content` status code
3. **Small transfers**: Most requests should be < 100 KB (metadata only)
4. **Few large transfers**: Only matching row groups downloaded

### Check Console Logs

DuckDB logs show:
```
DuckDB: ✓ Found 5 results in 0.parquet (45.23ms)
  ↳ Bloom filter: Identified matching row groups
  ↳ Statistics: Skipped non-matching row groups
  ↳ Column projection: Only read 2 columns
  ↳ HTTP Range: Downloaded only matching row groups

DuckDB: ⊗ No results in 1.parquet (12.45ms)
  ↳ Bloom filter: No matching row groups (file skipped efficiently)
  ↳ Statistics: All row groups pruned via min/max values
  ↳ HTTP: Only metadata downloaded (~few KB)
```

### EXPLAIN and EXPLAIN ANALYZE

The query engine automatically runs `EXPLAIN` and `EXPLAIN ANALYZE` for the first query to show:

**EXPLAIN (Logical Plan):**
```
═══════════════════════════════════════════════════════════
📊 QUERY EXECUTION PLAN (Logical Plan)
═══════════════════════════════════════════════════════════
  PROJECTION
  │   ─ revision_swhid
  │   ─ vulnerability_filename
  └─ FILTER
      │   ─ revision_swhid = 'abc123...'
      └─ PARQUET_SCAN
          │   ─ File: 0.parquet
          │   ─ Filters: revision_swhid = 'abc123...'
          │   ─ Columns: [revision_swhid, vulnerability_filename]
═══════════════════════════════════════════════════════════
```

**EXPLAIN ANALYZE (Actual Statistics):**
```
═══════════════════════════════════════════════════════════
📈 QUERY EXECUTION ANALYSIS - 0.parquet
═══════════════════════════════════════════════════════════
  PARQUET_SCAN
  │   ─ Row Groups: 100 total
  │   ─ Row Groups Scanned: 2
  │   ─ Row Groups Skipped: 98 (via Bloom filter + statistics)
  │   ─ Rows Scanned: 1,234,567
  │   ─ Bytes Read: 5.23 MB
  │   ─ Scan Time: 45.23ms
═══════════════════════════════════════════════════════════
📊 KEY OPTIMIZATION METRICS:
  ✓ Row Groups: 2 scanned, 98 skipped
    → 98.0% of row groups eliminated by Bloom filters + statistics
  ✓ Rows Scanned: 1,234,567 rows
  ✓ Data Read: 5.23 MB (via HTTP Range requests)
  ✓ Scan Time: 45.23ms

💡 Interpretation:
  • Skipped row groups = Bloom filters + statistics working
  • Low data read = Only matching chunks downloaded
  • Fast scan time = Column projection + filter pushdown working
═══════════════════════════════════════════════════════════
```

**Key Metrics Explained:**

- **Row Groups Scanned**: Number of row groups that were actually read from disk
- **Row Groups Skipped**: Number of row groups eliminated by Bloom filters and statistics
- **Skip Percentage**: Higher is better (means less data downloaded)
- **Bytes Read**: Actual data transferred via HTTP Range requests
- **Scan Time**: Time spent reading and decompressing data

**What to Look For:**

✅ **Good Performance:**
- High skip percentage (> 90%)
- Low bytes read (< 10 MB for single-value lookups)
- Fast scan time (< 100ms)

⚠️ **Poor Performance:**
- Low skip percentage (< 50%)
- High bytes read (> 100 MB)
- Slow scan time (> 1 second)

If performance is poor, check:
1. Are Bloom filters enabled in the Parquet files?
2. Are statistics present (min/max values)?
3. Is the data sorted/clustered by the query column?

## Configuration

All optimizations are enabled in `queryEngine.ts`:

```typescript
// Bloom filters
await conn.query("SET enable_parquet_bloom_filter=true;");

// Statistics-based filtering
await conn.query("SET force_statistics=true;");

// Filter pushdown
await conn.query("SET force_pushdown=true;");

// HTTP optimizations
await conn.query("SET enable_http_metadata_cache=true;");
await conn.query("SET http_keep_alive=true;");

// Parallel reading
await conn.query("SET enable_parallel_parquet=true;");
await conn.query("SET threads=4;");
```

## Query Patterns

### Optimized Queries

```sql
-- ✓ GOOD: Equality predicate (uses Bloom filter + statistics)
SELECT revision_swhid, vulnerability_filename
FROM read_parquet('file.parquet')
WHERE revision_swhid = 'abc123...';

-- ✓ GOOD: Range predicate (uses statistics)
SELECT * FROM read_parquet('file.parquet')
WHERE timestamp BETWEEN '2020-01-01' AND '2020-12-31';

-- ✓ GOOD: Column projection (only reads needed columns)
SELECT revision_swhid, vulnerability_filename
FROM read_parquet('file.parquet');
```

### Less Optimized Queries

```sql
-- ⚠ LESS OPTIMAL: LIKE with wildcard (can't use Bloom filter)
SELECT * FROM read_parquet('file.parquet')
WHERE revision_swhid LIKE '%abc%';

-- ⚠ LESS OPTIMAL: Function on column (can't use statistics)
SELECT * FROM read_parquet('file.parquet')
WHERE LOWER(revision_swhid) = 'abc123...';

-- ⚠ LESS OPTIMAL: SELECT * (reads all columns)
SELECT * FROM read_parquet('file.parquet')
WHERE revision_swhid = 'abc123...';
```

## Performance Tips

1. **Use equality predicates** when possible (enables Bloom filters)
2. **Select only needed columns** (reduces data transfer)
3. **Sort/cluster data** by frequently queried columns (improves statistics effectiveness)
4. **Use appropriate row group size** (128 MB is typical, allows fine-grained filtering)
5. **Enable Bloom filters** when writing Parquet files (adds ~1-2% overhead)

## Monitoring

### Metrics to Watch

- **Network transfer**: Should be minimal (< 10 MB for typical queries)
- **Query time**: Should be < 1 second for single-value lookups
- **Files queried**: Should stop early when data is sorted
- **Row groups skipped**: Should be > 90% for selective queries

### Troubleshooting

If queries are slow:
1. Check if Bloom filters are enabled in Parquet files
2. Verify statistics are present (min/max values)
3. Check if data is sorted/clustered
4. Look for full file downloads (indicates filter pushdown not working)
5. Verify HTTP Range requests are being used

## References

- [DuckDB Parquet Documentation](https://duckdb.org/docs/data/parquet)
- [Parquet Format Specification](https://parquet.apache.org/docs/)
- [Bloom Filter Wikipedia](https://en.wikipedia.org/wiki/Bloom_filter)
- [HTTP Range Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)
