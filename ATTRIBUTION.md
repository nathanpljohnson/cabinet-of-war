# Asset Attribution

All offline map assets for Central Europe 1740 game.

## JavaScript & CSS Libraries

### Leaflet 1.9.4
- **Files**: `vendor/leaflet.js` (144 KB), `vendor/leaflet.css` (14 KB)
- **Source URL**: https://unpkg.com/leaflet@1.9.4/dist/
- **License**: BSD 2-Clause License (https://raw.githubusercontent.com/Leaflet/Leaflet/v1.9.4/LICENSE)
- **Retrieved**: 2026-10-03

## Geospatial Data

### GeoJSON (geo.json) — 619.3 KB
Composite feature collection with 696 total features:
- **Rivers**: 88 features (name property)
- **Lakes**: 21 features (name, scalerank properties)
- **Coastline**: 100 features (name=featurecla, scalerank property)
- **Land**: 8 features (name=featurecla property)
- **Regions**: 20 features (mountains/ranges/plateaus/basins; name, featurecla properties)
- **Populated Places**: 459 features (name, pop_max, adm0name properties; pop_max >= 15000)

Clipped to bbox: lon 5–30, lat 42–56; simplified with Douglas-Peucker (ε=0.01°); coordinates to 3 decimals.

#### Source Datasets
All from Natural Earth 10m physical/cultural datasets:

- **ne_10m_rivers_lake_centerlines.shp/dbf** 
  - Source: https://naciscdn.org/naturalearth/10m/physical/ne_10m_rivers_lake_centerlines.zip
  - License: CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/)
  - Retrieved: 2026-10-03

- **ne_10m_lakes.shp/dbf**
  - Source: https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes.zip
  - License: CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/)
  - Retrieved: 2026-10-03

- **ne_10m_coastline.shp/dbf**
  - Source: https://naciscdn.org/naturalearth/10m/physical/ne_10m_coastline.zip
  - License: CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/)
  - Retrieved: 2026-10-03

- **ne_10m_land.shp/dbf**
  - Source: https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip
  - License: CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/)
  - Retrieved: 2026-10-03

- **ne_10m_geography_regions_polys.shp/dbf**
  - Source: https://naciscdn.org/naturalearth/10m/physical/ne_10m_geography_regions_polys.zip
  - License: CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/)
  - Retrieved: 2026-10-03

- **ne_10m_populated_places_simple.shp/dbf**
  - Source: https://naciscdn.org/naturalearth/10m/cultural/ne_10m_populated_places_simple.zip
  - License: CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/)
  - Retrieved: 2026-10-03

Natural Earth is maintained by the North American Cartographic Information Society (NACIS). More info: https://www.naturalearthdata.com/

## Historical Map

### europe1740.jpg — 442 KB, 2000×1426 px
- **Title**: Europe 1740
- **Original Source**: https://commons.wikimedia.org/wiki/File:Europe_1740_en.jpg
- **Commons URL**: https://commons.wikimedia.org/wiki/File:Europe_1740_en.jpg
- **Creator**: Bryan Rutherford (Bryanrutherford0)
- **License**: CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/)
- **License Text**: As confirmed on Wikimedia Commons file page, this work is in the public domain and is released under CC0.
- **Original Dimensions**: 3872×2761 px
- **Resized To**: 2000×1426 px (max width 2000px maintained aspect ratio)
- **Retrieved**: 2026-10-03

### Notes on Map Extent
The geographic extent (lon/lat bbox) of europe1740.jpg is not extracted from embedded metadata. The map visually covers Europe circa 1740 during the War of Polish Succession and surrounding conflicts. For game use, position via manual calibration in Leaflet using known landmark coordinates.

## Tools & Processing

- **Shapefile Reader**: Custom Python 3 stdlib-only reader (`shp2geojson.py`) using `struct` module
  - Parses .shp (geometry), .shx (index), .dbf (dBASE attributes)
  - Implements Douglas-Peucker line simplification
  - Filters/clips to Central Europe bbox (lon 5–30, lat 42–56)
  - License: (procedural code for this project)

- **Image Resize**: macOS `sips` tool (native)

## Summary

| Asset | Size | Count/Dims | License |
|-------|------|-----------|---------|
| leaflet.js | 144 KB | — | BSD 2-Clause |
| leaflet.css | 14 KB | — | BSD 2-Clause |
| geo.json | 619.3 KB | 696 features | CC0 1.0 |
| europe1740.jpg | 442 KB | 2000×1426 | CC0 1.0 |
| **Total** | **1.2 MB** | — | — |

All assets are free to use, modify, and distribute under their respective open licenses.

## Terrain relief (added second revision)
Rendered by `work/v2/render_terrain.py` from Terrain Tiles (Terrarium format, AWS Open Data, zoom 8), plus Natural Earth land/lakes/rivers masks. Required attribution (from tilezen/joerd docs/attribution.md, retrieved 2026-10-03; applicable parts):
- Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich;
- Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers;
- Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration;
- United States 3DEP and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey.
The relief is modern topography with synthetic colour/vegetation texture. It is not 1740 land cover.

## Revision 3 (tile pyramid, battle preview) — added 2026-10-03
- Land cover (forest, farmland, grass, wetland), water polygons, buildings, roads, streams: © OpenStreetMap contributors (ODbL 1.0), vector tiles served by OpenFreeMap (https://openfreemap.org). Derived raster tiles are produced works; keep this credit.
- River network: HydroRIVERS v1 (Lehner & Grill 2013, doi:10.1002/hyp.9740), free use with attribution under the HydroSHEDS licence.
- Realm outlines (coarse c.1715 snapshot, optional layer): aourednik/historical-basemaps (GPL-3.0; author cautions to verify against other sources). Used only as an approximate outline; Bohemia/Austria sit inside a single Holy Roman Empire polygon in this dataset.
- Elevation: Terrain Tiles z10 (battlefield area z12) — see credits above.

## Revision 4 — satellite-based tiles (2026-10-03)
- **Sentinel-2 cloudless 2020** — "Sentinel-2 cloudless – https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2020)". Licence: CC BY-NC-SA 4.0 (non-commercial, share-alike). The tiles in `tiles/` and `battle/` are derived from it (mapped modern buildings/industry/airfields removed by inpainting; hillshade and OSM overlays added), so they carry the same NC-SA terms. **Do not sell or commercially distribute this folder.** For a commercial release, re-render without the satellite fusion (set `sat=False`) or license EOxCloudless commercially.
- IM Fell English / IM Fell English SC fonts (Igino Marini; SIL Open Font License 1.1) embedded in the page for map lettering.

## Revision 5 — painted close-range map (2026-10-03)
`paint/` tiles (z13–z17 around Mollwitz) are rendered from OpenStreetMap vector data (© OpenStreetMap contributors, ODbL, via OpenFreeMap), Terrain Tiles elevation and HydroRIVERS only. They contain **no Sentinel-2 imagery**, so the CC BY-NC-SA terms above apply to `tiles/` and `battle/` but not to `paint/`. Field patterns, crowns, roofs and textures are procedural.

## Revision 7 (2026-10-03)
- Realm/crown-land/province overlay: derived from Natural Earth 10m Admin-1 States and Provinces (public domain), modern units grouped into approximate 1740 realms (see `outputs/src/realms.py` table). Approximate, not a historical frontier survey.
- City ground and 3D blocks: © OpenStreetMap contributors (ODbL) via OpenFreeMap (building footprints and `render_height`), Terrain Tiles elevation. Buildings are modern; no 1740 building survey exists in the data.
- Trade-route corridors and "known movements": hand-authored approximations/demo entries, labelled as such in the UI.

## Revision 8 (2026-10-03) — 1740 style
The satellite-based tiles (Sentinel-2 cloudless, CC BY-NC-SA) were **removed from the app and from `outputs/`** (moved to `work/archive_modern/`). Shipping tiles are now `tiles1740/` (hand-coloured style rendered from Terrain Tiles elevation, Natural Earth coast/lakes/rivers, OpenStreetMap forest cover, HydroRIVERS), `realms1740/` (Natural Earth Admin-1 grouped into approximate realms), `paint/` and `cities/` (OpenStreetMap/ODbL + Terrain Tiles). None contain Sentinel-2 data, so the NC-SA restriction no longer applies. Keep ODbL credit for OpenStreetMap-derived tiles.
