import time, json, base64, subprocess, requests, websocket, os

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE_DIR = r"E:\tmp\chrome_prof_sihe_target"
os.makedirs(PROFILE_DIR, exist_ok=True)
OUT_DIR = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b"

proc = subprocess.Popen([
    CHROME_PATH, "--remote-debugging-port=9229", "--remote-allow-origins=*",
    f"--user-data-dir={PROFILE_DIR}", "--headless=new", "--no-proxy-server",
    "--window-size=1600,950", "http://127.0.0.1:8000"
])
time.sleep(3)

try:
    tabs = requests.get("http://127.0.0.1:9229/json/list").json()
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
    time.sleep(3)

    # 1. Switch to Height Estimation Screen
    print("Switching to Height Estimation tab...")
    call("Runtime.evaluate", {"expression": """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.innerText && b.innerText.includes('Height Estimation'));
        if (btn) btn.click();
    })()
    """})
    time.sleep(3)

    # 2. Click specifically on a building polygon in the raster pane
    print("Clicking a building polygon...")
    click_bld_js = """
    (() => {
        const crosshairs = document.querySelectorAll('.cursor-crosshair');
        if (crosshairs.length === 0) return 'no_crosshair_container';
        const leftPane = crosshairs[0];
        const polys = leftPane.querySelectorAll('polygon');
        if (polys.length > 0) {
            // Click building #1 (BLD-023 or BLD-009)
            const target = polys[polys.length - 1];
            target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return 'clicked_building_poly';
        }
        return 'no_poly_in_pane';
    })()
    """
    res = call("Runtime.evaluate", {"expression": click_bld_js, "returnByValue": True})
    print("Click building result:", res)
    time.sleep(2)

    shot1 = os.path.join(OUT_DIR, "geodepth_sihe_building_selected.png")
    capture_screenshot(shot1)

    # 3. Click specifically on the open street in the raster pane (ground spot height)
    print("Clicking ground spot on street...")
    click_street_js = """
    (() => {
        const crosshairs = document.querySelectorAll('.cursor-crosshair');
        if (crosshairs.length === 0) return 'no_crosshair_container';
        const leftPane = crosshairs[0];
        const rect = leftPane.getBoundingClientRect();
        // Click at 70% width, 40% height within the image container
        const clickX = rect.left + rect.width * 0.70;
        const clickY = rect.top + rect.height * 0.40;
        leftPane.dispatchEvent(new MouseEvent('click', {
            clientX: clickX,
            clientY: clickY,
            bubbles: true,
            cancelable: true
        }));
        return `clicked_street_at_${Math.round(clickX)}_${Math.round(clickY)}`;
    })()
    """
    res = call("Runtime.evaluate", {"expression": click_street_js, "returnByValue": True})
    print("Click street result:", res)
    time.sleep(2)

    shot2 = os.path.join(OUT_DIR, "geodepth_sihe_ground_spot_selected.png")
    capture_screenshot(shot2)

finally:
    try: ws.close()
    except: pass
    proc.terminate()
    print("Done target test")
