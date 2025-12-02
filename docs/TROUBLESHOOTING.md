# Troubleshooting Guide

Common issues and solutions for the Vulnerability Fork Lookup System.

## "No parquet files found" Error

### Symptom
When searching for vulnerabilities, you see an error:
```
Search failed: Failed to query by commit ID: No parquet files found
```

### Cause
This error occurs when the application cannot access the parquet files in MinIO/S3. Common reasons:
1. MinIO is not running
2. The bucket doesn't have public read access configured
3. Data hasn't been uploaded to the bucket

### Solution

**Quick Fix:**
```bash
npm run setup-minio-dev
```

This automated script will:
- Start MinIO if needed
- Configure the bucket with public read access
- Upload data if missing
- Verify everything is accessible

**Manual Fix:**

1. Check if MinIO is running:
```bash
docker ps | grep minio
```

2. If not running, start it:
```bash
docker-compose up -d
```

3. Apply bucket policy for public read access:
```bash
cat > /tmp/bucket-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::vuln-data-dev/*"]
    }
  ]
}
EOF

AWS_ACCESS_KEY_ID=minioadmin AWS_SECRET_ACCESS_KEY=minioadmin \
  aws --endpoint-url http://localhost:9093 s3api put-bucket-policy \
  --bucket vuln-data-dev \
  --policy file:///tmp/bucket-policy.json
```

4. Verify files are accessible:
```bash
curl -I http://localhost:9093/vuln-data-dev/vulnerable_commits_using_cherrypicks_swhid/0.parquet
```

You should see `HTTP/1.1 200 OK`. If you see `403 Forbidden`, the bucket policy wasn't applied correctly.

## CORS Errors

### Symptom
Browser console shows CORS errors when trying to access MinIO.

### Solution
CORS is typically not needed for MinIO when using public bucket policies. However, if you encounter CORS issues:

```bash
cat > /tmp/cors.json <<'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:5173", "http://localhost:4173"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

AWS_ACCESS_KEY_ID=minioadmin AWS_SECRET_ACCESS_KEY=minioadmin \
  aws --endpoint-url http://localhost:9093 s3api put-bucket-cors \
  --bucket vuln-data-dev \
  --cors-configuration file:///tmp/cors.json
```

## DuckDB Initialization Fails

### Symptom
Application shows "Failed to initialize DuckDB" error.

### Cause
- Browser doesn't support WebAssembly
- SharedArrayBuffer not available (requires secure context)
- WASM files not loading correctly

### Solution
1. Use a modern browser (Chrome, Firefox, Safari, Edge)
2. Ensure you're accessing via `http://localhost` (not `127.0.0.1`)
3. Check browser console for specific errors
4. Clear browser cache and reload

## MinIO Connection Refused

### Symptom
Cannot connect to MinIO at `http://localhost:9093`.

### Solution
1. Check if MinIO is running:
```bash
docker ps | grep minio
```

2. Check MinIO logs:
```bash
docker logs vuln-lookup-minio
```

3. Restart MinIO:
```bash
docker-compose restart minio
```

4. Verify port mapping:
```bash
docker port vuln-lookup-minio
```

Should show:
```
9000/tcp -> 0.0.0.0:9093
9001/tcp -> 0.0.0.0:9091
```

## Data Upload Fails

### Symptom
`npm run upload-s3` fails or times out.

### Solution
1. Check AWS CLI is installed:
```bash
aws --version
```

2. Verify MinIO is accessible:
```bash
AWS_ACCESS_KEY_ID=minioadmin AWS_SECRET_ACCESS_KEY=minioadmin \
  aws --endpoint-url http://localhost:9093 s3 ls
```

3. Check disk space:
```bash
df -h
```

4. Try uploading a single file manually:
```bash
AWS_ACCESS_KEY_ID=minioadmin AWS_SECRET_ACCESS_KEY=minioadmin \
  aws --endpoint-url http://localhost:9093 s3 cp \
  test-data/vulnerable_commits_using_cherrypicks_swhid/0.parquet \
  s3://vuln-data-dev/vulnerable_commits_using_cherrypicks_swhid/0.parquet
```

## No Search Results

### Symptom
Searches return no results even though data is uploaded.

### Possible Causes & Solutions

1. **Wrong search format:**
   - Commit IDs must be 40-character SHA hashes
   - Origin URLs must be full repository URLs (e.g., `https://github.com/user/repo`)

2. **Data not in test subset:**
   - The test data only contains ~300 vulnerabilities
   - Try known vulnerable commits from `test-data/SAMPLE_COMMITS.md`

3. **Parquet files not accessible:**
   - Run `npm run setup-minio-dev` to verify setup
   - Check browser Network tab for 403/404 errors

## Browser Performance Issues

### Symptom
Browser becomes slow or unresponsive during queries.

### Solution
1. DuckDB WASM is memory-intensive - close other tabs
2. Use a modern browser with good WebAssembly support
3. For large datasets, consider increasing browser memory limits
4. Check browser console for memory warnings

## Development Server Won't Start

### Symptom
`npm run dev` fails or shows errors.

### Solution
1. Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

2. Check Node.js version:
```bash
node --version  # Should be 18+
```

3. Check for port conflicts:
```bash
lsof -i :5173  # Check if port 5173 is in use
```

4. Try a different port:
```bash
npm run dev -- --port 3000
```

## Getting Help

If you're still experiencing issues:

1. Check the [Local Setup Guide](LOCAL_SETUP.md) for detailed setup instructions
2. Review browser console for specific error messages
3. Check MinIO logs: `docker logs vuln-lookup-minio`
4. Verify your environment configuration in `.env.development`

## Useful Commands

```bash
# Check MinIO status
docker ps | grep minio

# View MinIO logs
docker logs vuln-lookup-minio -f

# List bucket contents
AWS_ACCESS_KEY_ID=minioadmin AWS_SECRET_ACCESS_KEY=minioadmin \
  aws --endpoint-url http://localhost:9093 s3 ls s3://vuln-data-dev --recursive

# Test file accessibility
curl -I http://localhost:9093/vuln-data-dev/vulnerable_commits_using_cherrypicks_swhid/0.parquet

# Restart everything
docker-compose restart
npm run setup-minio-dev
npm run dev
```
