# Local Development Setup with MinIO

This guide explains how to set up a local S3-compatible storage server using MinIO for development and testing of the Vulnerability Fork Lookup System.

## Overview

The application queries Parquet files and CVE JSON data from S3-compatible storage. For local development, we use MinIO, a high-performance object storage server that implements the S3 API.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- At least 5GB of free disk space for data files

## Quick Start

### 1. Start MinIO Server

We provide a Docker Compose configuration for easy setup:

```bash
# Start MinIO in the background
docker-compose up -d minio
```

This will start MinIO on `http://localhost:9000` with the web console available at `http://localhost:9001`.

**Default Credentials:**
- Access Key: `minioadmin`
- Secret Key: `minioadmin`

### 2. Access MinIO Console

Open your browser and navigate to `http://localhost:9001`. Log in with the default credentials above.

### 3. Create Bucket

You can create the bucket either through the web console or using the MinIO client (mc):

**Option A: Web Console**
1. Navigate to "Buckets" in the left sidebar
2. Click "Create Bucket"
3. Enter bucket name: `vuln-data-dev`
4. Click "Create Bucket"

**Option B: MinIO Client (mc)**
```bash
# Install mc (if not already installed)
# macOS
brew install minio/stable/mc

# Linux
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Configure mc to connect to local MinIO
mc alias set local http://localhost:9000 minioadmin minioadmin

# Create bucket
mc mb local/vuln-data-dev
```

### 4. Configure CORS

CORS must be configured to allow the web application to access MinIO from the browser.

**Option A: Using MinIO Client**
```bash
# Create CORS configuration file
cat > cors.json << 'EOF'
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

# Apply CORS configuration
mc anonymous set-json cors.json local/vuln-data-dev
```

**Option B: Using AWS CLI**
```bash
# Install AWS CLI if not already installed
# Then configure it to use MinIO endpoint
aws configure set aws_access_key_id minioadmin
aws configure set aws_secret_access_key minioadmin

# Apply CORS configuration
aws --endpoint-url http://localhost:9000 s3api put-bucket-cors \
  --bucket vuln-data-dev \
  --cors-configuration file://cors.json
```

### 5. Set Bucket Policy for Public Read Access

The application needs read access to the bucket:

```bash
# Create bucket policy file
cat > policy.json << 'EOF'
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

# Apply bucket policy
mc anonymous set-json policy.json local/vuln-data-dev

# Or using AWS CLI
aws --endpoint-url http://localhost:9000 s3api put-bucket-policy \
  --bucket vuln-data-dev \
  --policy file://policy.json
```

### 6. Upload Data Files

Use the provided upload script to upload Parquet and CVE data:

```bash
# First, extract CVE data if not already done
npm run extract-cve

# Upload data to MinIO
node scripts/uploadToS3.js
```

The script will:
- Upload all Parquet files from `input_data/`
- Upload all extracted CVE JSON files from `public/cve/`
- Maintain the correct directory structure in S3

### 7. Verify Setup

Check that files were uploaded successfully:

```bash
# List files in bucket
mc ls --recursive local/vuln-data-dev

# Or using AWS CLI
aws --endpoint-url http://localhost:9000 s3 ls s3://vuln-data-dev --recursive
```

You should see:
- `vulnerable_commits_using_cherrypicks_swhid/*.parquet`
- `vulnerable_origins/*.parquet`
- `cve/*.json` (root level CVE files)
- `cve/nvd_cve/*.json` (nvd_cve CVE files)

### 8. Configure Application

The application is already configured for local development. Verify your `.env.development` file:

```env
VITE_S3_ENDPOINT=http://localhost:9000
VITE_S3_BUCKET=vuln-data-dev
VITE_S3_REGION=us-east-1
```

### 9. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173` and will query data from your local MinIO instance.

## Docker Compose Configuration

The `docker-compose.yml` file includes the following MinIO configuration:

```yaml
version: '3.8'

services:
  minio:
    image: minio/minio:latest
    container_name: vuln-lookup-minio
    ports:
      - "9000:9000"  # S3 API
      - "9001:9001"  # Web Console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  minio_data:
    driver: local
```

## Troubleshooting

### CORS Errors

If you see CORS errors in the browser console:

1. Verify CORS configuration:
   ```bash
   mc anonymous get-json local/vuln-data-dev
   ```

2. Ensure the allowed origins match your dev server URL (default: `http://localhost:5173`)

3. Clear browser cache and reload

### Connection Refused

If the application cannot connect to MinIO:

1. Verify MinIO is running:
   ```bash
   docker ps | grep minio
   ```

2. Check MinIO logs:
   ```bash
   docker logs vuln-lookup-minio
   ```

3. Verify the endpoint in `.env.development` matches MinIO's address

### Files Not Found

If queries return no results:

1. Verify files were uploaded:
   ```bash
   mc ls --recursive local/vuln-data-dev
   ```

2. Check file paths match expected structure

3. Re-run the upload script:
   ```bash
   node scripts/uploadToS3.js
   ```

### DuckDB Cannot Read Parquet Files

If DuckDB fails to read Parquet files:

1. Verify bucket policy allows public read access
2. Check that files are accessible via HTTP:
   ```bash
   curl http://localhost:9000/vuln-data-dev/vulnerable_commits_using_cherrypicks_swhid/0.parquet -I
   ```
3. Ensure CORS is properly configured

## Alternative: Using LocalStack

If you prefer LocalStack over MinIO:

```bash
# Start LocalStack
docker run -d \
  --name localstack \
  -p 4566:4566 \
  -e SERVICES=s3 \
  -e DEBUG=1 \
  localstack/localstack

# Update .env.development
VITE_S3_ENDPOINT=http://localhost:4566
```

Then follow similar steps for bucket creation and data upload.

## Data Management

### Updating Data

When you have new data to upload:

```bash
# Extract new CVE data
npm run extract-cve

# Upload to MinIO
node scripts/uploadToS3.js
```

### Clearing Data

To start fresh:

```bash
# Remove all files from bucket
mc rm --recursive --force local/vuln-data-dev

# Or delete and recreate bucket
mc rb --force local/vuln-data-dev
mc mb local/vuln-data-dev

# Reconfigure CORS and policy (see steps 4-5 above)
```

### Stopping MinIO

```bash
# Stop MinIO container
docker-compose down

# Stop and remove data
docker-compose down -v
```

## Production Deployment

For production deployment, replace MinIO with a production S3 service:

1. Create an S3 bucket in AWS (or compatible service)
2. Upload data using the same upload script with production credentials
3. Configure CORS and bucket policy for your production domain
4. Update `.env.production` with production S3 endpoint and bucket name

## Security Notes

- The default MinIO credentials (`minioadmin`/`minioadmin`) are for local development only
- Never use these credentials in production
- For production, use proper IAM roles and policies
- Enable HTTPS for production deployments
- Restrict CORS origins to your production domain

## Additional Resources

- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
- [MinIO Client (mc) Guide](https://min.io/docs/minio/linux/reference/minio-mc.html)
- [DuckDB S3 Integration](https://duckdb.org/docs/extensions/httpfs.html)
- [AWS S3 CORS Configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)
