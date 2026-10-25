import time, json, base64, subprocess, requests, websocket, os

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE_DIR = r"E:\tmp\chrome_prof_sihe_ground"
os.makedirs(PROFILE_DIR, exist_ok=True)
OUT_DIR = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b"

proc = subprocess.Popen([
    CHROME_PATH, "--remote-debugging-port=9228", "--remote-allow-origins=*",
    f"--user-data-dir={PROFILE_DIR}", "--headless=new", "--no-proxy-server",
    "--window-size=1600,950", "http://127.0.0.1:8000"
])
time.sleep(3)

try:
    tabs = requests.get("http://127.0.0.1:9228/json/list").json()
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

    # 1. Navigate to Height Estimation
    call("Runtime.evaluate", {"expression": """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const heightTab = buttons.find(b => b.innerText && b.innerText.includes('Height Estimation'));
        if (heightTab) heightTab.click();
    })()
    """})
    time.sleep(2)

    # 2. Click specifically on the road corridor on the left TrueColor image (where there is no building polygon)
    click_street_js = """
    (() => {
        const svgs = Array.from(document.querySelectorAll('svg')).filter(s => s.getAttribute('viewBox'));
        if (svgs.length > 0) {
            const svg = svgs[0];
            const rect = svg.getBoundingClientRect();
            // In Sapporo image, x=75% width (right side road avenue) and y=50% height is the main road avenue
            const clickX = rect.left + rect.width * 0.72;
            const clickY = rect.top + rect.height * 0.45;
            svg.dispatchEvent(new MouseEvent('click', {
                clientX: clickX,
                clientY: clickY,
                bubbles: true,
                cancelable: true
            }));
            return `clicked_street_at_${Math.round(clickX)}_${Math.round(clickY)}`;
        }
        return 'no_svg';
    })()
    """
    res = call("Runtime.evaluate", {"expression": click_street_js, "returnByValue": True})
    print("Click street result:", res)
    time.sleep(2)

    shot1 = os.path.join(OUT_DIR, "geodepth_sihe_ground_spot_elevation.png")
    capture_screenshot(shot1)

    # 3. Click building #1 (tallest: BLD-023, 8.8m) from the quick select strip
    click_tallest_js = """
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
    res = call("Runtime.evaluate", {"expression": click_tallest_js, "returnByValue": True})
    print("Click tallest result:", res)
    time.sleep(2)

    shot2 = os.path.join(OUT_DIR, "geodepth_sihe_tallest_bld023.png")
    capture_screenshot(shot2)

finally:
    try: ws.close()
    except: pass
    proc.terminate()
    print("Done")
