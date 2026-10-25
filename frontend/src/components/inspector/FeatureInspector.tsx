import React, { useState, useEffect } from 'react'
import {
  Building2,
  Trees,
  Mountain,
  Ruler,
  Compass,
  Layers,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Scissors,
  Trash2,
  GitMerge
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { BuildingFeature, TreeFeature } from '../../types'

export const FeatureInspector: React.FC = () => {
  const selectedFeature = useStore((state) => state.selectedFeature)
  const selectFeature = useStore((state) => state.selectFeature)
  const editBuilding = useStore((state) => state.editBuilding)
  const deleteBuilding = useStore((state) => state.deleteBuilding)
  const splitBuilding = useStore((state) => state.splitBuilding)
  const mergeBuildings = useStore((state) => state.mergeBuildings)
  const editVegetation = useStore((state) => state.editVegetation)
  const sceneData = useStore((state) => state.sceneData)

  // Local state for building edits
  const [editHeight, setEditHeight] = useState<number>(8.0)
  const [editRoofShape, setEditRoofShape] = useState<string>('Gabled / Pitched Roof')
  const [editColor, setEditColor] = useState<string>('#c25a38')
  const [splitAxis, setSplitAxis] = useState<'auto' | 'long' | 'short'>('auto')
  const [mergeTargetId, setMergeTargetId] = useState<string>('')
  const [isProcessingEdit, setIsProcessingEdit] = useState<boolean>(false)

  // Local state for tree edits
  const [editTreeHeight, setEditTreeHeight] = useState<number>(6.0)
  const [editTreeCategory, setEditTreeCategory] = useState<string>('Broadleaf Deciduous Tree')

  useEffect(() => {
    if (selectedFeature?.type === 'building') {
      const b = selectedFeature.data as BuildingFeature
      setEditHeight(b.estimated_height_m)
      setEditRoofShape(b.roof_shape)
      setEditColor(b.base_color_hex || '#c25a38')
    } else if (selectedFeature?.type === 'vegetation') {
      const t = selectedFeature.data as TreeFeature
      setEditTreeHeight(t.estimated_canopy_height_m)
      setEditTreeCategory(t.vegetation_category)
    }
  }, [selectedFeature])

  if (!selectedFeature) {
    return (
      <div className="p-5 text-center text-slate-400 space-y-3">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
          <Info className="w-6 h-6 text-cyan-400/80" />
        </div>
        <div className="space-y-1">
          <h4 className="text-white font-medium text-xs">No Feature Selected</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Click on any individual 3D building or tree crown in the viewport to inspect its fine-grained geometry and classification.
          </p>
        </div>

        {sceneData && sceneData.buildings && sceneData.buildings.length > 0 && (
          <div className="mt-4 text-left space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              <span>Buildings (Tallest First)</span>
              <span className="text-cyan-400 font-mono">{sceneData.buildings.length} detected</span>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1 border border-slate-800 rounded-lg p-1.5 bg-slate-950/70 scrollbar-thin">
              {[...sceneData.buildings]
                .sort((a, b) => (b.estimated_height_m || b.height_m || 0) - (a.estimated_height_m || a.height_m || 0))
                .slice(0, 200)
                .map((b) => {
                  const h = b.estimated_height_m || b.height_m || 0
                  const area = b.footprint_area_m2 || b.area_m2 || 0
                  return (
                    <button
                      key={b.id}
                      onClick={() => {
                        selectFeature({
                          type: 'building',
                          id: b.id,
                          data: b
                        })
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800/90 transition-all flex items-center justify-between text-xs font-mono group border border-transparent hover:border-slate-700"
                    >
                      <span className="text-slate-300 group-hover:text-amber-400 font-semibold">{b.id}</span>
                      <span className="text-cyan-400 font-bold">{h.toFixed(1)} m</span>
                      <span className="text-slate-400 text-[11px]">{area.toFixed(1)} m²</span>
                    </button>
                  )
                })}
            </div>
          </div>
        )}

        {sceneData && (
          <div className="mt-4 p-3 bg-slate-800/40 rounded-lg border border-slate-700/60 text-left space-y-2 text-[11px]">
            <div className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
              Terrain Elevation Overview
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Source:</span>
              <span className="text-white font-medium text-right truncate max-w-[170px]">
                {sceneData.terrain_stats.elevation_source}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Elevation Range:</span>
              <span className="text-cyan-400 font-mono">
                {sceneData.terrain_stats.elevation_min_m}m – {sceneData.terrain_stats.elevation_max_m}m
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Mean Ground Slope:</span>
              <span className="text-white font-mono">
                {sceneData.terrain_stats.mean_slope_deg}°
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Surface Roughness:</span>
              <span className="text-white font-mono">
                {sceneData.terrain_stats.surface_roughness_m} m
              </span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // BUILDING INSPECTION & EDITING
  if (selectedFeature.type === 'building') {
    const bld = selectedFeature.data as BuildingFeature

    const handleApplyBuildingEdit = () => {
      editBuilding(bld.id, editHeight, editRoofShape, editColor)
    }

    return (
      <div className="p-4 space-y-5 text-xs text-slate-300">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-orange-950/60 border border-orange-700/80 text-orange-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white text-sm font-mono">{bld.id}</div>
              <div className="text-[10px] text-slate-400">Building Instance</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => selectFeature(null)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 transition-colors"
            >
              Back to List
            </button>
            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono">
              {Math.round(bld.confidence * 100)}% Conf
            </span>
          </div>
        </div>

        {/* Height & SIHE Multi-Source Card */}
        <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/80 space-y-2.5">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              Reconstructed Height
            </span>
            <div className="text-right">
              <span className="text-lg font-bold text-cyan-400 font-mono">
                {bld.estimated_height_m}m
              </span>
              <span className="text-[11px] text-slate-400 font-mono ml-1">
                ± {bld.height_uncertainty_m}m
              </span>
            </div>
          </div>

          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Estimated Stories:</span>
            <span className="text-white font-mono font-semibold">
              {bld.estimated_floors} {bld.estimated_floors === 1 ? 'Floor' : 'Floors'}
            </span>
          </div>

          {/* SIHE Evidence Breakdown */}
          <div className="pt-2 border-t border-slate-700/60 space-y-1.5 text-[11px]">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              SIHE Multi-Source Estimation
            </div>

            <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px]">SIHE NEURAL (nDSM)</span>
                <span className="text-white font-semibold">
                  {bld.sihe_height_m !== undefined ? `${bld.sihe_height_m} m` : 'N/A'}
                </span>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px]">APEX / RIDGE PEAK</span>
                <span className="text-cyan-300 font-semibold">
                  {bld.sihe_peak_height_m !== undefined ? `${bld.sihe_peak_height_m} m` : 'N/A'}
                </span>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px]">SHADOW TRIANGULATION</span>
                <span className="text-amber-300 font-semibold">
                  {bld.shadow_height_m !== undefined && bld.shadow_height_m > 0 ? `${bld.shadow_height_m} m` : 'Uncast / Occluded'}
                </span>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px]">ROOF PLANARITY</span>
                <span className="text-emerald-300 font-semibold truncate block">
                  {bld.sihe_roof_planarity || 'Planar Flat'}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
              <span className="text-slate-500">Evidence Source:</span>
              <span className="text-cyan-400 font-medium text-right max-w-[180px] truncate" title={bld.height_source}>
                {bld.height_source}
              </span>
            </div>
          </div>
        </div>

        {/* Footprint & Architectural Geometry */}
        <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/70 space-y-2">
          <div className="font-semibold text-slate-200 text-[11px] uppercase tracking-wider">
            Footprint & Roof Morphology
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">FOOTPRINT AREA</div>
              <div className="text-white font-semibold">{bld.footprint_area_m2} m²</div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">DIMENSIONS</div>
              <div className="text-white font-semibold">
                {bld.length_m}m × {bld.width_m}m
              </div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">ORIENTATION</div>
              <div className="text-white font-semibold">{bld.orientation_deg}° N</div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">REGULARITY</div>
              <div className="text-white font-semibold">{bld.shape_regularity} / 1.0</div>
            </div>
          </div>

          <div className="pt-2 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Roof Classification:</span>
              <span className="text-white font-medium">{bld.roof_shape}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Roof Material:</span>
              <span className="text-white font-medium">{bld.roof_material}</span>
            </div>
            {bld.has_hvac_units && (
              <div className="flex items-center gap-1.5 text-cyan-400 text-[10px]">
                <CheckCircle2 className="w-3 h-3" />
                <span>Rooftop Mechanical / HVAC Units Detected</span>
              </div>
            )}
            {bld.has_solar_panels && (
              <div className="flex items-center gap-1.5 text-amber-400 text-[10px]">
                <CheckCircle2 className="w-3 h-3" />
                <span>Photovoltaic Solar Array Detected</span>
              </div>
            )}
          </div>
        </div>

        {/* Live Correction / Editing Tools */}
        <div className="bg-slate-800/50 p-3 rounded-lg border border-cyan-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Correct Object Geometry</span>
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">Live Recalculate</span>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <span>Adjust Height (m)</span>
              <span className="font-mono text-cyan-400 font-bold">{editHeight}m</span>
            </div>
            <input
              type="range"
              min="2.5"
              max="50.0"
              step="0.5"
              value={editHeight}
              onChange={(e) => setEditHeight(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-300 mb-1">Roof Style</label>
            <select
              value={editRoofShape}
              onChange={(e) => setEditRoofShape(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
            >
              <option value="Flat Roof with Parapet">Flat Roof with Parapet</option>
              <option value="Gabled / Pitched Roof">Gabled / Pitched Roof</option>
              <option value="Hipped Roof">Hipped Roof</option>
              <option value="Linear / Industrial Gabled">Linear / Industrial Gabled</option>
            </select>
          </div>

          <button
            onClick={handleApplyBuildingEdit}
            disabled={isProcessingEdit}
            className="w-full py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium transition-colors text-xs"
          >
            Apply & Re-extrude Mesh
          </button>
        </div>

        {/* Building Mask Segmentation & Topology Editor */}
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Scissors className="w-3.5 h-3.5 text-amber-400" />
              <span>Mask & Topology Editor</span>
            </span>
            <span className="text-[10px] text-amber-400 font-mono">Instance Level</span>
          </div>

          {/* Split Building Action */}
          <div className="space-y-1.5 pt-1 border-t border-slate-700/60">
            <label className="text-[11px] text-slate-300 font-medium flex items-center justify-between">
              <span>Split Connected Footprint</span>
              <span className="text-[10px] text-slate-500">Bisect polygon</span>
            </label>
            <div className="flex gap-2">
              <select
                value={splitAxis}
                onChange={(e) => setSplitAxis(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white flex-1"
              >
                <option value="auto">Auto (Major Axis)</option>
                <option value="long">Perpendicular to Length</option>
                <option value="short">Parallel to Length</option>
              </select>
              <button
                disabled={isProcessingEdit}
                onClick={async () => {
                  setIsProcessingEdit(true)
                  try {
                    await splitBuilding(bld.id, splitAxis)
                  } finally {
                    setIsProcessingEdit(false)
                  }
                }}
                className="px-3 py-1 rounded bg-amber-600/80 hover:bg-amber-600 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1 transition-colors"
              >
                <Scissors className="w-3 h-3" />
                <span>Split</span>
              </button>
            </div>
          </div>

          {/* Merge Adjacent Building Action */}
          {sceneData && sceneData.buildings.length > 1 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-700/60">
              <label className="text-[11px] text-slate-300 font-medium flex items-center justify-between">
                <span>Merge Over-Segmented Fragment</span>
                <span className="text-[10px] text-slate-500">Union geometry</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white flex-1 truncate"
                >
                  <option value="">Select target building...</option>
                  {sceneData.buildings
                    .filter((b) => b.id !== bld.id)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.id} ({b.footprint_area_m2}m² - {b.roof_shape.split(' ')[0]})
                      </option>
                    ))}
                </select>
                <button
                  disabled={isProcessingEdit || !mergeTargetId}
                  onClick={async () => {
                    if (!mergeTargetId) return
                    setIsProcessingEdit(true)
                    try {
                      await mergeBuildings([bld.id, mergeTargetId])
                    } finally {
                      setIsProcessingEdit(false)
                      setMergeTargetId('')
                    }
                  }}
                  className="px-3 py-1 rounded bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1 transition-colors"
                >
                  <GitMerge className="w-3 h-3" />
                  <span>Merge</span>
                </button>
              </div>
            </div>
          )}

          {/* Delete False Positive */}
          <div className="pt-2 border-t border-slate-700/60">
            <button
              disabled={isProcessingEdit}
              onClick={async () => {
                if (window.confirm(`Delete ${bld.id}? This will remove it from the 3D scene.`)) {
                  setIsProcessingEdit(true)
                  try {
                    await deleteBuilding(bld.id)
                  } finally {
                    setIsProcessingEdit(false)
                  }
                }
              }}
              className="w-full py-1.5 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Building (Remove False Detection)</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // VEGETATION INSPECTION
  if (selectedFeature.type === 'vegetation') {
    const tree = selectedFeature.data as TreeFeature

    const handleApplyTreeEdit = () => {
      const modelType = editTreeCategory.includes('Conifer')
        ? 'conifer'
        : editTreeCategory.includes('Palm')
        ? 'palm'
        : editTreeCategory.includes('Shrub')
        ? 'shrub'
        : 'broadleaf'
      editVegetation(tree.id, editTreeHeight, editTreeCategory, modelType)
    }

    return (
      <div className="p-4 space-y-5 text-xs text-slate-300">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-emerald-950/60 border border-emerald-700/80 text-emerald-400">
              <Trees className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white text-sm font-mono">{tree.id}</div>
              <div className="text-[10px] text-slate-400">{tree.vegetation_category}</div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono">
            {Math.round(tree.detection_confidence * 100)}% Conf
          </span>
        </div>

        {/* Crown Canopy Metrics */}
        <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/80 space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              Reconstructed Canopy Height
            </span>
            <div className="text-right">
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {tree.estimated_canopy_height_m}m
              </span>
              <span className="text-[11px] text-slate-400 font-mono ml-1">
                ± {tree.height_uncertainty_m}m
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1">
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">CROWN DIAMETER</div>
              <div className="text-white font-semibold">{tree.crown_diameter_m} m</div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">CROWN AREA</div>
              <div className="text-white font-semibold">{tree.crown_area_m2} m²</div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[9px]">SIHE APEX HEIGHT</div>
              <div className="text-emerald-300 font-semibold">
                {tree.sihe_canopy_height_m !== undefined ? `${tree.sihe_canopy_height_m} m` : 'N/A'}
              </div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[9px]">METHOD</div>
              <div className="text-cyan-300 font-semibold truncate" title={tree.height_source || 'SIHE Peak Canopy Filter'}>
                {tree.height_source || 'SIHE Apex Filter'}
              </div>
            </div>
          </div>
        </div>

        {/* Vitality & Ecology */}
        <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/70 space-y-2 text-[11px]">
          <div className="font-semibold text-slate-200 uppercase tracking-wider text-[10px]">
            Ecology & Photosynthetic Vitality
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Photosynthetic Vigour:</span>
            <span className="text-emerald-400 font-medium">{tree.vitality_status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Canopy Clustering:</span>
            <span className="text-white font-medium">{tree.clustering_status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Nearest Neighbor Tree:</span>
            <span className="text-white font-mono">{tree.nearest_neighbor_dist_m}m</span>
          </div>

          {/* Species Uncertainty Disclaimer */}
          <div className="mt-2 p-2 rounded bg-slate-900/90 border border-slate-800 text-[10px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Taxonomic Uncertainty</span>
            </div>
            <p className="leading-relaxed">{tree.species_classification}</p>
          </div>
        </div>

        {/* Live Correction for Tree */}
        <div className="bg-slate-800/50 p-3 rounded-lg border border-emerald-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Adjust Tree Properties</span>
            </span>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-300 mb-1">
              <span>Canopy Height (m)</span>
              <span className="font-mono text-emerald-400 font-bold">{editTreeHeight}m</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="25.0"
              step="0.5"
              value={editTreeHeight}
              onChange={(e) => setEditTreeHeight(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-300 mb-1">Vegetation Type</label>
            <select
              value={editTreeCategory}
              onChange={(e) => setEditTreeCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
            >
              <option value="Broadleaf Deciduous Tree">Broadleaf Deciduous Tree</option>
              <option value="Coniferous Tree (Needleleaf)">Coniferous Tree (Needleleaf)</option>
              <option value="Palm / Subtropical Canopy">Palm / Subtropical Canopy</option>
              <option value="Shrub / Ornamental Bush">Shrub / Ornamental Bush</option>
            </select>
          </div>

          <button
            onClick={handleApplyTreeEdit}
            className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors text-xs"
          >
            Update Vegetation Instance
          </button>
        </div>
      </div>
    )
  }

  return null
}
