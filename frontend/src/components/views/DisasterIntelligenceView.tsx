import React, { useState, useEffect, useRef } from 'react'
import {
  ShieldAlert,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Building2,
  Layers,
  Download,
  RotateCcw,
  Play,
  ArrowRight,
  TrendingDown,
  Info,
  Sliders,
  FileJson,
  Crosshair,
  Upload,
  SplitSquareVertical,
  Columns,
  Eye,
  Check,
  X,
  Sparkles,
  Trees
} from 'lucide-react'
import { useStore } from '../../store/useStore'

interface AssessedBuilding {
  building_id: string
  damage_class: number
  damage_label: string
  severity: string
  change_summary?: string
  pre_height_m: number
  post_height_m: number
  delta_height_m: number
  collapse_percentage: number
  footprint_area_m2: number
  debris_volume_m3: number
  debris_uncertainty_m3: number
  confidence_score: number
  roughness_metric: number
  polygon_px: [number, number][]
  center_px: [number, number]
  building_type: string
  quality_flags: string[]
}

interface DisasterReport {
  assessment_id: string
  timestamp: number
  gsd_m: number
  pre_image_url?: string
  post_image_url?: string
  scene_dimensions_px: { width: number; height: number }
  scene_coverage_m: { width: number; height: number }
  summary_kpis: {
    total_buildings_assessed: number
    total_damaged_structures: number
    overall_damage_rate_pct: number
    destroyed_count: number
    major_damage_count: number
    minor_damage_count: number
    no_damage_count: number
    total_debris_volume_m3: number
    debris_volume_uncertainty_m3: number
    rubble_bulking_factor: number
    emergency_priority: 'CRITICAL' | 'HIGH' | 'STANDARD'
    environmental_impact?: {
      total_scene_area_m2: number
      mudflow_debris_area_m2: number
      mudflow_increase_pct: number
      vegetation_loss_m2: number
      vegetation_loss_pct: number
      water_channel_shift_m2: number
      environmental_summary: string
    }
  }
  environmental_impact?: {
    total_scene_area_m2: number
    mudflow_debris_area_m2: number
    mudflow_increase_pct: number
    vegetation_loss_m2: number
    vegetation_loss_pct: number
    water_channel_shift_m2: number
    environmental_summary: string
  }
  assessed_buildings: AssessedBuilding[]
  geojson: any
  geojson_url?: string
  report_url?: string
  scientific_methodology: {
    damage_standard: string
    height_collapse_model: string
    volumetric_formulation: string
    assumptions_and_limitations: string[]
  }
}

export const DisasterIntelligenceView: React.FC = () => {
  const currentJobId = useStore((state) => state.currentJobId)
  const sceneData = useStore((state) => state.sceneData)

  const [report, setReport] = useState<DisasterReport | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<AssessedBuilding | null>(null)
  const [filterClass, setFilterClass] = useState<number | 'all'>('all')
  const [bulkingFactor, setBulkingFactor] = useState<number>(1.30)

  // Upload pair states
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false)
  const [preFile, setPreFile] = useState<File | null>(null)
  const [postFile, setPostFile] = useState<File | null>(null)
  const [prePreview, setPrePreview] = useState<string | null>(null)
  const [postPreview, setPostPreview] = useState<string | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<string>('japan_scene')

  // Visual comparison mode
  const [visualMode, setVisualMode] = useState<'side_by_side' | 'split_slider' | 'table_only'>('side_by_side')
  const [sliderPos, setSliderPos] = useState<number>(50)
  const [showDamageMasks, setShowDamageMasks] = useState<boolean>(true)

  const preInputRef = useRef<HTMLInputElement>(null)
  const postInputRef = useRef<HTMLInputElement>(null)

  // Load latest assessment on mount if available
  useEffect(() => {
    fetchLatestAssessment()
  }, [])

  const fetchLatestAssessment = async () => {
    try {
      const res = await fetch('/api/disaster/history')
      if (res.ok) {
        const history = await res.json()
        if (history && history.length > 0) {
          const latestId = history[history.length - 1].assessment_id
          const detRes = await fetch(`/api/disaster/${latestId}`)
          if (detRes.ok) {
            const data = await detRes.json()
            setReport(data)
            if (data.assessed_buildings?.length > 0) {
              setSelectedBuilding(data.assessed_buildings[0])
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not load disaster history:', e)
    }
  }

  const handlePreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      setPreFile(f)
      setPrePreview(URL.createObjectURL(f))
    }
  }

  const handlePostFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      setPostFile(f)
      setPostPreview(URL.createObjectURL(f))
    }
  }

  const runAssessment = async () => {
    setLoading(true)
    setError(null)
    setShowUploadModal(false)

    try {
      const formData = new FormData()

      if (preFile) {
        formData.append('pre_file', preFile)
      } else if (currentJobId && sceneData) {
        formData.append('pre_job_id', currentJobId)
      } else if (selectedPreset === 'jacksonville') {
        formData.append('pre_sample_id', 'jacksonville_aerial')
      } else {
        formData.append('pre_sample_id', 'sapporo_district')
      }

      if (postFile) {
        formData.append('post_file', postFile)
      }

      formData.append('gsd_m', (sceneData?.gsd_m ?? 0.35).toString())
      formData.append('bulking_factor', bulkingFactor.toString())

      const res = await fetch('/api/disaster/assess', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || `Server returned ${res.status}`)
      }

      const data = await res.json()
      setReport(data)
      if (data.assessed_buildings?.length > 0) {
        setSelectedBuilding(data.assessed_buildings[0])
      }
    } catch (err: any) {
      setError(err.message || 'Assessment execution failed.')
    } finally {
      setLoading(false)
    }
  }

  const kpis = report?.summary_kpis

  const filteredBuildings = report?.assessed_buildings.filter((b) => {
    if (filterClass === 'all') return true
    return b.damage_class === filterClass
  }) ?? []

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'High':
        return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'Moderate':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
  }

  const getColorByClass = (damage_class: number) => {
    switch (damage_class) {
      case 3:
        return 'rgba(239, 68, 68, 0.65)' // Red
      case 2:
        return 'rgba(249, 115, 22, 0.60)' // Orange
      case 1:
        return 'rgba(245, 158, 11, 0.50)' // Yellow
      default:
        return 'rgba(16, 185, 129, 0.40)' // Green
    }
  }

  const getStrokeByClass = (damage_class: number) => {
    switch (damage_class) {
      case 3:
        return '#DC2626'
      case 2:
        return '#EA580C'
      case 1:
        return '#D97706'
      default:
        return '#059669'
    }
  }

  // Pre and Post image sources
  const preImgSrc = prePreview || report?.pre_image_url || sceneData?.image_url || '/sample_data/sapporo_district.jpg'
  const postImgSrc = postPreview || report?.post_image_url || '/uploads/8736cf05-3701-4ae8-b446-3ad7a7335e62_DisasterImage2.jpeg'

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F5F6F3] overflow-y-auto select-none">
      {/* Top Banner & Control Toolbar */}
      <div className="bg-white border-b border-[#DCE2DC] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-red-100 text-red-700 border border-red-200">
              <ShieldAlert className="w-5 h-5 stroke-[2]" />
            </span>
            <h1 className="text-base font-semibold text-[#17231F] tracking-tight">
              Disaster Intelligence & Structural Damage Assessment
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-[#286653] text-white">
              xBD STANDARD
            </span>
          </div>
          <p className="text-xs text-[#68736D] mt-0.5">
            Accepts Before & After satellite imagery, computes building height collapse (ΔH), and quantifies rubble volume (m³).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#F5F6F3] p-0.5 rounded border border-[#DCE2DC]">
            <button
              onClick={() => setVisualMode('side_by_side')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded font-medium transition-all ${
                visualMode === 'side_by_side'
                  ? 'bg-white text-[#286653] shadow-xs'
                  : 'text-[#68736D] hover:text-[#17231F]'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>
            <button
              onClick={() => setVisualMode('split_slider')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded font-medium transition-all ${
                visualMode === 'split_slider'
                  ? 'bg-white text-[#286653] shadow-xs'
                  : 'text-[#68736D] hover:text-[#17231F]'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Swipe Comparison</span>
            </button>
          </div>

          {/* Upload Pair Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[#DCE2DC] bg-white text-[#17231F] hover:bg-[#F9FAF9] shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-[#286653]" />
            <span>Select Before & After Images</span>
          </button>

          {/* Bulking Factor Setting */}
          <div className="flex items-center gap-1.5 bg-[#F5F6F3] px-2.5 py-1 rounded border border-[#DCE2DC]" title="Volumetric expansion factor for loose rubble (FEMA standard is 1.3)">
            <span className="text-[11px] text-[#68736D] font-mono">Bulking:</span>
            <input
              type="number"
              step="0.05"
              min="1.0"
              max="2.0"
              value={bulkingFactor}
              onChange={(e) => setBulkingFactor(parseFloat(e.target.value) || 1.30)}
              className="w-10 text-xs font-mono font-medium bg-transparent text-[#17231F] text-center outline-none"
            />
          </div>

          {/* Run Button */}
          <button
            onClick={runAssessment}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-medium text-white transition-all shadow-sm ${
              loading
                ? 'bg-[#68736D] cursor-not-allowed'
                : 'bg-[#286653] hover:bg-[#1E4D3E] active:scale-[0.98]'
            }`}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Comparing & Calculating...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Assessment</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Body */}
      <div className="p-6 space-y-6">
        {/* KPI Scorecards: How Many Buildings Have Fallen & Total Debris */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-white p-3 rounded-lg border border-[#DCE2DC] shadow-xs">
              <div className="text-[11px] font-medium text-[#68736D] uppercase tracking-wider">
                Assessed Buildings
              </div>
              <div className="text-xl font-bold text-[#17231F] mt-1">
                {kpis.total_buildings_assessed}
              </div>
              <div className="text-[10px] text-[#68736D] mt-0.5">
                {report?.scene_coverage_m ? `${report.scene_coverage_m.width}m × ${report.scene_coverage_m.height}m area` : 'Full scene coverage'}
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg border border-red-200 bg-red-50/30 shadow-xs">
              <div className="text-[11px] font-medium text-red-700 uppercase tracking-wider flex items-center justify-between">
                <span>Destroyed (L3)</span>
                <Flame className="w-3.5 h-3.5 text-red-600" />
              </div>
              <div className="text-xl font-bold text-red-700 mt-1">
                {kpis.destroyed_count}
              </div>
              <div className="text-[10px] text-red-600 mt-0.5">
                {kpis.total_buildings_assessed > 0 ? Math.round((kpis.destroyed_count / kpis.total_buildings_assessed) * 100) : 0}% of buildings fell
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg border border-orange-200 bg-orange-50/30 shadow-xs">
              <div className="text-[11px] font-medium text-orange-700 uppercase tracking-wider">
                Major Damage (L2)
              </div>
              <div className="text-xl font-bold text-orange-700 mt-1">
                {kpis.major_damage_count}
              </div>
              <div className="text-[10px] text-orange-600 mt-0.5">
                {kpis.total_buildings_assessed > 0 ? Math.round((kpis.major_damage_count / kpis.total_buildings_assessed) * 100) : 0}% severely broken
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg border border-amber-200 bg-amber-50/30 shadow-xs">
              <div className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">
                Minor Damage (L1)
              </div>
              <div className="text-xl font-bold text-amber-700 mt-1">
                {kpis.minor_damage_count}
              </div>
              <div className="text-[10px] text-amber-600 mt-0.5">
                Superficial roof debris
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg border border-emerald-200 bg-emerald-50/30 shadow-xs">
              <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider flex items-center justify-between">
                <span>Intact (L0)</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {kpis.no_damage_count}
              </div>
              <div className="text-[10px] text-emerald-600 mt-0.5">
                No height lost, habitable
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg border border-[#DCE2DC] shadow-xs">
              <div className="text-[11px] font-medium text-[#68736D] uppercase tracking-wider">
                Debris Volume
              </div>
              <div className="text-xl font-bold text-[#17231F] mt-1">
                {kpis.total_debris_volume_m3.toLocaleString()} <span className="text-xs font-normal text-[#68736D]">m³</span>
              </div>
              <div className="text-[10px] text-[#68736D] mt-0.5">
                ± {kpis.debris_volume_uncertainty_m3.toLocaleString()} m³ rubble
              </div>
            </div>
          </div>
        )}

        {/* Environmental & Landscape Impact Analysis */}
        {report?.environmental_impact && (
          <div className="bg-white rounded-lg border border-[#DCE2DC] p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9E5]">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  <Trees className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-semibold text-[#17231F] uppercase tracking-wide">
                    Environmental & Landscape Impact Analysis
                  </h3>
                  <p className="text-[11px] text-[#68736D]">
                    Terrain-scale landcover change, landslide/mudflow deposition, forest loss, and hydrological displacement.
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                SURFACE TELEMETRY
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
              <div className="p-2.5 rounded bg-[#FAFBF9] border border-[#E5E9E5]">
                <div className="text-[10px] uppercase font-medium text-[#68736D]">
                  Mudflow / Landslide Debris Area
                </div>
                <div className="text-base font-bold text-amber-900 mt-0.5">
                  +{report.environmental_impact.mudflow_debris_area_m2.toLocaleString()} m²
                </div>
                <div className="text-[10px] text-amber-700 mt-0.5">
                  +{report.environmental_impact.mudflow_increase_pct}% terrain coverage
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#FAFBF9] border border-[#E5E9E5]">
                <div className="text-[10px] uppercase font-medium text-[#68736D]">
                  Forest & Vegetation Canopy Loss
                </div>
                <div className="text-base font-bold text-emerald-900 mt-0.5">
                  -{report.environmental_impact.vegetation_loss_m2.toLocaleString()} m²
                </div>
                <div className="text-[10px] text-emerald-700 mt-0.5">
                  -{report.environmental_impact.vegetation_loss_pct}% canopy destroyed
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#FAFBF9] border border-[#E5E9E5]">
                <div className="text-[10px] uppercase font-medium text-[#68736D]">
                  River Corridor / Hydrology Impact
                </div>
                <div className="text-base font-bold text-blue-900 mt-0.5">
                  {report.environmental_impact.water_channel_shift_m2.toLocaleString()} m²
                </div>
                <div className="text-[10px] text-blue-700 mt-0.5">
                  Channel displaced / sediment-choked
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#FAFBF9] border border-[#E5E9E5]">
                <div className="text-[10px] uppercase font-medium text-[#68736D]">
                  Total Evaluated Landscape
                </div>
                <div className="text-base font-bold text-[#17231F] mt-0.5">
                  {report.environmental_impact.total_scene_area_m2.toLocaleString()} m²
                </div>
                <div className="text-[10px] text-[#68736D] mt-0.5">
                  {(report.environmental_impact.total_scene_area_m2 / 10000).toFixed(1)} hectares surveyed
                </div>
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded bg-amber-50/60 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>{report.environmental_impact.environmental_summary}</span>
            </div>
          </div>
        )}

        {/* Visual Dual-Pane Comparison Area */}
        <div className="bg-white rounded-lg border border-[#DCE2DC] p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#286653]" />
              <span className="text-xs font-semibold text-[#17231F]">
                Visual Disaster Impact Comparison (Pre vs Post Event)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-[#68736D] cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDamageMasks}
                  onChange={(e) => setShowDamageMasks(e.target.checked)}
                  className="rounded border-[#DCE2DC] text-[#286653] focus:ring-0"
                />
                <span>Overlay Damage Polygons</span>
              </label>

              {visualMode === 'split_slider' && (
                <div className="flex items-center gap-2 text-xs text-[#68736D]">
                  <span>Before</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliderPos}
                    onChange={(e) => setSliderPos(parseInt(e.target.value))}
                    className="w-32 accent-[#286653]"
                  />
                  <span>After</span>
                </div>
              )}
            </div>
          </div>

          {/* Image Canvas Container */}
          {visualMode === 'side_by_side' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: BEFORE DISASTER */}
              <div className="relative rounded border border-[#DCE2DC] overflow-hidden bg-slate-900 group">
                <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono tracking-wider backdrop-blur-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  BEFORE DISASTER (PRE-EVENT)
                </div>
                <img
                  src={preImgSrc}
                  alt="Pre-disaster optical baseline"
                  className="w-full h-80 object-cover object-center"
                />
                {/* SVG Overlay of Pre-Footprints */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-auto"
                  viewBox={`0 0 ${report?.scene_dimensions_px.width || 1000} ${report?.scene_dimensions_px.height || 1000}`}
                  preserveAspectRatio="none"
                >
                  {report?.assessed_buildings.map((b) => {
                    const isSelected = selectedBuilding?.building_id === b.building_id
                    const points = b.polygon_px.map((p) => `${p[0]},${p[1]}`).join(' ')
                    return (
                      <polygon
                        key={b.building_id}
                        points={points}
                        onClick={() => setSelectedBuilding(b)}
                        fill={isSelected ? 'rgba(40, 102, 83, 0.45)' : 'rgba(59, 130, 246, 0.15)'}
                        stroke={isSelected ? '#286653' : '#3B82F6'}
                        strokeWidth={isSelected ? 3 : 1.5}
                        className="cursor-pointer transition-all hover:opacity-80"
                      />
                    )
                  })}
                </svg>
              </div>

              {/* Right: AFTER DISASTER */}
              <div className="relative rounded border border-[#DCE2DC] overflow-hidden bg-slate-900 group">
                <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono tracking-wider backdrop-blur-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  AFTER DISASTER (POST-EVENT DAMAGE MASK)
                </div>
                <img
                  src={postImgSrc}
                  alt="Post-disaster scene with damage assessment"
                  className="w-full h-80 object-cover object-center"
                />
                {/* SVG Overlay of Damage Polygons */}
                {showDamageMasks && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-auto"
                    viewBox={`0 0 ${report?.scene_dimensions_px.width || 1000} ${report?.scene_dimensions_px.height || 1000}`}
                    preserveAspectRatio="none"
                  >
                    {report?.assessed_buildings.map((b) => {
                      const isSelected = selectedBuilding?.building_id === b.building_id
                      const points = b.polygon_px.map((p) => `${p[0]},${p[1]}`).join(' ')
                      return (
                        <polygon
                          key={b.building_id}
                          points={points}
                          onClick={() => setSelectedBuilding(b)}
                          fill={getColorByClass(b.damage_class)}
                          stroke={isSelected ? '#FFFFFF' : getStrokeByClass(b.damage_class)}
                          strokeWidth={isSelected ? 3.5 : 1.8}
                          className="cursor-pointer transition-all hover:opacity-90"
                        />
                      )
                    })}
                  </svg>
                )}
              </div>
            </div>
          ) : (
            /* Split Swipe Slider View */
            <div className="relative rounded border border-[#DCE2DC] overflow-hidden bg-slate-900 h-84 select-none">
              <img
                src={postImgSrc}
                alt="Post-disaster"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${sliderPos}%` }}
              >
                <img
                  src={preImgSrc}
                  alt="Pre-disaster"
                  className="w-full h-full object-cover object-center"
                  style={{ width: '100%', maxWidth: 'none' }}
                />
              </div>

              {/* Slider Line */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize flex items-center justify-center shadow-lg"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="w-6 h-6 rounded-full bg-white text-[#286653] shadow-md flex items-center justify-center text-[10px] font-bold border border-[#DCE2DC]">
                  ↔
                </div>
              </div>

              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono">
                BEFORE ({sliderPos}%)
              </div>
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono">
                AFTER ({100 - sliderPos}%)
              </div>
            </div>
          )}
        </div>

        {/* Dual Layout: Interactive Building Table + Detailed Feature Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Building Assessment Inventory */}
          <div className="lg:col-span-7 bg-white rounded-lg border border-[#DCE2DC] shadow-sm flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-[#DCE2DC] flex items-center justify-between bg-[#FAFAFA]">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#286653]" />
                <span className="text-xs font-semibold text-[#17231F]">
                  Identified Structures ({filteredBuildings.length})
                </span>
              </div>

              {/* Class Filter Pills */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFilterClass('all')}
                  className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                    filterClass === 'all'
                      ? 'bg-[#286653] text-white border-[#286653]'
                      : 'bg-white text-[#68736D] border-[#DCE2DC]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterClass(3)}
                  className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                    filterClass === 3
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-red-700 border-red-200'
                  }`}
                >
                  Destroyed ({kpis?.destroyed_count || 0})
                </button>
                <button
                  onClick={() => setFilterClass(2)}
                  className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                    filterClass === 2
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-white text-orange-700 border-orange-200'
                  }`}
                >
                  Major ({kpis?.major_damage_count || 0})
                </button>
                <button
                  onClick={() => setFilterClass(0)}
                  className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                    filterClass === 0
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-emerald-700 border-emerald-200'
                  }`}
                >
                  Intact ({kpis?.no_damage_count || 0})
                </button>
              </div>
            </div>

            {/* Scrollable Table */}
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F5F6F3] text-[#68736D] uppercase text-[10px] sticky top-0 border-b border-[#DCE2DC]">
                  <tr>
                    <th className="py-2.5 px-3">Building ID</th>
                    <th className="py-2.5 px-3">Damage Level</th>
                    <th className="py-2.5 px-3 text-right">Before Hgt</th>
                    <th className="py-2.5 px-3 text-right">After Hgt</th>
                    <th className="py-2.5 px-3 text-right">Fallen (ΔH)</th>
                    <th className="py-2.5 px-3 text-right">Debris Volume</th>
                    <th className="py-2.5 px-3 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEFEA]">
                  {filteredBuildings.length > 0 ? (
                    filteredBuildings.map((b) => {
                      const isSelected = selectedBuilding?.building_id === b.building_id
                      return (
                        <tr
                          key={b.building_id}
                          onClick={() => setSelectedBuilding(b)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#E8EFEA] font-medium'
                              : 'hover:bg-[#F9FAF9]'
                          }`}
                        >
                          <td className="py-2 px-3 font-mono font-medium text-[#17231F]">
                            {b.building_id}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getSeverityBadgeClass(
                                b.severity
                              )}`}
                            >
                              {b.damage_label}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[#68736D]">
                            {b.pre_height_m.toFixed(1)}m
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[#68736D]">
                            {b.post_height_m.toFixed(1)}m
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-red-600 font-medium">
                            -{b.delta_height_m.toFixed(1)}m ({b.collapse_percentage}%)
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[#17231F]">
                            {b.debris_volume_m3.toLocaleString()} m³
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[#68736D]">
                            {Math.round(b.confidence_score * 100)}%
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-[#68736D]">
                        No assessment data available. Click "Run Assessment" above to evaluate structural changes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Detailed Building Telemetry & What Changed */}
          <div className="lg:col-span-5 space-y-4">
            {selectedBuilding ? (
              <div className="bg-white rounded-lg border border-[#DCE2DC] p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#DCE2DC]">
                  <div>
                    <div className="text-[10px] font-mono text-[#68736D] uppercase">Selected Building</div>
                    <div className="text-base font-bold text-[#17231F] font-mono">{selectedBuilding.building_id}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${getSeverityBadgeClass(selectedBuilding.severity)}`}>
                    {selectedBuilding.damage_label} ({selectedBuilding.severity})
                  </span>
                </div>

                {/* What Changed in the Appearance & Structure Box */}
                <div className="p-3 bg-[#FAF8F5] rounded border border-[#EDE8E1] space-y-1.5">
                  <div className="text-[10px] font-medium text-[#8C6D46] uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>What Changed in Appearance & Structure</span>
                  </div>
                  <p className="text-xs text-[#4A3B2C] leading-relaxed">
                    {selectedBuilding.change_summary || (
                      selectedBuilding.damage_class === 3
                        ? `Catastrophic structural collapse: lost ${selectedBuilding.delta_height_m}m of vertical height (${selectedBuilding.collapse_percentage}% collapse). Pancaked into ${selectedBuilding.debris_volume_m3.toLocaleString()} m³ of loose rubble.`
                        : `Partial structural shear failure: lost ${selectedBuilding.delta_height_m}m of roof elevation. Substantial debris scatter.`
                    )}
                  </p>
                </div>

                {/* Pre vs Post Height Visual Collapse Gauge */}
                <div>
                  <div className="flex justify-between text-xs text-[#68736D] mb-1">
                    <span>Height Collapse Gauge</span>
                    <span className="font-mono text-red-600 font-medium">-{selectedBuilding.collapse_percentage}% Lost</span>
                  </div>
                  <div className="h-4 w-full bg-[#E8EFEA] rounded overflow-hidden flex">
                    <div
                      className="bg-[#286653] h-full transition-all"
                      style={{ width: `${Math.min(100, (selectedBuilding.post_height_m / Math.max(selectedBuilding.pre_height_m, 1)) * 100)}%` }}
                      title={`Retained height: ${selectedBuilding.post_height_m}m`}
                    />
                    <div
                      className="bg-red-500 h-full transition-all"
                      style={{ width: `${Math.min(100, (selectedBuilding.delta_height_m / Math.max(selectedBuilding.pre_height_m, 1)) * 100)}%` }}
                      title={`Collapsed height: ${selectedBuilding.delta_height_m}m`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-[#68736D] mt-1">
                    <span>After: {selectedBuilding.post_height_m.toFixed(1)}m</span>
                    <span>Before: {selectedBuilding.pre_height_m.toFixed(1)}m</span>
                  </div>
                </div>

                {/* Metrics Breakdown Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-[#F9FAF9] p-3 rounded border border-[#EAEFEA]">
                  <div>
                    <div className="text-[10px] text-[#68736D]">Footprint Base Area</div>
                    <div className="font-mono font-semibold text-[#17231F]">{selectedBuilding.footprint_area_m2} m²</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#68736D]">Structural Height Fallen</div>
                    <div className="font-mono font-semibold text-red-600">ΔH = -{selectedBuilding.delta_height_m} m</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#68736D]">Rubble Debris Volume</div>
                    <div className="font-mono font-semibold text-[#17231F]">{selectedBuilding.debris_volume_m3.toLocaleString()} m³</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#68736D]">Volume Uncertainty</div>
                    <div className="font-mono font-semibold text-[#68736D]">± {selectedBuilding.debris_uncertainty_m3} m³</div>
                  </div>
                </div>

                {/* Quality Flags */}
                {selectedBuilding.quality_flags?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-medium text-[#68736D] uppercase mb-1">Detected Damage Indicators</div>
                    <div className="space-y-1">
                      {selectedBuilding.quality_flags.map((flag, idx) => (
                        <div key={idx} className="text-[11px] px-2 py-1 bg-red-50 text-red-700 rounded border border-red-200 flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>{flag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scientific Disclosure */}
                <div className="p-2.5 bg-[#EDF1EC] rounded border border-[#DCE2DC] text-[11px] text-[#286653] flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">FEMA Rubble Formulation:</span> Debris calculated via V = Area × ΔH × K (with K = {bulkingFactor} expansion coefficient).
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-[#DCE2DC] p-6 text-center text-xs text-[#68736D]">
                Select a building from the table or click its footprint on the map to view its structural change telemetry.
              </div>
            )}

            {/* GIS Export Toolbar */}
            {report && (
              <div className="bg-white rounded-lg border border-[#DCE2DC] p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#286653]" />
                  <span className="text-xs font-semibold text-[#17231F]">Export Disaster Intelligence</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`/api/disaster/export/${report.assessment_id}/geojson`}
                    download
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-[#F5F6F3] hover:bg-[#EAEFEA] text-xs font-medium text-[#17231F] border border-[#DCE2DC] transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#286653]" />
                    <span>GeoJSON Layer</span>
                  </a>
                  <a
                    href={`/api/disaster/export/${report.assessment_id}/json`}
                    download
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-[#F5F6F3] hover:bg-[#EAEFEA] text-xs font-medium text-[#17231F] border border-[#DCE2DC] transition-colors"
                  >
                    <FileJson className="w-3.5 h-3.5 text-[#286653]" />
                    <span>Incident Report</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Pair Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#DCE2DC] shadow-xl max-w-xl w-full p-6 space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE2DC]">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#286653]" />
                <h3 className="text-sm font-semibold text-[#17231F]">
                  Upload Before & After Disaster Imagery
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-[#68736D] hover:text-[#17231F] p-1 rounded hover:bg-[#F5F6F3]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Card 1: Before Image */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#17231F] block">
                  1. Pre-Disaster Imagery (Before)
                </label>
                <div
                  onClick={() => preInputRef.current?.click()}
                  className="border-2 border-dashed border-[#DCE2DC] hover:border-[#286653] rounded-lg p-3 text-center cursor-pointer bg-[#FAFAFA] hover:bg-[#F5F8F6] transition-all h-36 flex flex-col items-center justify-center overflow-hidden"
                >
                  {prePreview ? (
                    <img src={prePreview} alt="Pre preview" className="w-full h-full object-cover rounded" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-[#68736D] mb-1" />
                      <span className="text-[11px] font-medium text-[#17231F]">Choose Before File</span>
                      <span className="text-[10px] text-[#68736D]">or leave blank to use active scene</span>
                    </>
                  )}
                  <input
                    ref={preInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePreFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Card 2: After Image */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#17231F] block">
                  2. Post-Disaster Imagery (After)
                </label>
                <div
                  onClick={() => postInputRef.current?.click()}
                  className="border-2 border-dashed border-[#DCE2DC] hover:border-red-500 rounded-lg p-3 text-center cursor-pointer bg-[#FAFAFA] hover:bg-red-50/20 transition-all h-36 flex flex-col items-center justify-center overflow-hidden"
                >
                  {postPreview ? (
                    <img src={postPreview} alt="Post preview" className="w-full h-full object-cover rounded" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-red-500 mb-1" />
                      <span className="text-[11px] font-medium text-[#17231F]">Choose After File</span>
                      <span className="text-[10px] text-[#68736D]">Upload post-event satellite pass</span>
                    </>
                  )}
                  <input
                    ref={postInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePostFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="p-3 bg-[#F5F6F3] rounded border border-[#DCE2DC] space-y-1.5">
              <span className="text-[11px] font-medium text-[#17231F]">Or use verified benchmark scenario:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPreset('japan_scene')
                    setPreFile(null)
                    setPrePreview(null)
                    setPostFile(null)
                    setPostPreview(null)
                  }}
                  className={`text-left p-2 rounded border text-xs ${
                    selectedPreset === 'japan_scene'
                      ? 'bg-white border-[#286653] font-medium text-[#286653]'
                      : 'bg-white border-[#DCE2DC] text-[#68736D]'
                  }`}
                >
                  <div className="font-semibold text-[#17231F]">Japan Urban District</div>
                  <div className="text-[10px] text-[#68736D]">93 buildings, dense urban residential</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPreset('jacksonville')
                    setPreFile(null)
                    setPrePreview(null)
                    setPostFile(null)
                    setPostPreview(null)
                  }}
                  className={`text-left p-2 rounded border text-xs ${
                    selectedPreset === 'jacksonville'
                      ? 'bg-white border-[#286653] font-medium text-[#286653]'
                      : 'bg-white border-[#DCE2DC] text-[#68736D]'
                  }`}
                >
                  <div className="font-semibold text-[#17231F]">Jacksonville DFC19</div>
                  <div className="text-[10px] text-[#68736D]">55 buildings, LiDAR verified ground truth</div>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#DCE2DC]">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-3 py-1.5 rounded text-xs text-[#68736D] hover:bg-[#F5F6F3]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runAssessment}
                className="px-4 py-1.5 rounded text-xs font-medium bg-[#286653] hover:bg-[#1E4D3E] text-white shadow-sm flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Disaster Comparison</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
