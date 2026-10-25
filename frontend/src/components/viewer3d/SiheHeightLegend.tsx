import React, { useState } from 'react'
import { Mountain, AlertCircle, Download, ChevronUp, ChevronDown } from 'lucide-react'
import { useStore } from '../../store/useStore'

export const SiheHeightLegend: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const viewMode = useStore((state) => state.viewMode)
  const [collapsed, setCollapsed] = useState(false)

  if (!sceneData || !sceneData.sihe) return null

  // Only show floating legend in 3D or SIHE view modes
  if (viewMode !== 'sihe' && viewMode !== '3d') return null

  const { calibration, uncertainty_metrics, visualization_url, ndsm_raster_url } = sceneData.sihe
  const maxH = calibration.max_object_height_m || 30.0
  const isMetersAGL = calibration.height_unit === 'meters_agl'

  return (
    <div className="absolute bottom-4 right-4 z-10 max-w-sm w-76 bg-[#FFFFFF]/95 backdrop-blur-sm border border-[#DCE2DC] rounded shadow-lg overflow-hidden transition-all text-xs select-none text-[#17231F]">
      {/* Header bar */}
      <div
        className="px-3 py-2 bg-[#F5F6F3] border-b border-[#DCE2DC] flex items-center justify-between cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#E8EFEA] border border-[#286653] flex items-center justify-center text-[#286653]">
            <Mountain className="w-3.5 h-3.5 stroke-[1.75]" />
          </div>
          <div>
            <div className="font-semibold text-[#17231F] text-[11px] uppercase tracking-wide flex items-center gap-1.5">
              <span>SIHE Height Model</span>
              <span className="px-1.5 py-0.2 rounded bg-[#E8EFEA] text-[#286653] text-[9px] font-mono border border-[#DCE2DC] font-medium">
                {isMetersAGL ? 'm AGL' : 'Relative'}
              </span>
            </div>
            <div className="text-[10px] text-[#68736D]">
              {viewMode === 'sihe' ? 'Heightmap Overlay Active' : 'Neural Surface Model'}
            </div>
          </div>
        </div>

        <button className="text-[#68736D] hover:text-[#17231F] p-1">
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-2.5 text-xs">
          {/* Turbo Colormap Ramp */}
          <div>
            <div className="flex justify-between items-center text-[10px] font-mono text-[#17231F] mb-1">
              <span>0.0 m (Bare Ground)</span>
              <span className="text-[#286653] font-bold">{maxH.toFixed(1)} m</span>
            </div>
            <div
              className="h-3.5 w-full rounded-xs border border-[#DCE2DC] shadow-inner relative"
              style={{
                background:
                  'linear-gradient(to right, #30123b 0%, #4662d8 15%, #28bbec 35%, #35f599 55%, #a2fc3c 70%, #fbbe23 85%, #eb4a00 95%, #7a0403 100%)',
              }}
            />
            <div className="flex justify-between text-[9px] text-[#68736D] font-mono mt-0.5">
              <span>0m</span>
              <span>{(maxH * 0.25).toFixed(0)}m</span>
              <span>{(maxH * 0.5).toFixed(0)}m</span>
              <span>{(maxH * 0.75).toFixed(0)}m</span>
              <span>{maxH.toFixed(0)}m</span>
            </div>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
            <div className="bg-[#F5F6F3] p-1.5 rounded border border-[#DCE2DC]">
              <span className="text-[#68736D] block text-[9px]">CALIBRATION</span>
              <span className="text-[#286653] font-semibold truncate block" title={calibration.calibration_method}>
                {calibration.is_calibrated ? 'Shadow Anchored' : 'Normalized'}
              </span>
            </div>
            <div className="bg-[#F5F6F3] p-1.5 rounded border border-[#DCE2DC]">
              <span className="text-[#68736D] block text-[9px]">UNCERTAINTY (95%)</span>
              <span className="text-[#426B8A] font-semibold">
                ± {(uncertainty_metrics?.mean_uncertainty_m ?? 1.8).toFixed(1)} m
              </span>
            </div>
          </div>

          {/* Scientific Disclaimer Note */}
          <div className="p-1.5 rounded bg-[#EDF1EC] border border-[#DCE2DC] text-[10px] text-[#68736D] flex items-start gap-1 leading-relaxed">
            <AlertCircle className="w-3.5 h-3.5 text-[#286653] shrink-0 mt-0.5" />
            <div>
              Heights represent <strong className="text-[#17231F]">nDSM = DSM - DEM</strong> above ground, not absolute AMSL datum.
            </div>
          </div>

          {/* Action Links */}
          <div className="flex gap-2 pt-1 border-t border-[#DCE2DC]">
            {ndsm_raster_url && (
              <a
                href={ndsm_raster_url}
                download
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-1 px-2 rounded bg-[#286653] hover:bg-[#204F42] text-white font-medium flex items-center justify-center gap-1.5 transition-colors text-[10px] shadow-sm"
              >
                <Download className="w-3 h-3 stroke-[2]" />
                <span>Download nDSM</span>
              </a>
            )}
            {visualization_url && (
              <a
                href={visualization_url}
                target="_blank"
                rel="noreferrer"
                className="py-1 px-2.5 rounded bg-[#F5F6F3] hover:bg-[#EDF1EC] border border-[#DCE2DC] text-[#17231F] flex items-center justify-center gap-1 transition-colors text-[10px]"
                title="Open high-resolution Turbo heightmap"
              >
                <span>Full Map</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
