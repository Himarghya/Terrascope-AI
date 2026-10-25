import os, sys, cv2, numpy as np, torch
from PIL import Image
import segmentation_models_pytorch as smp

CKPT = r'E:\height-model\height_v2.pt'
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
ck = torch.load(CKPT, map_location=dev)
model = smp.Unet(ck['enc'], encoder_weights=None, in_channels=3, classes=6).to(dev)
model.load_state_dict(ck['state'])
model.eval()

img_path = r'C:\Users\himar\.gemini\antigravity\scratch\satellite-3d-studio\backend\uploads\8736cf05-3701-4ae8-b446-3ad7a7335e62_DisasterImage2.jpeg'
im = Image.open(img_path).convert('RGB')
w, h = im.size
print('Loaded image:', w, h)

H_SCALE, TRAIN_GSD, TILE, STRIDE = 30.0, 0.35, 768, 640
MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)

g = 0.35
s = g / TRAIN_GSD
sh, sw = max(32, round(h * s)), max(32, round(w * s))
if abs(s - 1) > 0.05:
    im = im.resize((sw, sh), Image.LANCZOS if s < 1 else Image.BICUBIC)

a = (np.asarray(im, np.float32) / 255 - MEAN) / STD

@torch.no_grad()
def run(a):
    h, w = a.shape[:2]
    p = np.ascontiguousarray(np.pad(a, ((0, (-h) % 32), (0, (-w) % 32), (0, 0)), mode='edge').transpose(2, 0, 1))
    t = torch.from_numpy(p)[None].to(dev)
    out = (model(t) + model(t.flip(3)).flip(3)) / 2
    return out[0, :, :h, :w].float().cpu().numpy()

def starts(n):
    last = max(n - TILE, 0)
    st = list(range(0, last + 1, STRIDE))
    if st[-1] != last: st.append(last)
    return st

def infer(a):
    H, W = a.shape[:2]
    if H <= TILE and W <= TILE:
        return run(a)
    out = np.zeros((6, H, W), np.float32); wt = np.zeros((H, W), np.float32)
    h1 = np.hanning(TILE + 2)[1:-1]
    win = (np.outer(h1, h1) + 1e-3).astype(np.float32)
    for y in starts(H):
        for x in starts(W):
            ph, pw = min(TILE, H - y), min(TILE, W - x)
            out[:, y:y + ph, x:x + pw] += run(a[y:y + ph, x:x + pw]) * win[:ph, :pw]
            wt[y:y + ph, x:x + pw] += win[:ph, :pw]
    return out / wt

out = infer(a)
seg = out[:5].argmax(0).astype(np.uint8)
hgt = np.clip(out[5] * H_SCALE, 0, None)

m = (seg == 2).astype(np.uint8)
k = np.ones((3, 3), np.uint8)
m = cv2.morphologyEx(cv2.morphologyEx(m, cv2.MORPH_OPEN, k), cv2.MORPH_CLOSE, k)
cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
print('Raw building contours found:', len(cnts))

mx, my = (w * g) / sw, (h * g) / sh
min_area_px = max(8.0, 15.0 / (mx * my))
blds = []
for c in cnts:
    area = cv2.contourArea(c)
    if area < min_area_px: continue
    x, y, bw, bh = cv2.boundingRect(c)
    mask = np.zeros((bh, bw), np.uint8)
    cv2.drawContours(mask, [c], -1, 1, -1, offset=(-x, -y))
    hv = hgt[y:y + bh, x:x + bw][mask > 0]
    if hv.size == 0: continue
    height = max(3.0, float(np.median(hv)))
    (cx, cy), (rw, rh), ang = cv2.minAreaRect(c)
    if rw * rh > 0 and area / (rw * rh) > 0.85:
        poly = cv2.boxPoints(((cx, cy), (rw, rh), ang))
    else:
        poly = cv2.approxPolyDP(c, max(1.5, 0.012 * cv2.arcLength(c, True)), True).reshape(-1, 2)
    if len(poly) < 3: continue
    blds.append({'h': height, 'poly': poly, 'area': area * mx * my})

print('Extracted valid buildings:', len(blds))
blds.sort(key=lambda b: -b['h'])
for i in range(min(5, len(blds))):
    print(f"Building #{i+1}: height {blds[i]['h']:.1f}m, area {blds[i]['area']:.1f} m2")
