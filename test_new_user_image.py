import cv2, torch, numpy as np
from PIL import Image
from backend.core.geodepth_pipeline import GeoDepthPipeline

pipe = GeoDepthPipeline(ckpt_path='E:/height-model/height_v2.pt')
img_path = 'backend/uploads/e7008266-1bb9-45ec-87a2-048a7e3e86e2_c3bf614a-6b63-4e04-8ae1-e66488c0fc4b.jpeg'
bgr = cv2.imread(img_path)
rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
print('RGB shape:', rgb.shape)

seg, hgt, auto_gsd = pipe.infer_adaptive_multiscale(rgb, initial_gsd_m=0.35)
print('Auto GSD:', auto_gsd)
cls, counts = np.unique(seg, return_counts=True)
for c, cnt in zip(cls, counts):
    print(f'Class {c}: {cnt} pixels ({cnt/seg.size*100:.1f}%)')
print(f'Hgt: min={hgt.min():.2f}, max={hgt.max():.2f}, mean={hgt.mean():.2f}')

blds = pipe.extract_buildings(seg, hgt, rgb, gsd_m=auto_gsd)
print(f'Total detected buildings: {len(blds)}')

# Draw overlay
vis = bgr.copy()
for b in blds:
    poly = np.array(b['polygon_px'], dtype=np.int32)
    cv2.polylines(vis, [poly], isClosed=True, color=(0, 255, 0), thickness=2)
    cx, cy = int(b['cx']), int(b['cy'])
    cv2.circle(vis, (cx, cy), 3, (0, 0, 255), -1)

out_path = 'C:/Users/himar/.gemini/antigravity/brain/76000530-86a8-45e1-935b-a83dce89150b/test_new_japan_village_overlay.png'
cv2.imwrite(out_path, vis)
print(f'Saved overlay to {out_path}')
