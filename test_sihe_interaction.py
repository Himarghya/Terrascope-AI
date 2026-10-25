import time, json, base64, subprocess, requests, websocket, os

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE_DIR = r"E:\tmp\chrome_prof_sihe_test"
os.makedirs(PROFILE_DIR, exist_ok=True)
OUT_DIR = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b"

proc = subprocess.Popen([
    CHROME_PATH, "--remote-debugging-port=9227", "--remote-allow-origins=*",
    f"--user-data-dir={PROFILE_DIR}", "--headless=new", "--no-proxy-server",
    "--window-size=1600,950", "http://127.0.0.1:8000"
])
time.sleep(3)

try:
    tabs = requests.get("http://127.0.0.1:9227/json/list").json()
    page = next(t for t in tabs if t.get("type") == "page")
    ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=20)
    
    msg_id = 0
    def call(m, p=None):
        global msg_id
        msg_id += 1
        cid = msg_id
        ws.send(json.dumps({"id": cid, "method": m, "params": p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get("id") == cid: return r.get("result", {})

    def capture_screenshot(filepath):
        res = call("Page.captureScreenshot", {"format": "png"})
        data = base64.b64decode(res["data"])
        with open(filepath, "wb") as f:
            f.write(data)
        print(f"Captured: {filepath}")

    call("Page.enable")
    call("Runtime.enable")
    
    # Wait for page to initialize and process default scene
    print("Waiting for initial scene processing...")
    for _ in range(20):
        time.sleep(1)
        res = call("Runtime.evaluate", {
            "expression": 'Boolean(window.__ZUSTAND_STORE__ ? window.__ZUSTAND_STORE__.getState().sceneData : document.querySelector("canvas"))',
            "returnByValue": True
        })
        # Check if error or loaded
        txt = call("Runtime.evaluate", {
            "expression": 'document.body.innerText',
            "returnByValue": True
        }).get("result", {}).get("value", "")
        if "Processing Pipeline Error" not in txt and ("Extents:" in txt or "3D Reconstruction" in txt):
            print("Scene ready!")
            break

    time.sleep(2)

    # 1. Navigate to Height Estimation tab
    print("Navigating to Height Estimation tab...")
    nav_js = """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const heightTab = buttons.find(b => b.innerText && b.innerText.includes('Height Estimation'));
        if (heightTab) {
            heightTab.click();
            return 'clicked_height_tab';
        }
        return 'height_tab_not_found';
    })()
    """
    res = call("Runtime.evaluate", {"expression": nav_js, "returnByValue": True})
    print("Nav result:", res)
    time.sleep(3)

    # Capture initial SIHE view
    shot1 = os.path.join(OUT_DIR, "geodepth_sihe_initial_view.png")
    capture_screenshot(shot1)

    # 2. Click a building in the SIHE imagery (e.g. click on a building polygon in the left pane)
    print("Clicking building polygon...")
    click_bld_js = """
    (() => {
        const polygons = Array.from(document.querySelectorAll('polygon'));
        if (polygons.length > 0) {
            const targetPoly = polygons[Math.min(2, polygons.length - 1)];
            targetPoly.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return 'clicked_polygon';
        }
        return 'no_polygons_found';
    })()
    """
    res = call("Runtime.evaluate", {"expression": click_bld_js, "returnByValue": True})
    print("Click building result:", res)
    time.sleep(2)

    shot2 = os.path.join(OUT_DIR, "geodepth_sihe_building_clicked.png")
    capture_screenshot(shot2)

    # 3. Test clicking outside a building (ground / street spot elevation)
    print("Clicking ground spot...")
    click_ground_js = """
    (() => {
        const svgs = Array.from(document.querySelectorAll('svg'));
        const rasterSvg = svgs.find(s => s.getAttribute('viewBox') && s.getAttribute('viewBox').includes(' '));
        if (rasterSvg) {
            const rect = rasterSvg.getBoundingClientRect();
            // Click in bottom street corridor
            const clickX = rect.left + rect.width * 0.72;
            const clickY = rect.top + rect.height * 0.88;
            rasterSvg.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                clientX: clickX,
                clientY: clickY
            }));
            return 'clicked_ground';
        }
        return 'no_svg';
    })()
    """
    res = call("Runtime.evaluate", {"expression": click_ground_js, "returnByValue": True})
    print("Click ground result:", res)
    time.sleep(2)

    shot3 = os.path.join(OUT_DIR, "geodepth_sihe_ground_spot_clicked.png")
    capture_screenshot(shot3)

    # 4. Test clicking a quick-select building chip
    print("Clicking quick-select building chip...")
    click_chip_js = """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const chip = buttons.find(b => b.innerText && b.innerText.includes('#1') && b.innerText.includes('BLD-'));
        if (chip) {
            chip.click();
            return 'clicked_chip: ' + chip.innerText;
        }
        return 'chip_not_found';
    })()
    """
    res = call("Runtime.evaluate", {"expression": click_chip_js, "returnByValue": True})
    print("Click chip result:", res)
    time.sleep(2)

    shot4 = os.path.join(OUT_DIR, "geodepth_sihe_quick_select_building.png")
    capture_screenshot(shot4)

finally:
    try: ws.close()
    except: pass
    proc.terminate()
    print("SIHE interaction test completed.")
