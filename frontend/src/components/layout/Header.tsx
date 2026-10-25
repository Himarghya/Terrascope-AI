import React, { useState } from 'react'
import {
  Layers,
  Box,
  Eye,
  Download,
  RotateCcw,
  Compass,
  FileCode,
  MapPin,
  ChevronDown,
  Mountain
} from 'lucide-react'
import { useStore, ViewMode, CameraPreset } from '../../store/useStore'

export const Header: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const viewMode = useStore((state) => state.viewMode)
  const setViewMode = useStore((state) => state.setViewMode)
  const setCameraPreset = useStore((state) => state.setCameraPreset)
  const isProcessing = useStore((state) => state.isProcessing)

  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  const handleExport = (type: 'glb' | 'geojson' | 'json' | 'ndsm') => {
    if (!sceneData) return
    setExportMenuOpen(false)

    if (type === 'glb') {
      window.open(sceneData.glb_url, '_blank')
    } else if (type === 'geojson') {
      window.open(sceneData.geojson_url, '_blank')
    } else if (type === 'ndsm') {
      if (sceneData.sihe?.ndsm_raster_url) {
        window.open(sceneData.sihe.ndsm_raster_url, '_blank')
      }
    } else if (type === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sceneData, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', dataStr)
      downloadAnchor.setAttribute('download', `satellite_3d_analysis_${sceneData.job_id.slice(0, 8)}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
    }
  }

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20 shrink-0">
      {/* Brand & Project Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Box className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide text-white uppercase">
              SAT-3D STUDIO
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
              v1.0 GIS PRO
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Autonomous Satellite-to-3D Object Reconstruction Platform
          </p>
        </div>
      </div>

      {/* Center: Metadata Badges (GSD, CRS, Dimensions) */}
      {sceneData && (
        <div className="hidden lg:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/80 text-xs font-mono text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>GSD:</span>
            <strong className="text-white">{sceneData.gsd_m} m/px</strong>
          </div>
          <div className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/80 text-xs font-mono text-slate-300">
            <span>CRS:</span>{' '}
            <strong className="text-emerald-400">
              {sceneData.metadata.crs || 'Metric Local Frame'}
            </strong>
          </div>
          <div className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/80 text-xs font-mono text-slate-300">
            <span>EXTENT:</span>{' '}
            <strong className="text-white">
              {Math.round(sceneData.dimensions.width * sceneData.gsd_m)}m ×{' '}
              {Math.round(sceneData.dimensions.height * sceneData.gsd_m)}m
            </strong>
          </div>
        </div>
      )}

      {/* Right Controls: View Switcher, Camera Presets, Export */}
      <div className="flex items-center gap-2">
        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs font-medium">
          <button
            onClick={() => setViewMode('3d')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              viewMode === '3d'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D Scene</span>
          </button>
          <button
            onClick={() => setViewMode('satellite')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              viewMode === 'satellite'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>2D Imagery</span>
          </button>
          <button
            onClick={() => setViewMode('classification')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              viewMode === 'classification'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Land Cover</span>
          </button>
          <button
            onClick={() => setViewMode('sihe')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              viewMode === 'sihe'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mountain className="w-3.5 h-3.5 text-cyan-300" />
            <span>SIHE Heightmap</span>
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              viewMode === 'split'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Split 2D/3D</span>
          </button>
        </div>

        {/* Camera Presets (active in 3D & SIHE modes) */}
        {(viewMode === '3d' || viewMode === 'sihe') && (
          <div className="hidden sm:flex items-center gap-1 border-l border-slate-800 pl-2">
            <button
              onClick={() => setCameraPreset('perspective')}
              title="Oblique 3D Perspective (45°)"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>45°</span>
            </button>
            <button
              onClick={() => setCameraPreset('top')}
              title="Nadir Top-Down Ortho View"
              className="px-2 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-mono"
            >
              Nadir
            </button>
            <button
              onClick={() => setCameraPreset('side')}
              title="Horizon Side Elevation"
              className="px-2 py-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-mono"
            >
              Side
            </button>
            <button
              onClick={() => setCameraPreset('reset')}
              title="Reset Camera Orientation"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Export Button */}
        {sceneData && (
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50 text-xs">
                <button
                  onClick={() => handleExport('glb')}
                  className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-200"
                >
                  <Box className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="font-semibold">3D Scene (.GLB)</div>
                    <div className="text-[10px] text-slate-400">Binary glTF with 3D buildings</div>
                  </div>
                </button>
                <button
                  onClick={() => handleExport('geojson')}
                  className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-200"
                >
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-semibold">GIS Features (.GeoJSON)</div>
                    <div className="text-[10px] text-slate-400">Polygons & tree coordinates</div>
                  </div>
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-200"
                >
                  <FileCode className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="font-semibold">Analysis Report (.JSON)</div>
                    <div className="text-[10px] text-slate-400">Metrics, heights, and inventory</div>
                  </div>
                </button>
                {sceneData.sihe?.ndsm_raster_url && (
                  <button
                    onClick={() => handleExport('ndsm')}
                    className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-200 border-t border-slate-800"
                  >
                    <Mountain className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="font-semibold text-cyan-300">nDSM Raster (.GeoTIFF)</div>
                      <div className="text-[10px] text-slate-400">Calibrated heights above ground</div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
