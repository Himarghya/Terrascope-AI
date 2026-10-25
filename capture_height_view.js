const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const outPath = 'C:\\Users\\himar\\.gemini\\antigravity\\brain\\76000530-86a8-45e1-935b-a83dce89150b\\upgraded_height_estimation_view.png';

  console.log('Spawning Edge for Height Estimation view capture...');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9228',
    '--window-size=1600,1050',
    '--disable-gpu-sandbox',
    'http://127.0.0.1:8000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  let targets = [];
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9228/json');
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

  // Wait for initial app load
  await new Promise(r => setTimeout(r, 4000));

  console.log('Injecting completed scene and switching to height-estimation screen...');
  ws.send(JSON.stringify({
    id: 10,
    method: 'Runtime.evaluate',
    params: {
      awaitPromise: true,
      expression: `(async () => {
        const jobId = '089b8049-03d1-4c43-8ac3-b04f4a1ff20c';
        const res = await fetch('/api/scene/' + jobId);
        const data = await res.json();
        const store = window.useStore.getState();
        store.selectFeature(null);
        window.useStore.setState({
          sceneData: data,
          currentJobId: jobId,
          selectedSampleId: null,
          isProcessing: false,
          activeScreen: 'height-estimation',
          inspectorOpen: true
        });
        return 'Loaded ' + (data.buildings ? data.buildings.length : 0) + ' buildings in height view.';
      })()`
    }
  }));

  // Wait 4 seconds for raster tiles and swipe UI to render cleanly
  await new Promise(r => setTimeout(r, 4000));

  console.log('Capturing Height Estimation screenshot...');
  ws.send(JSON.stringify({
    id: 100,
    method: 'Page.captureScreenshot',
    params: { format: 'png' }
  }));

  const data = await new Promise((resolve, reject) => {
    const listener = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 100) {
        ws.removeEventListener('message', listener);
        resolve(msg.result.data);
      }
    };
    ws.addEventListener('message', listener);
    setTimeout(() => reject(new Error('Screenshot timeout')), 10000);
  });

  fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
  console.log('Upgraded Height Estimation screenshot saved to', outPath, 'size:', fs.statSync(outPath).size);

  ws.close();
  edge.kill();
  console.log('Done!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
