const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const outPath = 'C:\\Users\\himar\\.gemini\\antigravity\\brain\\76000530-86a8-45e1-935b-a83dce89150b\\geodepth_building_selected.png';

  console.log('Spawning Edge for building selection test...');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--window-size=1600,1000',
    '--disable-gpu-sandbox',
    'http://127.0.0.1:8000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  let targets = [];
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9224/json');
      targets = await res.json();
      if (targets.length > 0) break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const page = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => ws.onopen = resolve);

  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));

  console.log('Waiting 10 seconds for 3D scene to load...');
  await new Promise(r => setTimeout(r, 10000));

  // 1. Capture the overview with the BUILDINGS (TALLEST FIRST) list in the sidebar
  console.log('Capturing list overview screenshot...');
  ws.send(JSON.stringify({
    id: 99,
    method: 'Page.captureScreenshot',
    params: { format: 'png' }
  }));

  const dataOverview = await new Promise((resolve, reject) => {
    const listener = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 99) {
        ws.removeEventListener('message', listener);
        resolve(msg.result.data);
      }
    };
    ws.addEventListener('message', listener);
    setTimeout(() => reject(new Error('Overview timeout')), 10000);
  });
  const overviewPath = 'C:\\Users\\himar\\.gemini\\antigravity\\brain\\76000530-86a8-45e1-935b-a83dce89150b\\geodepth_live_tallest_list.png';
  fs.writeFileSync(overviewPath, Buffer.from(dataOverview, 'base64'));
  console.log('Overview saved to', overviewPath);

  // 2. Click the first (tallest) building in the list
  console.log('Clicking the tallest building in the list...');
  ws.send(JSON.stringify({
    id: 10,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const firstBld = document.querySelector('.max-h-64 button');
        if (firstBld) {
          firstBld.click();
          return 'Clicked ' + firstBld.textContent;
        }
        return 'No button found';
      })()`
    }
  }));

  await new Promise(r => setTimeout(r, 2000));

  console.log('Capturing selected building screenshot...');
  ws.send(JSON.stringify({
    id: 100,
    method: 'Page.captureScreenshot',
    params: { format: 'png' }
  }));

  const dataSelected = await new Promise((resolve, reject) => {
    const listener = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 100) {
        ws.removeEventListener('message', listener);
        resolve(msg.result.data);
      }
    };
    ws.addEventListener('message', listener);
    setTimeout(() => reject(new Error('Selected screenshot timeout')), 10000);
  });

  fs.writeFileSync(outPath, Buffer.from(dataSelected, 'base64'));
  console.log('Selected screenshot saved to', outPath, 'size:', fs.statSync(outPath).size);

  ws.close();
  edge.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
