# DuckDB Query Plan Analysis

## Overview

The application now logs DuckDB query execution plans using `EXPLAIN` to verify that Parquet optimizations are being applied. This document explains how to read and interpret these plans.

## Viewing Query Plans

Query plans are automatically logged to the browser console for the first file queried in each search.

### How to View

1. Open browser DevTools (F12)
2. Go to Console tab
3. Perform a search
4. Look for "DuckDB: Query execution plan (first file):"

## Example Query Plan

```
DuckDB: Query execution plan (first file):
  ┌───────────────────────────┐
  │      QUERY_RESULT         │
  │   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
  │             0             │
  │             2             │
  └─────────────┬─────────────┘
  ┌─────────────┴─────────────┐
  │         DISTINCT           │
  │   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
  │             0             │
  │             2             │
  └─────────────┬─────────────┘
  ┌─────────────┴─────────────┐
  │      PARQUET_SCAN         │
  │   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
  │ revision_swhid               │
  │ vulnerability_filename    │
  │   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
  │ Filters: revision_swhid='...'│
  │   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
  │ Statistics: ENABLED       │
  │ Bloom Filter: ENABLED     │
  │   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
  │             0             │
  │             2             │
  └───────────────────────────┘
```

## Key Components

### 1. PARQUET_SCAN

This is the most important node for our optimizations.

```
┌─────────────────────────────┐
│      PARQUET_SCAN           │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     │
│ revision_swhid                 │
│ vulnerability_filename      │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     │
│ Filters: revision_swhid='abc'  │
│   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     │
│ Statistics: ENABLED         │
│ Bloom Filter: ENABLED       │
└─────────────────────────────┘
```

**What to look for:**
- ✅ **Filters:** Shows the WHERE clause is pushed down to Parquet scan
- ✅ **Statistics: ENABLED** - Row group statistics are being used
- ✅ **Bloom Filter: ENABLED** - Bloom filters are being used (if available in file)

### 2. Column Projection

```
│ revision_swhid                 │
│ vulnerability_filename      │
```

**What this means:**
- Only these columns are read from Parquet
- Other columns in the file are skipped
- Reduces I/O and memory usage

### 3. Filter Pushdown

```
│ Filters: revision_swhid='abc123...'│
```

**What this means:**
- ✅ Filter is applied at the Parquet scan level (good!)
- ❌ If filter appears after PARQUET_SCAN, it's applied after reading (bad!)

**Good (Filter Pushdown):**
```
PARQUET_SCAN
  Filters: revision_swhid='abc'
```

**Bad (Post-Scan Filter):**
```
FILTER
  revision_swhid='abc'
  └─ PARQUET_SCAN
```

### 4. Statistics Usage

```
│ Statistics: ENABLED         │
```

**What this means:**
- DuckDB will read row group metadata
- Min/max values used to skip row groups
- Only row groups that might contain the value are read

**Example:**
```
Row Group 1: min='aaa', max='bbb' → SKIP (abc not in range)
Row Group 2: min='abc', max='def' → READ (abc might be here)
Row Group 3: min='xyz', max='zzz' → SKIP (abc not in range)
```

### 5. Bloom Filter Usage

```
│ Bloom Filter: ENABLED       │
```

**What this means:**
- Bloom filter is checked before reading row group
- Can definitively say "value NOT present"
- Faster than statistics check

**Example:**
```
Row Group 1: Bloom filter says "NOT present" → SKIP (100% certain)
Row Group 2: Bloom filter says "MAYBE present" → Check statistics → READ
```

## Optimization Verification

### ✅ Optimal Plan

All optimizations are working:

```
PARQUET_SCAN
  Columns: revision_swhid, vulnerability_filename
  Filters: revision_swhid='abc123'
  Statistics: ENABLED
  Bloom Filter: ENABLED
  Projection Pushdown: YES
```

**Characteristics:**
- Filter at PARQUET_SCAN level
- Statistics enabled
- Bloom filter enabled
- Only needed columns selected

### ⚠️ Suboptimal Plan

Some optimizations missing:

```
FILTER
  revision_swhid='abc123'
  └─ PARQUET_SCAN
       Columns: *
       Statistics: DISABLED
```

**Problems:**
- Filter applied AFTER scan (not pushed down)
- All columns read (no projection pushdown)
- Statistics not used

### ❌ Bad Plan

No optimizations:

```
FILTER
  revision_swhid='abc123'
  └─ SEQ_SCAN
       read_parquet('file.parquet')
```

**Problems:**
- Sequential scan (reads entire file)
- No filter pushdown
- No statistics
- No bloom filters

## Performance Indicators

### Row Group Skipping

Look for these in the plan or logs:

```
DuckDB: No results in 0.parquet (45.23ms - row groups skipped via statistics)
```

**What this means:**
- Query completed in 45ms
- No data was actually read (only metadata)
- All row groups were skipped via statistics

**Performance:**
- Fast query (< 100ms)
- Minimal data transfer (< 1 MB)
- Efficient use of HTTP Range requests

### Row Group Reading

```
DuckDB: Found 3 results in 1.parquet (123.45ms)
  ↳ Statistics-based filtering used to skip non-matching row groups
```

**What this means:**
- Some row groups were skipped
- Some row groups were read
- Results found in 123ms

**Performance:**
- Moderate query time (100-500ms)
- Partial data transfer (1-10 MB)
- Some row groups skipped

## Troubleshooting

### Statistics Not Enabled

**Symptom:**
```
PARQUET_SCAN
  Statistics: DISABLED
```

**Possible causes:**
1. Parquet file doesn't have statistics
2. DuckDB version doesn't support statistics
3. Configuration not applied

**Solution:**
- Check Parquet file with `scripts/checkParquetMetadata.py`
- Verify DuckDB version (should be 1.31.0+)
- Check initialization logs for "Statistics-based filtering enabled"

### Bloom Filter Not Enabled

**Symptom:**
```
PARQUET_SCAN
  Bloom Filter: DISABLED
```

**Possible causes:**
1. Parquet file doesn't have bloom filters
2. DuckDB version doesn't support bloom filters
3. Configuration not applied

**Solution:**
- Bloom filters must be written when creating Parquet files
- Check with: `python scripts/checkParquetMetadata.py file.parquet`
- If missing, regenerate Parquet files with bloom filters

### Filter Not Pushed Down

**Symptom:**
```
FILTER
  revision_swhid='abc'
  └─ PARQUET_SCAN
```

**Possible causes:**
1. Complex WHERE clause
2. Function applied to column
3. DuckDB optimizer decision

**Solution:**
- Use simple equality predicates: `WHERE col = value`
- Avoid: `WHERE LOWER(col) = value` (function prevents pushdown)
- Avoid: `WHERE col LIKE '%value%'` (wildcard prevents pushdown)

## Advanced Analysis

### EXPLAIN ANALYZE

For more detailed analysis, you can use `EXPLAIN ANALYZE` (requires code modification):

```typescript
const explainResult = await this.conn!.query(`EXPLAIN ANALYZE ${querySQL}`);
```

This shows:
- Actual execution time per operator
- Number of rows processed
- Memory usage
- I/O statistics

**Example output:**
```
PARQUET_SCAN
  Time: 45.23ms
  Rows: 0
  Row Groups Read: 0/100 (0%)
  Bytes Read: 1.2 MB (metadata only)
```

### Profiling

Enable DuckDB profiling for detailed metrics:

```typescript
await this.conn.query("SET enable_profiling=true;");
await this.conn.query("SET profiling_mode='detailed';");
```

Then query:
```typescript
const result = await this.conn.query(querySQL);
const profile = await this.conn.query("SELECT * FROM pragma_last_profiling_output();");
```

## Best Practices

### 1. Always Check First Query

The plan is logged for the first file only to avoid console spam. This is usually sufficient since all files use the same schema and optimizations.

### 2. Look for Key Indicators

Quick checklist:
- ✅ Filter at PARQUET_SCAN level
- ✅ Statistics: ENABLED
- ✅ Bloom Filter: ENABLED (if available)
- ✅ Only needed columns listed

### 3. Monitor Query Times

- < 100ms: Excellent (row groups skipped)
- 100-500ms: Good (some row groups read)
- > 500ms: Check plan for issues

### 4. Check Network Tab

Correlate plan with network activity:
- Small Range requests = optimizations working
- Large full file downloads = optimizations not working

## Example Scenarios

### Scenario 1: Value Not Found

```
Query: WHERE revision_swhid='nonexistent'
Plan: Statistics: ENABLED, Bloom Filter: ENABLED
Time: 45ms
Network: 1.2 MB (metadata only)
Result: 0 rows
```

**Analysis:** Perfect! All row groups skipped via bloom filters and statistics.

### Scenario 2: Value Found

```
Query: WHERE revision_swhid='abc123'
Plan: Statistics: ENABLED, Bloom Filter: ENABLED
Time: 234ms
Network: 5.3 MB (metadata + 2 row groups)
Result: 3 rows
```

**Analysis:** Good! Most row groups skipped, only 2 read.

### Scenario 3: No Optimizations

```
Query: WHERE revision_swhid='abc123'
Plan: Statistics: DISABLED
Time: 3456ms
Network: 315 MB (full file)
Result: 3 rows
```

**Analysis:** Bad! Entire file read. Check Parquet file and configuration.

## Summary

Query plan analysis helps verify that:
- ✅ Parquet optimizations are enabled
- ✅ Filters are pushed down to scan level
- ✅ Statistics and bloom filters are used
- ✅ Only necessary columns are read
- ✅ Row groups are efficiently skipped

This ensures optimal query performance with minimal data transfer.
