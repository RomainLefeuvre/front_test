# Sample Commits for Testing

## Real SWHIDs from the Dataset

These commits exist in the `vuln-data-dev` Parquet files and can be used for testing:

### Format 1: Full SWHID (Recommended)
```
swh:1:rev:fffb3c4c8f67c271a723855835c2ea0fb83fc33f
swh:1:rev:000426095224401649827d6cdc5a7d5e0ef4e17c
swh:1:rev:fffe17b77d06927aaf64fa80be5b765c870a4ef5
swh:1:rev:0001e8397e58906f317361f1548be61f41064962
swh:1:rev:fff86b069ec52d66d39bac2aa94230455cfe80fc
```

### Format 2: Plain SHA (Auto-converted to SWHID)
```
fffb3c4c8f67c271a723855835c2ea0fb83fc33f
000426095224401649827d6cdc5a7d5e0ef4e17c
fffe17b77d06927aaf64fa80be5b765c870a4ef5
0001e8397e58906f317361f1548be61f41064962
fff86b069ec52d66d39bac2aa94230455cfe80fc
```

## How to Test

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. **Open in browser**:
   ```
   http://localhost:5173
   ```

3. **Enter a commit**:
   - Copy one of the SWHIDs or SHAs above
   - Paste into the search box
   - Click "Search"

4. **Expected behavior**:
   - Plain SHA (40 hex chars) → Automatically converted to `swh:1:rev:HASH`
   - Full SWHID → Used as-is
   - Query executes against Parquet files
   - Results displayed (or "No vulnerabilities found" if none exist)

## Supported Formats

### ✅ Accepted
- `swh:1:rev:fffb3c4c8f67c271a723855835c2ea0fb83fc33f` (Full SWHID)
- `fffb3c4c8f67c271a723855835c2ea0fb83fc33f` (40-char SHA-1)
- `fffb3c4c8f67c271a723855835c2ea0fb83fc33f1234567890abcdef123456` (64-char SHA-256)

### ❌ Not Accepted
- `fffb3c4c` (Too short)
- `not-a-commit` (Invalid characters)
- `swh:1:dir:...` (Wrong SWHID type - must be `rev`)

## Implementation Details

The application now:
1. Detects if input is a SWHID or plain SHA
2. Validates the format
3. Converts plain SHA to SWHID automatically (`swh:1:rev:` prefix)
4. Queries the Parquet files using the SWHID

This ensures compatibility with the Software Heritage data format where `revision_id` columns contain SWHIDs.

---

**Note**: These commits are extracted from the actual Parquet files in MinIO. They should return query results (though the results may be empty if no vulnerabilities are associated with these specific commits).
