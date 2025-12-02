#!/usr/bin/env python3
"""
Check Parquet file metadata to verify optimizations are present.

This script inspects Parquet files to ensure they have:
- Row group statistics (min/max)
- Bloom filters
- Appropriate row group sizes

Usage:
    python scripts/checkParquetMetadata.py <parquet_file>
    python scripts/checkParquetMetadata.py input_data/vulnerable_commits_using_cherrypicks_swhid/0.parquet
"""

import sys
import os
from pathlib import Path

try:
    import pyarrow.parquet as pq
except ImportError:
    print("Error: pyarrow is not installed")
    print("Install it with: pip install pyarrow")
    sys.exit(1)


def format_bytes(bytes_val):
    """Format bytes into human-readable string."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_val < 1024.0:
            return f"{bytes_val:.2f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.2f} TB"


def check_parquet_file(file_path):
    """Check a Parquet file for optimizations."""
    print(f"\n{'='*80}")
    print(f"Analyzing: {file_path}")
    print(f"{'='*80}\n")
    
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return False
    
    try:
        # Read metadata without reading data
        metadata = pq.read_metadata(file_path)
        
        # File-level info
        print("📄 File Information:")
        print(f"   Format version: {metadata.format_version}")
        print(f"   Number of rows: {metadata.num_rows:,}")
        print(f"   Number of row groups: {metadata.num_row_groups}")
        print(f"   Number of columns: {metadata.num_columns}")
        
        # Get file size
        file_size = os.path.getsize(file_path)
        print(f"   File size: {format_bytes(file_size)}")
        
        # Schema
        print(f"\n📋 Schema:")
        schema = metadata.schema
        for i in range(len(schema)):
            col = schema[i]
            print(f"   {i+1}. {col.name} ({col.physical_type})")
        
        # Row group analysis
        print(f"\n📦 Row Group Analysis:")
        total_rows = 0
        row_group_sizes = []
        
        for i in range(metadata.num_row_groups):
            rg = metadata.row_group(i)
            total_rows += rg.num_rows
            row_group_sizes.append(rg.num_rows)
            
            if i == 0:  # Detailed info for first row group
                print(f"\n   Row Group 0 (sample):")
                print(f"      Rows: {rg.num_rows:,}")
                print(f"      Total byte size: {format_bytes(rg.total_byte_size)}")
                print(f"      Compressed size: {format_bytes(rg.total_compressed_size)}")
                compression_ratio = (1 - rg.total_compressed_size / rg.total_byte_size) * 100
                print(f"      Compression ratio: {compression_ratio:.1f}%")
        
        avg_row_group_size = sum(row_group_sizes) / len(row_group_sizes)
        print(f"\n   Average row group size: {avg_row_group_size:,.0f} rows")
        print(f"   Min row group size: {min(row_group_sizes):,} rows")
        print(f"   Max row group size: {max(row_group_sizes):,} rows")
        
        # Check for statistics and bloom filters
        print(f"\n🔍 Optimization Features:")
        
        # Check first row group, first column
        rg = metadata.row_group(0)
        
        has_statistics = False
        has_bloom_filters = False
        columns_with_stats = []
        columns_with_bloom = []
        
        for col_idx in range(rg.num_columns):
            col = rg.column(col_idx)
            col_name = metadata.schema[col_idx].name
            
            # Check statistics
            if col.is_stats_set:
                has_statistics = True
                columns_with_stats.append(col_name)
                
                if col_idx == 0:  # Show details for first column
                    print(f"\n   ✅ Statistics (column: {col_name}):")
                    stats = col.statistics
                    print(f"      Min: {stats.min}")
                    print(f"      Max: {stats.max}")
                    print(f"      Null count: {stats.null_count}")
                    print(f"      Distinct count: {stats.distinct_count if stats.distinct_count else 'N/A'}")
            
            # Check bloom filter
            # Note: PyArrow doesn't expose bloom_filter_offset directly in all versions
            # We check if the column metadata has bloom filter information
            try:
                # This is a workaround - bloom filter presence is not always exposed
                # In newer versions of Parquet, bloom filters are in the column metadata
                if hasattr(col, 'bloom_filter_offset') and col.bloom_filter_offset is not None:
                    has_bloom_filters = True
                    columns_with_bloom.append(col_name)
            except AttributeError:
                pass
        
        if has_statistics:
            print(f"\n   ✅ Row Group Statistics: PRESENT")
            print(f"      Columns with statistics: {len(columns_with_stats)}/{rg.num_columns}")
            print(f"      Columns: {', '.join(columns_with_stats[:5])}" + 
                  (f" ... and {len(columns_with_stats)-5} more" if len(columns_with_stats) > 5 else ""))
        else:
            print(f"\n   ❌ Row Group Statistics: NOT FOUND")
        
        # Bloom filter check (note: may not be detectable in all PyArrow versions)
        if has_bloom_filters:
            print(f"\n   ✅ Bloom Filters: PRESENT")
            print(f"      Columns with bloom filters: {', '.join(columns_with_bloom)}")
        else:
            print(f"\n   ⚠️  Bloom Filters: NOT DETECTED")
            print(f"      Note: Bloom filters may be present but not exposed by PyArrow")
            print(f"      DuckDB will still use them if they exist in the file")
        
        # Recommendations
        print(f"\n💡 Recommendations:")
        
        if avg_row_group_size < 50000:
            print(f"   ⚠️  Row groups are small (avg {avg_row_group_size:,.0f} rows)")
            print(f"      Consider: Increase row_group_size to 100,000-200,000 for better performance")
        elif avg_row_group_size > 500000:
            print(f"   ⚠️  Row groups are large (avg {avg_row_group_size:,.0f} rows)")
            print(f"      Consider: Decrease row_group_size to 100,000-200,000 for better filtering")
        else:
            print(f"   ✅ Row group size is optimal ({avg_row_group_size:,.0f} rows)")
        
        if not has_statistics:
            print(f"   ❌ Enable statistics when writing: write_statistics=True")
        
        if not has_bloom_filters:
            print(f"   ⚠️  Consider adding bloom filters for query columns:")
            print(f"      pq.write_table(table, file, bloom_filter_columns=['revision_id', 'origin'])")
        
        print(f"\n{'='*80}\n")
        return True
        
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return False


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/checkParquetMetadata.py <parquet_file>")
        print("\nExamples:")
        print("  python scripts/checkParquetMetadata.py input_data/vulnerable_commits_using_cherrypicks_swhid/0.parquet")
        print("  python scripts/checkParquetMetadata.py test-data/vulnerable_origins/0.parquet")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    # If it's a directory, check all parquet files
    if os.path.isdir(file_path):
        parquet_files = list(Path(file_path).glob("*.parquet"))
        if not parquet_files:
            print(f"No .parquet files found in {file_path}")
            sys.exit(1)
        
        print(f"Found {len(parquet_files)} Parquet files in {file_path}")
        print("Analyzing first file as sample...\n")
        check_parquet_file(str(parquet_files[0]))
    else:
        check_parquet_file(file_path)


if __name__ == "__main__":
    main()
