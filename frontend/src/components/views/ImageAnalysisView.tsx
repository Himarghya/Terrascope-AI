import React, { useState } from 'react'
import {
  Layers,
  Eye,
  Sliders,
  CheckCircle2,
  Info,
  ArrowRight,
  ShieldCheck,
  Maximize2,
  Scissors,
  Trash2,
  Box
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { SatelliteViewer2D } from '../viewer2d/SatelliteViewer2D'
import { BuildingFeature } from '../../types'

const LANDCOVER_CLASSES = [
  { name: 'Bare Soil & Ground', color: '#c2b280', code: 1 },
  { name: 'Grass & Low Vegetation', color: '#7cba4c', code: 2 },
  { name: 'Tree Canopy & Dense Vegetation', color: '#22702d', code: 3 },
  { name: 'Buildings & Built Structures', color: '#dc5f3c', code: 4 },
  { name: 'Roads & Paved Surfaces', color: '#50555f', code: 5 },
  { name: 'Water Bodies', color: '#2d78c8', code: 6 },
  { name: 'Cast Shadows', color: '#0f1219', code: 7 },
]

export const ImageAnalysisView: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const setActiveScreen = useStore((state) => state.setActiveScreen)
  const selectedFeature = useStore((state) => state.selectedFeature)
  const deleteBuilding = useStore((state) => state.deleteBuilding)
  const splitBuilding = useStore((state) => state.splitBuilding)
  const [displayMode, setDisplayMode] = useState<'satellite' | 'classification'>('satellite')
  const [isEditing, setIsEditing] = useState(false)

  if (!sceneData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#F5F6F3] p-8 text-center text-[#68736D] text-xs">
        <p>No imagery loaded yet. Select a dataset from Projects or upload custom imagery.</p>
        <button
          onClick={() => setActiveScreen('projects')}
          className="mt-3 px-3 py-1.5 rounded bg-[#286653] text-white font-medium"
        >
          Go to Projects
        </button>
      </div>
    )
  }

  const { metadata, landcover_stats, dimensions, gsd_m } = sceneData

  return (
    <div className="w-full h-full bg-[#F5F6F3] flex overflow-hidden select-none">
      {/* Central 2D Map Canvas */}
      <div className="flex-1 flex flex-col border-r border-[#DCE2DC] bg-[#EDF1EC] relative overflow-hidden">
        {/* Top View Mode Bar */}
        <div className="h-10 bg-[#FFFFFF] border-b border-[#DCE2DC] px-4 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#68736D] font-mono">RASTER VIEW:</span>
            <div className="flex items-center bg-[#F5F6F3] p-0.5 rounded border border-[#DCE2DC]">
              <button
                onClick={() => setDisplayMode('satellite')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  displayMode === 'satellite'
                    ? 'bg-[#FFFFFF] text-[#286653] shadow-sm font-semibold'
                    : 'text-[#68736D] hover:text-[#17231F]'
                }`}
              >
                TrueColor RGB
              </button>
              <button
                onClick={() => setDisplayMode('classification')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  displayMode === 'classification'
                    ? 'bg-[#FFFFFF] text-[#286653] shadow-sm font-semibold'
                    : 'text-[#68736D] hover:text-[#17231F]'
                }`}
              >
                Thematic Land Cover
              </button>
            </div>
          </div>

          <div className="text-[11px] text-[#68736D] font-mono">
            {dimensions.width} × {dimensions.height} px · {gsd_m} m/px
          </div>
        </div>

        {/* Segmentation Review & Editing Toolbar */}
        <div className="bg-[#EDF1EC] border-b border-[#DCE2DC] px-4 py-2 flex items-center justify-between text-xs shrink-0">
          {selectedFeature?.type === 'building' ? (
            (() => {
              const b = selectedFeature.data as BuildingFeature
              return (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#286653] bg-[#E8EFEA] px-2 py-0.5 rounded border border-[#286653]/30">
                      {b.id}
                    </span>
                    <span className="text-[#17231F] font-medium">
                      {b.footprint_area_m2} m² · {b.roof_shape} · {b.estimated_height_m}m
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={isEditing}
                      onClick={async () => {
                        setIsEditing(true)
                        try {
                          await splitBuilding(b.id, 'auto')
                        } finally {
                          setIsEditing(false)
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-[#286653] hover:bg-[#204F42] text-white text-[11px] font-medium flex items-center gap-1 shadow-sm disabled:opacity-50"
                      title="Split connected building mask into two separate structures"
                    >
                      <Scissors className="w-3 h-3" />
                      <span>Split Mask</span>
                    </button>
                    <button
                      disabled={isEditing}
                      onClick={async () => {
                        if (window.confirm(`Delete building ${b.id}?`)) {
                          setIsEditing(true)
                          try {
                            await deleteBuilding(b.id)
                          } finally {
                            setIsEditing(false)
                          }
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-[#FBEBEB] hover:bg-[#F8D7D7] text-[#B64040] border border-[#B64040]/30 text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                      title="Remove false detection from 3D scene"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete Mask</span>
                    </button>
                    <button
                      onClick={() => setActiveScreen('3d-reconstruction')}
                      className="px-2.5 py-1 rounded bg-[#FFFFFF] border border-[#DCE2DC] hover:border-[#286653] text-[#286653] text-[11px] font-medium flex items-center gap-1"
                      title="View extruded 3D mesh"
                    >
                      <Box className="w-3 h-3" />
                      <span>View in 3D</span>
                    </button>
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="flex items-center gap-2 text-[#68736D] text-[11px]">
              <Info className="w-3.5 h-3.5 text-[#286653]" />
              <span>
                Interactive Mask Review: Click any building polygon overlay to split connected structures, merge fragments, or delete false detections.
              </span>
            </div>
          )}
        </div>

        {/* 2D Viewer */}
        <div className="flex-1 relative overflow-auto bg-[#F5F6F3]">
          <SatelliteViewer2D forceMode={displayMode} />
        </div>
      </div>

      {/* Right Properties & Radiometry Panel */}
      <div className="w-80 bg-[#FFFFFF] flex flex-col justify-between overflow-y-auto p-4 space-y-4 text-xs text-[#17231F] shrink-0 border-l border-[#DCE2DC]">
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-xs text-[#17231F] uppercase tracking-wider mb-2">
              Ingestion Metadata
            </h2>
            <div className="bg-[#F5F6F3] p-2.5 rounded border border-[#DCE2DC] space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#68736D]">Filename:</span>
                <span className="text-[#17231F] font-semibold truncate max-w-[140px]" title={metadata.filename}>
                  {metadata.filename}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#68736D]">Dimensions:</span>
                <span className="text-[#17231F]">{dimensions.width} × {dimensions.height} px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#68736D]">Ground Area:</span>
                <span className="text-[#17231F]">
                  {Math.round((dimensions.width * gsd_m * dimensions.height * gsd_m) / 10000)} ha
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#68736D]">Color Channels:</span>
                <span className="text-[#17231F]">{metadata.channels} ({metadata.spectral_bands.join(', ')})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#68736D]">Bit Depth:</span>
                <span className="text-[#17231F]">{metadata.bit_depth}-bit per channel</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#68736D]">CRS Frame:</span>
                <span className="text-[#286653] font-semibold">{metadata.crs}</span>
              </div>
            </div>
          </div>

          {/* Radiometric Quality Assessment */}
          <div>
            <h2 className="font-semibold text-xs text-[#17231F] uppercase tracking-wider mb-2">
              Radiometric Quality
            </h2>
            <div className="bg-[#F5F6F3] p-2.5 rounded border border-[#DCE2DC] space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#68736D]">Sharpness Rating:</span>
                <span className="font-semibold text-[#286653]">
                  {metadata.quality_metrics.rating}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-[#68736D]">Laplacian Variance:</span>
                <span className="text-[#17231F]">{metadata.quality_metrics.sharpness_score}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-[#68736D]">Dynamic Range:</span>
                <span className="text-[#17231F]">{metadata.quality_metrics.dynamic_range} DN</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-[#68736D]">Mean Brightness:</span>
                <span className="text-[#17231F]">{metadata.quality_metrics.mean_brightness} DN</span>
              </div>
            </div>
          </div>

          {/* Thematic Land-Cover Distribution */}
          <div>
            <h2 className="font-semibold text-xs text-[#17231F] uppercase tracking-wider mb-2">
              Land-Cover Distribution
            </h2>
            <div className="border border-[#DCE2DC] rounded overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#F5F6F3] text-[#68736D] border-b border-[#DCE2DC]">
                  <tr>
                    <th className="py-1 px-2">Class</th>
                    <th className="py-1 px-2 text-right">Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE2DC] font-mono">
                  {LANDCOVER_CLASSES.map((cls) => {
                    const stat = landcover_stats[cls.name]
                    const pct = stat ? stat.percentage.toFixed(1) : '0.0'

                    return (
                      <tr key={cls.name} className="hover:bg-[#F5F6F3]">
                        <td className="py-1 px-2 flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0 border border-black/10"
                            style={{ backgroundColor: cls.color }}
                          />
                          <span className="font-sans text-[#17231F] text-[10px] truncate max-w-[130px]">
                            {cls.name.split('&')[0]}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-right text-[#17231F] font-semibold">
                          {pct}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Proceed Action */}
        <div className="pt-2 border-t border-[#DCE2DC]">
          <button
            onClick={() => setActiveScreen('3d-reconstruction')}
            className="w-full py-2 rounded bg-[#286653] hover:bg-[#204F42] text-white font-medium flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <span>Proceed to 3D Scene</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2]" />
          </button>
        </div>
      </div>
    </div>
  )
}
