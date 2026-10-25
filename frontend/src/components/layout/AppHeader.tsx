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
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Gauge,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
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
    <header className="h-14 bg-[#090d16] border-b border-[#1e293b] px-3.5 flex items-center justify-between z-20 shrink-0 select-none text-[#f8fafc] gap-3">
      {/* Left: Brand Identity & Active Dataset */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0284c7] to-[#0369a1] flex items-center justify-center font-mono font-bold text-xs text-white shadow-sm ring-1 ring-white/10 shrink-0">
          TS
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-extrabold tracking-wide text-xs text-white uppercase font-sans">
              TerraScope <span className="text-[#38bdf8] font-normal">3D</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1e293b] text-[#38bdf8] border border-[#334155] whitespace-nowrap">
              v2.0
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border whitespace-nowrap hidden sm:inline-block ${
                inputMode === 'mode_b'
                  ? 'bg-[#064e3b] text-[#34d399] border-[#059669]'
                  : 'bg-[#1e293b] text-[#94a3b8] border-[#334155]'
              }`}
            >
              {inputMode === 'mode_b' ? 'Georeferenced DEM' : 'Relative Depth'}
            </span>
          </div>
          <div className="text-[10px] text-[#94a3b8] font-mono truncate max-w-[190px] leading-tight">
            {sceneData?.metadata?.filename || 'Single-Image Reconstruction'}
          </div>
        </div>
      </div>

      {/* Center: Technical Telemetry Strip */}
      {sceneData && (
        <div className="hidden lg:flex items-center gap-1.5 font-mono text-[11px] whitespace-nowrap shrink-0">
          <button
            type="button"
            onClick={() => setGsdModalOpen(true)}
            title="Click to adjust Ground Sampling Distance (GSD) & metric scale"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] hover:border-[#38bdf8] text-[#94a3b8] hover:text-white transition-all cursor-pointer group shadow-2xs whitespace-nowrap shrink-0"
          >
            <Gauge className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
            <span>GSD:</span>
            <strong className="text-white group-hover:text-[#38bdf8] whitespace-nowrap">{sceneData.gsd_m} m/px</strong>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#1e293b] group-hover:bg-[#0284c7] text-[#38bdf8] group-hover:text-white font-sans font-semibold transition-colors ml-0.5 whitespace-nowrap">
              Edit
            </span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0f172a] border border-[#1e293b] text-[#94a3b8] whitespace-nowrap shrink-0">
            <span>Dim:</span>
            <strong className="text-white whitespace-nowrap">
              {sceneData.dimensions.width}×{sceneData.dimensions.height}
            </strong>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0f172a] border border-[#1e293b] text-[#94a3b8] whitespace-nowrap shrink-0">
            <span>CRS:</span>
            <strong className="text-white whitespace-nowrap truncate max-w-[110px]" title={sceneData.metadata.crs || 'Local Cartesian'}>
              {sceneData.metadata.crs ? sceneData.metadata.crs.split(' ')[0] : 'Local Frame'}
            </strong>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border whitespace-nowrap shrink-0 font-medium ${
              isCalibrated
                ? 'bg-[#064e3b]/80 border-[#059669] text-[#34d399]'
                : 'bg-[#451a03]/80 border-[#d97706] text-[#fbbf24]'
            }`}
          >
            {isCalibrated ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Calibrated Metric</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Uncalibrated Relative</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Right: Viewport Controls, Tools, AI Voice & Exports */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Interactive Point-to-Point Measurement Toggle */}
        <button
          onClick={() => setMeasurementMode(!measurementMode)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            measurementMode
              ? 'bg-[#0284c7] text-white border-[#38bdf8] shadow-sm'
              : 'bg-[#0f172a] text-[#94a3b8] border-[#1e293b] hover:text-white hover:border-[#334155]'
          }`}
          title="Toggle interactive 3D distance and elevation measurement tool"
        >
          <Ruler className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden xl:inline">Measure 3D</span>
          {measurementMode && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
        </button>

        {/* View Mode Segmented Switcher */}
        <div className="flex items-center p-0.5 rounded-md bg-[#0f172a] border border-[#1e293b] text-xs whitespace-nowrap shrink-0">
          <button
            onClick={() => setViewMode('3d')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === '3d'
                ? 'bg-[#1e293b] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5 shrink-0" />
            <span>3D</span>
          </button>
          <button
            onClick={() => setViewMode('satellite')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'satellite'
                ? 'bg-[#1e293b] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">2D</span>
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'split'
                ? 'bg-[#1e293b] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Split</span>
          </button>
        </div>

        {/* Colormap Selector Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setColormapMenuOpen(!colormapMenuOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#0f172a] border border-[#1e293b] text-xs text-[#94a3b8] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            title="Surface Colormap Shader"
          >
            <Layers className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
            <span className="capitalize">{activeColormap}</span>
            <ChevronDown className="w-3 h-3 text-[#64748b]" />
          </button>
          {colormapMenuOpen && (
            <div className="absolute right-0 mt-1 w-36 bg-[#0f172a] border border-[#1e293b] rounded-lg shadow-xl py-1 z-50 text-xs">
              {(['rgb', 'hypsometric', 'viridis', 'magma', 'slope', 'aspect'] as const).map((cm) => (
                <button
                  key={cm}
                  onClick={() => {
                    setActiveColormap(cm)
                    setColormapMenuOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 capitalize hover:bg-[#1e293b] cursor-pointer ${
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

        {/* Building Voice Inspector Toggle Button (Compact & Clean) */}
        <button
          onClick={toggleVoiceNarrationOnClick}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            voiceNarrationOnClick
              ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 shadow-2xs'
              : 'bg-[#0f172a] border-[#1e293b] text-[#94a3b8] hover:text-white'
          }`}
          title="Toggle ElevenLabs Voice Agent to speak building metrics on click"
        >
          {isSpeaking ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-bounce shrink-0" />
          ) : voiceNarrationOnClick ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
          <span className="hidden 2xl:inline">Voice Narration</span>
          <span
            className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
              voiceNarrationOnClick
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {voiceNarrationOnClick ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Export Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0f172a] border border-[#1e293b] text-xs text-[#94a3b8] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="w-3 h-3 text-[#64748b]" />
          </button>
          {exportMenuOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-[#0f172a] border border-[#1e293b] rounded-lg shadow-xl py-1 z-50 text-xs">
              <button
                onClick={() => handleExport('glb')}
                className="w-full text-left px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e293b] cursor-pointer"
              >
                3D Scene (.glb)
              </button>
              <button
                onClick={() => handleExport('geotiff')}
                className="w-full text-left px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e293b] cursor-pointer"
              >
                Elevation GeoTIFF (.tif)
              </button>
              <button
                onClick={() => handleExport('depth_png')}
                className="w-full text-left px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e293b] cursor-pointer"
              >
                16-Bit Depth Map (.png)
              </button>
              <button
                onClick={() => handleExport('measurements_csv')}
                className="w-full text-left px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e293b] cursor-pointer"
              >
                Measurements (.csv)
              </button>
              <button
                onClick={() => handleExport('report_json')}
                className="w-full text-left px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e293b] cursor-pointer"
              >
                Analysis Report (.json)
              </button>
            </div>
          )}
        </div>

        {/* Inspector Panel Toggle */}
        <button
          onClick={toggleInspector}
          className={`p-1.5 rounded-md border transition-colors cursor-pointer shrink-0 ${
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
