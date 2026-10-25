const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const outPath1 = 'C:\\Users\\himar\\.gemini\\antigravity\\brain\\76000530-86a8-45e1-935b-a83dce89150b\\individual_houses_45deg_view.png';
  const outPath2 = 'C:\\Users\\himar\\.gemini\\antigravity\\brain\\76000530-86a8-45e1-935b-a83dce89150b\\individual_houses_nadir_ortho_view.png';

  console.log('Spawning Edge for multi-angle capture...');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--window-size=1600,1000',
    '--disable-gpu-sandbox',
    'http://127.0.0.1:8000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  let targets = [];
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9226/json');
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

  // Load user scene and set 45-degree angle
  console.log('Loading scene and setting 45-degree perspective...');
  ws.send(JSON.stringify({
    id: 10,
    method: 'Runtime.evaluate',
    params: {
      awaitPromise: true,
      expression: `(async () => {
        const res = await fetch('/api/scene/90ae3dff-bd14-4835-bc7f-17fc77a83aed');
        const data = await res.json();
        const store = window.useStore.getState();
        store.setCameraPreset('perspective');
        window.useStore.setState({
          sceneData: data,
          currentJobId: '90ae3dff-bd14-4835-bc7f-17fc77a83aed',
          isProcessing: false,
          activeScreen: '3d-reconstruction',
          inspectorOpen: false
        });
        return 'Loaded ' + data.buildings.length + ' buildings';
      })()`
    }
  }));

  await new Promise(r => setTimeout(r, 6000));

  console.log('Capturing Screenshot 1 (45-degree Perspective)...');
  ws.send(JSON.stringify({
    id: 100,
    method: 'Page.captureScreenshot',
    params: { format: 'png' }
  }));

  const data1 = await new Promise((resolve, reject) => {
    const listener = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 100) {
        ws.removeEventListener('message', listener);
        resolve(msg.result.data);
      }
    };
    ws.addEventListener('message', listener);
    setTimeout(() => reject(new Error('Screenshot 1 timeout')), 10000);
  });
  fs.writeFileSync(outPath1, Buffer.from(data1, 'base64'));
  console.log('45-degree screenshot saved to', outPath1);

  // Switch to Nadir top-down orthographic view
  console.log('Switching to Nadir top-down view...');
  ws.send(JSON.stringify({
    id: 20,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        window.useStore.getState().setCameraPreset('top');
        return 'Switched to Nadir';
      })()`
    }
  }));

  await new Promise(r => setTimeout(r, 4000));

  console.log('Capturing Screenshot 2 (Nadir Ortho View)...');
  ws.send(JSON.stringify({
    id: 101,
    method: 'Page.captureScreenshot',
    params: { format: 'png' }
  }));

  const data2 = await new Promise((resolve, reject) => {
    const listener = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 101) {
        ws.removeEventListener('message', listener);
        resolve(msg.result.data);
      }
    };
    ws.addEventListener('message', listener);
    setTimeout(() => reject(new Error('Screenshot 2 timeout')), 10000);
  });
  fs.writeFileSync(outPath2, Buffer.from(data2, 'base64'));
  console.log('Nadir screenshot saved to', outPath2);

  ws.close();
  edge.kill();
  console.log('Done!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
