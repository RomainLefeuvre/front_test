# Parquet Optimizations

This document explains how the Vulnerability Fork Lookup System leverages Parquet file format optimizations for efficient querying.

## Overview

The application uses DuckDB WASM to query Parquet files stored in S3/MinIO. Parquet is a columnar storage format that includes several optimization features that allow DuckDB to skip reading large portions of data.

## Enabled Optimizations

### 1. Row Group Statistics (Min/Max)

**What it is:**
- Each row group in a Parquet file stores min/max values for each column
- These statistics are stored in the file footer/metadata

**How it helps:**
- When querying `WHERE revision_swhid = 'abc123'`, DuckDB reads the metadata first
- If a row group's min/max range doesn't include 'abc123', the entire row group is skipped
- No data transfer needed for skipped row groups

**Example:**
```
Row Group 1: revision_swhid min='aaa000', max='bbb999' → SKIP (abc123 not in range)
Row Group 2: revision_swhid min='abc000', max='abc999' → READ (abc123 might be here)
Row Group 3: revision_swhid min='def000', max='zzz999' → SKIP (abc123 not in range)
```

**Configuration:**
```typescript
await conn.query("SET force_statistics=true;");
```

### 2. Page-Level Statistics

**What it is:**
- Similar to row group statistics but at a finer granularity
- Each page within a row group has its own min/max statistics

**How it helps:**
- Even within a row group that passes the initial filter, individual pages can be skipped
- Provides more granular filtering than row group statistics alone

**Example:**
```
Row Group 2 (passed initial filter):
  Page 1: revision_swhid min='abc000', max='abc100' → SKIP
  Page 2: revision_swhid min='abc100', max='abc200' → READ (abc123 is here!)
  Page 3: revision_swhid min='abc200', max='abc999' → SKIP
```

### 3. Bloom Filters

**What it is:**
- Probabilistic data structure stored in Parquet metadata
- Can definitively say "this value is NOT in this row group"
- Very small size (few KB per row group)

**How it helps:**
- Fast negative lookups without reading any data
- Particularly effective for equality predicates (`WHERE column = value`)
- Complements min/max statistics

**Example:**
```
Query: WHERE revision_swhid = 'xyz789'

Row Group 1: Bloom filter says "NOT present" → SKIP (100% certain)
Row Group 2: Bloom filter says "MAYBE present" → Check statistics → READ if needed
```

**Configuration:**
```typescript
await conn.query("SET enable_parquet_bloom_filter=true;");
```

**Note:** Bloom filters must be written into the Parquet files during creation. If your Parquet files don't have bloom filters, this setting has no effect but doesn't hurt.

### 4. HTTP Range Requests

**What it is:**
- HTTP protocol feature that allows requesting specific byte ranges
- DuckDB uses this to read only needed portions of remote files

**How it helps:**
- Metadata (footer) is read first with a small range request
- Only row groups that pass filters are downloaded
- Dramatically reduces data transfer

**Example:**
```
File size: 300 MB
1. Read footer (last 1 MB): 1 Range request
2. Read metadata for all row groups: 1 Range request (~100 KB)
3. Apply filters using statistics and bloom filters
4. Read only matching row groups (e.g., 2 out of 100): 2 Range requests (~6 MB)

Total transferred: ~7 MB instead of 300 MB (97% reduction!)
```

**Configuration:**
```typescript
await conn.query("SET enable_http_metadata_cache=true;");
```

### 5. Object Cache

**What it is:**
- In-memory cache for Parquet metadata (footer, statistics, bloom filters)
- Persists across queries within the same session

**How it helps:**
- Subsequent queries to the same file don't need to re-download metadata
- Faster query execution for repeated searches

**Configuration:**
```typescript
await conn.query("SET enable_object_cache=true;");
```

## Query Patterns

### Optimal Query Pattern

Our queries are designed to maximize these optimizations:

```sql
SELECT DISTINCT revision_swhid, vulnerability_filename
FROM read_parquet('https://s3/bucket/file.parquet')
WHERE revision_swhid = 'abc123'
```

**Why this is optimal:**
1. **Equality predicate** (`=`) works perfectly with bloom filters
2. **Single column filter** on an indexed column (revision_swhid)
3. **DISTINCT** is applied after filtering, minimizing data processed

### What Happens During Query Execution

```
1. DuckDB fetches Parquet footer (HTTP Range request)
   ↓
2. Reads row group metadata (statistics + bloom filters)
   ↓
3. For each row group:
   a. Check bloom filter: Is revision_swhid definitely NOT here?
      → YES: Skip this row group entirely
      → MAYBE: Continue to next check
   
   b. Check min/max statistics: Could revision_swhid be in range?
      → NO: Skip this row group
      → YES: Continue to next check
   
   c. Fetch row group data (HTTP Range request)
   
   d. For each page in row group:
      - Check page-level statistics
      - Skip pages that don't match
      - Decompress and scan matching pages
   ↓
4. Return results
```

## Performance Characteristics

### Best Case Scenario
- Query for a value that doesn't exist
- Bloom filters eliminate all row groups
- Only metadata is downloaded (~1-2 MB for a 300 MB file)
- Query completes in <100ms

### Typical Case
- Query for an existing value
- Bloom filters + statistics eliminate 95-99% of row groups
- Only 1-2 row groups need to be downloaded
- Query completes in 200-500ms

### Worst Case
- Query for a very common value (appears in many row groups)
- Multiple row groups must be downloaded
- Query completes in 1-3 seconds

## Monitoring Optimizations

### Browser DevTools

Check the Network tab to see HTTP Range requests:

```
Request Headers:
  Range: bytes=0-1048576        ← Reading footer
  Range: bytes=1048576-1148576  ← Reading metadata
  Range: bytes=5242880-10485760 ← Reading specific row group
```

### Console Logs

The application logs optimization information:

```
DuckDB: Parquet optimizations enabled:
  ✓ Row group statistics (min/max values)
  ✓ Page-level statistics
  ✓ Bloom filters (fast negative lookups)

DuckDB: No results in 0.parquet (45.23ms - row groups skipped via statistics)
DuckDB: Found 3 results in 1.parquet (123.45ms)
  ↳ Statistics-based filtering used to skip non-matching row groups
```

## Creating Optimized Parquet Files

If you're generating Parquet files for this system, ensure they include:

### 1. Sorted Data
Sort by the query column (revision_swhid or origin):
```python
df.sort_values('revision_swhid').to_parquet('output.parquet')
```

This maximizes the effectiveness of min/max statistics.

### 2. Appropriate Row Group Size
```python
df.to_parquet('output.parquet', row_group_size=100000)
```

- Too small: Too many row groups, more metadata overhead
- Too large: Less granular filtering
- Sweet spot: 50,000 - 200,000 rows per group

### 3. Enable Bloom Filters
```python
import pyarrow.parquet as pq

pq.write_table(
    table,
    'output.parquet',
    bloom_filter_columns=['revision_swhid', 'origin'],
    bloom_filter_fpp=0.01  # 1% false positive rate
)
```

### 4. Enable Statistics
```python
pq.write_table(
    table,
    'output.parquet',
    write_statistics=True,  # Usually enabled by default
    use_dictionary=True     # Also helps with compression
)
```

## Verification

### Using the Provided Script

We provide a Python script to check Parquet metadata:

```bash
# Install pyarrow if needed
pip install pyarrow

# Check a single file
python scripts/checkParquetMetadata.py test-data/vulnerable_commits_using_cherrypicks_swhid/0.parquet

# Check all files in a directory (analyzes first file as sample)
python scripts/checkParquetMetadata.py test-data/vulnerable_commits_using_cherrypicks_swhid/
```

The script will show:
- File size and row count
- Number and size of row groups
- Whether statistics are present
- Whether bloom filters are detected
- Recommendations for optimization

### Manual Check with Python

```python
import pyarrow.parquet as pq

# Read metadata
metadata = pq.read_metadata('file.parquet')

# Check row group 0
rg = metadata.row_group(0)
col = rg.column(0)  # First column

# Check statistics
if col.is_stats_set:
    print(f"✓ Statistics present")
    print(f"  Min: {col.statistics.min}")
    print(f"  Max: {col.statistics.max}")
else:
    print("✗ No statistics")

# Note: Bloom filter detection depends on PyArrow version
# DuckDB will use them if present, even if not exposed by PyArrow
```

### Using parquet-tools

```bash
# Install parquet-tools
pip install parquet-tools

# Show metadata
parquet-tools show test-data/vulnerable_commits_using_cherrypicks_swhid/0.parquet

# Show schema
parquet-tools schema test-data/vulnerable_commits_using_cherrypicks_swhid/0.parquet
```

## Performance Tips

1. **Query one file at a time** (already implemented)
   - Allows better control over HTTP requests
   - Easier to stop early if data is sorted

2. **Use equality predicates** when possible
   - `WHERE col = value` works best with bloom filters
   - Range queries (`WHERE col > value`) only use statistics

3. **Filter on indexed columns**
   - revision_swhid and origin are the primary query columns
   - These should have bloom filters and be sorted

4. **Leverage data ordering**
   - If data is sorted, stop querying after finding results
   - Already implemented in the query engine

## References

- [Parquet Format Specification](https://parquet.apache.org/docs/file-format/)
- [DuckDB Parquet Documentation](https://duckdb.org/docs/data/parquet/overview.html)
- [Bloom Filters in Parquet](https://github.com/apache/parquet-format/blob/master/BloomFilter.md)
- [DuckDB HTTP/S3 Support](https://duckdb.org/docs/extensions/httpfs.html)

## Summary

The combination of these optimizations allows the application to:
- Query 300+ MB Parquet files while downloading only 1-10 MB
- Complete most queries in under 500ms
- Scale to large datasets without backend infrastructure
- Provide a responsive user experience in the browser

All of this happens automatically thanks to DuckDB's intelligent query planning and Parquet's rich metadata structure.
