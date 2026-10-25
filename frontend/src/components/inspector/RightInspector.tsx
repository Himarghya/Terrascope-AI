import React, { useState, useEffect } from 'react'
import {
  Building2,
  Trees,
  Mountain,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Compass,
  ArrowRight,
  ArrowLeft,
  Download,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { BuildingFeature, TreeFeature } from '../../types'

export const RightInspector: React.FC = () => {
  const inspectorOpen = useStore((state) => state.inspectorOpen)
  const toggleInspector = useStore((state) => state.toggleInspector)
  const selectedFeature = useStore((state) => state.selectedFeature)
  const selectFeature = useStore((state) => state.selectFeature)
  const editBuilding = useStore((state) => state.editBuilding)
  const editVegetation = useStore((state) => state.editVegetation)
  const sceneData = useStore((state) => state.sceneData)
  const setTargetFocusPosition = useStore((state) => state.setTargetFocusPosition)
  const verticalExaggeration = useStore((state) => state.verticalExaggeration)
  const setActiveScreen = useStore((state) => state.setActiveScreen)
  const setGsdModalOpen = useStore((state) => state.setGsdModalOpen)

  // Terra3D Measured Elevation & Validation State
  const dtmMeta = useStore((state) => state.dtmMeta)
  const dsmMeta = useStore((state) => state.dsmMeta)
  const validationReport = useStore((state) => state.validationReport)
  const measuredOffsetRemoved = useStore((state) => state.measuredOffsetRemoved)
  const georeferenceBounds = useStore((state) => state.georeferenceBounds)
  const voiceNarrationOnClick = useStore((state) => state.voiceNarrationOnClick)
  const toggleVoiceNarrationOnClick = useStore((state) => state.toggleVoiceNarrationOnClick)
  const narrateBuilding = useStore((state) => state.narrateBuilding)
  const isSpeaking = useStore((state) => state.voiceState.isSpeaking)

  // Local state for building edits
  const [editHeight, setEditHeight] = useState<number>(8.0)
  const [editRoofShape, setEditRoofShape] = useState<string>('Gabled / Pitched Roof')
  const [editColor, setEditColor] = useState<string>('#c25a38')

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

  if (!inspectorOpen) return null

  return (
    <aside className="w-80 bg-[#FFFFFF] border-l border-[#DCE2DC] flex flex-col justify-between shrink-0 h-full overflow-hidden z-20 select-none shadow-sm text-xs text-[#17231F]">
      {/* Top Header */}
      <div className="h-10 border-b border-[#DCE2DC] px-3 flex items-center justify-between bg-[#F5F6F3] shrink-0">
        <span className="font-semibold text-[11px] text-[#17231F] uppercase tracking-wide flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-[#286653] stroke-[2]" />
          <span>{selectedFeature ? 'Feature Inspector' : 'Scene Overview'}</span>
        </span>
        <button
          onClick={toggleInspector}
          className="p-1 rounded text-[#68736D] hover:text-[#17231F] hover:bg-[#FFFFFF]"
          title="Close Inspector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Inspector Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* CASE 1: NO FEATURE SELECTED -> SCENE-LEVEL OVERVIEW */}
        {!selectedFeature && sceneData && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-semibold text-[#68736D] uppercase tracking-wider block mb-1.5">
                Spatial Reference Frame
              </span>
              <div className="bg-[#F5F6F3] p-2.5 rounded border border-[#DCE2DC] space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#68736D]">CRS:</span>
                  <span className="text-[#286653] font-semibold truncate max-w-[150px]">
                    {sceneData.metadata.crs || 'Metric Local Frame'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#68736D]">GSD:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#17231F] font-semibold">{sceneData.gsd_m} m/px</span>
                    <button
                      type="button"
                      onClick={() => setGsdModalOpen(true)}
                      className="px-1.5 py-0.5 rounded bg-white hover:bg-[#E8EFEA] border border-[#DCE2DC] hover:border-[#286653] text-[#286653] text-[9px] font-sans font-medium transition-colors cursor-pointer shadow-2xs"
                      title="Change Ground Sampling Distance (GSD) & metric scale"
                    >
                      Change
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#68736D]">Extents:</span>
                  <span className="text-[#17231F]">
                    {Math.round(sceneData.dimensions.width * sceneData.gsd_m)}m ×{' '}
                    {Math.round(sceneData.dimensions.height * sceneData.gsd_m)}m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#68736D]">Raster Res:</span>
                  <span className="text-[#17231F]">{sceneData.dimensions.width} × {sceneData.dimensions.height} px</span>
                </div>
              </div>
            </div>

            {/* Terrain Relief Stats */}
            <div>
              <span className="text-[10px] font-semibold text-[#68736D] uppercase tracking-wider block mb-1.5">
                Topographic Relief
              </span>
              <div className="bg-[#F5F6F3] p-2.5 rounded border border-[#DCE2DC] space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#68736D]">Elevation Range:</span>
                  <span className="text-[#286653] font-semibold">
                    {sceneData.terrain_stats.elevation_min_m}m – {sceneData.terrain_stats.elevation_max_m}m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#68736D]">Mean Slope:</span>
                  <span className="text-[#17231F]">{sceneData.terrain_stats.mean_slope_deg}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#68736D]">Roughness:</span>
                  <span className="text-[#17231F]">{sceneData.terrain_stats.surface_roughness_m} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#68736D]">Elevation Source:</span>
                  <span className="text-[#17231F] truncate max-w-[130px]" title={sceneData.terrain_stats.elevation_source}>
                    {sceneData.terrain_stats.elevation_source}
                  </span>
                </div>
              </div>
            </div>

            {/* SIHE Model Datum */}
            {sceneData.sihe && (
              <div>
                <span className="text-[10px] font-semibold text-[#68736D] uppercase tracking-wider block mb-1.5">
                  SIHE Surface Model Datum
                </span>
                <div className="bg-[#F5F6F3] p-2.5 rounded border border-[#DCE2DC] space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[#68736D]">Datum:</span>
                    <span className="text-[#426B8A] font-semibold">meters AGL (nDSM)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#68736D]">Scale Factor (s):</span>
                    <span className="text-[#286653]">{(sceneData.sihe.calibration?.scale_factor_m ?? 30.0).toFixed(2)} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#68736D]">Mean 95% CI:</span>
                    <span className="text-[#17231F]">± {sceneData.sihe.uncertainty_metrics?.mean_uncertainty_m ?? 1.8} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#68736D]">Peak Object:</span>
                    <span className="text-[#17231F] font-semibold">{sceneData.sihe.calibration?.max_object_height_m ?? 15.0} m</span>
                  </div>
                </div>
              </div>
            )}

            {/* Terra3D Measured LiDAR & Validation Summary */}
            {(dtmMeta || dsmMeta || validationReport?.isValidated) && (
              <div>
                <span className="text-[10px] font-semibold text-[#68736D] uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span>Measured LiDAR & Ground Validation</span>
                  <span className="text-[9px] font-mono text-[#286653] font-semibold">Terra3D</span>
                </span>
                <div className="bg-[#F5F6F3] p-2.5 rounded border border-[#DCE2DC] space-y-1.5 font-mono text-[11px]">
                  {dtmMeta && (
                    <div className="flex justify-between">
                      <span className="text-[#68736D]">DTM (Bare Earth):</span>
                      <span className="text-[#286653] font-semibold">
                        {dtmMeta.resolution_m}m/px ({dtmMeta.coverage_pct}% cov)
                      </span>
                    </div>
                  )}
                  {dsmMeta && (
                    <div className="flex justify-between">
                      <span className="text-[#68736D]">DSM (Surface):</span>
                      <span className="text-[#286653] font-semibold">
                        {dsmMeta.resolution_m}m/px ({dsmMeta.coverage_pct}% cov)
                      </span>
                    </div>
                  )}
                  {measuredOffsetRemoved !== null && (
                    <div className="flex justify-between">
                      <span className="text-[#68736D]">Datum Offset Leveled:</span>
                      <span className="text-[#17231F]">
                        {measuredOffsetRemoved > 0 ? `+${measuredOffsetRemoved.toFixed(2)}m` : `${measuredOffsetRemoved.toFixed(2)}m`}
                      </span>
                    </div>
                  )}
                  {validationReport?.groundElevation && (
                    <div className="flex justify-between pt-1 border-t border-[#DCE2DC]">
                      <span className="text-[#68736D]">Ground RMSE (n={validationReport.groundElevation.count}):</span>
                      <span className="text-[#286653] font-semibold">
                        {validationReport.groundElevation.rmseM.toFixed(2)}m
                      </span>
                    </div>
                  )}
                  {validationReport?.objectHeight && (
                    <div className="flex justify-between">
                      <span className="text-[#68736D]">Object RMSE (n={validationReport.objectHeight.count}):</span>
                      <span className="text-[#286653] font-semibold">
                        {validationReport.objectHeight.rmseM.toFixed(2)}m
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scene Entity Summary & Quick Export */}
            <div className="bg-[#F5F6F3] p-2.5 rounded border border-[#DCE2DC] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#68736D]">Detected Objects:</span>
                <span className="font-semibold text-[#17231F]">
                  {sceneData.buildings.length} bld · {sceneData.trees.length} veg
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#68736D]">Ground Plane:</span>
                <span className="text-[#286653] font-semibold">Flat Planar Datum</span>
              </div>
              <button
                onClick={() => setActiveScreen('exports')}
                className="w-full mt-1 py-1.5 px-2 bg-[#FFFFFF] hover:bg-[#E8EFEA] border border-[#DCE2DC] hover:border-[#286653] rounded text-[11px] font-medium text-[#286653] flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export 3D Model (OBJ / GLB / DXF)</span>
              </button>
            </div>

            {/* BUILDINGS (TALLEST FIRST) */}
            {sceneData.buildings.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-[#68736D] uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-[#286653]" />
                    <span>Buildings (Tallest First)</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#68736D]">{sceneData.buildings.length} total</span>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1 border border-[#DCE2DC] rounded p-1.5 bg-[#F5F6F3]">
                  {[...sceneData.buildings]
                    .sort((a, b) => (b.height_m ?? b.estimated_height_m) - (a.height_m ?? a.estimated_height_m))
                    .map((b, idx) => {
                      const h = (b.height_m ?? b.estimated_height_m).toFixed(1)
                      const area = Math.round(b.area_m2 ?? b.footprint_area_m2)
                      return (
                        <button
                          key={b.id}
                          onClick={() => {
                            selectFeature({ type: 'building', id: b.id, data: b })
                            const target3D = sceneData.buildings_3d.find((m) => m.building_id === b.id)
                            if (target3D && target3D.vertices[0]) {
                              setTargetFocusPosition([
                                target3D.vertices[0][0],
                                target3D.base_elevation * verticalExaggeration + (b.height_m ?? b.estimated_height_m) / 2,
                                target3D.vertices[0][2]
                              ])
                            }
                          }}
                          className="w-full flex items-center justify-between p-2 rounded text-[11px] font-mono bg-white hover:bg-[#E8EFEA] border border-[#DCE2DC] hover:border-[#286653] transition-colors text-left group shadow-2xs cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#68736D] text-[10px]">#{idx + 1}</span>
                            <span className="font-semibold text-[#17231F] group-hover:text-[#286653]">{b.id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#286653] font-bold">{h}m</span>
                            <span className="text-[#68736D] text-[10px]">{area}m²</span>
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Scientific Validation Note */}
            <div className="p-2.5 rounded bg-[#EDF1EC] border border-[#DCE2DC] text-[10px] text-[#68736D] space-y-1 leading-relaxed">
              <span className="font-semibold text-[#17231F] block text-[10px] uppercase">
                Remote Sensing Rigor
              </span>
              <p>
                Urban digital twin operates on a planar ground datum (nDSM = DSM - DTM), isolating sharp vertical architectural building prisms and tree crowns without ground deformation.
              </p>
            </div>
          </div>
        )}

        {/* CASE 2: BUILDING SELECTED */}
        {selectedFeature?.type === 'building' && (() => {
          const bld = selectedFeature.data as BuildingFeature

          const handleApplyEdit = () => {
            editBuilding(bld.id, editHeight, editRoofShape, editColor)
          }

          return (
            <div className="space-y-4">
              {/* Back to Overview */}
              <button
                onClick={() => selectFeature(null)}
                className="text-[11px] font-medium text-[#286653] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Scene Overview</span>
              </button>

              {/* Feature Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#DCE2DC]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#E8EFEA] border border-[#286653] flex items-center justify-center text-[#286653]">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-mono font-bold text-xs text-[#17231F] flex items-center gap-1.5">
                      <span>{bld.id}</span>
                      {bld.building_type && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#FFFFFF] border border-[#286653] text-[#286653] font-sans font-medium">
                          {bld.building_type}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#68736D]">{bld.building_type || 'Building Instance'}</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#E8EFEA] text-[#286653] font-semibold border border-[#286653]">
                  {Math.round(bld.confidence * 100)}% Conf
                </span>
              </div>

              {/* ElevenLabs Voice Narration Action Card */}
              <div className="bg-[#E8EFEA] p-2.5 rounded border border-[#286653]/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isSpeaking ? (
                    <Volume2 className="w-4 h-4 text-[#286653] animate-bounce" />
                  ) : voiceNarrationOnClick ? (
                    <Volume2 className="w-4 h-4 text-[#286653]" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-[#68736D]" />
                  )}
                  <div>
                    <div className="text-[11px] font-semibold text-[#17231F] flex items-center gap-1.5">
                      <span>ElevenLabs Voice Agent</span>
                      {isSpeaking && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#286653] text-white font-mono animate-pulse">
                          Speaking...
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-[#68736D]">
                      {voiceNarrationOnClick
                        ? 'Speaks height, dimensions & features on click'
                        : 'Narration on click is disabled'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => narrateBuilding(bld)}
                    className="px-2 py-1 rounded bg-[#286653] hover:bg-[#1e4d3f] text-white text-[10px] font-medium transition-colors cursor-pointer"
                    title="Speak dimensions & features now"
                  >
                    Speak
                  </button>
                  <button
                    onClick={toggleVoiceNarrationOnClick}
                    className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                      voiceNarrationOnClick
                        ? 'bg-[#FFFFFF] border-[#286653] text-[#286653] font-bold shadow-2xs'
                        : 'bg-[#F5F6F3] border-[#DCE2DC] text-[#68736D]'
                    }`}
                    title="Toggle auto-speech when clicking buildings"
                  >
                    {voiceNarrationOnClick ? 'Auto: ON' : 'Auto: OFF'}
                  </button>
                </div>
              </div>

              {/* Reconstructed Height Card */}
              <div>
                <span className="text-[10px] font-semibold text-[#68736D] uppercase tracking-wider block mb-1">
                  Reconstructed Height & Floors
                </span>
                <div className="bg-[#F5F6F3] p-2.5 rounded border border-[#DCE2DC] space-y-1 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[#68736D]">Metric Height:</span>
                    <span className="font-mono font-bold text-[#286653] text-sm">
                      {bld.estimated_height_m}m <span className="text-xs text-[#68736D] font-normal">± {bld.height_uncertainty_m}m</span>
                    </span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-[#68736D]">Stories:</span>
                    <span className="text-[#17231F] font-semibold">{bld.estimated_floors} {bld.estimated_floors === 1 ? 'Floor' : 'Floors'}</span>
                  </div>
                  <div className="flex justify-between text-[10px] pt-1 border-t border-[#DCE2DC]">
                    <span className="text-[#68736D]">Evidence Source:</span>
                    <span className="text-[#17231F] truncate max-w-[150px]" title={bld.height_source}>
                      {bld.height_source}
                    </span>
                  </div>
                </div>
              </div>

              {/* SIHE Multi-Source Breakdown */}
              <div>
                <span className="text-[10px] font-semibold text-[#68736D] uppercase tracking-wider block mb-1">
                  SIHE Neural & Shadow Geometry
                </span>
                <div className="bg-[#F5F6F3] p-2.5 rounded border border-[#DCE2DC] grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                  <div className="bg-[#FFFFFF] p-1.5 rounded border border-[#DCE2DC]">
                    <span className="text-[#68736D] block text-[9px]">SIHE nDSM</span>
                    <span className="text-[#17231F] font-semibold">{bld.sihe_height_m !== undefined ? `${bld.sihe_height_m} m` : 'N/A'}</span>
                  </div>
                  <div className="bg-[#FFFFFF] p-1.5 rounded border border-[#DCE2DC]">
                    <span className="text-[#68736D] block text-[9px]">APEX RIDGE</span>
                    <span className="text-[#286653] font-semibold">{bld.sihe_peak_height_m !== undefined ? `${bld.sihe_peak_height_m} m` : 'N/A'}</span>
                  </div>
                  <div className="bg-[#FFFFFF] p-1.5 rounded border border-[#DCE2DC]">
                    <span className="text-[#68736D] block text-[9px]">SHADOW RAY</span>
                    <span className="text-[#B7791F] font-semibold">
                      {bld.shadow_height_m && bld.shadow_height_m > 0 ? `${bld.shadow_height_m} m` : 'Uncast'}
                    </span>
                  </div>
                  <div className="bg-[#FFFFFF] p-1.5 rounded border border-[#DCE2DC]">
                    <span className="text-[#68736D] block text-[9px]">ROOF PITCH</span>
                    <span className="text-[#426B8A] font-semibold truncate block">{bld.sihe_roof_planarity || 'Planar'}</span>
                  </div>
                </div>
              </div>

              {/* Footprint & Roof Morphology */}
              <div>
                <span className="text-[10px] font-semibold text-[#68736D] uppercase tracking-wider block mb-1">
                  Morphological Properties
                </span>
                <div className="bg-[#F5F6F3] p-2.5 rounded border border-[#DCE2DC] space-y-1.5 text-[11px]">
                  <div className="flex justify-between font-mono">
                    <span className="text-[#68736D]">Footprint Area:</span>
                    <span className="text-[#17231F] font-semibold">{bld.footprint_area_m2} m²</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-[#68736D]">Dimensions:</span>
                    <span className="text-[#17231F]">{bld.length_m}m × {bld.width_m}m</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-[#68736D]">Orientation:</span>
                    <span className="text-[#17231F]">{bld.orientation_deg}° N</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#68736D]">Typology:</span>
                    <span className="text-[#286653] font-semibold">{bld.building_type || 'Unclassified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#68736D]">Roof Style:</span>
                    <span className="text-[#17231F] font-medium">{bld.roof_shape}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#68736D]">Material / Appearance:</span>
                    <span className="text-[#17231F]">{bld.roof_material}</span>
                  </div>
                  {bld.floor_count_category && (
                    <div className="flex justify-between font-mono text-[10px] pt-1 border-t border-[#DCE2DC]">
                      <span className="text-[#68736D]">Floor Category:</span>
                      <span className="text-[#286653] font-semibold">{bld.floor_count_category}</span>
                    </div>
                  )}
                  {bld.vegetation_proximity_category && (
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="text-[#68736D]">Vegetation Proximity:</span>
                      <span className="text-[#17231F] font-semibold">
                        {bld.vegetation_proximity_m !== null && bld.vegetation_proximity_m !== undefined
                          ? `${bld.vegetation_proximity_m}m (${bld.vegetation_proximity_category})`
                          : bld.vegetation_proximity_category}
                      </span>
                    </div>
                  )}
                  {bld.model_version && (
                    <div className="flex justify-between font-mono text-[9px] text-[#68736D]">
                      <span>Model:</span>
                      <span className="truncate max-w-[155px]">{bld.model_version}</span>
                    </div>
                  )}
                  {bld.roof_appearance_note && (
                    <div className="text-[9px] text-[#68736D] italic pt-1 border-t border-[#DCE2DC]">
                      {bld.roof_appearance_note}
                    </div>
                  )}
                  {bld.has_hvac_units && (
                    <div className="flex items-center gap-1 text-[#286653] text-[10px] pt-1 border-t border-[#DCE2DC]">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Rooftop Mechanical / HVAC Units</span>
                    </div>
                  )}
                  {bld.has_solar_panels && (
                    <div className="flex items-center gap-1 text-[#B7791F] text-[10px] pt-1 border-t border-[#DCE2DC]">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Photovoltaic Solar Panels</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Correction Controls */}
              <div className="p-2.5 rounded bg-[#EDF1EC] border border-[#DCE2DC] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[#17231F] uppercase tracking-wide flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-[#286653]" />
                    <span>Adjust Geometry</span>
                  </span>
                  <span className="text-[10px] text-[#286653] font-mono">Live Recalculate</span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[#68736D] mb-1 font-mono">
                    <span>Height</span>
                    <span className="font-bold text-[#286653]">{editHeight}m</span>
                  </div>
                  <input
                    type="range"
                    min="2.5"
                    max="50.0"
                    step="0.5"
                    value={editHeight}
                    onChange={(e) => setEditHeight(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#DCE2DC] rounded appearance-none cursor-pointer accent-[#286653]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[#68736D] mb-1 font-medium">Roof Style</label>
                  <select
                    value={editRoofShape}
                    onChange={(e) => setEditRoofShape(e.target.value)}
                    className="w-full bg-[#FFFFFF] border border-[#DCE2DC] rounded p-1 text-xs text-[#17231F]"
                  >
                    <option value="Flat Roof with Parapet">Flat Roof with Parapet</option>
                    <option value="Gabled / Pitched Roof">Gabled / Pitched Roof</option>
                    <option value="Hipped Roof">Hipped Roof</option>
                    <option value="Linear / Industrial Gabled">Linear / Industrial Gabled</option>
                  </select>
                </div>

                <button
                  onClick={handleApplyEdit}
                  className="w-full py-1.5 rounded bg-[#286653] hover:bg-[#204F42] text-white text-xs font-medium transition-colors shadow-sm"
                >
                  Apply Geometry Update
                </button>
              </div>
            </div>
          )
        })()}

        {/* CASE 3: TREE SELECTED */}
        {selectedFeature?.type === 'vegetation' && (() => {
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
            <div className="space-y-4">
              {/* Back to Overview */}
              <button
                onClick={() => selectFeature(null)}
                className="text-[11px] font-medium text-[#286653] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Scene Overview</span>
              </button>

              {/* Feature Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#DCE2DC]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#E8EFEA] border border-[#286653] flex items-center justify-center text-[#286653]">
                    <Trees className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-mono font-bold text-xs text-[#17231F]">{tree.id}</div>
                    <div className="text-[10px] text-[#68736D]">{tree.vegetation_category}</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#E8EFEA] text-[#286653] font-semibold border border-[#286653]">
                  {Math.round(tree.detection_confidence * 100)}% Conf
                </span>
              </div>

              {/* Crown Dimensions */}
              <div>
                <span className="text-[10px] font-semibold text-[#68736D] uppercase tracking-wider block mb-1">
                  Canopy Dimensions
                </span>
                <div className="bg-[#F5F6F3] p-2.5 rounded border border-[#DCE2DC] space-y-1 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[#68736D]">Canopy Apex Height:</span>
                    <span className="font-mono font-bold text-[#286653] text-sm">
                      {tree.estimated_canopy_height_m}m <span className="text-xs text-[#68736D] font-normal">± {tree.height_uncertainty_m}m</span>
                    </span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-[#68736D]">Crown Diameter:</span>
                    <span className="text-[#17231F] font-semibold">{tree.crown_diameter_m} m</span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-[#68736D]">Crown Projected Area:</span>
                    <span className="text-[#17231F]">{tree.crown_area_m2} m²</span>
                  </div>
                  <div className="flex justify-between text-[10px] pt-1 border-t border-[#DCE2DC]">
                    <span className="text-[#68736D]">SIHE Apex Estimate:</span>
                    <span className="text-[#286653] font-mono font-semibold">
                      {tree.sihe_canopy_height_m !== undefined ? `${tree.sihe_canopy_height_m} m` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vitality & Ecology */}
              <div>
                <span className="text-[10px] font-semibold text-[#68736D] uppercase tracking-wider block mb-1">
                  Ecology & Photosynthetic Vitality
                </span>
                <div className="bg-[#F5F6F3] p-2.5 rounded border border-[#DCE2DC] space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[#68736D]">Photosynthetic Vigour:</span>
                    <span className="text-[#286653] font-semibold">{tree.vitality_status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#68736D]">Canopy Clustering:</span>
                    <span className="text-[#17231F]">{tree.clustering_status}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-[#68736D]">Nearest Neighbor:</span>
                    <span className="text-[#17231F]">{tree.nearest_neighbor_dist_m} m</span>
                  </div>
                  <div className="mt-1 p-2 rounded bg-[#FFFFFF] border border-[#DCE2DC] text-[10px] text-[#68736D] space-y-0.5">
                    <span className="font-semibold text-[#17231F] block">Taxonomic Note</span>
                    <p className="leading-relaxed">{tree.species_classification}</p>
                  </div>
                </div>
              </div>

              {/* Live Tree Edit */}
              <div className="p-2.5 rounded bg-[#EDF1EC] border border-[#DCE2DC] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[#17231F] uppercase tracking-wide flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-[#286653]" />
                    <span>Adjust Canopy</span>
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[#68736D] mb-1 font-mono">
                    <span>Height</span>
                    <span className="font-bold text-[#286653]">{editTreeHeight}m</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="25.0"
                    step="0.5"
                    value={editTreeHeight}
                    onChange={(e) => setEditTreeHeight(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#DCE2DC] rounded appearance-none cursor-pointer accent-[#286653]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[#68736D] mb-1 font-medium">Vegetation Type</label>
                  <select
                    value={editTreeCategory}
                    onChange={(e) => setEditTreeCategory(e.target.value)}
                    className="w-full bg-[#FFFFFF] border border-[#DCE2DC] rounded p-1 text-xs text-[#17231F]"
                  >
                    <option value="Broadleaf Deciduous Tree">Broadleaf Deciduous Tree</option>
                    <option value="Coniferous Tree (Needleleaf)">Coniferous Tree (Needleleaf)</option>
                    <option value="Palm / Subtropical Canopy">Palm / Subtropical Canopy</option>
                    <option value="Shrub / Ornamental Bush">Shrub / Ornamental Bush</option>
                  </select>
                </div>

                <button
                  onClick={handleApplyTreeEdit}
                  className="w-full py-1.5 rounded bg-[#286653] hover:bg-[#204F42] text-white text-xs font-medium transition-colors shadow-sm"
                >
                  Update Canopy Instance
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Bottom Dismiss Selection button (if feature selected) */}
      {selectedFeature && (
        <div className="p-2.5 border-t border-[#DCE2DC] bg-[#F5F6F3]">
          <button
            onClick={() => selectFeature(null)}
            className="w-full py-1 rounded bg-[#FFFFFF] hover:bg-[#EDF1EC] border border-[#DCE2DC] text-[#68736D] text-[11px] font-medium transition-colors"
          >
            Clear Selection
          </button>
        </div>
      )}
    </aside>
  )
}
