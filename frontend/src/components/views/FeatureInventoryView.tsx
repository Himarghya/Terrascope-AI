import React, { useState } from 'react'
import {
  Building2,
  Trees,
  Search,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Download
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { BuildingFeature, TreeFeature } from '../../types'

export const FeatureInventoryView: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const selectFeature = useStore((state) => state.selectFeature)
  const setTargetFocusPosition = useStore((state) => state.setTargetFocusPosition)
  const verticalExaggeration = useStore((state) => state.verticalExaggeration)
  const setActiveScreen = useStore((state) => state.setActiveScreen)
  const setViewMode = useStore((state) => state.setViewMode)
  const setInspectorOpen = useStore((state) => state.setInspectorOpen)

  const [activeTab, setActiveTab] = useState<'buildings' | 'vegetation'>('buildings')
  const [searchQuery, setSearchQuery] = useState('')

  if (!sceneData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#F5F6F3] p-8 text-center text-[#68736D] text-xs">
        <p>No feature data available. Please load a dataset or process an image first.</p>
        <button
          onClick={() => setActiveScreen('projects')}
          className="mt-3 px-3 py-1.5 rounded bg-[#286653] text-white font-medium"
        >
          Go to Projects
        </button>
      </div>
    )
  }

  const { buildings, trees } = sceneData

  const filteredBuildings = buildings.filter(
    (b) =>
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.building_type && b.building_type.toLowerCase().includes(searchQuery.toLowerCase())) ||
      b.roof_shape.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.roof_material.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredTrees = trees.filter(
    (t) =>
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.vegetation_category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.vitality_status.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleFlyToBuilding = (bld: BuildingFeature) => {
    selectFeature({
      type: 'building',
      id: bld.id,
      data: bld,
    })
    setInspectorOpen(true)
    setViewMode('3d')
    setActiveScreen('3d-reconstruction')

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
    setInspectorOpen(true)
    setViewMode('3d')
    setActiveScreen('3d-reconstruction')

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
    <div className="w-full h-full bg-[#F5F6F3] flex flex-col overflow-y-auto p-6 text-[#17231F] select-none">
      <div className="max-w-6xl mx-auto w-full space-y-4">
        {/* Header & Tabs */}
        <div className="flex items-center justify-between border-b border-[#DCE2DC] pb-4">
          <div>
            <h1 className="text-base font-semibold text-[#17231F] tracking-tight">
              Building & Vegetation Inventory
            </h1>
            <p className="text-xs text-[#68736D] mt-0.5">
              Fine-grained morphological, geometric, and radiometric parameters for all detected structures and canopies.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#68736D] absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search by ID or style..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#FFFFFF] border border-[#DCE2DC] rounded pl-8 pr-3 py-1.5 text-xs text-[#17231F] placeholder-[#68736D] focus:outline-none focus:border-[#286653] w-64 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#DCE2DC]">
          <button
            onClick={() => setActiveTab('buildings')}
            className={`pb-2.5 px-4 font-medium text-xs flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'buildings'
                ? 'border-[#286653] text-[#286653] font-semibold'
                : 'border-transparent text-[#68736D] hover:text-[#17231F]'
            }`}
          >
            <Building2 className="w-4 h-4 stroke-[1.75]" />
            <span>Buildings ({buildings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('vegetation')}
            className={`pb-2.5 px-4 font-medium text-xs flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'vegetation'
                ? 'border-[#286653] text-[#286653] font-semibold'
                : 'border-transparent text-[#68736D] hover:text-[#17231F]'
            }`}
          >
            <Trees className="w-4 h-4 stroke-[1.75]" />
            <span>Vegetation Canopies ({trees.length})</span>
          </button>
        </div>

        {/* Technical Data Table */}
        <div className="bg-[#FFFFFF] border border-[#DCE2DC] rounded shadow-sm overflow-hidden">
          {activeTab === 'buildings' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F5F6F3] text-[#68736D] font-medium border-b border-[#DCE2DC]">
                  <tr>
                    <th className="py-2.5 px-3">Building ID</th>
                    <th className="py-2.5 px-3">Typology</th>
                    <th className="py-2.5 px-3">Footprint</th>
                    <th className="py-2.5 px-3">Dimensions</th>
                    <th className="py-2.5 px-3">Roof Shape</th>
                    <th className="py-2.5 px-3">Orientation</th>
                    <th className="py-2.5 px-3">3D Height</th>
                    <th className="py-2.5 px-3">SIHE nDSM</th>
                    <th className="py-2.5 px-3">Stories</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE2DC] font-mono text-xs">
                  {filteredBuildings.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => handleFlyToBuilding(b)}
                      className="hover:bg-[#F5F6F3] cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 font-bold text-[#17231F]">{b.id}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-[#E8EFEA] text-[#286653] font-medium border border-[#286653]/30">
                          {b.building_type || 'Unclassified'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#17231F]">{b.footprint_area_m2} m²</td>
                      <td className="py-2.5 px-3 text-[#68736D]">{b.length_m}m × {b.width_m}m</td>
                      <td className="py-2.5 px-3 font-sans text-[#17231F]">{b.roof_shape}</td>
                      <td className="py-2.5 px-3 text-[#68736D]">{b.orientation_deg}° N</td>
                      <td className="py-2.5 px-3 text-[#286653] font-bold">{b.estimated_height_m}m</td>
                      <td className="py-2.5 px-3 text-[#426B8A]">
                        {b.sihe_height_m !== undefined ? `${b.sihe_height_m}m` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-[#17231F]">{b.estimated_floors}</td>
                      <td className="py-2.5 px-3 text-[#286653]">
                        {Math.round(b.confidence * 100)}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          title="Fly to in 3D Workspace"
                          className="p-1 rounded hover:bg-[#E8EFEA] text-[#286653] inline-flex items-center gap-1 font-sans text-[11px]"
                        >
                          <span>Focus</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F5F6F3] text-[#68736D] font-medium border-b border-[#DCE2DC]">
                  <tr>
                    <th className="py-2.5 px-3">Tree ID</th>
                    <th className="py-2.5 px-3">Crown Diameter</th>
                    <th className="py-2.5 px-3">Crown Area</th>
                    <th className="py-2.5 px-3">Canopy Height</th>
                    <th className="py-2.5 px-3">SIHE Canopy</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Photosynthetic Vitality</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE2DC] font-mono text-xs">
                  {filteredTrees.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => handleFlyToTree(t)}
                      className="hover:bg-[#F5F6F3] cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 font-bold text-[#17231F]">{t.id}</td>
                      <td className="py-2.5 px-3 text-[#17231F]">{t.crown_diameter_m} m</td>
                      <td className="py-2.5 px-3 text-[#17231F]">{t.crown_area_m2} m²</td>
                      <td className="py-2.5 px-3 text-[#286653] font-bold">{t.estimated_canopy_height_m}m</td>
                      <td className="py-2.5 px-3 text-[#426B8A]">
                        {t.sihe_canopy_height_m !== undefined ? `${t.sihe_canopy_height_m}m` : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-[#17231F]">{t.vegetation_category}</td>
                      <td className="py-2.5 px-3 font-sans text-[#286653]">{t.vitality_status}</td>
                      <td className="py-2.5 px-3 text-[#286653]">
                        {Math.round(t.detection_confidence * 100)}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          title="Fly to in 3D Workspace"
                          className="p-1 rounded hover:bg-[#E8EFEA] text-[#286653] inline-flex items-center gap-1 font-sans text-[11px]"
                        >
                          <span>Focus</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
