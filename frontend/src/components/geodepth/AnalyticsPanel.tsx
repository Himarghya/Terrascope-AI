import React from 'react'
import {
  Compass,
  TrendingUp,
  BarChart2,
  Droplets,
  AlertTriangle,
  Layers,
  HelpCircle
} from 'lucide-react'
import { useStore } from '../../store/useStore'

export const AnalyticsPanel: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const terrainAnalytics = useStore((state) => state.terrainAnalytics) || sceneData?.analytics
  const activeColormap = useStore((state) => state.activeColormap)
  const setActiveColormap = useStore((state) => state.setActiveColormap)

  if (!terrainAnalytics) {
    return (
      <div className="p-4 text-xs text-[#94a3b8] space-y-2">
        <p>No terrain analysis data available for current scene.</p>
        <p>Run 3D reconstruction on an image or DEM to generate slope, aspect, and drainage analytics.</p>
      </div>
    )
  }

  const { slope, aspect, elevation, drainage, landslide_screening } = terrainAnalytics

  return (
    <div className="p-4 space-y-6 text-[#f8fafc] text-xs">
      {/* Header */}
      <div className="border-b border-[#1e293b] pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#38bdf8]" />
            <h2 className="font-semibold text-sm text-white">Terrain Analysis Toolkit</h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1e293b] text-[#38bdf8] border border-[#334155]">
            Horn's Method
          </span>
        </div>
        <p className="text-[11px] text-[#94a3b8] mt-1.5 leading-relaxed">
          Spatial derivative analysis accounting for horizontal cell dimensions and vertical metric units.
        </p>
      </div>

      {/* Section 1: Slope Analysis */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-white">Slope Analysis</span>
          <button
            onClick={() => setActiveColormap('slope')}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
              activeColormap === 'slope'
                ? 'bg-[#0284c7] text-white border-[#38bdf8]'
                : 'bg-[#1e293b] text-[#94a3b8] border-[#334155] hover:text-white'
            }`}
          >
            {activeColormap === 'slope' ? 'Active 3D Shader' : 'Visualize on 3D'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div className="bg-[#1e293b]/70 p-2 rounded">
            <span className="text-[#94a3b8] text-[10px] block">Mean Slope</span>
            <strong className="text-white text-sm">{slope.mean_slope_deg}°</strong>
          </div>
          <div className="bg-[#1e293b]/70 p-2 rounded">
            <span className="text-[#94a3b8] text-[10px] block">Max Slope</span>
            <strong className="text-white text-sm">{slope.max_slope_deg}°</strong>
          </div>
          <div className="bg-[#1e293b]/70 p-2 rounded">
            <span className="text-[#94a3b8] text-[10px] block">Percent Rise</span>
            <strong className="text-white text-sm">{slope.mean_slope_pct}%</strong>
          </div>
        </div>

        {/* Slope Classification Bars */}
        <div className="space-y-1.5 pt-1 text-[11px]">
          <div className="flex justify-between text-[#94a3b8]">
            <span>Flat (&lt;5°)</span>
            <span className="font-mono text-white">{slope.categories.flat_lt_5deg}%</span>
          </div>
          <div className="w-full bg-[#1e293b] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#22c55e] h-full" style={{ width: `${slope.categories.flat_lt_5deg}%` }} />
          </div>

          <div className="flex justify-between text-[#94a3b8]">
            <span>Gentle (5°–15°)</span>
            <span className="font-mono text-white">{slope.categories.gentle_5_to_15deg}%</span>
          </div>
          <div className="w-full bg-[#1e293b] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#38bdf8] h-full" style={{ width: `${slope.categories.gentle_5_to_15deg}%` }} />
          </div>

          <div className="flex justify-between text-[#94a3b8]">
            <span>Moderate (15°–30°)</span>
            <span className="font-mono text-white">{slope.categories.moderate_15_to_30deg}%</span>
          </div>
          <div className="w-full bg-[#1e293b] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#f59e0b] h-full" style={{ width: `${slope.categories.moderate_15_to_30deg}%` }} />
          </div>

          <div className="flex justify-between text-[#94a3b8]">
            <span>Steep (&gt;30°)</span>
            <span className="font-mono text-white">{slope.categories.steep_gt_30deg}%</span>
          </div>
          <div className="w-full bg-[#1e293b] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#ef4444] h-full" style={{ width: `${slope.categories.steep_gt_30deg}%` }} />
          </div>
        </div>
      </div>

      {/* Section 2: Aspect Analysis (Compass Orientation) */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-white">Aspect (Terrain Facing Direction)</span>
          <button
            onClick={() => setActiveColormap('aspect')}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
              activeColormap === 'aspect'
                ? 'bg-[#0284c7] text-white border-[#38bdf8]'
                : 'bg-[#1e293b] text-[#94a3b8] border-[#334155] hover:text-white'
            }`}
          >
            {activeColormap === 'aspect' ? 'Active 3D Shader' : 'Visualize Compass'}
          </button>
        </div>
        <div className="text-[11px] text-[#94a3b8]">
          Dominant Orientation: <strong className="text-[#38bdf8] font-mono">{aspect.dominant_direction}</strong>
        </div>

        {/* 8-Direction Compass Grid */}
        <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px]">
          {Object.entries(aspect.distribution).map(([dir, pct]) => (
            <div key={dir} className="bg-[#1e293b]/70 p-1.5 rounded text-center">
              <span className="text-[#94a3b8] block truncate">{dir}</span>
              <strong className="text-white">{String(pct)}%</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Elevation Statistics & Histogram */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-white">Elevation Distribution</span>
          <span className="text-[10px] font-mono text-[#94a3b8]">
            Range: {elevation.elevation_range_m}m
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px]">
          <div className="bg-[#1e293b]/70 p-1.5 rounded text-center">
            <span className="text-[#94a3b8] text-[9px] block">Min</span>
            <strong className="text-white">{elevation.elevation_min_m}m</strong>
          </div>
          <div className="bg-[#1e293b]/70 p-1.5 rounded text-center">
            <span className="text-[#94a3b8] text-[9px] block">Mean</span>
            <strong className="text-white">{elevation.elevation_mean_m}m</strong>
          </div>
          <div className="bg-[#1e293b]/70 p-1.5 rounded text-center">
            <span className="text-[#94a3b8] text-[9px] block">Max</span>
            <strong className="text-white">{elevation.elevation_max_m}m</strong>
          </div>
          <div className="bg-[#1e293b]/70 p-1.5 rounded text-center">
            <span className="text-[#94a3b8] text-[9px] block">Peaks</span>
            <strong className="text-white">{elevation.peaks_detected}</strong>
          </div>
        </div>

        {/* Elevation Histogram Sparkline */}
        <div className="pt-2">
          <span className="text-[10px] text-[#94a3b8] block mb-1">Elevation Distribution Histogram</span>
          <div className="flex items-end gap-0.5 h-12 bg-[#1e293b]/40 p-1 rounded">
            {elevation.histogram.map((bin: { bin_start: number; bin_end: number; count: number; pct: number }, i: number) => (
              <div
                key={i}
                title={`${bin.bin_start}m - ${bin.bin_end}m: ${bin.pct}%`}
                className="flex-1 bg-[#38bdf8] hover:bg-[#7dd3fc] transition-colors rounded-t"
                style={{ height: `${Math.max(4, bin.pct * 2.5)}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Section 4: Drainage & Flood Susceptibility Screening */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
          <Droplets className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>Drainage & Flood Susceptibility</span>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
          <div>
            <span className="text-[#94a3b8] block">Pooling Basin Area:</span>
            <strong className="text-white">{drainage.pooling_area_sq_m} m²</strong>
          </div>
          <div>
            <span className="text-[#94a3b8] block">Max Ponding Depth:</span>
            <strong className="text-white">{drainage.max_ponding_depth_m} m</strong>
          </div>
        </div>
        <div className="p-2 rounded bg-[#1e293b]/50 border border-[#334155] text-[10px] text-[#94a3b8]">
          <strong className="text-[#38bdf8]">Indicator:</strong> {drainage.drainage_flow_indicator}
          <div className="mt-1 text-[9px] text-[#64748b]">
            * {drainage.scientific_disclaimer}
          </div>
        </div>
      </div>

      {/* Section 5: Landslide Topographic Screening */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded p-3.5 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
          <AlertTriangle className="w-3.5 h-3.5 text-[#fbbf24]" />
          <span>Landslide Topographic Screening</span>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
          <div>
            <span className="text-[#94a3b8] block">Slopes &gt;30°:</span>
            <strong className="text-white">{landslide_screening.slopes_over_30_deg_pct}%</strong>
          </div>
          <div>
            <span className="text-[#94a3b8] block">Slopes &gt;45°:</span>
            <strong className="text-white">{landslide_screening.slopes_over_45_deg_pct}%</strong>
          </div>
        </div>
        <div className="p-2 rounded bg-[#1e293b]/50 border border-[#334155] text-[10px] text-[#94a3b8]">
          <strong className="text-[#fbbf24]">Screening Category:</strong> {landslide_screening.risk_level}
          <div className="mt-1 text-[9px] text-[#64748b]">
            * {landslide_screening.scientific_disclaimer}
          </div>
        </div>
      </div>
    </div>
  )
}
export default AnalyticsPanel
