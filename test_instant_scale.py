import time, json, base64, subprocess, requests, websocket, os

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE_DIR = r"E:\tmp\chrome_prof_scale_test"
os.makedirs(PROFILE_DIR, exist_ok=True)

proc = subprocess.Popen([
    CHROME_PATH, "--remote-debugging-port=9225", "--remote-allow-origins=*",
    f"--user-data-dir={PROFILE_DIR}", "--headless=new", "--no-proxy-server",
    "--window-size=1600,900", "http://127.0.0.1:8000"
])
time.sleep(3)

try:
    tabs = requests.get("http://127.0.0.1:9225/json/list").json()
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

    # 1. Click GSD button in header
    call("Runtime.evaluate", {"expression": """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const gsdBtn = buttons.find(b => b.innerText && (b.innerText.includes('m/px') || b.innerText.includes('GSD')));
        if (gsdBtn) gsdBtn.click();
    })()
    """})
    time.sleep(1)

    # 2. Click 0.25 m/px preset
    call("Runtime.evaluate", {"expression": """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const p25 = buttons.find(b => b.innerText && b.innerText.includes('0.25 m/px'));
        if (p25) p25.click();
    })()
    """})
    time.sleep(1)

    # 3. Click 'Instant Scale (Fast)' button
    call("Runtime.evaluate", {"expression": """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const fastBtn = buttons.find(b => b.innerText && b.innerText.includes('Instant Scale'));
        if (fastBtn) fastBtn.click();
    })()
    """})
    time.sleep(2)

    # 4. Capture screenshot showing GSD updated to 0.25 m/px
    shot_path = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b\geodepth_rescaled_0_25_gsd.png"
    capture_screenshot(shot_path)

finally:
    try: ws.close()
    except: pass
    proc.terminate()
    print("Done scale test")
