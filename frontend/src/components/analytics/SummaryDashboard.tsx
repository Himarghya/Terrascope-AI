import React, { useState } from 'react'
import {
  Building2,
  Trees,
  Mountain,
  Compass,
  Search,
  CheckCircle2,
  ExternalLink,
  Percent,
  Layers,
  ArrowUpRight,
  Download
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { BuildingFeature, TreeFeature } from '../../types'

export const SummaryDashboard: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const selectFeature = useStore((state) => state.selectFeature)
  const setTargetFocusPosition = useStore((state) => state.setTargetFocusPosition)
  const verticalExaggeration = useStore((state) => state.verticalExaggeration)
  const setViewMode = useStore((state) => state.setViewMode)

  const [activeTab, setActiveTab] = useState<'buildings' | 'vegetation'>('buildings')
  const [searchQuery, setSearchQuery] = useState('')

  if (!sceneData) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        No active scene data. Load a sample or upload imagery to generate summary inventory.
      </div>
    )
  }

  const { summary_stats, buildings, trees, gsd_m } = sceneData

  // Filtered lists
  const filteredBuildings = buildings.filter((b) =>
    b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.roof_shape.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredTrees = trees.filter((t) =>
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.vegetation_category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleFlyToBuilding = (bld: BuildingFeature) => {
    selectFeature({
      type: 'building',
      id: bld.id,
      data: bld,
    })
    setViewMode('3d')

    // Find center in 3D
    const target3D = sceneData.buildings_3d.find((m) => m.building_id === bld.id)
    if (target3D && target3D.vertices[0]) {
      setTargetFocusPosition([
        target3D.vertices[0][0],
        target3D.base_elevation * verticalExaggeration + bld.estimated_height_m / 2,
        target3D.vertices[0][2],
      ])
    }
  }

  const handleFlyToTree = (tree: TreeFeature) => {
    selectFeature({
      type: 'vegetation',
      id: tree.id,
      data: tree,
    })
    setViewMode('3d')

    const targetVeg = sceneData.vegetation_3d.find((v) => v.id === tree.id)
    if (targetVeg) {
      setTargetFocusPosition([
        targetVeg.position[0],
        targetVeg.position[1] * verticalExaggeration + tree.estimated_canopy_height_m / 2,
        targetVeg.position[2],
      ])
    }
  }

  return (
    <div className="p-4 space-y-5 text-xs text-slate-300">
      {/* 1. Metric Overview Cards */}
      <div>
        <label className="font-semibold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider text-[11px] mb-2.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Scene Analytics & Inventory</span>
        </label>

        <div className="grid grid-cols-2 gap-2 font-mono">
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/80">
            <div className="text-[10px] text-slate-400">TOTAL BUILDINGS</div>
            <div className="text-xl font-bold text-white mt-0.5">
              {summary_stats.total_buildings}
            </div>
            <div className="text-[10px] text-cyan-400 mt-1">
              {summary_stats.built_up_area_m2.toLocaleString()} m² built-up
            </div>
          </div>

          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/80">
            <div className="text-[10px] text-slate-400">TREE CROWNS</div>
            <div className="text-xl font-bold text-white mt-0.5">
              {summary_stats.total_trees_detected}
            </div>
            <div className="text-[10px] text-emerald-400 mt-1">
              {summary_stats.vegetation_coverage_pct.toFixed(1)}% total canopy
            </div>
          </div>

          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/80">
            <div className="text-[10px] text-slate-400">BUILDING DENSITY</div>
            <div className="text-xl font-bold text-cyan-400 mt-0.5">
              {summary_stats.building_density_pct}%
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Mean H: {summary_stats.mean_building_height_m}m
            </div>
          </div>

          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/80">
            <div className="text-[10px] text-slate-400">CONFIDENCE</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">
              {Math.round(summary_stats.overall_reconstruction_confidence * 100)}%
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Calibrated score</div>
          </div>
        </div>
      </div>

      {/* SIHE Elevation & Surface Model Overview */}
      {sceneData.sihe && (
        <div className="bg-slate-800/40 p-3 rounded-lg border border-cyan-800/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <Mountain className="w-3.5 h-3.5 text-cyan-400" />
              <span>SIHE Neural Elevation & nDSM</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[9px] font-mono">
              {sceneData.sihe.calibration.height_unit === 'meters_agl' ? 'm AGL' : 'Relative'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[9px]">PEAK SURFACE HEIGHT</span>
              <span className="text-white font-bold text-xs">{sceneData.sihe.calibration.max_object_height_m} m</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[9px]">CALIBRATION METHOD</span>
              <span className="text-emerald-400 font-semibold truncate block" title={sceneData.sihe.calibration.calibration_method}>
                {sceneData.sihe.calibration.calibration_method}
              </span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[9px]">MEAN UNCERTAINTY (95%)</span>
              <span className="text-cyan-400 font-semibold">± {sceneData.sihe.uncertainty_metrics.mean_uncertainty_m} m</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block text-[9px]">SCALE FACTOR (s)</span>
              <span className="text-amber-300 font-semibold">{sceneData.sihe.calibration.scale_factor_m.toFixed(2)} m</span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setViewMode('sihe')}
              className="flex-1 py-1 px-2 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/80 text-cyan-300 text-[10px] flex items-center justify-center gap-1 font-medium transition-colors"
            >
              <Mountain className="w-3 h-3" />
              <span>Inspect SIHE Heightmap in 3D</span>
            </button>
            {sceneData.sihe.ndsm_raster_url && (
              <a
                href={sceneData.sihe.ndsm_raster_url}
                download
                target="_blank"
                rel="noreferrer"
                className="py-1 px-2.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] flex items-center gap-1 font-medium transition-colors"
              >
                <Download className="w-3 h-3 text-cyan-400" />
                <span>GeoTIFF</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* 2. Interactive Feature Tables */}
      <div className="space-y-3">
        {/* Table Selector Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('buildings')}
            className={`pb-2 px-3 font-medium text-xs flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'buildings'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Buildings ({buildings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('vegetation')}
            className={`pb-2 px-3 font-medium text-xs flex items-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'vegetation'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Trees className="w-3.5 h-3.5" />
            <span>Trees ({trees.length})</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search by ID or class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Scrollable Table */}
        <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60">
          {activeTab === 'buildings' ? (
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold sticky top-0 border-b border-slate-700">
                <tr>
                  <th className="py-1.5 px-2">ID</th>
                  <th className="py-1.5 px-2">Area</th>
                  <th className="py-1.5 px-2">3D H</th>
                  <th className="py-1.5 px-2">SIHE</th>
                  <th className="py-1.5 px-2">Roof</th>
                  <th className="py-1.5 px-2 text-right">Focus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {filteredBuildings.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => handleFlyToBuilding(b)}
                  >
                    <td className="py-1.5 px-2 font-bold text-white">{b.id}</td>
                    <td className="py-1.5 px-2 text-slate-300">{b.footprint_area_m2}m²</td>
                    <td className="py-1.5 px-2 text-cyan-400 font-bold">{b.estimated_height_m}m</td>
                    <td className="py-1.5 px-2 text-emerald-400">{b.sihe_height_m !== undefined ? `${b.sihe_height_m}m` : '-'}</td>
                    <td className="py-1.5 px-2 text-slate-400 truncate max-w-[70px]">
                      {b.roof_shape.split(' ')[0]}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <button
                        title="Fly to in 3D"
                        className="p-1 rounded hover:bg-cyan-900/40 text-cyan-400"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold sticky top-0 border-b border-slate-700">
                <tr>
                  <th className="py-1.5 px-2">ID</th>
                  <th className="py-1.5 px-2">Diam</th>
                  <th className="py-1.5 px-2">Canopy</th>
                  <th className="py-1.5 px-2">SIHE</th>
                  <th className="py-1.5 px-2">Class</th>
                  <th className="py-1.5 px-2 text-right">Focus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {filteredTrees.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => handleFlyToTree(t)}
                  >
                    <td className="py-1.5 px-2 font-bold text-white">{t.id}</td>
                    <td className="py-1.5 px-2 text-slate-300">{t.crown_diameter_m}m</td>
                    <td className="py-1.5 px-2 text-emerald-400 font-bold">
                      {t.estimated_canopy_height_m}m
                    </td>
                    <td className="py-1.5 px-2 text-cyan-400">{t.sihe_canopy_height_m !== undefined ? `${t.sihe_canopy_height_m}m` : '-'}</td>
                    <td className="py-1.5 px-2 text-slate-400 truncate max-w-[70px]">
                      {t.tree_model_type}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <button
                        title="Fly to in 3D"
                        className="p-1 rounded hover:bg-emerald-900/40 text-emerald-400"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
