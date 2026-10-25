import React from 'react'
import {
  Layers,
  Building2,
  Trees,
  Mountain,
  Grid,
  Sun,
  Palette,
  Route,
  Eye
} from 'lucide-react'
import { useStore } from '../../store/useStore'

const LANDCOVER_COLORS: Record<string, string> = {
  'Bare Soil & Ground': '#c2b280',
  'Grass & Low Vegetation': '#7cba4c',
  'Tree Canopy & Dense Vegetation': '#22702d',
  'Buildings & Built Structures': '#dc5f3c',
  'Roads & Paved Surfaces': '#50555f',
  'Water Bodies': '#2d78c8',
  'Cast Shadows': '#0f1219',
}

export const LayerManager: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const layerVisibility = useStore((state) => state.layerVisibility)
  const toggleLayer = useStore((state) => state.toggleLayer)
  const verticalExaggeration = useStore((state) => state.verticalExaggeration)
  const setVerticalExaggeration = useStore((state) => state.setVerticalExaggeration)
  const viewMode = useStore((state) => state.viewMode)
  const setViewMode = useStore((state) => state.setViewMode)

  const numBuildings = sceneData?.buildings.length || 0
  const numTrees = sceneData?.trees.length || 0
  const numRoads = sceneData?.road_corridors?.length || (sceneData?.roads_3d?.faces ? 1 : 0)

  return (
    <div className="p-4 space-y-6 text-xs text-slate-300">
      {/* 1. 3D Object & Scene Layers */}
      <div>
        <label className="font-semibold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider text-[11px] mb-3">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>3D Scene Layers</span>
        </label>

        <div className="space-y-2.5">
          {/* Terrain Layer */}
          <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mountain className="w-4 h-4 text-amber-400" />
                <span className="font-medium text-white">Terrain Elevation Mesh</span>
              </div>
              <input
                type="checkbox"
                checked={layerVisibility.terrain}
                onChange={() => toggleLayer('terrain')}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Sub-toggle: Drape Satellite Imagery vs Clay Relief */}
            {layerVisibility.terrain && (
              <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Drape Satellite Orthophoto</span>
                </div>
                <input
                  type="checkbox"
                  checked={layerVisibility.satelliteTexture !== false}
                  onChange={() => toggleLayer('satelliteTexture')}
                  className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0 cursor-pointer"
                />
              </div>
            )}

            {/* Vertical Exaggeration Slider */}
            {layerVisibility.terrain && (
              <div className="mt-2 pt-2 border-t border-slate-700/60">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Vertical Relief Exaggeration</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {verticalExaggeration.toFixed(1)}×
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="4.0"
                  step="0.1"
                  value={verticalExaggeration}
                  onChange={(e) => setVerticalExaggeration(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            )}

            {/* SIHE Heightmap Mode Switch */}
            {sceneData?.sihe && (
              <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-slate-200">SIHE Heightmap Texture</div>
                  <div className="text-[10px] text-slate-400">Turbo false-color relative DSM</div>
                </div>
                <button
                  onClick={() => setViewMode(viewMode === 'sihe' ? '3d' : 'sihe')}
                  className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                    viewMode === 'sihe'
                      ? 'bg-cyan-600 text-white border-cyan-500 font-bold'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  {viewMode === 'sihe' ? 'ACTIVE' : 'ACTIVATE'}
                </button>
              </div>
            )}
          </div>

          {/* Buildings Layer */}
          <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-orange-400" />
                <div>
                  <div className="font-medium text-white">3D Extruded Buildings</div>
                  <div className="text-[10px] text-slate-400">
                    {numBuildings} distinct instances detected
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={layerVisibility.buildings}
                onChange={() => toggleLayer('buildings')}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Sub-layers: Wall & Roof toggles */}
            {layerVisibility.buildings && (
              <div className="mt-2.5 pt-2 border-t border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-300 pl-6">
                  <span>Extruded Wall Meshes</span>
                  <input
                    type="checkbox"
                    checked={layerVisibility.walls !== false}
                    onChange={() => toggleLayer('walls')}
                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-300 pl-6">
                  <span>Roof Surface Geometry (Gabled/Hipped/Flat)</span>
                  <input
                    type="checkbox"
                    checked={layerVisibility.roofs !== false}
                    onChange={() => toggleLayer('roofs')}
                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Road Network Corridors */}
          <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-sky-400" />
              <div>
                <div className="font-medium text-white">Road Network Corridors</div>
                <div className="text-[10px] text-slate-400">
                  {numRoads > 0 ? `${numRoads} paved road corridors` : 'Terrain-draped ribbon mesh'}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={layerVisibility.roads}
              onChange={() => toggleLayer('roads')}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0 cursor-pointer"
            />
          </div>

          {/* Vegetation Layer */}
          <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trees className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="font-medium text-white">3D Vegetation & Tree Crowns</div>
                <div className="text-[10px] text-slate-400">
                  {numTrees} individual tree crowns
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={layerVisibility.vegetation}
              onChange={() => toggleLayer('vegetation')}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0 cursor-pointer"
            />
          </div>

          {/* Shadows Toggle */}
          <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400" />
              <div className="font-medium text-white">Dynamic 3D Shadows</div>
            </div>
            <input
              type="checkbox"
              checked={layerVisibility.shadows}
              onChange={() => toggleLayer('shadows')}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0 cursor-pointer"
            />
          </div>

          {/* Wireframe Toggle */}
          <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-indigo-400" />
              <div className="font-medium text-white">Wireframe Geometry Mode</div>
            </div>
            <input
              type="checkbox"
              checked={layerVisibility.wireframe}
              onChange={() => toggleLayer('wireframe')}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 2. Land Cover Classification Legend & Statistics */}
      {sceneData && (
        <div>
          <label className="font-semibold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider text-[11px] mb-3">
            <Palette className="w-3.5 h-3.5 text-emerald-400" />
            <span>Land-Cover Distribution</span>
          </label>

          <div className="space-y-2 bg-slate-800/40 p-3 rounded-lg border border-slate-700/70">
            {Object.entries(sceneData.landcover_stats).map(([className, stat]) => {
              const color = LANDCOVER_COLORS[className] || '#64748b'
              return (
                <div key={className} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0 border border-black/30"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-slate-300 truncate max-w-[170px]">{className}</span>
                    </div>
                    <span className="font-mono text-white font-medium">
                      {stat.percentage.toFixed(1)}%
                    </span>
                  </div>
                  {/* Proportion bar */}
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, stat.percentage)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
