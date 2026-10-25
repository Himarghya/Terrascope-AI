const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const outPath = 'C:\\Users\\himar\\.gemini\\antigravity\\brain\\76000530-86a8-45e1-935b-a83dce89150b\\universal_robust_settlement_3d.png';

  console.log('Spawning Edge for user settlement capture...');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--window-size=1600,1000',
    '--disable-gpu-sandbox',
    'http://127.0.0.1:8000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  let targets = [];
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9227/json');
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

  // Wait for initial load
  await new Promise(r => setTimeout(r, 5000));

  // Explicitly fetch and set the user settlement scene
  console.log('Injecting user settlement job 0d907fc8-f3ec-4f24-b700-df5b8002bda3...');
  ws.send(JSON.stringify({
    id: 10,
    method: 'Runtime.evaluate',
    params: {
      awaitPromise: true,
      expression: `(async () => {
        const res = await fetch('/api/scene/0d907fc8-f3ec-4f24-b700-df5b8002bda3');
        const data = await res.json();
        const store = window.useStore.getState();
        store.selectFeature(null);
        window.useStore.setState({
          sceneData: data,
          currentJobId: '0d907fc8-f3ec-4f24-b700-df5b8002bda3',
          selectedSampleId: null,
          isProcessing: false,
          activeScreen: '3d-reconstruction',
          cameraPreset: 'perspective',
          inspectorOpen: true
        });
        return 'Set user scene: ' + data.buildings.length + ' buildings, GSD=' + data.gsd_m;

      })()`
    }
  }));

  // Wait 10 seconds for Three.js geometry rebuild
  await new Promise(r => setTimeout(r, 10000));

  console.log('Capturing user settlement 3D screenshot...');
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
  console.log('User settlement screenshot saved to', outPath, 'size:', fs.statSync(outPath).size);

  ws.close();
  edge.kill();
  console.log('Done!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
