#!/usr/bin/env python3
import json
from shp import read_shp_geometries, read_dbf_attributes

shp_path = "/Users/nathanjohnson/Documents/Codex/2026-10-03/files-pasted-by-the-user-i/work/hydro/HydroRIVERS_v10_eu_shp/HydroRIVERS_v10_eu.shp"
dbf_path = "/Users/nathanjohnson/Documents/Codex/2026-10-03/files-pasted-by-the-user-i/work/hydro/HydroRIVERS_v10_eu_shp/HydroRIVERS_v10_eu.dbf"

target_min_lon = 7.5
target_max_lon = 24.5
target_min_lat = 44.5
target_max_lat = 53.5

print("Reading attributes from DBF...")
attributes = read_dbf_attributes(dbf_path)
print(f"  Records: {len(attributes)}")
if attributes:
    print(f"  First record keys: {list(attributes[0].keys())}")

print("Reading geometries from SHP...")
geometries = read_shp_geometries(shp_path)
print(f"  Records: {len(geometries)}")

rivers = []
rivers_major = []
discharge_counts = {0.1: 0, 1: 0, 5: 0, 50: 0, 500: 0}
ord_stra_values = set()

print("Processing records...")
for shape_type, parts, rec_num in geometries:
    if rec_num - 1 >= len(attributes):
        continue

    attrs = attributes[rec_num - 1]
    if not attrs:
        continue

    # Extract DIS_AV_CMS and ORD_STRA
    dis = attrs.get('DIS_AV_CMS')
    ord_stra = attrs.get('ORD_STRA')

    if dis is None or ord_stra is None:
        continue

    # Find bbox of all points in this reach
    all_points = []
    for part in parts:
        all_points.extend(part)

    if not all_points:
        continue

    lons = [p[0] for p in all_points]
    lats = [p[1] for p in all_points]

    min_lon = min(lons)
    max_lon = max(lons)
    min_lat = min(lats)
    max_lat = max(lats)

    # Check if bbox intersects target bbox
    if (max_lon < target_min_lon or min_lon > target_max_lon or
        max_lat < target_min_lat or min_lat > target_max_lat):
        continue

    # Clip coordinates to target bbox (keep only points inside or exact boundary points)
    clipped_parts = []
    for part in parts:
        clipped_part = []
        for lon, lat in part:
            if target_min_lon <= lon <= target_max_lon and target_min_lat <= lat <= target_max_lat:
                clipped_part.append([round(lon, 4), round(lat, 4)])

        # Remove duplicate consecutive points
        if clipped_part:
            dedup_part = [clipped_part[0]]
            for p in clipped_part[1:]:
                if p != dedup_part[-1]:
                    dedup_part.append(p)
            if len(dedup_part) >= 2:
                clipped_parts.append(dedup_part)

    if not clipped_parts:
        continue

    # Build river record: [dis, ord, [[lon,lat],...]]
    river_record = [dis, ord_stra] + clipped_parts
    rivers.append(river_record)

    if dis >= 5:
        rivers_major.append(river_record)

    # Track discharge distribution
    if dis >= 0.1:
        discharge_counts[0.1] += 1
    if dis >= 1:
        discharge_counts[1] += 1
    if dis >= 5:
        discharge_counts[5] += 1
    if dis >= 50:
        discharge_counts[50] += 1
    if dis >= 500:
        discharge_counts[500] += 1

    ord_stra_values.add(ord_stra)

print(f"\nFiltered to {len(rivers)} reaches")
print(f"Major reaches (DIS>=5): {len(rivers_major)}")

# Output rivers.json
output_rivers = {
    "fields": ["dis", "ord"],
    "lines": rivers
}

output_path = "/Users/nathanjohnson/Documents/Codex/2026-10-03/files-pasted-by-the-user-i/work/hydro/rivers.json"
with open(output_path, 'w') as f:
    json.dump(output_rivers, f, separators=(',', ':'))

output_size = len(json.dumps(output_rivers, separators=(',', ':')))
print(f"\nrivers.json: {output_size} bytes")

# Output rivers_major.json
output_major = {
    "fields": ["dis", "ord"],
    "lines": rivers_major
}

output_major_path = "/Users/nathanjohnson/Documents/Codex/2026-10-03/files-pasted-by-the-user-i/work/hydro/rivers_major.json"
with open(output_major_path, 'w') as f:
    json.dump(output_major, f, separators=(',', ':'))

major_size = len(json.dumps(output_major, separators=(',', ':')))
print(f"rivers_major.json: {major_size} bytes")

# Statistics
print("\n=== DISCHARGE DISTRIBUTION ===")
print(f"Reaches >= 0.1 m³/s: {discharge_counts[0.1]}")
print(f"Reaches >= 1 m³/s:   {discharge_counts[1]}")
print(f"Reaches >= 5 m³/s:   {discharge_counts[5]}")
print(f"Reaches >= 50 m³/s:  {discharge_counts[50]}")
print(f"Reaches >= 500 m³/s: {discharge_counts[500]}")

print(f"\n=== STRAHLER ORDER (ORD_STRA) ===")
print(f"Range: {min(ord_stra_values)} to {max(ord_stra_values)}")
print(f"Values present: {sorted(ord_stra_values)}")
