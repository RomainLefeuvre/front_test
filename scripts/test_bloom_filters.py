#!/usr/bin/env python3
"""
Test si les bloom filters sont vraiment présents et fonctionnels
"""

import sys
import os
from pathlib import Path

try:
    import pyarrow.parquet as pq
    import pyarrow as pa
except ImportError:
    print("Error: pyarrow is not installed")
    sys.exit(1)


def test_bloom_filters_deep(file_path):
    """Test approfondi des bloom filters"""
    print(f"🔍 TEST APPROFONDI DES BLOOM FILTERS")
    print(f"Fichier: {file_path}")
    print("=" * 80)
    
    if not os.path.exists(file_path):
        print(f"❌ Fichier non trouvé: {file_path}")
        return
    
    try:
        # Lire avec PyArrow
        pf = pq.ParquetFile(file_path)
        metadata = pf.metadata
        
        print(f"📊 Informations générales:")
        print(f"   Version format: {metadata.format_version}")
        print(f"   Créé par: {metadata.created_by}")
        print(f"   Row groups: {metadata.num_row_groups}")
        
        # Test sur les premiers row groups
        print(f"\n🔬 ANALYSE DÉTAILLÉE DES BLOOM FILTERS:")
        
        for rg_idx in range(min(3, metadata.num_row_groups)):
            print(f"\n--- Row Group {rg_idx} ---")
            rg = metadata.row_group(rg_idx)
            
            for col_idx in range(min(2, rg.num_columns)):  # Juste les 2 premières colonnes
                col = rg.column(col_idx)
                col_name = metadata.schema[col_idx].name
                
                print(f"  Colonne: {col_name}")
                
                # Méthode 1: Vérifier les attributs directs
                attrs = dir(col)
                bloom_attrs = [attr for attr in attrs if 'bloom' in attr.lower()]
                print(f"    Attributs bloom: {bloom_attrs}")
                
                # Méthode 2: Essayer d'accéder aux propriétés bloom
                try:
                    if hasattr(col, 'bloom_filter_offset'):
                        offset = col.bloom_filter_offset
                        print(f"    ✓ bloom_filter_offset: {offset}")
                    else:
                        print(f"    ❌ Pas de bloom_filter_offset")
                except Exception as e:
                    print(f"    ❌ Erreur bloom_filter_offset: {e}")
                
                try:
                    if hasattr(col, 'bloom_filter_length'):
                        length = col.bloom_filter_length  
                        print(f"    ✓ bloom_filter_length: {length}")
                    else:
                        print(f"    ❌ Pas de bloom_filter_length")
                except Exception as e:
                    print(f"    ❌ Erreur bloom_filter_length: {e}")
                
                # Méthode 3: Vérifier le dictionnaire de métadonnées
                try:
                    col_dict = col.to_dict()
                    bloom_keys = [k for k in col_dict.keys() if 'bloom' in k.lower()]
                    if bloom_keys:
                        print(f"    ✓ Clés bloom dans dict: {bloom_keys}")
                        for key in bloom_keys:
                            print(f"      {key}: {col_dict[key]}")
                    else:
                        print(f"    ❌ Aucune clé bloom dans le dictionnaire")
                except Exception as e:
                    print(f"    ❌ Erreur dictionnaire: {e}")
        
        # Test avec parquet-tools si disponible
        print(f"\n🛠️  RECOMMANDATIONS:")
        print(f"1. Vérifiez avec parquet-tools:")
        print(f"   pip install parquet-tools")
        print(f"   parquet-tools show {file_path}")
        
        print(f"\n2. Recréez les fichiers avec bloom filters explicites:")
        print(f"   python scripts/optimizeParquet.py input_data/vulnerable_origins output_data/vulnerable_origins")
        
        print(f"\n3. Testez avec DuckDB CLI:")
        print(f"   SELECT COUNT(*) FROM read_parquet('{file_path}') WHERE origin = 'test';")
        
    except Exception as e:
        print(f"❌ Erreur: {e}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_bloom_filters.py <parquet_file>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    test_bloom_filters_deep(file_path)


if __name__ == "__main__":
    main()