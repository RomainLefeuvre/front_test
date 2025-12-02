# DuckDB Lazy Loading Optimization

## Overview
Implemented lazy loading for Parquet files using DuckDB's HTTP Range request capabilities to avoid downloading entire files upfront.

## What Changed

### Before
- `queryByOrigin`: Downloaded and registered ALL parquet files in memory before querying
- High memory usage and slow initial load times
- Files cached in DuckDB's virtual filesystem

### After
- Both `queryByCommitId` and `queryByOrigin` now use direct HTTP URLs
- DuckDB uses HTTP Range requests to fetch only the data needed for the query
- No upfront file downloads
- Significantly reduced memory footprint and faster queries

## How It Works

1. **File Discovery**: Uses HTTP HEAD requests to discover available parquet files without downloading them
2. **Query Execution**: Passes HTTP URLs directly to `read_parquet()`
3. **Lazy Fetching**: DuckDB automatically fetches only the row groups and columns needed for the query using HTTP Range requests

## Benefits

- **Faster startup**: No need to download all files before querying
- **Lower memory usage**: Only fetches data that matches the query
- **Better scalability**: Can handle larger datasets without memory issues
- **Network efficiency**: Reduces bandwidth usage by fetching only necessary data

## Reference

Based on the approach discussed in: https://github.com/duckdb/duckdb-wasm/discussions/2107
