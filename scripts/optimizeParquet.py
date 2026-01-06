#!/usr/bin/env python3
"""
Optimize Parquet files for DuckDB-WASM browser queries.

This script:
1. Sorts data by the query column (origin) for better statistics pruning
2. Adds bloom filters for fast negative lookups
3. Uses smaller row groups for finer-grained filtering
4. Splits large files into smaller chunks

Usage:
    python scripts/optimizeParquet.py input_data/vulnerable_origins output_data/vulnerable_origins
"""

import argparse
import os
import sys
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq


def optimize_parquet_file(input_file: Path, output_dir: Path, max_rows_per_file: int = 10_000_000):
    """
    Optimize a single parquet file for browser queries.
    
    Key optimizations:
    - Sort by 'origin' column for better min/max statistics pruning
    - Add bloom filters on 'origin' column for fast negative lookups
    - Smaller row groups (100K rows) for finer filtering granularity
    - Split into smaller files if too large
    """
    print(f"\nProcessing: {input_file}")
    
    # Read the file
    table = pq.read_table(input_file)
    num_rows = len(table)
    print(f"  Rows: {num_rows:,}")
    
    # Sort by origin for better statistics
    print("  Sorting by 'origin'...")
    sorted_indices = pa.compute.sort_indices(table, sort_keys=[("origin", "ascending")])
    table = table.take(sorted_indices)
    
    # Determine output files
    output_dir.mkdir(parents=True, exist_ok=True)
    base_name = input_file.stem
    
    # Split if too large
    if num_rows > max_rows_per_file:
        num_chunks = (num_rows + max_rows_per_file - 1) // max_rows_per_file
        print(f"  Splitting into {num_chunks} files...")
        
        for i in range(num_chunks):
            start = i * max_rows_per_file
            end = min((i + 1) * max_rows_per_file, num_rows)
            chunk = table.slice(start, end - start)
            
            output_file = output_dir / f"{base_name}_{i}.parquet"
            write_optimized_parquet(chunk, output_file)
    else:
        output_file = output_dir / f"{base_name}.parquet"
        write_optimized_parquet(table, output_file)


def write_optimized_parquet(table: pa.Table, output_file: Path):
    """Write a parquet file with optimizations for browser queries."""
    
    # Write with optimizations
    pq.write_table(
        table,
        output_file,
        compression='zstd',
        compression_level=3,  # Fast compression
        use_dictionary=True,
        write_statistics=True,
        # Smaller row groups = more granular filtering
        # Each row group can be skipped independently
        row_group_size=100_000,
        # Enable bloom filters on string columns used in WHERE clauses
        # This allows DuckDB to quickly skip row groups that don't contain the value
        write_bloom_filter_for_columns=['origin'],
        bloom_filter_fpp=0.01,  # 1% false positive rate
    )
    
    size_mb = os.path.getsize(output_file) / 1024 / 1024
    print(f"  ✓ Wrote: {output_file.name} ({size_mb:.1f} MB)")


def main():
    parser = argparse.ArgumentParser(description='Optimize Parquet files for browser queries')
    parser.add_argument('input_dir', help='Input directory with parquet files')
    parser.add_argument('output_dir', help='Output directory for optimized files')
    parser.add_argument('--max-rows', type=int, default=10_000_000,
                        help='Max rows per output file (default: 10M)')
    
    args = parser.parse_args()
    
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    
    if not input_dir.exists():
        print(f"Error: Input directory {input_dir} does not exist")
        sys.exit(1)
    
    parquet_files = sorted(input_dir.glob("*.parquet"))
    print(f"Found {len(parquet_files)} parquet files")
    
    for pf in parquet_files:
        try:
            optimize_parquet_file(pf, output_dir, args.max_rows)
        except Exception as e:
            print(f"  ✗ Error: {e}")
    
    print("\n✓ Done!")
    print(f"\nOptimizations applied:")
    print("  - Sorted by 'origin' for better min/max statistics")
    print("  - Added bloom filters on 'origin' column")
    print("  - Smaller row groups (100K) for finer filtering")
    print("  - Split large files for browser memory limits")


if __name__ == '__main__':
    main()
