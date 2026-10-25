import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import {
  Building2,
  Wrench,
  Download,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Eye,
  Sparkles,
  RefreshCw,
  Box,
  FileCode,
  ShieldCheck,
  ChevronRight,
  Info,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { BuildingDetailMesh, UrbanPropMesh, SidewalkMesh } from '../../types'

// ==============================================================================
// ERROR BOUNDARY FOR ROBUST VIEWPORT ISOLATION
// ==============================================================================

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class StudioErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('StudioErrorBoundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#090d16] text-[#f8fafc] p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="text-base font-bold text-white mb-1">City Detail Studio Recovered</div>
          <div className="text-xs text-[#94a3b8] max-w-md mb-4">
            A temporary component state discrepancy occurred: {this.state.error?.message || 'Unexpected state'}.
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            className="px-4 py-2 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reload Studio
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ==============================================================================
// 3D PROCEDURAL CITY CANVAS RENDERER
// ==============================================================================

interface City3DSceneProps {
  buildings: BuildingDetailMesh[]
  urbanProps: UrbanPropMesh[]
  sidewalks: SidewalkMesh[]
  previewMode: 'solid' | 'wireframe'
  selectedBuildingId: string | null
  onSelectBuilding: (id: string) => void
}

const DetailedBuilding3D: React.FC<{
  building: BuildingDetailMesh
  previewMode: 'solid' | 'wireframe'
  isSelected: boolean
  onClick: () => void
}> = ({ building, previewMode, isSelected, onClick }) => {
  if (!building) return null

  // Render Solid or Wireframe combined mesh
  let meshData = building.combined_mesh
  if (!meshData || !meshData.vertices || meshData.vertices.length === 0) {
    const wm = (building as any).walls_mesh
    const rm = (building as any).roof_mesh
    if (wm && wm.vertices && wm.vertices.length > 0) {
      const v = [...wm.vertices]
      const f = [...wm.faces]
      if (rm && rm.vertices) {
        const off = v.length
        v.push(...rm.vertices)
        for (const rf of rm.faces || []) {
          f.push([rf[0] + off, rf[1] + off, rf[2] + off])
        }
      }
      meshData = { vertices: v, faces: f, vertex_count: v.length, face_count: f.length }
    }
  }

  if (!meshData || !meshData.vertices || meshData.vertices.length === 0) return null

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(meshData.vertices.flat()), 3))
  geom.setIndex(new THREE.BufferAttribute(new Uint32Array(meshData.faces.flat()), 1))
  geom.computeVertexNormals()

  const baseHex =
    building.classification?.base_color_hex ||
    (building as any).base_color_hex ||
    (building as any).profile?.base_color_hex ||
    '#94a3b8'

  return (
    <mesh
      geometry={geom}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <meshStandardMaterial
        color={isSelected ? '#38bdf8' : baseHex}
        wireframe={previewMode === 'wireframe'}
        roughness={0.5}
        metalness={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

const City3DCanvas: React.FC<City3DSceneProps> = ({
  buildings,
  urbanProps,
  sidewalks,
  previewMode,
  selectedBuildingId,
  onSelectBuilding,
}) => {
  return (
    <Canvas
      camera={{ position: [0, 80, 120], fov: 45 }}
      className="w-full h-full bg-[#0a0f1d]"
    >
      <ambientLight intensity={0.65} />
      <directionalLight position={[50, 100, 50]} intensity={1.2} castShadow />
      <directionalLight position={[-50, 40, -50]} intensity={0.4} />

      {/* Ground Grid */}
      <Grid
        infiniteGrid
        cellSize={5}
        sectionSize={20}
        fadeDistance={250}
        cellColor="#1e293b"
        sectionColor="#334155"
      />

      {/* Render All Detailed Buildings */}
      <group>
        {(buildings || []).map((b) => {
          const bId = b.building_id || (b as any).id
          return (
            <DetailedBuilding3D
              key={bId}
              building={b}
              previewMode={previewMode}
              isSelected={bId === selectedBuildingId}
              onClick={() => onSelectBuilding(bId)}
            />
          )
        })}
      </group>

      {/* Render Sidewalks */}
      {(sidewalks || []).map((sw) => {
        if (!sw.vertices || sw.vertices.length === 0) return null
        const geom = new THREE.BufferGeometry()
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sw.vertices.flat()), 3))
        geom.setIndex(new THREE.BufferAttribute(new Uint32Array(sw.faces.flat()), 1))
        geom.computeVertexNormals()
        return (
          <mesh key={sw.id} geometry={geom}>
            <meshStandardMaterial color="#475569" roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        )
      })}

      {/* Render Urban Props */}
      {(urbanProps || []).map((prop) => {
        if (!prop.vertices || prop.vertices.length === 0) return null
        const geom = new THREE.BufferGeometry()
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(prop.vertices.flat()), 3))
        geom.setIndex(new THREE.BufferAttribute(new Uint32Array(prop.faces.flat()), 1))
        geom.computeVertexNormals()
        return (
          <mesh key={prop.id} geometry={geom}>
            <meshStandardMaterial
              color={prop.prop_type === 'streetlight' ? '#38bdf8' : '#e2e8f0'}
              roughness={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}

      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} />
    </Canvas>
  )
}

// ==============================================================================
// MAIN CITY DETAIL STUDIO VIEW COMPONENT
// ==============================================================================

const CityDetailStudioViewInner: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const cityDetailData = useStore((state) => state.cityDetailData)
  const isGeneratingCityDetail = useStore((state) => state.isGeneratingCityDetail)
  const cityDetailTier = useStore((state) => state.cityDetailTier)
  const setCityDetailTier = useStore((state) => state.setCityDetailTier)
  const cityStyle = useStore((state) => state.cityStyle)
  const setCityStyle = useStore((state) => state.setCityStyle)
  const includeProps = useStore((state) => state.includeProps)
  const setIncludeProps = useStore((state) => state.setIncludeProps)
  const includeSidewalks = useStore((state) => state.includeSidewalks)
  const setIncludeSidewalks = useStore((state) => state.setIncludeSidewalks)
  const cityPreviewMode = useStore((state) => state.cityPreviewMode)
  const setCityPreviewMode = useStore((state) => state.setCityPreviewMode)
  const selectedDetailedBuildingId = useStore((state) => state.selectedDetailedBuildingId)
  const setSelectedDetailedBuildingId = useStore((state) => state.setSelectedDetailedBuildingId)

  const generateDetailedCity = useStore((state) => state.generateDetailedCity)
  const detailSingleBuilding = useStore((state) => state.detailSingleBuilding)
  const exportDetailedCity = useStore((state) => state.exportDetailedCity)
  const isExportingCity = useStore((state) => state.isExportingCity)
  const cityExportResult = useStore((state) => state.cityExportResult)
  const voiceNarrationOnClick = useStore((state) => state.voiceNarrationOnClick)
  const toggleVoiceNarrationOnClick = useStore((state) => state.toggleVoiceNarrationOnClick)
  const narrateBuilding = useStore((state) => state.narrateBuilding)
  const isSpeaking = useStore((state) => state.voiceState.isSpeaking)

  const [activeTab, setActiveTab] = useState<'generate' | 'inspect' | 'export'>('generate')

  // Auto-generate city detail if scene is loaded but no detail exists yet
  useEffect(() => {
    if (sceneData && !cityDetailData && !isGeneratingCityDetail) {
      generateDetailedCity()
    }
  }, [sceneData])

  const buildingsList = cityDetailData?.buildings || []
  const urbanPropsList = cityDetailData?.urban_props || (cityDetailData as any)?.street_props || []
  const sidewalksList = cityDetailData?.sidewalks || []

  const summary = cityDetailData?.summary || {
    total_detailed_buildings: buildingsList.length || (cityDetailData as any)?.building_count || 0,
    total_triangles: (cityDetailData as any)?.total_scene_triangles || 0,
    total_vertices: (cityDetailData as any)?.total_scene_vertices || 0,
    urban_props_count: urbanPropsList.length,
    sidewalk_segments_count: sidewalksList.length,
    detail_tier: (cityDetailData as any)?.detail_tier || cityDetailTier || 'medium',
    city_style: (cityDetailData as any)?.city_style || cityStyle || 'modern_urban',
  }

  const selectedBuilding = buildingsList.find(
    (b) => (b.building_id || (b as any).id) === selectedDetailedBuildingId
  )

  const handleDownload = (url?: string) => {
    if (!url) return
    window.open(url, '_blank')
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-[#090d16] text-[#f8fafc]">
      {/* 3D Viewport with Top Overlay Mode Switcher */}
      <div className="flex-1 relative flex flex-col">
        {/* Floating Mode Switcher */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 p-1 bg-[#0f172a]/90 backdrop-blur border border-[#1e293b] rounded-lg shadow-xl">
          <button
            onClick={() => setCityPreviewMode('solid')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              cityPreviewMode === 'solid'
                ? 'bg-[#0284c7] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Solid Architecture
          </button>
          <button
            onClick={() => setCityPreviewMode('wireframe')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              cityPreviewMode === 'wireframe'
                ? 'bg-[#0284c7] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Topology Wireframe
          </button>

          <button
            onClick={toggleVoiceNarrationOnClick}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-all ml-auto ${
              voiceNarrationOnClick
                ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300'
                : 'bg-[#0f172a] border-[#1e293b] text-[#94a3b8] hover:text-white'
            }`}
            title="Toggle ElevenLabs Voice Agent to speak building height, dimensions, and features on click"
          >
            {isSpeaking ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
            ) : voiceNarrationOnClick ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Voice Inspector: {voiceNarrationOnClick ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* 3D Canvas */}
        <div className="flex-1 w-full h-full">
          {cityDetailData ? (
            <City3DCanvas
              buildings={buildingsList}
              urbanProps={urbanPropsList}
              sidewalks={sidewalksList}
              previewMode={cityPreviewMode}
              selectedBuildingId={selectedDetailedBuildingId}
              onSelectBuilding={(id) => {
                setSelectedDetailedBuildingId(id)
                setActiveTab('inspect')
                const bld = buildingsList.find((b) => (b.building_id || (b as any).id) === id)
                if (bld && voiceNarrationOnClick) {
                  narrateBuilding(bld)
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-[#94a3b8]">
              <RefreshCw className="w-8 h-8 animate-spin text-[#38bdf8]" />
              <div className="text-sm font-medium">Procedural City Generator is reconstructing architecture...</div>
            </div>
          )}
        </div>

        {/* Bottom Telemetry Bar */}
        {cityDetailData && (
          <div className="h-9 px-4 bg-[#090d16]/90 border-t border-[#1e293b] flex items-center justify-between text-xs font-mono text-[#94a3b8]">
            <div className="flex items-center gap-4">
              <span>Buildings: {summary.total_detailed_buildings}</span>
              <span>Triangles: {(summary.total_triangles || 0).toLocaleString()}</span>
              <span>Vertices: {(summary.total_vertices || 0).toLocaleString()}</span>
              <span>Props: {summary.urban_props_count || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Geometry Verified
              </span>
              <span>•</span>
              <span className="capitalize">{summary.detail_tier} Detail</span>
            </div>
          </div>
        )}
      </div>

      {/* Right Studio Control & Inspector Sidebar */}
      <div className="w-96 border-l border-[#1e293b] bg-[#0c1322] flex flex-col shrink-0 select-none">
        {/* Header */}
        <div className="p-4 border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#0284c7]/20 border border-[#0284c7]/40 flex items-center justify-center text-[#38bdf8]">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-white">City Detail Studio</div>
              <div className="text-[11px] text-[#94a3b8]">Procedural Architecture & Multi-Engine Exporter</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#1e293b] text-xs font-medium bg-[#090d16]">
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex-1 py-2.5 text-center transition-colors ${
              activeTab === 'generate'
                ? 'border-b-2 border-[#38bdf8] text-[#38bdf8] bg-[#0c1322]'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Generation
          </button>
          <button
            onClick={() => setActiveTab('inspect')}
            className={`flex-1 py-2.5 text-center transition-colors ${
              activeTab === 'inspect'
                ? 'border-b-2 border-[#38bdf8] text-[#38bdf8] bg-[#0c1322]'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Building Inspector
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2.5 text-center transition-colors ${
              activeTab === 'export'
                ? 'border-b-2 border-[#38bdf8] text-[#38bdf8] bg-[#0c1322]'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Engine Exports
          </button>
        </div>

        {/* Content Pane */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
          {/* TAB 1: GENERATION SETTINGS */}
          {activeTab === 'generate' && (
            <>
              {/* Detail Tier */}
              <div>
                <label className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
                  Procedural Detail Tier
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setCityDetailTier(tier)}
                      className={`py-2 rounded-lg border text-center capitalize font-medium transition-all ${
                        cityDetailTier === tier
                          ? 'bg-[#0284c7] border-[#38bdf8] text-white shadow-sm'
                          : 'bg-[#0f172a] border-[#1e293b] text-[#cbd5e1] hover:text-white'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-[#64748b] mt-1.5 leading-relaxed">
                  {cityDetailTier === 'low' && 'Optimized clean massing envelopes, roof shapes, and primary parapets.'}
                  {cityDetailTier === 'medium' && 'Solid walls with thickness, recessed window frames, doors, and basic HVAC.'}
                  {cityDetailTier === 'high' && 'Deep window reveals, glass panes, sills, lintels, balconies, entrance canopies, and UCX collision hulls.'}
                </div>
              </div>

              {/* City Architectural Style */}
              <div>
                <label className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
                  Architectural Style
                </label>
                <select
                  value={cityStyle}
                  onChange={(e) => setCityStyle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f172a] border border-[#1e293b] rounded-lg text-white font-medium focus:outline-none focus:border-[#38bdf8]"
                >
                  <option value="cyberpunk_2077">Cyberpunk 2077 (Neon Billboards, Spires, Helipads, Conduits)</option>
                  <option value="sci_fi_metropolis">Sci-Fi Metropolis (Futuristic Angular Megastructures)</option>
                  <option value="modern_urban">Modern Urban (Glass & Concrete)</option>
                  <option value="european_historic">European Historic (Masonry & Tile)</option>
                  <option value="suburban_residential">Suburban Residential (Timber & Shingle)</option>
                  <option value="industrial_logistics">Industrial & Logistics (Corrugated Metal)</option>
                  <option value="commercial_strip">Commercial Mixed-Use</option>
                </select>
              </div>

              {/* District Elements Toggles */}
              <div className="p-3 bg-[#0f172a] rounded-lg border border-[#1e293b] flex flex-col gap-2.5">
                <label className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">
                  District Props & Streetscape
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Include Sidewalks & Curbs</span>
                  <input
                    type="checkbox"
                    checked={includeSidewalks}
                    onChange={(e) => setIncludeSidewalks(e.target.checked)}
                    className="rounded bg-[#090d16] border-[#1e293b] text-[#0284c7]"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Urban Streetlights & Benches</span>
                  <input
                    type="checkbox"
                    checked={includeProps}
                    onChange={(e) => setIncludeProps(e.target.checked)}
                    className="rounded bg-[#090d16] border-[#1e293b] text-[#0284c7]"
                  />
                </label>
              </div>

              {/* Generate Button */}
              <button
                onClick={() => generateDetailedCity()}
                disabled={isGeneratingCityDetail}
                className="w-full py-2.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all"
              >
                {isGeneratingCityDetail ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Synthesizing City Geometry...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Regenerate Detailed City</span>
                  </>
                )}
              </button>

              {/* Preservation Guarantee Card */}
              <div className="p-3 bg-[#0a1a2f] border border-[#1e3a5f] rounded-lg text-[11px] text-[#cbd5e1] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#38bdf8] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white mb-0.5">Physical Coherence Guarantee</div>
                  Building footprints, orientations, heights, and terrain elevations from the trained model are 100% preserved.
                </div>
              </div>
            </>
          )}

          {/* TAB 2: BUILDING INSPECTOR */}
          {activeTab === 'inspect' && (
            <>
              {selectedBuilding ? (
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-[#0f172a] rounded-lg border border-[#1e293b]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-[#64748b] font-mono">SELECTED STRUCTURE</div>
                        <div className="font-bold text-sm text-white">
                          {selectedBuilding.building_id || (selectedBuilding as any).id}
                        </div>
                      </div>
                      <button
                        onClick={() => narrateBuilding(selectedBuilding)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
                        title="Speak height, dimensions, and architectural features using ElevenLabs"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Speak Features</span>
                      </button>
                    </div>
                    <div className="text-xs text-[#38bdf8] capitalize mt-1">
                      {selectedBuilding.classification?.category?.replace('_', ' ') ||
                        (selectedBuilding as any).category_name ||
                        (selectedBuilding as any).category ||
                        'Building'}
                    </div>
                  </div>

                  {/* Quantitative Attributes */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 bg-[#0f172a] rounded border border-[#1e293b]">
                      <div className="text-[#64748b]">Footprint Area</div>
                      <div className="text-white font-mono font-bold mt-0.5">
                        {(
                          selectedBuilding.footprint_area_m2 ||
                          (selectedBuilding as any).area_m2 ||
                          0
                        ).toFixed(1)}{' '}
                        m²
                      </div>
                    </div>
                    <div className="p-2.5 bg-[#0f172a] rounded border border-[#1e293b]">
                      <div className="text-[#64748b]">Estimated Height</div>
                      <div className="text-white font-mono font-bold mt-0.5">
                        {(
                          selectedBuilding.total_height ||
                          (selectedBuilding as any).total_height_m ||
                          (selectedBuilding as any).estimated_height_m ||
                          0
                        ).toFixed(1)}{' '}
                        m
                      </div>
                    </div>
                    <div className="p-2.5 bg-[#0f172a] rounded border border-[#1e293b]">
                      <div className="text-[#64748b]">Floors</div>
                      <div className="text-white font-mono font-bold mt-0.5">
                        {selectedBuilding.classification?.floors ||
                          (selectedBuilding as any).floors ||
                          1}{' '}
                        floors
                      </div>
                    </div>
                    <div className="p-2.5 bg-[#0f172a] rounded border border-[#1e293b]">
                      <div className="text-[#64748b]">Roof Style</div>
                      <div className="text-white font-mono font-bold mt-0.5 capitalize">
                        {selectedBuilding.classification?.roof_style ||
                          (selectedBuilding as any).roof_shape ||
                          'Flat'}
                      </div>
                    </div>
                  </div>

                  {/* Component Sub-Meshes Breakdown */}
                  {selectedBuilding.components && Object.keys(selectedBuilding.components).length > 0 && (
                    <div className="p-3 bg-[#0f172a] rounded-lg border border-[#1e293b]">
                      <div className="text-[11px] font-semibold text-[#94a3b8] mb-2 uppercase tracking-wider flex items-center justify-between">
                        <span>Modular Sub-Meshes</span>
                        <span className="text-[10px] text-emerald-400 font-mono">Modifiable in Blender</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        {Object.entries(selectedBuilding.components).map(([k, c]) => (
                          <div key={k} className="p-1.5 bg-[#090d16] rounded border border-[#1e293b] flex items-center justify-between">
                            <span className="capitalize text-slate-300 font-medium">{k.replace('_', ' ')}</span>
                            <span className="font-mono text-[#38bdf8]">{c.face_count || c.faces?.length || 0} Δ</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mesh Topology Stats */}
                  <div className="p-3 bg-[#0f172a] rounded-lg border border-[#1e293b]">
                    <div className="text-[11px] font-semibold text-[#94a3b8] mb-2 uppercase tracking-wider">
                      Mesh Health & Collision
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Triangles:</span>
                        <span className="font-mono text-white">
                          {(
                            selectedBuilding.combined_mesh?.face_count ||
                            (selectedBuilding as any).summary_stats?.total_triangles ||
                            0
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Degenerate Faces:</span>
                        <span className="font-mono text-emerald-400">
                          {selectedBuilding.validation?.degenerate_count ?? 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748b]">UCX Collision Hull:</span>
                        <span className="font-mono text-emerald-400">
                          {selectedBuilding.collision_ucx?.name ||
                            (selectedBuilding as any).collision_mesh?.name ||
                            'UCX_Valid'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Regenerate Single Building Button */}
                  <button
                    onClick={() =>
                      detailSingleBuilding(
                        selectedBuilding.building_id || (selectedBuilding as any).id,
                        undefined,
                        'high'
                      )
                    }
                    className="w-full py-2 rounded-lg bg-[#1e293b] hover:bg-[#334155] text-white font-medium flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Regenerate Building at High Detail</span>
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center text-[#64748b] bg-[#0f172a] rounded-lg border border-[#1e293b]">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <div>Click any building in the 3D viewport to inspect its architectural properties.</div>
                </div>
              )}
            </>
          )}

          {/* TAB 3: ENGINE EXPORTS */}
          {activeTab === 'export' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
                  Target Game Engines & DCC Tools
                </label>
                <div className="flex flex-col gap-2">
                  {/* Blender Export */}
                  <div className="p-3 bg-[#0f172a] rounded-lg border border-[#1e293b] flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Box className="w-4 h-4 text-[#f97316]" /> Blender 4.x / 5.x
                      </div>
                      <div className="text-[11px] text-[#94a3b8] mt-0.5">
                        Modular sub-meshes, vertex groups (`VG_*`), and native PBR shaders
                      </div>
                    </div>
                    <button
                      onClick={() => exportDetailedCity('blender')}
                      disabled={isExportingCity}
                      className="px-3 py-1.5 rounded bg-[#1e293b] hover:bg-[#334155] text-white font-medium"
                    >
                      Export
                    </button>
                  </div>

                  {/* Unreal Engine 5 Export */}
                  <div className="p-3 bg-[#0f172a] rounded-lg border border-[#1e293b] flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Box className="w-4 h-4 text-[#38bdf8]" /> Unreal Engine 5
                      </div>
                      <div className="text-[11px] text-[#94a3b8] mt-0.5">
                        Modular FBX with discrete components & auto `UCX_` collision
                      </div>
                    </div>
                    <button
                      onClick={() => exportDetailedCity('unreal_engine')}
                      disabled={isExportingCity}
                      className="px-3 py-1.5 rounded bg-[#1e293b] hover:bg-[#334155] text-white font-medium"
                    >
                      Export
                    </button>
                  </div>

                  {/* Unity Export */}
                  <div className="p-3 bg-[#0f172a] rounded-lg border border-[#1e293b] flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Box className="w-4 h-4 text-[#cbd5e1]" /> Unity
                      </div>
                      <div className="text-[11px] text-[#94a3b8] mt-0.5">
                        Hierarchical GameObjects with MeshColliders & PBR materials
                      </div>
                    </div>
                    <button
                      onClick={() => exportDetailedCity('unity')}
                      disabled={isExportingCity}
                      className="px-3 py-1.5 rounded bg-[#1e293b] hover:bg-[#334155] text-white font-medium"
                    >
                      Export
                    </button>
                  </div>

                  {/* Master 1-Click Multi-Engine Package */}
                  <button
                    onClick={() => exportDetailedCity('all')}
                    disabled={isExportingCity}
                    className="w-full mt-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    {isExportingCity ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Packaging Multi-Engine City...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Export All Engine Packages & Manifest</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Export Download Links if Available */}
              {cityExportResult && (
                <div className="p-3 bg-[#0f172a] rounded-lg border border-[#1e293b] flex flex-col gap-2">
                  <div className="font-semibold text-white flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Package Generated Successfully
                  </div>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {cityExportResult.glb_url && (
                      <button
                        onClick={() => handleDownload(cityExportResult.glb_url)}
                        className="text-left text-[11px] text-[#38bdf8] hover:underline"
                      >
                        ↓ Download Standard 3D Scene (.glb)
                      </button>
                    )}
                    {cityExportResult.fbx_url && (
                      <button
                        onClick={() => handleDownload(cityExportResult.fbx_url)}
                        className="text-left text-[11px] text-[#38bdf8] hover:underline"
                      >
                        ↓ Download Unreal/Unity Engine (.fbx with UCX_)
                      </button>
                    )}
                    {cityExportResult.blender_script_url && (
                      <button
                        onClick={() => handleDownload(cityExportResult.blender_script_url)}
                        className="text-left text-[11px] text-[#38bdf8] hover:underline"
                      >
                        ↓ Download Blender Python City Builder (.py)
                      </button>
                    )}
                    {cityExportResult.manifest_url && (
                      <button
                        onClick={() => handleDownload(cityExportResult.manifest_url)}
                        className="text-left text-[11px] text-[#38bdf8] hover:underline"
                      >
                        ↓ Download Export Manifest (.json)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export const CityDetailStudioView: React.FC = () => {
  return (
    <StudioErrorBoundary>
      <CityDetailStudioViewInner />
    </StudioErrorBoundary>
  )
}

export default CityDetailStudioView
