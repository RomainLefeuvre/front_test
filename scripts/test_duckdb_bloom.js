#!/usr/bin/env node
/**
 * Test si DuckDB WASM utilise vraiment les bloom filters
 */

import * as duckdb from '@duckdb/duckdb-wasm';

async function testBloomFilters() {
  console.log('🧪 TEST DUCKDB BLOOM FILTERS');
  console.log('=' .repeat(50));
  
  try {
    // Configuration identique à queryEngine.ts
    const MANUAL_BUNDLES = {
      mvp: {
        mainModule: new URL('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm', import.meta.url).href,
        mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js', import.meta.url).href,
      },
      eh: {
        mainModule: new URL('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm', import.meta.url).href,
        mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js', import.meta.url).href,
      },
    };
    
    console.log('📦 Sélection du bundle DuckDB...');
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    
    console.log('👷 Création du worker...');
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    
    console.log('🚀 Initialisation DuckDB...');
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule);
    await db.open({});
    
    const conn = await db.connect();
    
    // Test des configurations bloom filter
    console.log('\n🔧 Test des configurations:');
    
    try {
      await conn.query("SET enable_parquet_bloom_filter=true;");
      console.log('✅ enable_parquet_bloom_filter=true → OK');
    } catch (e) {
      console.log('❌ enable_parquet_bloom_filter=true → ERREUR:', e.message);
    }
    
    // Vérifier la configuration actuelle
    try {
      const result = await conn.query("SELECT current_setting('enable_parquet_bloom_filter') as bloom_setting;");
      const rows = result.toArray();
      console.log('📊 Configuration actuelle:', rows[0]?.bloom_setting);
    } catch (e) {
      console.log('⚠️  Impossible de vérifier la configuration:', e.message);
    }
    
    // Test avec un fichier réel
    console.log('\n🎯 Test avec fichier réel:');
    const testFile = 'input_data/vulnerable_origins/0.parquet';
    
    try {
      // Requête avec valeur impossible
      const startTime = performance.now();
      const result = await conn.query(`
        SELECT COUNT(*) as count 
        FROM read_parquet('${testFile}') 
        WHERE origin = 'VALEUR_IMPOSSIBLE_QUI_NEXISTE_PAS_123456789'
      `);
      const queryTime = performance.now() - startTime;
      const rows = result.toArray();
      
      console.log(`⏱️  Temps de requête: ${queryTime.toFixed(2)}ms`);
      console.log(`📊 Résultats: ${rows[0]?.count || 0}`);
      
      if (queryTime < 100) {
        console.log('✅ RAPIDE → Bloom filters probablement actifs');
      } else {
        console.log('❌ LENT → Bloom filters probablement inactifs');
      }
      
    } catch (e) {
      console.log('❌ Erreur de requête:', e.message);
    }
    
    // Nettoyage
    await conn.close();
    await db.terminate();
    worker.terminate();
    
    console.log('\n✅ Test terminé');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

testBloomFilters();