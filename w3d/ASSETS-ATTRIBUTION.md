# 3D experiment — third-party code and assets

Checked 2026-10-20. The original project's `ATTRIBUTION.md` still governs the map tiles (some CC BY-NC-SA 4.0 → non-commercial use only) and Leaflet (BSD-2-Clause). The 3D map table texture is drawn from `tiles1740/6/…`, so the same restriction applies to it.

| File | Source | Author | Licence (as verified) |
| --- | --- | --- | --- |
| `vendor/three/three.module.js`, `vendor/three/addons/*` | npm `three@0.170.0` | three.js authors | MIT (`vendor/three/LICENSE`) |
| `assets/ual1_standard.glb` (mannequin + 43 clips) | https://quaternius.itch.io/universal-animation-library (Standard/free tier) | Quaternius | CC0 1.0 — `License.txt` in the archive: "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication" |
| `assets/horse_bay.glb` | https://poly.pizza/m/qvTrSG9pZF (Ultimate Animated Animals) | Quaternius | CC0 1.0 (model page) |
| `assets/horse_white.glb` | https://poly.pizza/m/bEdE4rmZy9 | Quaternius | CC0 1.0 (model page) |
| `assets/sheep.glb` | https://poly.pizza/m/rgJXF570ZK | Quaternius | CC0 1.0 (model page) |
| `assets/shibainu.glb` | https://poly.pizza/m/y4wdQpg767 | Quaternius | CC0 1.0 (model page) |

Everything else in `w3d/` (terrain, trees, rocks, grass, buildings, tents, cannon, wagons, flag, uniforms, tricornes, low-poly battle figures) is generated in code for this experiment.

Uniforms, flags and buildings are **illustrative**: colours follow the broad conventions of 1740 (Austrian white/pearl-grey coats, yellow ordinary colour with black eagle; opposing army in dark blue to match the desk's map colour) and are not reconstructions of specific regiments or sites. Battlefield relief is invented; land cover comes from the project's OSM grid (`src/battle_terrain.json`).

Downloaded but not used (kept out of the project): Stylized Nature MegaKit (CC0), Universal Base Characters (CC0), Kenney Survival / Pirate / Castle kits (CC0).
