#!/usr/bin/env python3
"""
Analyser les statistiques min/max dans les fichiers Parquet pour comprendre
comment DuckDB peut optimiser les requêtes.
"""

import sys
import os
from pathlib import Path

try:
    import pyarrow.parquet as pq
except ImportError:
    print("Error: pyarrow is not installed")
    print("Install it with: pip install pyarrow")
    sys.exit(1)


def analyze_statistics(file_path, column_name='origin', max_row_groups=10):
    """Analyser les statistiques min/max pour une colonne spécifique."""
    print(f"\n{'='*80}")
    print(f"ANALYSE DES STATISTIQUES: {file_path}")
    print(f"Colonne: {column_name}")
    print(f"{'='*80}")
    
    if not os.path.exists(file_path):
        print(f"❌ Fichier non trouvé: {file_path}")
        return
    
    try:
        metadata = pq.read_metadata(file_path)
        
        # Trouver l'index de la colonne
        col_idx = None
        for i in range(metadata.num_columns):
            if metadata.schema[i].name == column_name:
                col_idx = i
                break
        
        if col_idx is None:
            print(f"❌ Colonne '{column_name}' non trouvée")
            available_cols = [metadata.schema[i].name for i in range(metadata.num_columns)]
            print(f"Colonnes disponibles: {', '.join(available_cols)}")
            return
        
        print(f"📊 Fichier: {os.path.basename(file_path)}")
        print(f"   Lignes totales: {metadata.num_rows:,}")
        print(f"   Row groups: {metadata.num_row_groups}")
        print(f"   Colonne analysée: {column_name} (index {col_idx})")
        
        print(f"\n📈 STATISTIQUES PAR ROW GROUP:")
        print(f"{'RG':>3} | {'Lignes':>8} | {'Min':>30} | {'Max':>30} | {'Overlap?'}")
        print("-" * 90)
        
        stats_list = []
        prev_max = None
        overlaps = 0
        
        num_to_show = min(max_row_groups, metadata.num_row_groups)
        
        for rg_idx in range(num_to_show):
            rg = metadata.row_group(rg_idx)
            col = rg.column(col_idx)
            
            if col.is_stats_set:
                stats = col.statistics
                min_val = str(stats.min)
                max_val = str(stats.max)
                
                # Tronquer les valeurs longues
                min_display = min_val[:28] + ".." if len(min_val) > 30 else min_val
                max_display = max_val[:28] + ".." if len(max_val) > 30 else max_val
                
                # Vérifier les overlaps
                overlap_indicator = ""
                if prev_max is not None:
                    if min_val < prev_max:
                        overlap_indicator = "⚠️ OVERLAP"
                        overlaps += 1
                    else:
                        overlap_indicator = "✅ OK"
                
                print(f"{rg_idx:3d} | {rg.num_rows:8,} | {min_display:>30} | {max_display:>30} | {overlap_indicator}")
                
                stats_list.append({
                    'rg': rg_idx,
                    'min': stats.min,
                    'max': stats.max,
                    'rows': rg.num_rows
                })
                
                prev_max = max_val
            else:
                print(f"{rg_idx:3d} | {rg.num_rows:8,} | {'PAS DE STATS':>30} | {'PAS DE STATS':>30} | ❌")
        
        if metadata.num_row_groups > max_row_groups:
            print(f"... et {metadata.num_row_groups - max_row_groups} row groups de plus")
        
        # Analyse des overlaps
        print(f"\n🔍 ANALYSE DU TRI:")
        if len(stats_list) > 1:
            total_comparisons = len(stats_list) - 1
            overlap_percentage = (overlaps / total_comparisons) * 100
            
            if overlaps == 0:
                print("✅ DONNÉES PARFAITEMENT TRIÉES")
                print("   → DuckDB peut skip efficacement les row groups")
                print("   → Requêtes très rapides avec statistiques min/max")
            else:
                print(f"⚠️  DONNÉES PARTIELLEMENT TRIÉES")
                print(f"   → {overlaps}/{total_comparisons} overlaps ({overlap_percentage:.1f}%)")
                print(f"   → DuckDB devra télécharger plus de row groups")
                print(f"   → Performance sous-optimale")
        
        # Simulation de requête
        print(f"\n🎯 SIMULATION DE REQUÊTE:")
        if stats_list:
            # Prendre une valeur au milieu
            mid_idx = len(stats_list) // 2
            if mid_idx < len(stats_list):
                test_value = stats_list[mid_idx]['min']
                print(f"   Test avec: {test_value}")
                
                would_download = 0
                would_skip = 0
                
                for stat in stats_list:
                    if stat['min'] <= test_value <= stat['max']:
                        would_download += 1
                    else:
                        would_skip += 1
                
                total_rg = len(stats_list)
                skip_percentage = (would_skip / total_rg) * 100
                
                print(f"   Résultat:")
                print(f"     Row groups à télécharger: {would_download}/{total_rg}")
                print(f"     Row groups skippés: {would_skip}/{total_rg} ({skip_percentage:.1f}%)")
                
                if skip_percentage > 80:
                    print("     ✅ Excellent! Très peu de téléchargements")
                elif skip_percentage > 50:
                    print("     ⚠️  Correct, mais pourrait être mieux")
                else:
                    print("     ❌ Mauvais! Trop de row groups à télécharger")
        
        print(f"\n💡 RECOMMANDATIONS:")
        if overlaps > 0:
            print("   🔧 Trier les données par 'origin' pour éliminer les overlaps")
            print("   📈 Cela réduira drastiquement les téléchargements")
        else:
            print("   ✅ Les données sont bien triées!")
        
        if len(stats_list) == 0:
            print("   🔧 Activer les statistiques: write_statistics=True")
        
        print(f"{'='*80}\n")
        
    except Exception as e:
        print(f"❌ Erreur: {e}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/analyze_stats.py <parquet_file> [column_name]")
        print("\nExemples:")
        print("  python scripts/analyze_stats.py input_data/vulnerable_origins/0.parquet")
        print("  python scripts/analyze_stats.py input_data/vulnerable_origins/0.parquet origin")
        print("  python scripts/analyze_stats.py input_data/vulnerable_commits_using_cherrypicks_swhid/0.parquet revision_swhid")
        sys.exit(1)
    
    file_path = sys.argv[1]
    column_name = sys.argv[2] if len(sys.argv) > 2 else 'origin'
    
    # Si c'est un dossier, analyser le premier fichier
    if os.path.isdir(file_path):
        parquet_files = list(Path(file_path).glob("*.parquet"))
        if not parquet_files:
            print(f"Aucun fichier .parquet trouvé dans {file_path}")
            sys.exit(1)
        
        print(f"Trouvé {len(parquet_files)} fichiers Parquet")
        print("Analyse du premier fichier...\n")
        analyze_statistics(str(parquet_files[0]), column_name)
    else:
        analyze_statistics(file_path, column_name)


if __name__ == "__main__":
    main()