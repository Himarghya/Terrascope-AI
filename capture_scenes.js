const { spawn } = require('child_process');
const fs = require('fs');

const jobId = process.argv[2] || 'd567fbf4-dc4b-47c7-a5cf-6665632d3871';
const outPrefix = process.argv[3] || 'india_village';
const targetMode = process.argv[4] || '3d'; // '3d' or 'satellite'

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const outDir = 'C:\\Users\\himar\\.gemini\\antigravity\\brain\\a55b43fc-e72b-4116-840b-a27bd4653be2';
  const outFile = `${outDir}\\verified_${targetMode}_${outPrefix}.png`;

  const debugPort = 9240 + Math.floor(Math.random() * 50);
  const userDataDir = `C:\\Users\\himar\\.gemini\\antigravity\\scratch\\satellite-3d-studio\\edge_tmp_${debugPort}`;
  console.log(`Capturing ${targetMode} for ${outPrefix} (Job: ${jobId}) on port ${debugPort}...`);
  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1600,1050',
    '--disable-gpu-sandbox',
    'http://127.0.0.1:8000/'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  let targets = [];
  for (let i = 0; i < 12; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
      targets = await res.json();
      if (targets.length > 0) break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const page = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => ws.onopen = resolve);

  let nextId = 1;
  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const listener = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', listener);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', listener);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await sendCommand('Runtime.enable');
  await sendCommand('Page.enable');
  // Wait for initial page loads
  await new Promise(r => setTimeout(r, 3000));

  console.log('Fetching scene data and setting store...');
  const evalResult = await sendCommand('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const res = await fetch('/api/scene/${jobId}');
      if (!res.ok) throw new Error('Failed to fetch scene: ' + res.status);
      const data = await res.json();
      
      const store = window.useStore.getState();
      store.selectFeature(null);
      window.useStore.setState({
        sceneData: data,
        currentJobId: '${jobId}',
        selectedSampleId: null,
        isProcessing: false,
        activeScreen: '3d-reconstruction',
        viewMode: '${targetMode}',
        cameraPreset: 'perspective',
        inspectorOpen: true
      });
      return {
        loaded: true,
        buildingsCount: data.buildings ? data.buildings.length : 0,
        buildings3DCount: data.buildings_3d ? data.buildings_3d.length : 0,
        viewMode: '${targetMode}',
        jobId: '${jobId}'
      };
    })()`
  });

  console.log('Eval result:', JSON.stringify(evalResult.result ? evalResult.result.value : evalResult));

  // Wait for Three.js render or SVG render
  const waitMs = targetMode === '3d' ? 8000 : 3000;
  console.log(`Waiting ${waitMs}ms for render...`);
  await new Promise(r => setTimeout(r, waitMs));

  console.log('Capturing screenshot...');
  const screenResult = await sendCommand('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outFile, Buffer.from(screenResult.data, 'base64'));
  console.log(`SUCCESS! Saved ${targetMode} to ${outFile} (${fs.statSync(outFile).size} bytes)`);

  ws.close();
  edge.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
