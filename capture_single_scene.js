const { spawn } = require('child_process');
const fs = require('fs');

const jobId = process.argv[2] || 'd567fbf4-dc4b-47c7-a5cf-6665632d3871';
const outPrefix = process.argv[3] || 'india_dense';
const mode = process.argv[4] || 'both'; // '3d', 'satellite', 'both'

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const outDir = 'C:\\Users\\himar\\.gemini\\antigravity\\brain\\76000530-86a8-45e1-935b-a83dce89150b';
  const out3D = `${outDir}\\verified_3d_${outPrefix}.png`;
  const out2D = `${outDir}\\verified_2d_${outPrefix}.png`;

  console.log(`Spawning Edge for capture of ${outPrefix} (${jobId}, mode=${mode})...`);
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9232',
    '--window-size=1600,1050',
    '--disable-gpu-sandbox',
    'http://127.0.0.1:8000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  let targets = [];
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9232/json');
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
  // Wait 4 seconds for default App mount effects to settle
  await new Promise(r => setTimeout(r, 4000));

  async function takeScreenshot(filePath) {
    ws.send(JSON.stringify({ id: 100, method: 'Page.captureScreenshot', params: { format: 'png' } }));
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
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`Saved screenshot to ${filePath} (${fs.statSync(filePath).size} bytes)`);
  }

  if (mode === '3d' || mode === 'both') {
    console.log('Setting 3D mode in store...');
    ws.send(JSON.stringify({
      id: 10,
      method: 'Runtime.evaluate',
      params: {
        awaitPromise: true,
        expression: `(async () => {
          const res = await fetch('/api/scene/' + '${jobId}');
          const data = await res.json();
          const store = window.useStore.getState();
          store.selectFeature(null);
          window.useStore.setState({
            sceneData: data,
            currentJobId: '${jobId}',
            selectedSampleId: null,
            isProcessing: false,
            activeScreen: '3d-reconstruction',
            viewMode: '3d',
            cameraPreset: 'perspective',
            inspectorOpen: true
          });
          return '3D mode loaded: ' + data.buildings.length + ' buildings.';
        })()`
      }
    }));
    await new Promise(r => setTimeout(r, 8000));
    await takeScreenshot(out3D);
  }

  if (mode === 'satellite' || mode === 'both') {
    console.log('Setting 2D Ortho mode in store...');
    ws.send(JSON.stringify({
      id: 20,
      method: 'Runtime.evaluate',
      params: {
        awaitPromise: true,
        expression: `(async () => {
          const res = await fetch('/api/scene/' + '${jobId}');
          const data = await res.json();
          window.useStore.setState({
            sceneData: data,
            currentJobId: '${jobId}',
            selectedSampleId: null,
            isProcessing: false,
            activeScreen: '3d-reconstruction',
            viewMode: 'satellite',
            inspectorOpen: true
          });
          return 'Switched to 2D Ortho: ' + data.buildings.length + ' buildings.';
        })()`
      }
    }));
    await new Promise(r => setTimeout(r, 4000));
    await takeScreenshot(out2D);
  }

  ws.close();
  edge.kill();
  console.log('Capture completed successfully.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
