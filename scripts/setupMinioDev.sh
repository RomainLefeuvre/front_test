#!/bin/bash
# MinIO Setup Script for Local Development
# 
# This script sets up MinIO with data for local development
# Configures public read access for browser-based queries

set -e

echo "MinIO Development Setup"
echo "======================="
echo ""

# Configuration
MINIO_ENDPOINT="http://localhost:9093"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
DEV_BUCKET="vuln-data-dev"
INPUT_DATA_DIR="input_data"

# Export AWS credentials for CLI
export AWS_ACCESS_KEY_ID=$MINIO_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$MINIO_SECRET_KEY

# Check if MinIO is running
echo "1. Checking if MinIO is running..."
if ! docker ps | grep -q vuln-lookup-minio; then
    echo "   MinIO is not running. Starting MinIO..."
    docker-compose up -d
    echo "   Waiting for MinIO to be healthy..."
    sleep 5
else
    echo "   ✓ MinIO is running"
fi

# Check if bucket exists, create if not
echo ""
echo "2. Setting up development bucket..."
if aws --endpoint-url $MINIO_ENDPOINT s3 ls | grep -q $DEV_BUCKET; then
    echo "   ✓ Bucket '$DEV_BUCKET' already exists"
else
    echo "   Creating bucket '$DEV_BUCKET'..."
    aws --endpoint-url $MINIO_ENDPOINT s3 mb s3://$DEV_BUCKET
    echo "   ✓ Bucket created"
fi

# Set bucket policy for public read access (required for browser access)
echo ""
echo "3. Configuring bucket for public read access..."
cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::$DEV_BUCKET/*"]
    }
  ]
}
EOF

if aws --endpoint-url $MINIO_ENDPOINT s3api put-bucket-policy --bucket $DEV_BUCKET --policy file:///tmp/bucket-policy.json 2>/dev/null; then
    echo "   ✓ Bucket policy applied (public read access enabled)"
else
    echo "   ⚠ Could not apply bucket policy"
    exit 1
fi

rm -f /tmp/bucket-policy.json

# Check if data needs to be uploaded
echo ""
echo "4. Checking data..."
PARQUET_COUNT=$(aws --endpoint-url $MINIO_ENDPOINT s3 ls s3://$DEV_BUCKET/vulnerable_commits_using_cherrypicks_swhid/ 2>/dev/null | grep -c ".parquet" || echo "0")

if [ "$PARQUET_COUNT" -gt 0 ]; then
    echo "   ✓ Found $PARQUET_COUNT parquet files already uploaded"
    echo "   Skipping upload (data already exists)"
else
    echo "   No data found. Uploading..."
    
    if [ ! -d "$INPUT_DATA_DIR" ]; then
        echo "   ⚠ Input data directory '$INPUT_DATA_DIR' not found"
        echo "   Please ensure you have the parquet files in $INPUT_DATA_DIR/"
        echo "   Or use test data: node scripts/uploadToS3.js --parquet-dir test-data"
        exit 1
    fi
    
    node scripts/uploadToS3.js \
        --endpoint $MINIO_ENDPOINT \
        --bucket $DEV_BUCKET \
        --parquet-dir $INPUT_DATA_DIR \
        --cve-dir public/cve
fi

# Verify data is accessible via HTTP (without credentials)
echo ""
echo "5. Verifying public access..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $MINIO_ENDPOINT/$DEV_BUCKET/vulnerable_commits_using_cherrypicks_swhid/0.parquet)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✓ Data is publicly accessible"
else
    echo "   ✗ Error: Data is not accessible (HTTP $HTTP_STATUS)"
    echo "   The browser won't be able to query the data"
    exit 1
fi

echo ""
echo "✓ MinIO development setup complete!"
echo ""
echo "Configuration:"
echo "  Endpoint: $MINIO_ENDPOINT"
echo "  Bucket: $DEV_BUCKET"
echo "  Public read: Enabled"
echo ""
echo "You can now run the development server:"
echo "  npm run dev"
echo ""
