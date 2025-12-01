#!/bin/bash
# MinIO Setup Script for End-to-End Tests
# 
# This script sets up MinIO with test data for e2e testing
# Requirements: 11.1

set -e

echo "MinIO E2E Test Setup"
echo "===================="
echo ""

# Configuration
MINIO_ENDPOINT="http://localhost:9093"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
TEST_BUCKET="vuln-data-test"
TEST_DATA_DIR="test-data"

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
echo "2. Setting up test bucket..."
if aws --endpoint-url $MINIO_ENDPOINT s3 ls | grep -q $TEST_BUCKET; then
    echo "   ✓ Bucket '$TEST_BUCKET' already exists"
else
    echo "   Creating bucket '$TEST_BUCKET'..."
    aws --endpoint-url $MINIO_ENDPOINT s3 mb s3://$TEST_BUCKET
    echo "   ✓ Bucket created"
fi

# Upload test data
echo ""
echo "3. Uploading test data..."
if [ ! -d "$TEST_DATA_DIR" ]; then
    echo "   ✗ Error: Test data directory '$TEST_DATA_DIR' not found"
    echo "   Please run the test data extraction script first"
    exit 1
fi

node scripts/uploadToS3.js \
    --endpoint $MINIO_ENDPOINT \
    --bucket $TEST_BUCKET \
    --parquet-dir $TEST_DATA_DIR \
    --cve-dir $TEST_DATA_DIR/cve

# Set bucket policy for public read access (optional, for easier testing)
echo ""
echo "4. Configuring bucket access..."
cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::$TEST_BUCKET/*"]
    }
  ]
}
EOF

if aws --endpoint-url $MINIO_ENDPOINT s3api put-bucket-policy --bucket $TEST_BUCKET --policy file:///tmp/bucket-policy.json 2>/dev/null; then
    echo "   ✓ Bucket policy applied"
else
    echo "   ⚠ Could not apply bucket policy (this is OK for local testing)"
fi

rm -f /tmp/bucket-policy.json

# Verify data is accessible
echo ""
echo "5. Verifying data..."
PARQUET_COUNT=$(aws --endpoint-url $MINIO_ENDPOINT s3 ls s3://$TEST_BUCKET/vulnerable_commits_using_cherrypicks_swhid/ | wc -l)
CVE_COUNT=$(aws --endpoint-url $MINIO_ENDPOINT s3 ls s3://$TEST_BUCKET/cve/ | wc -l)

echo "   Parquet files: $PARQUET_COUNT"
echo "   CVE files: $CVE_COUNT"

if [ "$PARQUET_COUNT" -gt 0 ] && [ "$CVE_COUNT" -gt 0 ]; then
    echo "   ✓ Data verified"
else
    echo "   ✗ Error: Data verification failed"
    exit 1
fi

echo ""
echo "✓ MinIO E2E setup complete!"
echo ""
echo "Configuration:"
echo "  Endpoint: $MINIO_ENDPOINT"
echo "  Bucket: $TEST_BUCKET"
echo "  Access Key: $MINIO_ACCESS_KEY"
echo "  Secret Key: $MINIO_SECRET_KEY"
echo ""
echo "You can now run end-to-end tests with:"
echo "  npm run test:e2e"
echo ""
