import React, { useState } from 'react'
import {
  Settings2,
  Sliders,
  Sun,
  ShieldCheck,
  Cpu,
  Save,
  CheckCircle2,
  Compass
} from 'lucide-react'
import { useStore } from '../../store/useStore'

export const SettingsView: React.FC = () => {
  const sunAzimuth = useStore((state) => state.sunAzimuth)
  const sunElevation = useStore((state) => state.sunElevation)
  const setSunLighting = useStore((state) => state.setSunLighting)
  const verticalExaggeration = useStore((state) => state.verticalExaggeration)
  const setVerticalExaggeration = useStore((state) => state.setVerticalExaggeration)
  const layerVisibility = useStore((state) => state.layerVisibility)
  const toggleLayer = useStore((state) => state.toggleLayer)

  const [savedNotification, setSavedNotification] = useState(false)

  const handleSave = () => {
    setSavedNotification(true)
    setTimeout(() => setSavedNotification(false), 2000)
  }

  return (
    <div className="w-full h-full bg-[#F5F6F3] flex flex-col overflow-y-auto p-6 text-[#17231F] select-none">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DCE2DC] pb-4">
          <div>
            <h1 className="text-base font-semibold text-[#17231F] tracking-tight">
              Workstation Configuration
            </h1>
            <p className="text-xs text-[#68736D] mt-0.5">
              Tune physical solar triangulation geometry, 3D viewport rendering performance, and processing defaults.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded bg-[#286653] hover:bg-[#204F42] text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
          >
            {savedNotification ? <CheckCircle2 className="w-3.5 h-3.5 stroke-[2]" /> : <Save className="w-3.5 h-3.5 stroke-[2]" />}
            <span>{savedNotification ? 'Saved Preferences' : 'Save Configuration'}</span>
          </button>
        </div>

        {/* 1. Solar Physics & Shadow Geometry */}
        <div className="bg-[#FFFFFF] border border-[#DCE2DC] rounded p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#DCE2DC] pb-2 font-semibold text-xs text-[#17231F] uppercase tracking-wide">
            <Sun className="w-4 h-4 text-[#B7791F]" />
            <span>Solar Trigonometry & Shadow Calibration Parameters</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-[#17231F] mb-1 font-mono">
                <span>Solar Azimuth Angle (Clockwise from North)</span>
                <span className="font-bold text-[#286653]">{sunAzimuth}° N</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={sunAzimuth}
                onChange={(e) => setSunLighting(parseFloat(e.target.value), sunElevation)}
                className="w-full h-1.5 bg-[#DCE2DC] rounded appearance-none cursor-pointer accent-[#286653]"
              />
              <p className="text-[10px] text-[#68736D] mt-1">
                Used to cast physics rays along the anti-solar direction for building height triangulation (H = L · tan(α_sun)).
              </p>
            </div>

            <div>
              <div className="flex justify-between text-xs text-[#17231F] mb-1 font-mono">
                <span>Solar Elevation Angle (Above Horizon)</span>
                <span className="font-bold text-[#286653]">{sunElevation}°</span>
              </div>
              <input
                type="range"
                min="10"
                max="85"
                step="2"
                value={sunElevation}
                onChange={(e) => setSunLighting(sunAzimuth, parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#DCE2DC] rounded appearance-none cursor-pointer accent-[#286653]"
              />
              <p className="text-[10px] text-[#68736D] mt-1">
                Solar zenith angle complement (α_sun = 90° - θ_z) at satellite acquisition timestamp.
              </p>
            </div>
          </div>
        </div>

        {/* 2. 3D Viewport Performance */}
        <div className="bg-[#FFFFFF] border border-[#DCE2DC] rounded p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#DCE2DC] pb-2 font-semibold text-xs text-[#17231F] uppercase tracking-wide">
            <Sliders className="w-4 h-4 text-[#286653]" />
            <span>3D Viewport & Relief Exaggeration</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-xs text-[#17231F] mb-1 font-mono">
                <span>Vertical Relief Exaggeration</span>
                <span className="font-bold text-[#286653]">{verticalExaggeration.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={verticalExaggeration}
                onChange={(e) => setVerticalExaggeration(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#DCE2DC] rounded appearance-none cursor-pointer accent-[#286653]"
              />
              <p className="text-[10px] text-[#68736D] mt-1">
                Scales terrain elevation displacement in real-time to accentuate subtle topological relief.
              </p>
            </div>

            <div className="pt-2 border-t border-[#DCE2DC] space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-medium text-[#17231F] block text-xs">Directional Shadow Mapping</span>
                  <span className="text-[10px] text-[#68736D]">2048×2048 cascaded depth shadow pass</span>
                </div>
                <input
                  type="checkbox"
                  checked={layerVisibility.shadows}
                  onChange={() => toggleLayer('shadows')}
                  className="w-4 h-4 rounded accent-[#286653] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-medium text-[#17231F] block text-xs">Wireframe Geometry Mode</span>
                  <span className="text-[10px] text-[#68736D]">Show polygonal mesh tessellation</span>
                </div>
                <input
                  type="checkbox"
                  checked={layerVisibility.wireframe}
                  onChange={() => toggleLayer('wireframe')}
                  className="w-4 h-4 rounded accent-[#286653] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* 3. System Runtime & Model Diagnostics */}
        <div className="bg-[#FFFFFF] border border-[#DCE2DC] rounded p-4 space-y-3 shadow-sm font-mono text-xs">
          <div className="flex items-center gap-2 border-b border-[#DCE2DC] pb-2 font-semibold text-xs text-[#17231F] uppercase tracking-wide font-sans">
            <Cpu className="w-4 h-4 text-[#426B8A]" />
            <span>AI Inference Runtime Diagnostics</span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-[#68736D]">Model Architecture:</span>
              <span className="text-[#17231F] font-semibold">HeightFormer Multi-Scale ViT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#68736D]">Model Cache Status:</span>
              <span className="text-[#286653] font-semibold">Loaded in Memory (Singleton)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#68736D]">Execution Device:</span>
              <span className="text-[#17231F]">CUDA / PyTorch Optimized Engine</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#68736D]">Tiling Window:</span>
              <span className="text-[#17231F]">512×512 px (128px Hann overlap)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
