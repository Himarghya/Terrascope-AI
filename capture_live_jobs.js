const { spawn } = require('child_process');
const fs = require('fs');

const jobs = [
  {
    id: '36f060c4-8973-475f-83db-598ab6a6d6f2',
    prefix: 'japan_village',
    title: 'Japanese Village Oblique (User Latest Upload)'
  },
  {
    id: '1b581f2c-c1da-44b2-8b59-3998bf5c1989',
    prefix: 'china_village',
    title: 'China Village Settlement (User Screenshot)'
  }
];

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  console.log('Spawning Edge for multi-scene captures...');
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
  await new Promise(r => setTimeout(r, 3000));

  for (const job of jobs) {
    console.log(`\n=== Processing ${job.title} (${job.id}) ===`);
    const out2D = `C:\\Users\\himar\\.gemini\\antigravity\\brain\\76000530-86a8-45e1-935b-a83dce89150b\\live_${job.prefix}_2d.png`;
    const out3D = `C:\\Users\\himar\\.gemini\\antigravity\\brain\\76000530-86a8-45e1-935b-a83dce89150b\\live_${job.prefix}_3d.png`;

    // 1. Load scene and switch to 2D image-analysis
    ws.send(JSON.stringify({
      id: 10,
      method: 'Runtime.evaluate',
      params: {
        awaitPromise: true,
        expression: `(async () => {
          const res = await fetch('/api/scene/' + '${job.id}');
          const data = await res.json();
          const store = window.useStore.getState();
          store.selectFeature(null);
          window.useStore.setState({
            sceneData: data,
            currentJobId: '${job.id}',
            selectedSampleId: null,
            isProcessing: false,
            activeScreen: 'image-analysis',
            inspectorOpen: true
          });
          return 'Loaded ' + data.buildings.length + ' buildings.';
        })()`
      }
    }));
    await new Promise(r => setTimeout(r, 5000));

    // Capture 2D
    console.log('Capturing 2D overlay...');
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
    fs.writeFileSync(out2D, Buffer.from(data2D, 'base64'));
    console.log('Saved 2D to', out2D);

    // 2. Switch to 3D reconstruction
    ws.send(JSON.stringify({
      id: 20,
      method: 'Runtime.evaluate',
      params: {
        expression: `window.useStore.setState({ activeScreen: '3d-reconstruction', cameraPreset: 'perspective' });`
      }
    }));
    await new Promise(r => setTimeout(r, 8000));

    // Capture 3D
    console.log('Capturing 3D model...');
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
    fs.writeFileSync(out3D, Buffer.from(data3D, 'base64'));
    console.log('Saved 3D to', out3D);
  }

  ws.close();
  edge.kill();
  console.log('All captures complete!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
