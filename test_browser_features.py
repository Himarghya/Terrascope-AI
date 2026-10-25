import time, json, base64, subprocess, requests, websocket, os

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE_DIR = r"E:\tmp\chrome_prof_geodepth_test"
os.makedirs(PROFILE_DIR, exist_ok=True)
os.makedirs(r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b", exist_ok=True)

proc = subprocess.Popen([
    CHROME_PATH, "--remote-debugging-port=9224", "--remote-allow-origins=*",
    f"--user-data-dir={PROFILE_DIR}", "--headless=new", "--no-proxy-server",
    "--window-size=1600,900", "http://127.0.0.1:8000"
])
time.sleep(3)

try:
    tabs = requests.get("http://127.0.0.1:9224/json/list").json()
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
    time.sleep(2)

    # 1. Wait for scene to load or click Sapporo district
    print("Waiting for page load...")
    time.sleep(3)
    
    # Check if a scene is loaded, if not click on the first sample
    click_sample_js = """
    (() => {
        // Find sample card or button if scene isn't loaded
        const buttons = Array.from(document.querySelectorAll('button'));
        const sapporoBtn = buttons.find(b => b.innerText && b.innerText.includes('Sapporo'));
        if (sapporoBtn) {
            sapporoBtn.click();
            return 'clicked_sapporo';
        }
        return 'no_button';
    })()
    """
    res = call("Runtime.evaluate", {"expression": click_sample_js, "returnByValue": True})
    print("Click sample result:", res)
    time.sleep(4)

    # Capture 1: Main scene with prominent Measure 3D and GSD button
    shot1_path = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b\geodepth_gsd_and_measure_toolbar.png"
    capture_screenshot(shot1_path)

    # 2. Click GSD button to open modal
    click_gsd_js = """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const gsdBtn = buttons.find(b => b.innerText && (b.innerText.includes('m/px') || b.innerText.includes('GSD')));
        if (gsdBtn) {
            gsdBtn.click();
            return 'clicked_gsd';
        }
        return 'gsd_btn_not_found';
    })()
    """
    res = call("Runtime.evaluate", {"expression": click_gsd_js, "returnByValue": True})
    print("Click GSD result:", res)
    time.sleep(1)
    
    shot2_path = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b\geodepth_gsd_modal_open.png"
    capture_screenshot(shot2_path)

    # Close modal (click Cancel or backdrop)
    call("Runtime.evaluate", {"expression": """
    (() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
    })()
    """})
    time.sleep(1)

    # 3. Click Measure 3D button
    click_measure_js = """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const measureBtn = buttons.find(b => b.innerText && b.innerText.includes('Measure 3D'));
        if (measureBtn) {
            measureBtn.click();
            return 'clicked_measure';
        }
        return 'measure_btn_not_found';
    })()
    """
    res = call("Runtime.evaluate", {"expression": click_measure_js, "returnByValue": True})
    print("Click Measure 3D result:", res)
    time.sleep(1)

    # Simulate clicks on the 3D canvas to place two points
    simulate_measurement_js = """
    (() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return 'no_canvas';
        const rect = canvas.getBoundingClientRect();
        
        // Point A click near center
        const x1 = rect.left + rect.width * 0.45;
        const y1 = rect.top + rect.height * 0.48;
        
        // Point B click slightly offset
        const x2 = rect.left + rect.width * 0.58;
        const y2 = rect.top + rect.height * 0.56;
        
        const evt1 = new MouseEvent('pointerdown', { bubbles: true, clientX: x1, clientY: y1, button: 0 });
        const evtUp1 = new MouseEvent('pointerup', { bubbles: true, clientX: x1, clientY: y1, button: 0 });
        canvas.dispatchEvent(evt1);
        canvas.dispatchEvent(evtUp1);
        
        setTimeout(() => {
            const evt2 = new MouseEvent('pointerdown', { bubbles: true, clientX: x2, clientY: y2, button: 0 });
            const evtUp2 = new MouseEvent('pointerup', { bubbles: true, clientX: x2, clientY: y2, button: 0 });
            canvas.dispatchEvent(evt2);
            canvas.dispatchEvent(evtUp2);
        }, 500);

        return 'dispatched_clicks';
    })()
    """
    res = call("Runtime.evaluate", {"expression": simulate_measurement_js, "returnByValue": True})
    print("Dispatch clicks result:", res)
    time.sleep(2)

    shot3_path = r"C:\Users\himar\.gemini\antigravity\brain\76000530-86a8-45e1-935b-a83dce89150b\geodepth_measure_3d_active.png"
    capture_screenshot(shot3_path)

finally:
    try: ws.close()
    except: pass
    proc.terminate()
    print("Done")
