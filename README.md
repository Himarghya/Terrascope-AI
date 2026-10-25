# TerraScope AI / GeoDepth 3D 🛰️🏙️

> **Unified Geospatial Voice Intelligence & Autonomous 3D Digital Twin Platform**  
> *Transforming single-view 2D satellite imagery into metric 3D digital twins, physics-grounded disaster simulations, and spoken intelligence.*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r174-000000?logo=three.js&logoColor=white)](https://threejs.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org/)
[![Agent37](https://img.shields.io/badge/Agent37-Hermes_Runtime-6366F1)](https://www.agent37.com)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-Voice_Intelligence-FF6B6B)](https://elevenlabs.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## 🌍 Overview

**TerraScope AI** (formerly GeoDepth 3D) is an end-to-end geospatial intelligence system designed for urban planners, disaster response teams (SAR), and defense analysts. 

From a single 2D optical satellite image or orthomosaic, TerraScope AI:
1. **Reconstructs 3D Urban Topography**: Infers photogrammetric depth, extracts individual building footprints via watershed segmentation, estimates accurate building heights ($\pm 1.2\text{m}$ RMSE) and roof geometries, and populates 3D procedural vegetation on a Copernicus 30m calibrated DEM.
2. **Simulates Physical Disasters**: Executes Joyner-Boore seismic ground shaking models, flood rise inundation, landslide risk calculations, and bitemporal change detection with rubble volume estimation.
3. **Deploys an Autonomous AI Worker (Agent37)**: Uses the preconfigured `agent37-hermes` cloud runtime to orchestrate multi-step geospatial investigations, monitor sectors, and resume workflows across sessions using durable storage.
4. **Delivers Spoken Voice Intelligence (ElevenLabs)**: Provides natural two-way voice conversations, hands-free building inspections, and evidence-grounded audio debriefs.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│               Interactive React Three Fiber Workstation                │
│   • 3D Viewport (Orbit/Fly-to)     • Building Inspector HUD            │
│   • Bitemporal Split Screen         • Spoken Voice Assistant Widget     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ WebSockets / REST
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      FastAPI Geospatial Backend                        │
│                                                                        │
│  ┌─────────────────────────┐           ┌────────────────────────────┐  │
│  │   Computer Vision & ML  │           │   Agent & Voice Services   │  │
│  │ • ResNet50 U-Net Depth  │           │ • Agent37 Hermes Engine    │  │
│  │ • height_v2.pt Checkpt  │           │ • ElevenLabs TTS / STT     │  │
│  │ • Watershed / Shadows   │           │ • Durable Investigation DB │  │
│  └─────────────────────────┘           └────────────────────────────┘  │
│  ┌─────────────────────────┐           ┌────────────────────────────┐  │
│  │ Physics Hazard Engines  │           │   GIS & 3D Exporters       │  │
│  │ • Joyner-Boore GMPE     │           │ • GLB / GeoJSON / CityJSON │  │
│  │ • Flood Inundation 2.5D │           │ • Unreal 5 / Unity Meshes  │  │
│  └─────────────────────────┘           └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 1. 2D-to-3D Neural Photogrammetric Reconstruction
- **Deep Elevation Inference**: Powered by a trained ResNet50 U-Net backbone (`height_v2.pt`) trained on photogrammetric LiDAR depth pairs.
- **Instance Separation**: Distance-transform watershed and Canny edge barriers prevent adjacent building grouping.
- **Parametric Roof Classification**: Detects flat with parapets, gabled, hipped, and industrial saw-tooth roofs.
- **Solar Shadow Trigonometry**: Dual height verification via solar zenith angles ($H = L \cdot \tan\theta_{\text{sun}}$).

### 2. Autonomous Persistent Worker (Agent37 Hermes)
- **Official Runtime**: Built upon Agent37's official `agent37-hermes` cloud harness with automated credit-saving sleep timeouts.
- **Controlled Backend Tool Execution**: Hermes directly queries:
  - `get_analysis_results`: Building density, average heights, and area.
  - `get_building_details`: Individual structural dimensions, floors, materials.
  - `get_terrain_summary`: Slope, elevation relief, datum calibration.
  - `request_earthquake_analysis`: Real-time Joyner-Boore seismic ground acceleration.
  - `compare_earthquake_scenarios`: Differential damage deltas across magnitudes.
  - `generate_analysis_report`: Certified markdown damage assessment dossiers.
- **Cross-Session Resumption**: Persists investigation state under `backend/data/investigations/`, resuming multi-turn sessions without re-running compute pipelines.

### 3. Voice-Enabled Geospatial Intelligence (ElevenLabs)
- **Natural Voice Queries**: Speak directly to inspect buildings, run disaster simulations, or request briefings.
- **Real-Time Building Voice Inspection**: Click on any 3D building in the viewport to hear an instantaneous, natural voice readout of its height, floor count, structural footprint, and solar potential.
- **Strict Evidence Grounding**: Responses are deterministic and derived exclusively from ML outputs, eliminating hallucinations.

### 4. Physics-Grounded Disaster & Hazard Intelligence
- **Joyner-Boore Seismic Attenuation**: Calculates Peak Ground Acceleration (PGA in $g$) and Modified Mercalli Intensity (MMI) based on hypocentral distance and focal depth.
- **Structural Vulnerability Fragility Curves**: Evaluates building collapse probability as a function of structure height and ground motion.
- **Bitemporal Change Detection**: Aligns pre- and post-disaster satellite imagery, isolates pancaked structures, and calculates rubble volume ($m^3$).

### 5. Multi-Engine 3D & GIS Exports
- **GLB/glTF**: PBR textures and instanced foliage meshes.
- **GeoJSON**: Projected polygon footprints with physical attributes.
- **Game Engine Ready**: Direct export compatibility for Unreal Engine 5 (Nanite) and Unity.

---

## 🚀 Getting Started

### Prerequisites
- **Python**: 3.10+ (tested on Python 3.14)
- **Node.js**: 18+ (tested on Node.js 24)
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/Himarghya/Terrascope-AI.git
cd Terrascope-AI
```

### 2. Configure Environment Variables
Copy the `.env.example` template in both the root and `backend/` directories:
```bash
cp .env.example .env
cp .env.example backend/.env
```
Fill in your API keys in `backend/.env`:
```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
AGENT37_API_KEY=your_agent37_api_key_here
```
> *Note: API keys are strictly kept on the backend server and never exposed to client-side bundles.*

### 3. Backend Setup
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```
The FastAPI backend will start at `http://127.0.0.1:8000` (interactive documentation at `/docs`).

### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
Open your browser to `http://localhost:5173` (or `http://127.0.0.1:3000`).

---

## 🧪 Testing & Verification

Run the comprehensive automated test suite for Agent37 investigations and voice workflows:
```bash
cd backend
python -m pytest tests/test_agent37_investigations.py tests/test_unified_agent37_elevenlabs.py -v
```

Verify frontend TypeScript compilation and production build:
```bash
cd frontend
npm run build
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend and ML engine health check. |
| `POST` | `/api/process` | Asynchronously reconstruct 3D scene from satellite image. |
| `POST` | `/api/infer` | Lightweight 2D image ➔ 3D height inference API. |
| `POST` | `/api/agent37/explain` | Orchestrate Agent37 Hermes tool workflow on current scene. |
| `GET` | `/api/agent37/models` | Discover active Agent37 models and live cloud instance status. |
| `POST` | `/api/voice/speak` | Synthesize speech using ElevenLabs TTS. |
| `POST` | `/api/voice/transcribe` | Transcribe speech audio using ElevenLabs STT. |

---

## 🛡️ Security & Integrity

- **Zero Client Leakage**: All Agent37 and ElevenLabs secrets reside exclusively on the backend.
- **Deterministic Guardrails**: Structural heights and damage figures are computed deterministically by PyTorch models (`height_v2.pt`) and empirical physics GMPE equations, not hallucinated by LLMs.
- **Physical Limitations Transparency**: All disaster simulations explicitly output engineering disclaimers regarding soil conditions and field audit requirements.

---

## 📄 License

Distributed under the Apache 2.0 License. See `LICENSE` for more information.
