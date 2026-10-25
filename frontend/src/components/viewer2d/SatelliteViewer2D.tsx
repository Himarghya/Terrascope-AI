import React, { useState } from 'react'
import { useStore } from '../../store/useStore'
import { BuildingFeature, TreeFeature } from '../../types'

interface Viewer2DProps {
  forceMode?: 'satellite' | 'classification' | 'sihe'
}

export const SatelliteViewer2D: React.FC<Viewer2DProps> = ({ forceMode }) => {
  const sceneData = useStore((state) => state.sceneData)
  const viewMode = useStore((state) => state.viewMode)
  const selectedFeature = useStore((state) => state.selectedFeature)
  const hoveredFeatureId = useStore((state) => state.hoveredFeatureId)
  const selectFeature = useStore((state) => state.selectFeature)
  const setHoveredFeatureId = useStore((state) => state.setHoveredFeatureId)

  const [showOverlays, setShowOverlays] = useState(true)

  if (!sceneData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-500 text-xs">
        No satellite imagery loaded.
      </div>
    )
  }

  const effectiveMode = forceMode || (viewMode === 'classification' ? 'classification' : viewMode === 'sihe' ? 'sihe' : 'satellite')
  let imageUrl = sceneData.image_url
  if (effectiveMode === 'classification') {
    imageUrl = sceneData.classification_vis_url
  } else if (effectiveMode === 'sihe' && sceneData.sihe?.visualization_url) {
    imageUrl = sceneData.sihe.visualization_url
  }
  const { width, height } = sceneData.dimensions

  return (
    <div className="w-full h-full relative bg-slate-950 flex items-center justify-center overflow-auto p-4 select-none">
      <div className="relative inline-block border border-slate-800 shadow-2xl rounded overflow-hidden">
        {/* Raster Image */}
        <img
          src={imageUrl}
          alt="Satellite Layer"
          className="max-h-[82vh] max-w-full object-contain block"
        />

        {/* Vector SVG Overlays */}
        {showOverlays && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-auto"
            viewBox={`0 0 ${width} ${height}`}
          >
            {/* Building Footprint Polygons */}
            {sceneData.buildings.map((b) => {
              const ptsStr = b.polygon_px.map((pt) => `${pt[0]},${pt[1]}`).join(' ')
              const isSelected = selectedFeature?.id === b.id
              const isHovered = hoveredFeatureId === b.id

              return (
                <polygon
                  key={b.id}
                  points={ptsStr}
                  fill={isSelected ? 'rgba(6, 182, 212, 0.45)' : isHovered ? 'rgba(56, 189, 248, 0.35)' : 'rgba(234, 88, 12, 0.25)'}
                  stroke={isSelected ? '#06b6d4' : isHovered ? '#38bdf8' : '#ea580c'}
                  strokeWidth={isSelected ? 3 : 1.5}
                  className="cursor-pointer transition-all"
                  onClick={() =>
                    selectFeature({
                      type: 'building',
                      id: b.id,
                      data: b,
                    })
                  }
                  onMouseEnter={() => setHoveredFeatureId(b.id)}
                  onMouseLeave={() => setHoveredFeatureId(null)}
                >
                  <title>{`${b.id} (${b.roof_shape}, H: ${b.estimated_height_m}m)`}</title>
                </polygon>
              )
            })}

            {/* Tree Crown Points */}
            {sceneData.trees.map((t) => {
              const [cx, cy] = t.center_px
              const r_px = (t.crown_diameter_m / 2) / sceneData.gsd_m
              const isSelected = selectedFeature?.id === t.id
              const isHovered = hoveredFeatureId === t.id

              return (
                <circle
                  key={t.id}
                  cx={cx}
                  cy={cy}
                  r={Math.max(3, r_px)}
                  fill={isSelected ? 'rgba(6, 182, 212, 0.6)' : isHovered ? 'rgba(74, 222, 128, 0.5)' : 'rgba(22, 163, 74, 0.35)'}
                  stroke={isSelected ? '#06b6d4' : isHovered ? '#4ade80' : '#16a34a'}
                  strokeWidth={isSelected ? 2.5 : 1}
                  className="cursor-pointer transition-all"
                  onClick={() =>
                    selectFeature({
                      type: 'vegetation',
                      id: t.id,
                      data: t,
                    })
                  }
                  onMouseEnter={() => setHoveredFeatureId(t.id)}
                  onMouseLeave={() => setHoveredFeatureId(null)}
                >
                  <title>{`${t.id} (${t.vegetation_category}, Diam: ${t.crown_diameter_m}m)`}</title>
                </circle>
              )
            })}
          </svg>
        )}
      </div>

      {/* Floating Overlay Toggle in bottom corner */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-lg shadow-lg text-xs flex items-center gap-2">
        <input
          type="checkbox"
          id="toggleOverlays"
          checked={showOverlays}
          onChange={(e) => setShowOverlays(e.target.checked)}
          className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-600 text-cyan-600 cursor-pointer"
        />
        <label htmlFor="toggleOverlays" className="text-slate-300 cursor-pointer">
          Show Vector Polygons Overlay
        </label>
      </div>
    </div>
  )
}
