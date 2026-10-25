const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const outPath = 'C:\\Users\\himar\\.gemini\\antigravity\\brain\\76000530-86a8-45e1-935b-a83dce89150b\\holistic_buildings_3d_render.png';

  console.log('Spawning Edge for 3D capture...');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--window-size=1600,1050',
    '--disable-gpu-sandbox',
    'http://127.0.0.1:8000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  let targets = [];
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9229/json');
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
  await new Promise(r => setTimeout(r, 4000));

  console.log('Fetching and setting latest uploaded scene in store...');
  ws.send(JSON.stringify({
    id: 10,
    method: 'Runtime.evaluate',
    params: {
      awaitPromise: true,
      expression: `(async () => {
        // Find latest completed job
        const resList = await fetch('/api/samples'); // or fetch directly
        // Use the Japan job ID
        const jobId = '1fd20644-4fa8-4d4a-b5d0-2a486eb1e9d6'; // India scene with 73 buildings
        const res = await fetch('/api/scene/' + jobId);
        const data = await res.json();
        const store = window.useStore.getState();
        store.selectFeature(null);
        window.useStore.setState({
          sceneData: data,
          currentJobId: jobId,
          selectedSampleId: null,
          isProcessing: false,
          activeScreen: '3d-reconstruction',
          cameraPreset: 'perspective',
          inspectorOpen: true
        });
        return 'Loaded ' + data.buildings.length + ' buildings into 3D view.';
      })()`
    }
  }));

  // Wait 10 seconds for Three.js geometry compilation
  await new Promise(r => setTimeout(r, 10000));

  console.log('Capturing 3D reconstruction screenshot...');
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
  console.log('Saved 3D screenshot to', outPath, 'size:', fs.statSync(outPath).size);

  ws.close();
  edge.kill();
  console.log('Done!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
