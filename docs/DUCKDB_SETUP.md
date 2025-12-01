# DuckDB WASM Setup

This project uses DuckDB WASM for client-side data querying. Due to browser security restrictions (CORS and mixed content policies), we serve the DuckDB WASM files locally instead of loading them from a CDN.

## Version Requirements

**Important**: This project uses DuckDB WASM version **1.28.0** (not 1.30.0) due to stability issues with the newer version. Version 1.30.0 has a known bug that causes "Invalid PhysicalType for GetTypeIdSize" errors during initialization.

## How It Works

1. **Postinstall Script**: After running `npm install`, the `scripts/setupDuckDB.js` script automatically copies the required DuckDB WASM files from `node_modules` to `public/duckdb/`.

2. **Local Files**: The following files are copied:
   - `duckdb-browser-eh.worker.js` - The Web Worker script
   - `duckdb-eh.wasm` - The WebAssembly module

3. **COOP/COEP Headers**: The Vite dev server is configured with the necessary headers for SharedArrayBuffer support:
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Embedder-Policy: require-corp`

## Manual Setup

If you need to manually set up the DuckDB files:

```bash
npm run postinstall
```

Or directly:

```bash
node scripts/setupDuckDB.js
```

## Troubleshooting

### "Security Error: Content may not load data from..."

This error occurs when:
- The DuckDB files are not in `public/duckdb/`
- The dev server doesn't have the correct COOP/COEP headers

**Solution**: Run `npm run postinstall` and restart your dev server.

### "error in duckdb worker: undefined"

This error typically means:
- The worker file couldn't be loaded
- The WASM module failed to instantiate

**Solution**: 
1. Check that files exist in `public/duckdb/`
2. Clear browser cache and restart dev server
3. Check browser console for detailed error messages

## Production Deployment

When deploying to production, ensure your web server sends the same COOP/COEP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The DuckDB files in `public/duckdb/` will be included in the build output automatically.
