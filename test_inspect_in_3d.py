import time, json, base64, subprocess, requests, websocket, os

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE_DIR = r"E:\tmp\chrome_prof_inspect_3d"
os.makedirs(PROFILE_DIR, exist_ok=True)
OUT_DIR = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b"

proc = subprocess.Popen([
    CHROME_PATH, "--remote-debugging-port=9230", "--remote-allow-origins=*",
    f"--user-data-dir={PROFILE_DIR}", "--headless=new", "--no-proxy-server",
    "--window-size=1600,950", "http://127.0.0.1:8000"
])
time.sleep(3)

try:
    tabs = requests.get("http://127.0.0.1:9230/json/list").json()
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

    # 1. Go to Height Estimation
    call("Runtime.evaluate", {"expression": """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.innerText && b.innerText.includes('Height Estimation'));
        if (btn) btn.click();
    })()
    """})
    time.sleep(2)

    # 2. Click Quick-Select chip for #1 BLD-023
    call("Runtime.evaluate", {"expression": """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const chip = buttons.find(b => b.innerText && b.innerText.includes('#1') && b.innerText.includes('BLD-'));
        if (chip) chip.click();
    })()
    """})
    time.sleep(1)

    # 3. Click "Inspect in 3D Scene" button in the inspection card
    call("Runtime.evaluate", {"expression": """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const inspect3DBtn = buttons.find(b => b.innerText && b.innerText.includes('Inspect in 3D Scene'));
        if (inspect3DBtn) inspect3DBtn.click();
    })()
    """})
    time.sleep(3)

    shot = os.path.join(OUT_DIR, "geodepth_sihe_focused_in_3d.png")
    capture_screenshot(shot)

finally:
    try: ws.close()
    except: pass
    proc.terminate()
    print("Done 3D inspect test")
