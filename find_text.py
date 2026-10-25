import os

for root, dirs, files in os.walk("."):
    if "node_modules" in root or ".git" in root or ".pytest_cache" in root:
        continue
    for f in files:
        if f.endswith((".ts", ".tsx", ".py", ".html")):
            p = os.path.join(root, f)
            try:
                with open(p, "r", encoding="utf-8", errors="ignore") as fp:
                    content = fp.read()
                    if "Interactive Mask" in content or "Mask Review" in content or "Show Vector Polygons" in content:
                        print(f"Found in {p}")
            except Exception:
                pass
