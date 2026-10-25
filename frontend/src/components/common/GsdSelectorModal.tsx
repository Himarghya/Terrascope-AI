import React, { useState, useEffect } from 'react'
import {
  X,
  Gauge,
  Zap,
  RefreshCw,
  Check,
  Info,
  Maximize2,
  Sliders
} from 'lucide-react'
import { useStore } from '../../store/useStore'

interface GsdPreset {
  gsd: number
  label: string
  sensor: string
}

const GSD_PRESETS: GsdPreset[] = [
  { gsd: 0.10, label: '0.10 m', sensor: 'Drone / UAV Ortho' },
  { gsd: 0.25, label: '0.25 m', sensor: 'High-Res Aerial / Sapporo' },
  { gsd: 0.35, label: '0.35 m', sensor: 'Model Native Datum (DFC19)' },
  { gsd: 0.50, label: '0.50 m', sensor: 'Pleiades Neo / High Sat' },
  { gsd: 1.00, label: '1.00 m', sensor: 'Standard Spaceborne' },
  { gsd: 1.50, label: '1.50 m', sensor: 'Regional Settlement' },
  { gsd: 2.00, label: '2.00 m', sensor: 'Map Overview / Villages' },
  { gsd: 2.50, label: '2.50 m', sensor: 'Wide Regional Overview' },
]

export const GsdSelectorModal: React.FC = () => {
  const isGsdModalOpen = useStore((state) => state.isGsdModalOpen)
  const setGsdModalOpen = useStore((state) => state.setGsdModalOpen)
  const sceneData = useStore((state) => state.sceneData)
  const changeGsd = useStore((state) => state.changeGsd)
  const isProcessing = useStore((state) => state.isProcessing)

  const currentGsd = sceneData?.gsd_m ?? 0.35
  const [targetGsd, setTargetGsd] = useState<number>(currentGsd)
  const [isApplying, setIsApplying] = useState<boolean>(false)

  useEffect(() => {
    if (sceneData?.gsd_m) {
      setTargetGsd(sceneData.gsd_m)
    }
  }, [sceneData?.gsd_m, isGsdModalOpen])

  if (!isGsdModalOpen) return null

  const widthPx = sceneData?.dimensions.width ?? 1000
  const heightPx = sceneData?.dimensions.height ?? 1000
  const widthM = Math.round(widthPx * targetGsd)
  const heightM = Math.round(heightPx * targetGsd)
  const areaHa = ((widthM * heightM) / 10000).toFixed(1)

  const handleApplyInstant = async () => {
    if (targetGsd <= 0) return
    setIsApplying(true)
    try {
      await changeGsd(targetGsd, 'scale')
      setGsdModalOpen(false)
    } finally {
      setIsApplying(false)
    }
  }

  const handleApplyRerun = async () => {
    if (targetGsd <= 0) return
    setIsApplying(true)
    try {
      setGsdModalOpen(false)
      await changeGsd(targetGsd, 'rerun')
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#FFFFFF] border border-[#DCE2DC] rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-[#17231F] flex flex-col font-sans">
        {/* Header */}
        <div className="h-12 border-b border-[#DCE2DC] px-4 flex items-center justify-between bg-[#F5F6F3]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#E8EFEA] border border-[#286653] flex items-center justify-center text-[#286653]">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-xs tracking-wide text-[#17231F]">
                Ground Sampling Distance (GSD)
              </h3>
              <p className="text-[10px] text-[#68736D]">
                Spatial resolution calibration in meters per pixel
              </p>
            </div>
          </div>
          <button
            onClick={() => setGsdModalOpen(false)}
            className="p-1 rounded text-[#68736D] hover:text-[#17231F] hover:bg-[#FFFFFF] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          {/* Quick Presets */}
          <div>
            <label className="text-[10px] font-semibold text-[#68736D] uppercase tracking-wider block mb-1.5">
              Standard Resolution Presets
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {GSD_PRESETS.map((p) => {
                const isSelected = Math.abs(targetGsd - p.gsd) < 0.005
                return (
                  <button
                    key={p.gsd}
                    type="button"
                    onClick={() => setTargetGsd(p.gsd)}
                    className={`p-2 rounded-lg border text-left flex flex-col transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#E8EFEA] border-[#286653] text-[#286653] ring-1 ring-[#286653]'
                        : 'bg-[#F5F6F3] border-[#DCE2DC] hover:bg-[#FFFFFF] text-[#17231F]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono font-bold text-xs">{p.label}/px</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#286653]" />}
                    </div>
                    <span className="text-[9px] text-[#68736D] truncate mt-0.5">
                      {p.sensor}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom GSD Input */}
          <div>
            <label className="text-[10px] font-semibold text-[#68736D] uppercase tracking-wider block mb-1.5">
              Custom Metric GSD (meters / pixel)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTargetGsd((v) => Math.max(0.05, Math.round((v - 0.05) * 100) / 100))}
                className="w-8 h-8 rounded border border-[#DCE2DC] bg-[#F5F6F3] hover:bg-white font-mono font-bold text-sm flex items-center justify-center cursor-pointer"
              >
                -
              </button>
              <div className="flex-1 relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="10.0"
                  value={targetGsd}
                  onChange={(e) => setTargetGsd(parseFloat(e.target.value) || 0.35)}
                  className="w-full h-8 px-3 rounded border border-[#DCE2DC] bg-white font-mono text-sm font-semibold text-[#17231F] focus:outline-hidden focus:border-[#286653] focus:ring-1 focus:ring-[#286653]"
                />
                <span className="absolute right-3 top-2 text-[10px] font-mono text-[#68736D] pointer-events-none">
                  m/px
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTargetGsd((v) => Math.round((v + 0.05) * 100) / 100)}
                className="w-8 h-8 rounded border border-[#DCE2DC] bg-[#F5F6F3] hover:bg-white font-mono font-bold text-sm flex items-center justify-center cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Projected Extents Telemetry */}
          <div className="p-2.5 rounded-lg bg-[#F5F6F3] border border-[#DCE2DC] space-y-1 font-mono text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-[#68736D]">Projected Extents:</span>
              <span className="font-semibold text-[#17231F]">{widthM}m × {heightM}m</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#68736D]">Ground Area:</span>
              <span className="text-[#286653] font-semibold">{areaHa} hectares</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#68736D]">Scale Difference:</span>
              <span className="text-[#17231F]">
                {((targetGsd / currentGsd) * 100).toFixed(0)}% of current ({currentGsd.toFixed(2)}m/px)
              </span>
            </div>
          </div>

          {/* Informational Guidance */}
          <div className="p-2.5 rounded bg-[#EDF1EC] border border-[#DCE2DC] text-[10px] text-[#68736D] flex items-start gap-2 leading-relaxed">
            <Info className="w-3.5 h-3.5 text-[#286653] shrink-0 mt-0.5" />
            <p>
              <strong>Instant Scale</strong> scales all 3D building vertices, footprint areas, and tree canopies dynamically in the viewport. <strong>Re-infer</strong> runs the trained neural model at the exact resolution to re-detect structural shapes.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-[#DCE2DC] bg-[#F5F6F3] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setGsdModalOpen(false)}
            className="px-3 py-1.5 rounded border border-[#DCE2DC] bg-white text-[#68736D] hover:text-[#17231F] text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isApplying || isProcessing}
              onClick={handleApplyInstant}
              className="px-3 py-1.5 rounded border border-[#286653] bg-white hover:bg-[#E8EFEA] text-[#286653] text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              title="Instantly scale the 3D scene in the browser"
            >
              <Zap className="w-3.5 h-3.5 text-[#286653]" />
              <span>Instant Scale (Fast)</span>
            </button>
            <button
              type="button"
              disabled={isApplying || isProcessing}
              onClick={handleApplyRerun}
              className="px-3 py-1.5 rounded bg-[#286653] hover:bg-[#1f5041] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              title="Re-run neural model inference at this exact resolution"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>Re-infer with Model</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
