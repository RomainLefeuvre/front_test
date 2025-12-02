# Quick Verification Guide

This guide helps you verify that all optimizations are working correctly.

## Prerequisites

- MinIO running with data uploaded
- Development server running (`npm run dev`)
- Browser DevTools open (F12)

## Step-by-Step Verification

### 1. Check MinIO Setup

```bash
# Verify MinIO is running
docker ps | grep minio

# Should show:
# vuln-lookup-minio ... Up ... 0.0.0.0:9093->9000/tcp
```

### 2. Check Data Accessibility

```bash
# Test public access to parquet files
curl -I http://localhost:9093/vuln-data-dev/vulnerable_commits_using_cherrypicks_swhid/0.parquet

# Should return:
# HTTP/1.1 200 OK
```

If you get `403 Forbidden`, run:
```bash
npm run setup-minio-dev
```

### 3. Open Application

1. Navigate to `http://localhost:5173`
2. Open DevTools (F12) → Console tab
3. Keep Console open for next steps

### 4. Verify DuckDB Initialization

Perform any search. Look for these logs:

```
✅ DuckDB: HTTP metadata cache enabled
✅ DuckDB: Object cache enabled (for Parquet metadata)
✅ DuckDB: Statistics-based filtering (enabled by default)
✅ DuckDB: Parquet Bloom filters enabled
✅ DuckDB: Parquet optimizations enabled:
     ✓ Row group statistics (min/max values)
     ✓ Page-level statistics
     ✓ Bloom filters (fast negative lookups)
```

**If you see errors:**
- Check that DuckDB WASM loaded correctly
- Verify browser supports WebAssembly
- Check for CORS issues

### 5. Verify Query Execution Plan

After a search, look for:

```
✅ DuckDB: Query execution plan (first file):
     PARQUET_SCAN
       Filters: revision_id='...' or origin='...'
       Statistics: ENABLED
       Bloom Filter: ENABLED
```

**What to check:**
- ✅ `PARQUET_SCAN` present (not `SEQ_SCAN`)
- ✅ `Filters:` shows your WHERE clause
- ✅ `Statistics: ENABLED`
- ✅ `Bloom Filter: ENABLED` (if available in files)

### 6. Verify HTTP Range Requests

1. Go to DevTools → Network tab
2. Perform a search
3. Click on a `.parquet` file request
4. Check Request Headers

**Should see:**
```
✅ Range: bytes=0-1048576
✅ Range: bytes=1048576-1148576
```

**Multiple small Range requests = Optimizations working!**

**If you see:**
- ❌ No Range header
- ❌ Single large request downloading entire file
- → Check MinIO CORS and bucket policy

### 7. Verify Row Group Skipping

Look for these log patterns:

**When value not found:**
```
✅ DuckDB: No results in 0.parquet (45.23ms - row groups skipped via statistics)
```
- Fast query (< 100ms)
- Row groups skipped

**When value found:**
```
✅ DuckDB: Found 3 results in 1.parquet (123.45ms)
     ↳ Statistics-based filtering used to skip non-matching row groups
```
- Moderate time (100-500ms)
- Some row groups read

### 8. Verify CVE Lazy Loading

1. Search for something with many results (e.g., a popular repository)
2. Watch the Console

**Should see:**
```
✅ DuckDB: Found 50 results
✅ Applying filters...
✅ Loading CVE data for 5 filtered results...
```

**Not:**
```
❌ Loading CVE data for 50 results...
```

3. Apply a filter (e.g., severity = "CRITICAL")
4. Watch Network tab

**Should see:**
- Only a few CVE JSON requests
- Not dozens of requests

### 9. Performance Benchmarks

Run these test searches and verify performance:

#### Test 1: Value Not Found
```
Search: Commit ID that doesn't exist
Expected: < 100ms, minimal data transfer
```

#### Test 2: Value Found
```
Search: Valid commit ID from test data
Expected: 200-500ms, 5-10 MB transfer
```

#### Test 3: Origin with Filtering
```
Search: Repository URL
Apply filter: Severity = "CRITICAL"
Expected: Only filtered CVEs loaded
```

## Troubleshooting

### Issue: No Query Plan Shown

**Symptom:** No "Query execution plan" in console

**Solution:**
- Query plan is only shown for first file
- Try a fresh search
- Check console isn't filtered

### Issue: Statistics Not Enabled

**Symptom:** Plan shows `Statistics: DISABLED`

**Solution:**
```bash
# Check if Parquet files have statistics
python scripts/checkParquetMetadata.py test-data/vulnerable_commits_using_cherrypicks_swhid/0.parquet

# Should show:
# ✅ Row Group Statistics: PRESENT
```

### Issue: Bloom Filters Not Enabled

**Symptom:** Plan shows `Bloom Filter: DISABLED`

**Solution:**
- Bloom filters must be in Parquet files
- Check with metadata script (above)
- If missing, files need to be regenerated with bloom filters
- **Note:** This is optional - statistics alone provide good performance

### Issue: Full File Downloads

**Symptom:** Network tab shows large downloads (100+ MB)

**Solution:**
1. Check bucket policy:
```bash
npm run setup-minio-dev
```

2. Verify Range requests are supported:
```bash
curl -H "Range: bytes=0-1000" http://localhost:9093/vuln-data-dev/vulnerable_commits_using_cherrypicks_swhid/0.parquet
```

Should return `206 Partial Content`

### Issue: Slow Queries

**Symptom:** Queries take > 1 second

**Possible causes:**
1. No statistics in Parquet files
2. Data not sorted by query column
3. Row groups too large
4. Network issues

**Solution:**
```bash
# Check Parquet metadata
python scripts/checkParquetMetadata.py <file>

# Look for:
# - Row group size: 50K-200K rows (optimal)
# - Statistics: PRESENT
# - Data should be sorted by revision_id/origin
```

## Success Criteria

All checks passed:
- ✅ MinIO accessible with public read
- ✅ DuckDB initializes with all optimizations
- ✅ Query plan shows PARQUET_SCAN with filters
- ✅ Statistics and bloom filters enabled
- ✅ HTTP Range requests visible in Network tab
- ✅ Row groups skipped for non-matching data
- ✅ CVE data loaded only for filtered results
- ✅ Query times < 500ms for typical searches
- ✅ Data transfer < 10 MB for typical searches

## Performance Summary

Expected performance with optimizations:

| Scenario | Time | Data Transfer | Row Groups Read |
|----------|------|---------------|-----------------|
| Value not found | 50-100ms | 1-2 MB | 0% (all skipped) |
| Value in 1 file | 200-500ms | 5-10 MB | 1-2% (1-2 groups) |
| Value in multiple files | 500-1500ms | 10-30 MB | 5-10% (5-10 groups) |

**Without optimizations:**
- Time: 5-10 seconds
- Data transfer: 300+ MB
- Row groups read: 100% (all)

**Improvement: 10-50x faster, 95-99% less data transfer**

## Next Steps

If all verifications pass:
- ✅ System is optimized and ready to use
- ✅ Refer to [Query Plan Analysis](QUERY_PLAN_ANALYSIS.md) for deeper analysis
- ✅ See [Parquet Optimizations](PARQUET_OPTIMIZATIONS.md) for technical details

If issues found:
- 🔧 See [Troubleshooting Guide](TROUBLESHOOTING.md)
- 📖 Review [Local Setup Guide](LOCAL_SETUP.md)
- 🚀 Check [Optimization Summary](OPTIMIZATION_SUMMARY.md)
