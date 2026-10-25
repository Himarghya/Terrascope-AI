import React from 'react'
import {
  Ruler,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  FileSpreadsheet,
  FileCode
} from 'lucide-react'
import { useStore } from '../../store/useStore'

export const MeasurementsPanel: React.FC = () => {
  const measurementMode = useStore((state) => state.measurementMode)
  const setMeasurementMode = useStore((state) => state.setMeasurementMode)
  const measurements = useStore((state) => state.measurements)
  const activeMeasurementPoints = useStore((state) => state.activeMeasurementPoints)
  const clearMeasurements = useStore((state) => state.clearMeasurements)
  const deleteMeasurement = useStore((state) => state.deleteMeasurement)
  const exportGISAsset = useStore((state) => state.exportGISAsset)
  const isCalibrated = useStore((state) => state.isCalibrated)

  const handleExportCSV = async () => {
    try {
      const res = await exportGISAsset('measurements_csv', measurements)
      if (res.download_url) window.open(res.download_url, '_blank')
    } catch (err: any) {
      alert(`Export failed: ${err.message}`)
    }
  }

  const handleExportGeoJSON = async () => {
    try {
      const res = await exportGISAsset('measurements_geojson', measurements)
      if (res.download_url) window.open(res.download_url, '_blank')
    } catch (err: any) {
      alert(`Export failed: ${err.message}`)
    }
  }

  return (
    <div className="p-4 space-y-6 text-[#f8fafc] text-xs">
      {/* Header */}
      <div className="border-b border-[#1e293b] pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-[#38bdf8]" />
            <h2 className="font-semibold text-sm text-white">Point-to-Point Measurement</h2>
          </div>
          <button
            onClick={() => setMeasurementMode(!measurementMode)}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium border transition-colors ${
              measurementMode
                ? 'bg-[#0284c7] text-white border-[#38bdf8]'
                : 'bg-[#1e293b] text-[#94a3b8] border-[#334155] hover:text-white'
            }`}
          >
            {measurementMode ? 'Measurement Mode ON' : 'Turn ON Tool'}
          </button>
        </div>
        <p className="text-[11px] text-[#94a3b8] mt-1.5 leading-relaxed">
          Click any two points on the 3D surface to obtain metric horizontal distance, 3D surface distance, and elevation delta.
        </p>
      </div>

      {/* Interactive Status Box */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-2">
        <span className="text-xs font-semibold text-white">Tool Status</span>
        <div className="text-[11px] text-[#94a3b8] flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            measurementMode ? 'bg-[#22c55e] animate-ping' : 'bg-[#64748b]'
          }`} />
          {measurementMode ? (
            activeMeasurementPoints.length === 0 ? (
              <span>Click on the 3D terrain to place <strong>Point A</strong>.</span>
            ) : (
              <span>Point A placed! Click on terrain to place <strong>Point B</strong>.</span>
            )
          ) : (
            <span>Tool inactive. Click "Turn ON Tool" above or in the top navigation bar.</span>
          )}
        </div>
        {activeMeasurementPoints.length === 1 && (
          <div className="p-2 rounded bg-[#1e293b]/60 font-mono text-[10px] text-[#38bdf8]">
            Point A: [{activeMeasurementPoints[0][0].toFixed(1)}, {activeMeasurementPoints[0][1].toFixed(1)}, {activeMeasurementPoints[0][2].toFixed(1)}]
          </div>
        )}
      </div>

      {/* Measurements Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-white">
            Recorded Measurements ({measurements.length})
          </span>
          {measurements.length > 0 && (
            <button
              onClick={clearMeasurements}
              className="text-[10px] text-[#94a3b8] hover:text-[#ef4444]"
            >
              Clear All
            </button>
          )}
        </div>

        {measurements.length === 0 ? (
          <div className="text-center py-6 text-[#64748b] bg-[#0f172a] border border-[#1e293b] rounded text-xs">
            No measurements recorded yet. Click two points in the 3D viewport.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {measurements.map((m) => (
              <div
                key={m.id}
                className="bg-[#0f172a] border border-[#1e293b] rounded p-3 space-y-2 relative"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono font-semibold text-xs text-white">
                    <MapPin className="w-3.5 h-3.5 text-[#38bdf8]" />
                    <span>{m.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                      isCalibrated
                        ? 'bg-[#064e3b] text-[#34d399] border-[#059669]'
                        : 'bg-[#451a03] text-[#fbbf24] border-[#d97706]'
                    }`}>
                      {m.reliability}
                    </span>
                    <button
                      onClick={() => deleteMeasurement(m.id)}
                      className="text-[#94a3b8] hover:text-[#ef4444]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-[#94a3b8]">
                  <div>
                    <span>Horizontal Dist:</span>{' '}
                    <strong className="text-white text-xs">{m.horizontal_dist_m} m</strong>
                  </div>
                  <div>
                    <span>3D Surface Dist:</span>{' '}
                    <strong className="text-white text-xs">{m.surface_dist_m} m</strong>
                  </div>
                  <div>
                    <span>Elevation Delta (ΔZ):</span>{' '}
                    <strong className="text-white text-xs">{m.delta_elev_m > 0 ? `+${m.delta_elev_m}` : m.delta_elev_m} m</strong>
                  </div>
                  <div>
                    <span>Slope Angle:</span>{' '}
                    <strong className="text-white text-xs">{m.slope_deg}°</strong>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-[#64748b] border-t border-[#1e293b] pt-1.5">
                  A: [{m.point_a.join(', ')}] → B: [{m.point_b.join(', ')}]
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Export Buttons */}
        {measurements.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={handleExportCSV}
              className="py-1.5 px-3 rounded bg-[#1e293b] hover:bg-[#334155] text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#22c55e]" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportGeoJSON}
              className="py-1.5 px-3 rounded bg-[#1e293b] hover:bg-[#334155] text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Export GeoJSON</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
export default MeasurementsPanel
