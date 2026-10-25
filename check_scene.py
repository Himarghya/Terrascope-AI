import requests

res = requests.get('http://127.0.0.1:8000/api/scene/6c87ba34-b863-4428-b782-fda6d2ef86de').json()
blds = res.get('buildings', [])
trees = res.get('trees', [])
b3d = res.get('buildings_3d', [])
stats = res.get('summary_stats', {})
print(f"Total Buildings: {len(blds)}")
print(f"Total 3D Building Meshes: {len(b3d)}")
print(f"Total Trees: {len(trees)}")
print(f"Tallest Building: {stats.get('tallest_building_m')} m")
print(f"Mean Building Height: {stats.get('mean_building_height_m')} m")
print(f"Built-up Area: {stats.get('built_up_area_m2')} m2")
for i in range(min(8, len(blds))):
    b = blds[i]
    print(f"  {b.get('id')}: height {b.get('estimated_height_m')}m, area {b.get('footprint_area_m2')} m2, shape {b.get('roof_shape')}")
