import React from 'react'
import {
  Download,
  Box,
  FileCode,
  FileSpreadsheet,
  Image as ImageIcon,
  FileText,
  ShieldCheck
} from 'lucide-react'
import { useStore } from '../../store/useStore'

export const ExportsPanel: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const measurements = useStore((state) => state.measurements)
  const exportGISAsset = useStore((state) => state.exportGISAsset)
  const isCalibrated = useStore((state) => state.isCalibrated)

  const handleExport = async (type: string) => {
    try {
      const res = await exportGISAsset(type, measurements)
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
    <div className="p-4 space-y-6 text-[#f8fafc] text-xs">
      {/* Header */}
      <div className="border-b border-[#1e293b] pb-3">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-[#38bdf8]" />
          <h2 className="font-semibold text-sm text-white">GIS & 3D Model Exports</h2>
        </div>
        <p className="text-[11px] text-[#94a3b8] mt-1.5 leading-relaxed">
          Export reconstructed 3D meshes, georeferenced rasters, depth maps, and vector GIS layers with preserved geospatial coordinates.
        </p>
      </div>

      <div className="space-y-3">
        {/* Export 1: GLB 3D Scene */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-[#38bdf8]" />
              <strong className="text-white text-xs">Complete 3D Scene (.glb)</strong>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#1e293b] text-[#94a3b8]">Binary glTF</span>
          </div>
          <p className="text-[11px] text-[#94a3b8]">
            Full 3D model containing displaced terrain heightfield, 3D extruded buildings with realistic roofs, and procedural trees. Ready for Blender, Unreal Engine, Cesium, and Three.js.
          </p>
          <button
            onClick={() => handleExport('glb')}
            className="w-full py-1.5 px-3 rounded bg-[#0284c7] hover:bg-[#0369a1] text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .GLB Scene</span>
          </button>
        </div>

        {/* Export 2: Georeferenced GeoTIFF */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#22c55e]" />
              <strong className="text-white text-xs">Elevation GeoTIFF (.tif)</strong>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#1e293b] text-[#34d399]">32-Bit Float</span>
          </div>
          <p className="text-[11px] text-[#94a3b8]">
            Standard GIS raster maintaining projected coordinate reference system (CRS), affine transformation matrix, and metric elevation values.
          </p>
          <button
            onClick={() => handleExport('geotiff')}
            className="w-full py-1.5 px-3 rounded bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download GeoTIFF (.tif)</span>
          </button>
        </div>

        {/* Export 3: 16-Bit Depth Map with Metadata */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#f59e0b]" />
              <strong className="text-white text-xs">16-Bit Depth Map (.png + .json)</strong>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#1e293b] text-[#fbbf24]">High Dynamic Range</span>
          </div>
          <p className="text-[11px] text-[#94a3b8]">
            Normalized 16-bit single-channel depth raster paired with companion metadata JSON defining value interpretations and calibration constraints.
          </p>
          <button
            onClick={() => handleExport('depth_png')}
            className="w-full py-1.5 px-3 rounded bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Depth PNG & Metadata</span>
          </button>
        </div>

        {/* Export 4: Point Measurements CSV & GeoJSON */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#38bdf8]" />
              <strong className="text-white text-xs">Point Measurements ({measurements.length})</strong>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#1e293b] text-[#94a3b8]">CSV / GeoJSON</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handleExport('measurements_csv')}
              className="py-1.5 px-3 rounded bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Download CSV</span>
            </button>
            <button
              onClick={() => handleExport('measurements_geojson')}
              className="py-1.5 px-3 rounded bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Download GeoJSON</span>
            </button>
          </div>
        </div>

        {/* Export 5: Full Comprehensive Analysis Report */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#cbd5e1]" />
              <strong className="text-white text-xs">Full Scientific Report (.json)</strong>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#1e293b] text-[#94a3b8]">JSON Schema</span>
          </div>
          <p className="text-[11px] text-[#94a3b8]">
            Export complete telemetry: terrain slope, aspect, elevation histogram, drainage pooling index, landslide screening, building inventory, and calibration residuals.
          </p>
          <button
            onClick={() => handleExport('report_json')}
            className="w-full py-1.5 px-3 rounded bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Analysis Report (.json)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
export default ExportsPanel
