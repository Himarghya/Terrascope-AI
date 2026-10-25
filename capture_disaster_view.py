import time, json, base64, subprocess, requests, websocket, os

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE_DIR = r"E:\tmp\chrome_prof_disaster_test"
os.makedirs(PROFILE_DIR, exist_ok=True)
ARTIFACT_DIR = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b"
os.makedirs(ARTIFACT_DIR, exist_ok=True)

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

    # Click Disaster Assessment tab in sidebar
    click_disaster_tab = """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const disasterBtn = buttons.find(b => b.innerText && (b.innerText.includes('Disaster') || b.innerText.includes('Damage')));
        if (disasterBtn) {
            disasterBtn.click();
            return 'clicked_disaster_tab';
        }
        return 'no_disaster_button_found: ' + buttons.map(b => b.innerText).join(', ');
    })()
    """
    res = call("Runtime.evaluate", {"expression": click_disaster_tab, "returnByValue": True})
    print("Click disaster tab result:", res)
    time.sleep(3)

    capture_screenshot(os.path.join(ARTIFACT_DIR, "terrascope_disaster_intelligence_view.png"))

finally:
    proc.terminate()
