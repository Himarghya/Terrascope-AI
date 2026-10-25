const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const outPath2D = 'C:\\Users\\himar\\.gemini\\antigravity\\brain\\76000530-86a8-45e1-935b-a83dce89150b\\verified_all_houses_2d_overlay.png';
  const outPath3D = 'C:\\Users\\himar\\.gemini\\antigravity\\brain\\76000530-86a8-45e1-935b-a83dce89150b\\verified_all_houses_3d_render.png';

  console.log('Spawning Edge for dual 2D/3D capture...');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9230',
    '--window-size=1600,1050',
    '--disable-gpu-sandbox',
    'http://127.0.0.1:8000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  let targets = [];
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9230/json');
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

  const jobId = '59e9b3a9-8c35-4a5a-8516-306dd3bb0a90';

  // 1. Capture 2D Image Analysis Screen (The exact screen user showed in first screenshot!)
  console.log('Switching to Image Analysis (image-analysis) screen...');
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
          activeScreen: 'image-analysis',
          inspectorOpen: true
        });
        return 'Loaded ' + data.buildings.length + ' buildings into Image Analysis.';
      })()`
    }
  }));

  await new Promise(r => setTimeout(r, 5000));

  console.log('Capturing 2D Image Analysis screenshot...');
  ws.send(JSON.stringify({ id: 100, method: 'Page.captureScreenshot', params: { format: 'png' } }));

  const data2D = await new Promise((resolve, reject) => {
    const listener = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 100) {
        ws.removeEventListener('message', listener);
        resolve(msg.result.data);
      }
    };
    ws.addEventListener('message', listener);
    setTimeout(() => reject(new Error('2D Screenshot timeout')), 10000);
  });
  fs.writeFileSync(outPath2D, Buffer.from(data2D, 'base64'));
  console.log('Saved 2D screenshot to', outPath2D, 'size:', fs.statSync(outPath2D).size);

  // 2. Capture 3D Reconstruction Screen (The exact screen user showed in second screenshot!)
  console.log('Switching to 3D Reconstruction (3d-reconstruction) screen...');
  ws.send(JSON.stringify({
    id: 20,
    method: 'Runtime.evaluate',
    params: {
      expression: `window.useStore.setState({ activeScreen: '3d-reconstruction', cameraPreset: 'perspective' });`
    }
  }));

  await new Promise(r => setTimeout(r, 10000));

  console.log('Capturing 3D screenshot...');
  ws.send(JSON.stringify({ id: 200, method: 'Page.captureScreenshot', params: { format: 'png' } }));

  const data3D = await new Promise((resolve, reject) => {
    const listener = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 200) {
        ws.removeEventListener('message', listener);
        resolve(msg.result.data);
      }
    };
    ws.addEventListener('message', listener);
    setTimeout(() => reject(new Error('3D Screenshot timeout')), 10000);
  });
  fs.writeFileSync(outPath3D, Buffer.from(data3D, 'base64'));
  console.log('Saved 3D screenshot to', outPath3D, 'size:', fs.statSync(outPath3D).size);

  ws.close();
  edge.kill();
  console.log('All Done!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
