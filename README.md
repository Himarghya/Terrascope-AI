# TerraScope AI 🛰️🏙️

> **On-Demand Geospatial Voice Intelligence & Autonomous 3D Digital Twin Platform**  
> *Transforming single-view 2D satellite and drone imagery into interactive 3D digital twins, micro-building disaster simulations, and actuarial insurance risk scoring in < 15 seconds.*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r174-000000?logo=three.js&logoColor=white)](https://threejs.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org/)
[![Agent37](https://img.shields.io/badge/Agent37-Hermes_Runtime-6366F1)](https://www.agent37.com)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-Voice_Intelligence-FF6B6B)](https://elevenlabs.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-71%20Passed-brightgreen)](https://github.com/Himarghya/Terrascope-AI)

---

## 🌍 Executive Overview

**TerraScope AI** is a tactical geospatial intelligence engine built for disaster first responders, commercial property underwriters, and municipal urban planners.

Unlike legacy geospatial datasets that take months of airplane flight surveys or weeks of hydrodynamic modeling, TerraScope AI converts **any raw optical satellite or drone screenshot into a fully walkable, physics-simulated 3D digital twin in under 15 seconds**.

### What TerraScope AI Delivers:
1. **Sub-15s 2D-to-3D Reconstruction**: Infers metric depth, extracts individual building footprints, isolates 1-meter alleys in dense informal settlements, and predicts building heights ($\pm 1.2\text{m}$ RMSE).
2. **Micro-Building Physics Simulation**: Executes Joyner-Boore seismic ground acceleration, Topographic Wetness Index (TWI) flood pooling, slope stability Factor of Safety (FoS), and bitemporal post-disaster rubble volume calculations.
3. **Real-Time Property Insurance Underwriting**: Computes building-level hazard exposure scores ($0-100$), estimated Replacement Cost Valuation (RCV), premium surcharge recommendations, and deductible tiering.
4. **Autonomous AI Investigation (Agent37)**: Employs a persistent cloud worker runtime to inspect sectors, analyze structural vulnerabilities, and resume investigation dossiers across sessions.
5. **Hands-Free Voice Intelligence (ElevenLabs)**: Enables natural, two-way conversational debriefs and tactile building audio readouts for field teams on the ground.

---

## 🏆 Competitive Advantage

| Comparison Dimension | Traditional Aerial / Data Giants *(Nearmap, Ecopia, MS)* | Catastrophe Modelers *(Moody's RMS, Fathom)* | **TerraScope AI** |
| :--- | :--- | :--- | :--- |
| **Speed to Delivery** | **Months to Weeks** (Scheduled airplane surveys & batch updates) | **Days to Weeks** (Supercomputer hydrodynamic simulations) | **< 15 Seconds (On-Demand)** from any fresh 2D satellite image |
| **Geographic Coverage** | **Western Suburbs Only** (Only where planes fly: US, UK, Australia) | Limited in un-gauged or developing river basins | **100% Global Coverage** (Works anywhere on Earth with an optical satellite pass) |
| **Informal Settlements & Slums** | ❌ **Fails** (Fuses dense villages into monolithic blobs) | ❌ **Macro only** ($30\text{m} - 100\text{m}$ regional grids) | **1-Meter Alley Separation** (Alley-Cutter separates dense homes down to 1–3 px gaps) |
| **Hazard & Risk Intelligence** | ❌ None or static postal-code scores | Macro financial portfolio capital pricing | **Micro-Building Physics + Insurance RCV & Premium Scoring** |
| **Interactivity & Voice** | Static CSVs, shapefiles, or flat 2D PDFs | Macro heatmaps and tabular actuarial loss tables | **Interactive 3D Web Canvas + ElevenLabs Voice Intelligence** |

> **Key Positioning Note:** TerraScope AI does not attempt to replace 30-year actuarial reinsurance models. We provide **tactical field triage and rapid pre-underwriting screening in the critical first 24 hours** when local sensors are destroyed or absent.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│               Interactive React Three Fiber Workstation                │
│   • 3D Viewport (Orbit/Fly-to)     • Building Inspector HUD            │
│   • Bitemporal Split Screen        • Spoken Voice Assistant Widget     │
│   • Insurance Risk Studio          • Evacuation Route Overlay          │
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
│  │ • Symmetric Alley-Cutter│           │ • Durable Investigation DB │  │
│  └─────────────────────────┘           └────────────────────────────┘  │
│  ┌─────────────────────────┐           ┌────────────────────────────┐  │
│  │ Physics Hazard Engines  │           │  Actuarial Insurance Engine│  │
│  │ • Joyner-Boore GMPE     │           │ • Parcel Risk (0-100)      │  │
│  │ • Topographic Wetness   │           │ • Replacement Cost Val.    │  │
│  │ • Slope FoS / A* Routes │           │ • Premium Surcharges       │  │
│  └─────────────────────────┘           └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Core Feature Modules

### 1. 2D-to-3D Photogrammetric Reconstruction & Alley-Cutter
* **ResNet50 U-Net Backbone**: Custom metric depth inference engine calibrated on LiDAR-optical pairs (`height_v2.pt`).
* **Symmetric Valley Alley-Cutter**: Solves the dense settlement problem. While baseline models merge adjacent buildings into single large shapes, our boundary valley detector separates structures across 1–3 pixel gaps (**benchmarked from 193 to 884 distinct houses, a +358% detection increase**).
* **Dual Solar Shadow Trigonometry**: Cross-verifies neural heights with solar azimuth and zenith geometry ($H = L \cdot \tan\theta_{\text{sun}}$).

### 2. Commercial Property Insurance Risk Engine
* **Multivariate Risk Scoring ($0-100$)**: Evaluates flood depth, seismic peak ground acceleration (PGA), and slope failure risk per parcel.
* **Financial Exposure Modeling**: Estimates structural replacement cost value based on footprint area, floor count, and regional construction rates.
* **Actuarial Pricing Assistance**: Generates baseline annual premiums, catastrophe risk surcharges, and recommended deductible tiering (Standard, Elevated, High Hazard).

### 3. Micro-Building Physics Hazard Simulation
* **Joyner-Boore Seismic Attenuation**: Models peak ground acceleration (PGA) and Modified Mercalli Intensity (MMI) across structural height fragility curves.
* **Topographic Wetness & Inundation (TWI)**: Models surface water pooling routes based on digital elevation gradients.
* **Slope Stability (FoS)**: Calculates infinite-slope factor of safety under saturated rain conditions.
* **A* Evacuation Pathing**: Dynamically plots safe evacuation corridors around flooded streets and debris zones.

### 4. Autonomous Worker (Agent37 Hermes) & Voice Intelligence (ElevenLabs)
* **Agent37 Cloud Harness**: Persistent background investigator capable of inspecting building density, querying seismic deltas, and drafting certified damage assessment dossiers.
* **ElevenLabs Multimodal Audio**: Two-way conversational interface allowing field personnel to verbally ask questions (*"What is the flood exposure on sector 4?"*) and hear natural, evidence-grounded audio readouts.

---

## 🚀 Quickstart Guide

### Prerequisites
* **Python**: 3.10+ (tested on Python 3.10 – 3.14)
* **Node.js**: 18+ (tested on Node.js 22 & 24)
* **Git**

### 1. Clone Repository
```bash
git clone https://github.com/Himarghya/Terrascope-AI.git
cd Terrascope-AI
```

### 2. Environment Configuration
Copy `.env.example` in both root and `backend/`:
```bash
cp .env.example backend/.env
```
Add your optional API keys to `backend/.env`:
```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
AGENT37_API_KEY=your_agent37_api_key_here
```
*(Core 2D-to-3D inference and physics hazard engines run locally without third-party API dependencies.)*

### 3. Backend Setup
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```
API documentation is immediately available at `http://127.0.0.1:8000/docs`.

### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 📡 REST API Reference

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/v1/2d-to-3d/predict` | `POST` | **Public Standard API**: Submit 2D satellite image for 3D reconstruction. |
| `/v1/2d-to-3d/jobs/{id}` | `GET` | Retrieve async reconstruction status, heights, and 3D meshes. |
| `/api/insurance/assess` | `POST` | Calculate parcel risk score ($0-100$), financial exposure & deductible tier. |
| `/api/process` | `POST` | Full pipeline execution (orthomosaic, DEM calibration, 3D scene creation). |
| `/api/infer` | `POST` | Fast neural depth & height estimation endpoint. |
| `/api/agent37/explain` | `POST` | Run autonomous Agent37 multi-step investigation on current scene. |
| `/api/voice/speak` | `POST` | Synthesize natural voice readout via ElevenLabs. |
| `/api/voice/transcribe` | `POST` | Voice-to-text transcription for hands-free queries. |

---

## 🧪 Automated Test Suite

The test suite validates end-to-end functionality across computer vision, insurance risk modeling, standard APIs, and agent workflows:

```bash
# Run all backend unit & integration tests
pytest backend/tests -v
```
*(All 71 tests passing).*

To verify the React Three Fiber production build:
```bash
cd frontend
npm run build
```

---

## 🛡️ Engineering Disclaimers & Integrity

* **Deterministic Grounding**: Structural dimensions, floor counts, and damage probabilities are calculated deterministically by trained neural models and empirical physics equations, completely eliminating LLM hallucinations.
* **Pre-Underwriting & Triage Scope**: Flood TWI and seismic calculations are engineered for situational awareness and pre-underwriting screening. They do not supersede municipal engineering stamp approvals or certified land surveys.

---

## 📄 License

Distributed under the Apache 2.0 License. See `LICENSE` for details.
