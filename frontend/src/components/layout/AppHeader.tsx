import React, { useState } from 'react'
import {
  Box,
  Eye,
  Layers,
  Columns2,
  Download,
  PanelRightClose,
  PanelRightOpen,
  Ruler,
  Compass,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Gauge,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useStore, ViewMode } from '../../store/useStore'
import { VoiceAssistantWidget } from '../voice/VoiceAssistantWidget'

export const AppHeader: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const setGsdModalOpen = useStore((state) => state.setGsdModalOpen)
  const viewMode = useStore((state) => state.viewMode)
  const setViewMode = useStore((state) => state.setViewMode)
  const inspectorOpen = useStore((state) => state.inspectorOpen)
  const toggleInspector = useStore((state) => state.toggleInspector)
  const isCalibrated = useStore((state) => state.isCalibrated)
  const measurementMode = useStore((state) => state.measurementMode)
  const setMeasurementMode = useStore((state) => state.setMeasurementMode)
  const activeColormap = useStore((state) => state.activeColormap)
  const setActiveColormap = useStore((state) => state.setActiveColormap)
  const exportGISAsset = useStore((state) => state.exportGISAsset)
  const inputMode = useStore((state) => state.inputMode)
  const voiceNarrationOnClick = useStore((state) => state.voiceNarrationOnClick)
  const toggleVoiceNarrationOnClick = useStore((state) => state.toggleVoiceNarrationOnClick)
  const isSpeaking = useStore((state) => state.voiceState.isSpeaking)

  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [colormapMenuOpen, setColormapMenuOpen] = useState(false)

  const handleExport = async (type: string) => {
    setExportMenuOpen(false)
    try {
      const res = await exportGISAsset(type)
      if (res.download_url) {
        window.open(res.download_url, '_blank')
      } else if (res.depth_png_url) {
        window.open(res.depth_png_url, '_blank')
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`)
    }
  }

  return (
    <header className="h-14 bg-[#090d16] border-b border-[#1e293b] px-4 flex items-center justify-between z-20 shrink-0 select-none text-[#f8fafc]">
      {/* Left: Platform Title and Dataset Context */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#0284c7] flex items-center justify-center font-mono font-bold text-sm text-white shadow-sm">
            GD
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-xs text-white uppercase">GeoDepth 3D</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e293b] text-[#38bdf8] border border-[#334155]">
                v2.0
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                inputMode === 'mode_b'
                  ? 'bg-[#064e3b] text-[#34d399] border-[#059669]'
                  : 'bg-[#1e293b] text-[#94a3b8] border-[#334155]'
              }`}>
                {inputMode === 'mode_b' ? 'Mode B: Georeferenced DEM' : 'Mode A: Relative Monocular'}
              </span>
            </div>
            <div className="text-[10px] text-[#94a3b8] font-mono truncate max-w-xs">
              {sceneData?.metadata?.filename || 'Single-Image Metric Reconstruction'}
            </div>
          </div>
        </div>
      </div>

      {/* Center: Technical Telemetry Strip */}
      {sceneData && (
        <div className="hidden lg:flex items-center gap-2 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => setGsdModalOpen(true)}
            title="Click to adjust Ground Sampling Distance (GSD) & metric scale"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] hover:border-[#38bdf8] text-[#94a3b8] hover:text-white transition-all cursor-pointer group shadow-2xs"
          >
            <Gauge className="w-3.5 h-3.5 text-[#38bdf8] group-hover:scale-110 transition-transform" />
            <span>GSD:</span>
            <strong className="text-white group-hover:text-[#38bdf8]">{sceneData.gsd_m} m/px</strong>
            <span className="text-[9px] px-1 py-0.2 rounded bg-[#1e293b] group-hover:bg-[#0284c7] text-[#38bdf8] group-hover:text-white font-sans font-medium transition-colors ml-0.5">
              Edit
            </span>
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0f172a] border border-[#1e293b] text-[#94a3b8]">
            <span>Dim:</span>
            <strong className="text-white">
              {sceneData.dimensions.width}×{sceneData.dimensions.height}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0f172a] border border-[#1e293b] text-[#94a3b8]">
            <span>CRS:</span>
            <strong className="text-white truncate max-w-[120px]">
              {sceneData.metadata.crs ? sceneData.metadata.crs.split(' ')[0] : 'Local Cartesian'}
            </strong>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border ${
            isCalibrated
              ? 'bg-[#064e3b]/80 border-[#059669] text-[#34d399]'
              : 'bg-[#451a03]/80 border-[#d97706] text-[#fbbf24]'
          }`}>
            {isCalibrated ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Calibrated Metric</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Uncalibrated Relative</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Right: View Switchers, Measurement Toggle, Exports */}
      <div className="flex items-center gap-2">
        {/* Interactive Point-to-Point Measurement Toggle */}
        <button
          onClick={() => setMeasurementMode(!measurementMode)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium border transition-colors ${
            measurementMode
              ? 'bg-[#0284c7] text-white border-[#38bdf8] shadow-sm'
              : 'bg-[#0f172a] text-[#94a3b8] border-[#1e293b] hover:text-white hover:border-[#334155]'
          }`}
          title="Toggle interactive 3D distance and elevation measurement tool"
        >
          <Ruler className="w-3.5 h-3.5" />
          <span>Measure 3D</span>
          {measurementMode && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
        </button>

        {/* View Mode Segmented Switcher */}
        <div className="flex items-center p-0.5 rounded bg-[#0f172a] border border-[#1e293b] text-xs">
          <button
            onClick={() => setViewMode('3d')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === '3d'
                ? 'bg-[#1e293b] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D</span>
          </button>
          <button
            onClick={() => setViewMode('satellite')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'satellite'
                ? 'bg-[#1e293b] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>2D Ortho</span>
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'split'
                ? 'bg-[#1e293b] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>Split</span>
          </button>
        </div>

        {/* Colormap Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setColormapMenuOpen(!colormapMenuOpen)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0f172a] border border-[#1e293b] text-xs text-[#94a3b8] hover:text-white transition-colors"
          >
            <span className="capitalize">{activeColormap}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {colormapMenuOpen && (
            <div className="absolute right-0 mt-1 w-36 bg-[#0f172a] border border-[#1e293b] rounded shadow-lg py-1 z-50 text-xs">
              {(['rgb', 'hypsometric', 'viridis', 'magma', 'slope', 'aspect'] as const).map((cm) => (
                <button
                  key={cm}
                  onClick={() => {
                    setActiveColormap(cm)
                    setColormapMenuOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 capitalize hover:bg-[#1e293b] ${
                    activeColormap === cm ? 'text-[#38bdf8] font-semibold' : 'text-[#cbd5e1]'
                  }`}
                >
                  {cm === 'rgb' ? 'Satellite RGB' : cm}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Voice Assistant & Agent37 Widget */}
        <VoiceAssistantWidget />

        {/* Building Voice Inspector Toggle Button */}
        <button
          onClick={toggleVoiceNarrationOnClick}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
            voiceNarrationOnClick
              ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 shadow-sm ring-1 ring-emerald-500/30'
              : 'bg-[#0f172a] border-[#1e293b] text-[#94a3b8] hover:text-white'
          }`}
          title="Toggle ElevenLabs Voice Agent to speak building height, dimensions, and features on click"
        >
          {isSpeaking ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
          ) : voiceNarrationOnClick ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span className="hidden xl:inline">Voice Inspector:</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
              voiceNarrationOnClick
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {voiceNarrationOnClick ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0f172a] border border-[#1e293b] text-xs text-[#94a3b8] hover:text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {exportMenuOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-[#0f172a] border border-[#1e293b] rounded shadow-lg py-1 z-50 text-xs">
              <button
                onClick={() => handleExport('glb')}
                className="w-full text-left px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e293b]"
              >
                3D Scene (.glb)
              </button>
              <button
                onClick={() => handleExport('geotiff')}
                className="w-full text-left px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e293b]"
              >
                Elevation GeoTIFF (.tif)
              </button>
              <button
                onClick={() => handleExport('depth_png')}
                className="w-full text-left px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e293b]"
              >
                16-Bit Depth Map (.png)
              </button>
              <button
                onClick={() => handleExport('measurements_csv')}
                className="w-full text-left px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e293b]"
              >
                Measurements (.csv)
              </button>
              <button
                onClick={() => handleExport('report_json')}
                className="w-full text-left px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e293b]"
              >
                Analysis Report (.json)
              </button>
            </div>
          )}
        </div>

        {/* Inspector Panel Toggle */}
        <button
          onClick={toggleInspector}
          className={`p-1.5 rounded border transition-colors ${
            inspectorOpen
              ? 'bg-[#1e293b] text-white border-[#334155]'
              : 'bg-[#0f172a] text-[#94a3b8] border-[#1e293b] hover:text-white'
          }`}
          title={inspectorOpen ? 'Collapse Inspector Panel' : 'Expand Inspector Panel'}
        >
          {inspectorOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>
      </div>
    </header>
  )
}
export default AppHeader
