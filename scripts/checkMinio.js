#!/usr/bin/env node
/**
 * Check MinIO connectivity and bucket status
 * Useful for verifying integration test prerequisites
 */

const MINIO_ENDPOINT = process.env.VITE_S3_ENDPOINT || 'http://localhost:9093';
const MINIO_BUCKET = process.env.VITE_S3_BUCKET || 'vuln-data-dev';

async function checkMinioHealth() {
  console.log('🔍 Checking MinIO connectivity...\n');
  
  try {
    // Check if MinIO is responding
    const healthUrl = `${MINIO_ENDPOINT}/minio/health/live`;
    console.log(`Checking health endpoint: ${healthUrl}`);
    
    const response = await fetch(healthUrl);
    
    if (response.ok) {
      console.log('✅ MinIO is running and healthy');
    } else {
      console.log(`⚠️  MinIO responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Failed to connect to MinIO');
    console.error(`   Endpoint: ${MINIO_ENDPOINT}`);
    console.error(`   Error: ${error.message}`);
    console.error('\n💡 Make sure MinIO is running:');
    console.error('   docker-compose up -d');
    process.exit(1);
  }
  
  // Check bucket (this will fail without credentials, but that's ok)
  try {
    const bucketUrl = `${MINIO_ENDPOINT}/${MINIO_BUCKET}/`;
    console.log(`\nChecking bucket: ${bucketUrl}`);
    
    const response = await fetch(bucketUrl);
    
    if (response.status === 403) {
      console.log('✅ Bucket exists (authentication required for access)');
    } else if (response.status === 404) {
      console.log('⚠️  Bucket does not exist');
      console.log('   Create it in MinIO console: http://localhost:9091');
    } else {
      console.log(`   Status: ${response.status}`);
    }
  } catch (error) {
    console.log(`   Could not check bucket: ${error.message}`);
  }
  
  console.log('\n📋 Configuration:');
  console.log(`   Endpoint: ${MINIO_ENDPOINT}`);
  console.log(`   Bucket: ${MINIO_BUCKET}`);
  console.log(`   Console: http://localhost:9091`);
  console.log('\n✨ Ready to run integration tests!');
}

checkMinioHealth();
