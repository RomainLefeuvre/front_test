# Development Setup

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Start your API backend on port 3000** (the Vite proxy will forward requests to it)

## How it works

### Vite Proxy Configuration

The development server is configured to proxy API requests to avoid CORS issues:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
    '/health': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
}
```

### Environment Configuration

- **Development**: `VITE_API_BASE_URL=` (empty - uses Vite proxy)
- **Production**: `VITE_API_BASE_URL=https://your-api-domain.com`

### API Endpoints Expected

Your backend should implement these endpoints on `localhost:3000`:

- `GET /health` - Health check
- `GET /api/origin/vulnerabilities?url={origin_url}` - Query by repository URL
- `GET /api/swhid/{swhid}/vulnerabilities` - Query by commit SWHID

See `openapi.json` for the complete API specification.

## Testing the Frontend

1. **Without backend**: You'll see CORS/network errors, but the UI works
2. **With backend**: Full functionality with real API responses
3. **Run tests**: `npm test` (uses mocked API calls)

## Troubleshooting

### CORS Errors
- Make sure your API backend is running on `localhost:3000`
- Check that Vite proxy is configured correctly
- Verify the API endpoints match the OpenAPI specification

### Network Errors
- Check if your backend is running: `curl http://localhost:3000/health`
- Look at the browser DevTools Network tab for failed requests
- Check Vite proxy logs in the terminal

### API Response Format
Make sure your backend returns responses matching the OpenAPI schema:

```json
// GET /api/origin/vulnerabilities?url=https://github.com/example/repo
{
  "origin": "https://github.com/example/repo",
  "vulnerable_commits": [
    {
      "revision_id": "swh:1:rev:abc123...",
      "branch_name": "main", 
      "vulnerability_filename": "CVE-2024-1234.json"
    }
  ]
}
```