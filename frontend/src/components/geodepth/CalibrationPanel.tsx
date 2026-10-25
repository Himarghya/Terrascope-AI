import React, { useState } from 'react'
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Plus,
  Trash2,
  Activity,
  Layers,
  HelpCircle
} from 'lucide-react'
import { useStore } from '../../store/useStore'

export const CalibrationPanel: React.FC = () => {
  const isCalibrated = useStore((state) => state.isCalibrated)
  const calibrationData = useStore((state) => state.calibrationData)
  const sceneData = useStore((state) => state.sceneData)
  const calibrateKnownDistance = useStore((state) => state.calibrateKnownDistance)
  const calibrateElevationControlPoints = useStore((state) => state.calibrateElevationControlPoints)
  const calibrateCopernicusDEM = useStore((state) => state.calibrateCopernicusDEM)

  // Known distance local state
  const [pixelDist, setPixelDist] = useState<number>(100.0)
  const [knownDistanceM, setKnownDistanceM] = useState<number>(35.0)
  const [distLoading, setDistLoading] = useState<boolean>(false)

  // GCP local state
  const [gcps, setGcps] = useState<Array<{ px: number; py: number; z_ref_m: number; label: string }>>([
    { px: 50, py: 50, z_ref_m: 8.5, label: 'Road Intersection A' },
    { px: 200, py: 150, z_ref_m: 12.0, label: 'Courtyard Datum' },
    { px: 400, py: 350, z_ref_m: 15.2, label: 'Basin Edge C' },
    { px: 120, py: 400, z_ref_m: 9.8, label: 'Perimeter Wall Base' },
  ])
  const [gcpLoading, setGcpLoading] = useState<boolean>(false)

  // DEM alignment state
  const [demLoading, setDemLoading] = useState<boolean>(false)

  const handleApplyDistance = async () => {
    if (pixelDist <= 0 || knownDistanceM <= 0) return
    setDistLoading(true)
    await calibrateKnownDistance(pixelDist, knownDistanceM)
    setDistLoading(false)
  }

  const handleApplyGCPs = async () => {
    if (gcps.length < 3) {
      alert('At least 3 valid Ground Control Points (GCPs) are required for metric calibration.')
      return
    }
    setGcpLoading(true)
    await calibrateElevationControlPoints(gcps)
    setGcpLoading(false)
  }

  const handleAddGcpRow = () => {
    setGcps([
      ...gcps,
      { px: 250, py: 250, z_ref_m: 10.0, label: `GCP Point ${gcps.length + 1}` }
    ])
  }

  const handleRemoveGcpRow = (idx: number) => {
    setGcps(gcps.filter((_, i) => i !== idx))
  }

  const handleCopernicusAlign = async () => {
    setDemLoading(true)
    await calibrateCopernicusDEM()
    setDemLoading(false)
  }

  return (
    <div className="p-4 space-y-6 text-[#f8fafc] text-xs">
      {/* Header Banner */}
      <div className="border-b border-[#1e293b] pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#38bdf8]" />
            <h2 className="font-semibold text-sm text-white">Metric Calibration Engine</h2>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
            isCalibrated
              ? 'bg-[#064e3b] text-[#34d399] border-[#059669]'
              : 'bg-[#451a03] text-[#fbbf24] border-[#d97706]'
          }`}>
            {isCalibrated ? 'CALIBRATED METRIC' : 'UNCALIBRATED RELATIVE'}
          </span>
        </div>
        <p className="text-[11px] text-[#94a3b8] mt-1.5 leading-relaxed">
          Transforms AI-derived relative depth into defensible metric geometry (<code className="text-[#38bdf8]">z = a·f(depth) + b</code>).
          Single ordinary RGB images do not uniquely determine absolute elevations without external control.
        </p>
      </div>

      {/* Section 1: Known-Distance Scale Calibration */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-3">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
          <span>1. Horizontal Scale via Known Distance</span>
        </div>
        <p className="text-[11px] text-[#94a3b8]">
          Enter the measured length of a visible feature (e.g. building edge, road width, athletic court) to establish metric GSD.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[#94a3b8] block mb-1">Feature Pixel Span (px)</label>
            <input
              type="number"
              value={pixelDist}
              onChange={(e) => setPixelDist(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-[#38bdf8] outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#94a3b8] block mb-1">Known Real Distance (m)</label>
            <input
              type="number"
              value={knownDistanceM}
              onChange={(e) => setKnownDistanceM(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#1e293b] border border-[#334155] rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-[#38bdf8] outline-none"
            />
          </div>
        </div>
        <button
          onClick={handleApplyDistance}
          disabled={distLoading}
          className="w-full py-1.5 px-3 rounded bg-[#0284c7] hover:bg-[#0369a1] text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
        >
          {distLoading ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
          <span>Compute Calibrated GSD</span>
        </button>
      </div>

      {/* Section 2: Ground Control Points (GCPs) Regression */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-white">2. Elevation Control Points (GCPs)</span>
          <button
            onClick={handleAddGcpRow}
            className="flex items-center gap-1 text-[10px] text-[#38bdf8] hover:text-white"
          >
            <Plus className="w-3 h-3" />
            <span>Add GCP</span>
          </button>
        </div>
        <p className="text-[11px] text-[#94a3b8]">
          Fits robust Huber regression against known ground elevations, rejecting local outlier points.
        </p>

        {/* GCPs Table */}
        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
          {gcps.map((pt, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono bg-[#1e293b]/70 p-1.5 rounded">
              <input
                type="text"
                value={pt.label}
                onChange={(e) => {
                  const updated = [...gcps]
                  updated[i].label = e.target.value
                  setGcps(updated)
                }}
                className="w-24 bg-[#0f172a] border border-[#334155] px-1 py-0.5 rounded text-white truncate"
              />
              <span className="text-[#94a3b8]">X:</span>
              <input
                type="number"
                value={pt.px}
                onChange={(e) => {
                  const updated = [...gcps]
                  updated[i].px = parseInt(e.target.value) || 0
                  setGcps(updated)
                }}
                className="w-12 bg-[#0f172a] border border-[#334155] px-1 py-0.5 rounded text-white text-center"
              />
              <span className="text-[#94a3b8]">Y:</span>
              <input
                type="number"
                value={pt.py}
                onChange={(e) => {
                  const updated = [...gcps]
                  updated[i].py = parseInt(e.target.value) || 0
                  setGcps(updated)
                }}
                className="w-12 bg-[#0f172a] border border-[#334155] px-1 py-0.5 rounded text-white text-center"
              />
              <span className="text-[#94a3b8]">Z(m):</span>
              <input
                type="number"
                value={pt.z_ref_m}
                onChange={(e) => {
                  const updated = [...gcps]
                  updated[i].z_ref_m = parseFloat(e.target.value) || 0
                  setGcps(updated)
                }}
                className="w-14 bg-[#0f172a] border border-[#334155] px-1 py-0.5 rounded text-white text-center"
              />
              <button
                onClick={() => handleRemoveGcpRow(i)}
                className="text-[#94a3b8] hover:text-[#ef4444] p-0.5"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={handleApplyGCPs}
          disabled={gcpLoading}
          className="w-full py-1.5 px-3 rounded bg-[#0f172a] hover:bg-[#1e293b] border border-[#334155] text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
        >
          {gcpLoading ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-[#38bdf8]" />}
          <span>Fit Robust Huber Regression ({gcps.length} GCPs)</span>
        </button>
      </div>

      {/* Section 3: Copernicus DEM GLO-30 Alignment */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-white">3. Copernicus DEM GLO-30 Alignment</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e293b] text-[#38bdf8]">30m Grid</span>
        </div>
        <p className="text-[11px] text-[#94a3b8]">
          Cross-samples external Copernicus GLO-30 elevation raster across the scene bounds to fit scale and datum offset.
        </p>

        {/* Scientific Constraint Warning */}
        <div className="p-2.5 rounded bg-[#1e293b]/60 border border-[#334155] text-[10px] text-[#94a3b8] flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-[#fbbf24] shrink-0 mt-0.5" />
          <span>
            <strong>Scientific Note:</strong> Copernicus DEM GLO-30 is a 30m resolution regional macro-topography reference. It does not validate local building heights or fine architectural roof structures.
          </span>
        </div>

        <button
          onClick={handleCopernicusAlign}
          disabled={demLoading}
          className="w-full py-1.5 px-3 rounded bg-[#0f172a] hover:bg-[#1e293b] border border-[#334155] text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
        >
          {demLoading ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Compass className="w-3.5 h-3.5 text-[#22c55e]" />}
          <span>Align with Copernicus DEM (30m)</span>
        </button>
      </div>

      {/* Section 4: Live Calibration Statistics & Uncertainty Report */}
      {calibrationData && (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-2.5 font-mono text-[11px]">
          <div className="text-xs font-semibold text-white flex items-center justify-between">
            <span>Calibration Telemetry</span>
            <span className="text-[#34d399]">{calibrationData.reliability_category || 'Active'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[#94a3b8] pt-1">
            <div>
              <span>Scale (a):</span>{' '}
              <strong className="text-white">{calibrationData.scale_parameter_a ?? '1.0'}</strong>
            </div>
            <div>
              <span>Offset (b):</span>{' '}
              <strong className="text-white">{calibrationData.offset_parameter_b ?? '0.0'} m</strong>
            </div>
            <div>
              <span>RMSE:</span>{' '}
              <strong className="text-white">{calibrationData.rmse_m ? `±${calibrationData.rmse_m} m` : 'N/A'}</strong>
            </div>
            <div>
              <span>MAE:</span>{' '}
              <strong className="text-white">{calibrationData.mae_m ? `${calibrationData.mae_m} m` : 'N/A'}</strong>
            </div>
            <div className="col-span-2">
              <span>95% Confidence Interval:</span>{' '}
              <strong className="text-[#38bdf8]">
                {calibrationData.uncertainty_bound_95_pct_m ? `±${calibrationData.uncertainty_bound_95_pct_m} m` : 'Estimated'}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default CalibrationPanel
