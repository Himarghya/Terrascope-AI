import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Download,
  RefreshCw,
  Sliders,
  Building2,
  Waves,
  Activity,
  Mountain,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Box,
  Layers,
  UploadCloud,
  Cpu
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { InsuranceRiskReport, TwoDToThreeDPredictionResponse } from '../../types'

export const InsuranceRiskView: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const insuranceReport = useStore((state) => state.insuranceReport)
  const isAssessingInsurance = useStore((state) => state.isAssessingInsurance)
  const insuranceError = useStore((state) => state.insuranceError)
  const runInsuranceAssessment = useStore((state) => state.runInsuranceAssessment)
  const fetchSampleInsuranceReport = useStore((state) => state.fetchSampleInsuranceReport)
  const run2Dto3DInference = useStore((state) => state.run2Dto3DInference)
  const selectedBuildingRiskId = useStore((state) => state.selectedBuildingRiskId)
  const setSelectedBuildingRiskId = useStore((state) => state.setSelectedBuildingRiskId)
  const setActiveScreen = useStore((state) => state.setActiveScreen)

  // Local state for weights customization
  const [showWeightSliders, setShowWeightSliders] = useState(false)
  const [weights, setWeights] = useState({
    flood: 0.35,
    earthquake: 0.30,
    landslide: 0.15,
    structural: 0.20
  })

  // Search and filter for building schedule
  const [searchQuery, setSearchQuery] = useState('')
  const [tierFilter, setTierFilter] = useState<'ALL' | 'Low' | 'Moderate' | 'Elevated'>('ALL')
  const [expandedBuildingId, setExpandedBuildingId] = useState<string | null>(null)

  // 2D-to-3D Model API Integration state
  const [showApiModal, setShowApiModal] = useState(false)
  const [apiSampleId, setApiSampleId] = useState('jacksonville_aerial')
  const [apiFile, setApiFile] = useState<File | null>(null)
  const [apiGsd, setApiGsd] = useState(0.35)
  const [isApiRunning, setIsApiRunning] = useState(false)
  const [apiResult, setApiResult] = useState<TwoDToThreeDPredictionResponse | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  // Auto-fetch insurance report on mount if not yet populated
  useEffect(() => {
    if (!insuranceReport && !isAssessingInsurance) {
      const sample = (sceneData as any)?.sample_id || 'jacksonville_aerial'
      fetchSampleInsuranceReport(sample)
    }
  }, [insuranceReport, sceneData])

  const handleRecalculate = () => {
    runInsuranceAssessment(weights)
  }

  const handleWeightChange = (key: keyof typeof weights, value: number) => {
    const updated = { ...weights, [key]: value }
    setWeights(updated)
  }

  const handleRun2Dto3D = async () => {
    setIsApiRunning(true)
    setApiError(null)
    setApiResult(null)
    try {
      const target = apiFile ? apiFile : apiSampleId
      const res = await run2Dto3DInference(target, apiGsd)
      if (res) {
        setApiResult(res)
        // Auto re-evaluate insurance for newly inferred scene
        runInsuranceAssessment(weights)
      } else {
        setApiError('Inference failed to complete')
      }
    } catch (e: any) {
      setApiError(e?.message || 'Error executing 2D-to-3D inference')
    } finally {
      setIsApiRunning(false)
    }
  }

  const exportReportJson = () => {
    if (!insuranceReport) return
    const blob = new Blob([JSON.stringify(insuranceReport, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `TerraScope_Insurance_Report_${insuranceReport.report_id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Filtered building schedule
  const buildings = insuranceReport?.building_schedule || []
  const filteredBuildings = buildings.filter((b) => {
    const matchesSearch =
      b.building_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.dominant_peril.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.roof_shape.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTier = tierFilter === 'ALL' || b.underwriting_tier === tierFilter
    return matchesSearch && matchesTier
  })

  // Underwriting tier coloring
  const getTierColor = (code?: string) => {
    switch (code) {
      case 'TIER_1_PREFERRED':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-300',
          text: 'text-emerald-800',
          badge: 'bg-emerald-600 text-white',
          ring: 'ring-emerald-500'
        }
      case 'TIER_2_STANDARD':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-300',
          text: 'text-blue-800',
          badge: 'bg-blue-600 text-white',
          ring: 'ring-blue-500'
        }
      case 'TIER_3_ELEVATED':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-300',
          text: 'text-amber-800',
          badge: 'bg-amber-600 text-white',
          ring: 'ring-amber-500'
        }
      case 'TIER_4_HIGH_RISK':
      default:
        return {
          bg: 'bg-rose-50',
          border: 'border-rose-300',
          text: 'text-rose-800',
          badge: 'bg-rose-600 text-white',
          ring: 'ring-rose-500'
        }
    }
  }

  const tierColors = getTierColor(insuranceReport?.underwriting_tier?.code)

  return (
    <div className="flex-1 overflow-y-auto bg-[#F4F6F4] text-[#17231F] p-4 lg:p-6 space-y-6">
      {/* Top Application Bar with Underwriting Status */}
      <div className="bg-white border border-[#DCE2DC] rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#286653] text-white flex items-center justify-center font-bold shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-[#17231F] tracking-tight flex items-center gap-2">
                Insurance Risk Assessment & Underwriting Mode
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#E8EFEA] text-[#286653] border border-[#286653]/30">
                  Preliminary Screening
                </span>
              </h1>
              <p className="text-xs text-[#68736D]">
                Multi-peril physical hazard scoring (Earthquake, Flood, Landslide) & 3D building structural exposure
              </p>
            </div>
          </div>
          <div className="mt-2 text-xs text-[#68736D] flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Asset: <strong className="text-[#17231F]">{insuranceReport?.asset_identifier || 'Aerial Survey Scene'}</strong></span>
            <span>Report ID: <code className="text-[#286653] font-mono text-[11px]">{insuranceReport?.report_id || 'Generating...'}</code></span>
            <span>Evaluation Time: {insuranceReport?.evaluation_time_ms ? `${insuranceReport.evaluation_time_ms} ms` : '—'}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowApiModal(!showApiModal)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-sm"
          >
            <Cpu className="w-4 h-4 text-indigo-600" />
            2D-to-3D API Model
          </button>

          <button
            onClick={() => setShowWeightSliders(!showWeightSliders)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-white border border-[#DCE2DC] text-[#286653] hover:bg-[#F5F6F3] transition-colors shadow-sm"
          >
            <Sliders className="w-4 h-4" />
            {showWeightSliders ? 'Hide Weights' : 'Adjust Weights'}
          </button>

          <button
            onClick={handleRecalculate}
            disabled={isAssessingInsurance}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#286653] text-white hover:bg-[#205243] disabled:opacity-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isAssessingInsurance ? 'animate-spin' : ''}`} />
            {isAssessingInsurance ? 'Assessing...' : 'Re-calculate Risk'}
          </button>

          <button
            onClick={exportReportJson}
            disabled={!insuranceReport}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-white border border-[#DCE2DC] text-[#68736D] hover:text-[#17231F] hover:bg-[#F5F6F3] transition-colors shadow-sm"
            title="Download full JSON report"
          >
            <Download className="w-4 h-4" />
            Export Dossier
          </button>
        </div>
      </div>

      {/* 2D-to-3D API Inference Integration Modal / Panel */}
      {showApiModal && (
        <div className="bg-white border-2 border-indigo-200 rounded-xl p-5 shadow-md space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-indigo-950">
                  2D-to-3D Model Inference API (POST /v1/2d-to-3d/predict)
                </h3>
                <p className="text-xs text-indigo-700">
                  Execute the trained HeightFormer remote-sensing checkpoint (height_v2.pt) on 2D imagery to generate 3D structures and metric building heights.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowApiModal(false)}
              className="text-xs text-indigo-500 hover:text-indigo-800 font-semibold px-2 py-1"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Source Selection */}
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Input Source</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="api_src"
                    checked={!apiFile}
                    onChange={() => setApiFile(null)}
                    className="text-indigo-600"
                  />
                  <span>Select Benchmark Sample</span>
                </label>
                {!apiFile && (
                  <select
                    value={apiSampleId}
                    onChange={(e) => setApiSampleId(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-gray-300 bg-white"
                  >
                    <option value="jacksonville_aerial">Jacksonville Aerial Tile (JAX_018_015)</option>
                    <option value="sapporo_district">Sapporo Urban Core (0.35m GSD)</option>
                  </select>
                )}

                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="radio"
                    name="api_src"
                    checked={Boolean(apiFile)}
                    onChange={() => {}}
                    className="text-indigo-600"
                  />
                  <span>Upload Custom Overhead Image (JPG / PNG / GeoTIFF)</span>
                </label>
                {apiFile && (
                  <div className="p-2 border border-dashed border-indigo-300 rounded bg-indigo-50/50">
                    <p className="text-[11px] text-indigo-800 font-medium truncate">{apiFile.name} ({(apiFile.size / 1024).toFixed(1)} KB)</p>
                    <button
                      onClick={() => setApiFile(null)}
                      className="text-[10px] text-rose-600 hover:underline mt-1"
                    >
                      Clear File
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/tiff"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setApiFile(e.target.files[0])
                  }}
                  className="w-full text-[11px] text-gray-500"
                />
              </div>
            </div>

            {/* Resolution & Pipeline Settings */}
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Inference Resolution (GSD)</label>
              <div className="space-y-1.5">
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="2.0"
                  value={apiGsd}
                  onChange={(e) => setApiGsd(parseFloat(e.target.value) || 0.35)}
                  className="w-full text-xs p-2 rounded border border-gray-300"
                />
                <span className="text-[10px] text-gray-500 block">
                  Ground Sampling Distance (m/pixel). Jacksonville benchmark uses 0.35 m/px.
                </span>
                <div className="p-2 rounded bg-gray-50 text-[11px] text-gray-600 border border-gray-200">
                  <div>Model: <strong>ResNet50 U-Net (height_v2.pt)</strong></div>
                  <div>Output: <strong>3D Buildings, Heights, Landcover & Terrain DEM</strong></div>
                </div>
              </div>
            </div>

            {/* Execution CTA & Status */}
            <div className="flex flex-col justify-between">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Execute 2D-to-3D Inference</label>
                <p className="text-[11px] text-gray-500 mb-2">
                  Calls endpoint <code>POST /api/v1/2d-to-3d/predict</code> synchronously, updates in-memory scene geometry and recalculates insurance risk.
                </p>
                {apiError && (
                  <div className="p-2 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[11px]">
                    {apiError}
                  </div>
                )}
              </div>
              <button
                onClick={handleRun2Dto3D}
                disabled={isApiRunning}
                className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isApiRunning ? 'animate-spin' : ''}`} />
                {isApiRunning ? 'Inferring 3D Geometry...' : 'Run 2D-to-3D Inference'}
              </button>
            </div>
          </div>

          {/* API Inference Results Feedback */}
          {apiResult && (
            <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  2D-to-3D Model Inference Succeeded ({apiResult.inference_time_ms} ms)
                </span>
                <span className="text-[11px] text-emerald-700 font-mono">Job: {apiResult.prediction_id}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-emerald-900">
                <div className="bg-white/80 p-2 rounded border border-emerald-100">
                  <span className="text-[10px] text-emerald-600 block">Buildings Extracted</span>
                  <strong>{apiResult.summary.building_count} structures</strong>
                </div>
                <div className="bg-white/80 p-2 rounded border border-emerald-100">
                  <span className="text-[10px] text-emerald-600 block">Mean Building Height</span>
                  <strong>{apiResult.summary.mean_building_height_m} m</strong>
                </div>
                <div className="bg-white/80 p-2 rounded border border-emerald-100">
                  <span className="text-[10px] text-emerald-600 block">Vegetation Coverage</span>
                  <strong>{apiResult.summary.vegetation_coverage_pct}%</strong>
                </div>
                <div className="bg-white/80 p-2 rounded border border-emerald-100">
                  <span className="text-[10px] text-emerald-600 block">Reconstruction Confidence</span>
                  <strong>{(apiResult.summary.overall_reconstruction_confidence * 100).toFixed(0)}%</strong>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1 text-[11px]">
                <a
                  href={apiResult.artifacts.heightmap_png_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> View Inferred 16-bit Heightmap PNG
                </a>
                <button
                  onClick={() => setActiveScreen('3d-reconstruction')}
                  className="text-indigo-700 hover:underline flex items-center gap-1 font-medium ml-auto"
                >
                  <Box className="w-3 h-3" /> View in 3D Canvas
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Underwriting Weight Slider Bar (Collapsible) */}
      {showWeightSliders && (
        <div className="bg-white border border-[#DCE2DC] rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#DCE2DC] pb-2">
            <h3 className="text-xs font-semibold text-[#17231F] flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#286653]" />
              Custom Underwriting Peril Weights (Total normalized to 100%)
            </h3>
            <button
              onClick={() => {
                setWeights({ flood: 0.35, earthquake: 0.30, landslide: 0.15, structural: 0.20 })
                runInsuranceAssessment({ flood: 0.35, earthquake: 0.30, landslide: 0.15, structural: 0.20 })
              }}
              className="text-[11px] text-[#286653] hover:underline"
            >
              Reset to Defaults
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="flex justify-between text-[#68736D] mb-1">
                <span>Flood Weight</span>
                <strong>{(weights.flood * 100).toFixed(0)}%</strong>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.80"
                step="0.05"
                value={weights.flood}
                onChange={(e) => handleWeightChange('flood', parseFloat(e.target.value))}
                className="w-full accent-[#286653]"
              />
            </div>
            <div>
              <div className="flex justify-between text-[#68736D] mb-1">
                <span>Earthquake Weight</span>
                <strong>{(weights.earthquake * 100).toFixed(0)}%</strong>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.80"
                step="0.05"
                value={weights.earthquake}
                onChange={(e) => handleWeightChange('earthquake', parseFloat(e.target.value))}
                className="w-full accent-[#286653]"
              />
            </div>
            <div>
              <div className="flex justify-between text-[#68736D] mb-1">
                <span>Landslide/Slope Weight</span>
                <strong>{(weights.landslide * 100).toFixed(0)}%</strong>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.60"
                step="0.05"
                value={weights.landslide}
                onChange={(e) => handleWeightChange('landslide', parseFloat(e.target.value))}
                className="w-full accent-[#286653]"
              />
            </div>
            <div>
              <div className="flex justify-between text-[#68736D] mb-1">
                <span>Structural Geometry Weight</span>
                <strong>{(weights.structural * 100).toFixed(0)}%</strong>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.60"
                step="0.05"
                value={weights.structural}
                onChange={(e) => handleWeightChange('structural', parseFloat(e.target.value))}
                className="w-full accent-[#286653]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Executive Underwriting Scorecard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Overall Risk Score Dial & Underwriting Tier */}
        <div className={`lg:col-span-5 bg-white border ${tierColors.border} rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-4`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#68736D]">
                Overall Underwriting Score
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${tierColors.badge}`}>
                {insuranceReport?.underwriting_tier?.label || 'Calculating...'}
              </span>
            </div>

            {/* Score Big Display */}
            <div className="flex items-baseline gap-2 my-2">
              <span className="text-5xl font-extrabold tracking-tight text-[#17231F]">
                {insuranceReport?.overall_risk_score !== undefined
                  ? insuranceReport.overall_risk_score.toFixed(1)
                  : '--'}
              </span>
              <span className="text-sm font-semibold text-[#68736D]">/ 100.0</span>
            </div>

            {/* Score Interpretation Meter */}
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex my-3">
              <div className="bg-emerald-500 h-full w-1/4" title="0-25: Preferred" />
              <div className="bg-blue-500 h-full w-1/4" title="26-50: Standard" />
              <div className="bg-amber-500 h-full w-1/4" title="51-75: Elevated" />
              <div className="bg-rose-500 h-full w-1/4" title="76-100: High Risk" />
            </div>
            <div className="flex justify-between text-[10px] text-[#68736D] font-mono">
              <span>0 (Low)</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100 (Severe)</span>
            </div>
          </div>

          {/* Underwriting Guidance Box */}
          <div className={`p-4 rounded-lg border ${tierColors.border} ${tierColors.bg} text-xs space-y-2`}>
            <div className="font-semibold text-[#17231F] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#286653]" />
              Underwriting Directive:
            </div>
            <p className="text-[#17231F]">
              {insuranceReport?.underwriting_tier?.action || 'Evaluating scene data...'}
            </p>
            <div className="text-[11px] text-[#68736D] pt-1 border-t border-[#DCE2DC]/60">
              <strong>Deductible Guideline:</strong> {insuranceReport?.underwriting_tier?.deductible_recommendation || 'Standard'}
            </div>
          </div>
        </div>

        {/* Right: Individual Peril Breakdown Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Flood Risk Card */}
          <div className="bg-white border border-[#DCE2DC] rounded-xl p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Waves className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#17231F]">Flood Peril</h4>
                  <span className="text-[10px] text-[#68736D]">Weight: {(weights.flood * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-extrabold text-[#17231F]">
                  {insuranceReport?.hazard_scores?.flood?.score?.toFixed(1) ?? '--'}
                </span>
                <span className="text-[10px] text-[#68736D] block font-medium">
                  {insuranceReport?.hazard_scores?.flood?.rating || 'Low'}
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full"
                style={{ width: `${Math.min(insuranceReport?.hazard_scores?.flood?.score || 0, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-[#68736D]">
              {insuranceReport?.hazard_scores?.flood?.key_metric || 'Ponding and depression runoff'}
            </p>
          </div>

          {/* Earthquake Risk Card */}
          <div className="bg-white border border-[#DCE2DC] rounded-xl p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#17231F]">Earthquake Peril</h4>
                  <span className="text-[10px] text-[#68736D]">Weight: {(weights.earthquake * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-extrabold text-[#17231F]">
                  {insuranceReport?.hazard_scores?.earthquake?.score?.toFixed(1) ?? '--'}
                </span>
                <span className="text-[10px] text-[#68736D] block font-medium">
                  {insuranceReport?.hazard_scores?.earthquake?.rating || 'Low'}
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-rose-600 h-1.5 rounded-full"
                style={{ width: `${Math.min(insuranceReport?.hazard_scores?.earthquake?.score || 0, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-[#68736D]">
              {insuranceReport?.hazard_scores?.earthquake?.key_metric || 'PGA ground acceleration and MMI'}
            </p>
          </div>

          {/* Landslide / Slope Risk Card */}
          <div className="bg-white border border-[#DCE2DC] rounded-xl p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Mountain className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#17231F]">Landslide & Slope</h4>
                  <span className="text-[10px] text-[#68736D]">Weight: {(weights.landslide * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-extrabold text-[#17231F]">
                  {insuranceReport?.hazard_scores?.landslide?.score?.toFixed(1) ?? '--'}
                </span>
                <span className="text-[10px] text-[#68736D] block font-medium">
                  {insuranceReport?.hazard_scores?.landslide?.rating || 'Low'}
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-600 h-1.5 rounded-full"
                style={{ width: `${Math.min(insuranceReport?.hazard_scores?.landslide?.score || 0, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-[#68736D]">
              {insuranceReport?.hazard_scores?.landslide?.key_metric || 'Geotechnical Factor of Safety (FoS)'}
            </p>
          </div>

          {/* Structural Geometry Risk Card */}
          <div className="bg-white border border-[#DCE2DC] rounded-xl p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#17231F]">Structural Geometry</h4>
                  <span className="text-[10px] text-[#68736D]">Weight: {(weights.structural * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-extrabold text-[#17231F]">
                  {insuranceReport?.hazard_scores?.structural?.score?.toFixed(1) ?? '--'}
                </span>
                <span className="text-[10px] text-[#68736D] block font-medium">
                  {insuranceReport?.hazard_scores?.structural?.rating || 'Moderate'}
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-600 h-1.5 rounded-full"
                style={{ width: `${Math.min(insuranceReport?.hazard_scores?.structural?.score || 0, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-[#68736D]">
              {insuranceReport?.hazard_scores?.structural?.key_metric || 'Height, slenderness & flat roof ratio'}
            </p>
          </div>
        </div>
      </div>

      {/* Building-by-Building Underwriting Schedule */}
      <div className="bg-white border border-[#DCE2DC] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCE2DC] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#17231F] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#286653]" />
              Building Underwriting Schedule ({filteredBuildings.length} of {buildings.length} Assets)
            </h3>
            <p className="text-xs text-[#68736D]">
              Individual structural height measurements and specific peril ratings
            </p>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ID, peril, roof..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[#DCE2DC] bg-[#F9FAF9] focus:outline-none focus:border-[#286653] w-48"
              />
            </div>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as any)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-[#DCE2DC] bg-white text-[#17231F]"
            >
              <option value="ALL">All Tiers</option>
              <option value="Low">Low Risk</option>
              <option value="Moderate">Moderate Risk</option>
              <option value="Elevated">Elevated Risk</option>
            </select>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#DCE2DC] text-[#68736D] font-semibold">
                <th className="py-2.5 px-3">Building ID</th>
                <th className="py-2.5 px-3">Height (m)</th>
                <th className="py-2.5 px-3">Stories</th>
                <th className="py-2.5 px-3">Footprint (m²)</th>
                <th className="py-2.5 px-3">Roof Shape</th>
                <th className="py-2.5 px-3">Dominant Peril</th>
                <th className="py-2.5 px-3 text-right">Risk Score</th>
                <th className="py-2.5 px-3 text-center">Tier</th>
                <th className="py-2.5 px-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEFEA]">
              {filteredBuildings.slice(0, 15).map((b) => {
                const isExpanded = expandedBuildingId === b.building_id
                return (
                  <React.Fragment key={b.building_id}>
                    <tr
                      className={`hover:bg-[#F5F8F6] transition-colors cursor-pointer ${
                        selectedBuildingRiskId === b.building_id ? 'bg-[#E8EFEA]' : ''
                      }`}
                      onClick={() => setExpandedBuildingId(isExpanded ? null : b.building_id)}
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-[#17231F]">
                        {b.building_id}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#17231F]">{b.height_m.toFixed(1)} m</td>
                      <td className="py-2.5 px-3">{b.stories}</td>
                      <td className="py-2.5 px-3">{b.footprint_area_m2.toFixed(0)} m²</td>
                      <td className="py-2.5 px-3">{b.roof_shape}</td>
                      <td className="py-2.5 px-3 text-[#286653] font-medium">{b.dominant_peril}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#17231F]">
                        {b.building_risk_score.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            b.underwriting_tier === 'Low'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.underwriting_tier === 'Moderate'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {b.underwriting_tier}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedBuildingId(isExpanded ? null : b.building_id)
                          }}
                          className="text-[#286653] hover:text-[#17231F]"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {isExpanded && (
                      <tr className="bg-[#FAFBF9]">
                        <td colSpan={9} className="p-4 border-b border-[#DCE2DC]">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            <div className="bg-white p-3 rounded-lg border border-[#DCE2DC]">
                              <span className="font-semibold text-gray-700 block mb-1">Peril Sub-Scores:</span>
                              <div className="space-y-1 text-[#68736D]">
                                <div className="flex justify-between">
                                  <span>Flood Susceptibility:</span>
                                  <strong>{b.sub_scores.flood_score.toFixed(1)} / 100</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Earthquake Shaking:</span>
                                  <strong>{b.sub_scores.earthquake_score.toFixed(1)} / 100</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Slope Instability:</span>
                                  <strong>{b.sub_scores.landslide_score.toFixed(1)} / 100</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Structural Geometry:</span>
                                  <strong>{b.sub_scores.structural_score.toFixed(1)} / 100</strong>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white p-3 rounded-lg border border-[#DCE2DC]">
                              <span className="font-semibold text-gray-700 block mb-1">Underwriting Flags:</span>
                              <ul className="list-disc list-inside space-y-1 text-[#68736D]">
                                {b.underwriting_flags.map((flag, idx) => (
                                  <li key={idx} className="text-[11px]">{flag}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="bg-white p-3 rounded-lg border border-[#DCE2DC] flex flex-col justify-between">
                              <div>
                                <span className="font-semibold text-gray-700 block mb-1">Survey Recommendation:</span>
                                <p className="text-[11px] text-[#68736D]">{b.recommended_survey_focus}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedBuildingRiskId(b.building_id)
                                  setActiveScreen('3d-reconstruction')
                                }}
                                className="mt-2 text-xs font-medium text-[#286653] hover:underline flex items-center gap-1"
                              >
                                <Box className="w-3 h-3" /> Focus Structure in 3D Canvas
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
          {filteredBuildings.length > 15 && (
            <p className="text-[11px] text-[#68736D] text-center pt-2">
              Showing top 15 of {filteredBuildings.length} assets. Use search to filter specific structures.
            </p>
          )}
        </div>
      </div>

      {/* Historical Hazard Telemetry Section */}
      <div className="bg-white border border-[#DCE2DC] rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#DCE2DC] pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#286653]" />
            <h3 className="text-sm font-bold text-[#17231F]">
              Ground-Truth Historical Hazard Telemetry & Catastrophe Records
            </h3>
          </div>
          {insuranceReport?.historical_hazard_information?.historical_records_available ? (
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              Verified Records Linked
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
              Historical Records Unavailable
            </span>
          )}
        </div>

        {insuranceReport?.historical_hazard_information?.historical_records_available ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-[#F9FAF9] rounded-lg border border-[#E0E6E0] space-y-1.5">
              <span className="font-semibold text-blue-900 flex items-center gap-1">
                <Waves className="w-3.5 h-3.5 text-blue-600" /> Flood & Surge Records
              </span>
              <p className="text-[11px] text-[#68736D]">
                <strong>FEMA Flood Zone:</strong> {insuranceReport.historical_hazard_information.fema_flood_zone}
              </p>
              {insuranceReport.historical_hazard_information.historical_flood_events?.map((ev, i) => (
                <div key={i} className="text-[11px] border-t border-gray-200 pt-1 mt-1 text-[#68736D]">
                  <strong className="text-gray-800">{ev.event_name} ({ev.year}):</strong> {ev.impact_summary} (Surge: {ev.recorded_surge_height_m}m)
                </div>
              ))}
            </div>

            <div className="p-3 bg-[#F9FAF9] rounded-lg border border-[#E0E6E0] space-y-1.5">
              <span className="font-semibold text-rose-900 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-rose-600" /> Historical Seismic Telemetry
              </span>
              {insuranceReport.historical_hazard_information.historical_earthquake_events?.map((ev, i) => (
                <div key={i} className="text-[11px] text-[#68736D]">
                  <div><strong>Baseline:</strong> {ev.event_name} ({ev.year})</div>
                  <div><strong>Rating:</strong> {ev.seismic_zone_rating}</div>
                  <div className="text-[10px] text-gray-500 mt-1">{ev.note}</div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-[#F9FAF9] rounded-lg border border-[#E0E6E0] space-y-1.5">
              <span className="font-semibold text-amber-900 flex items-center gap-1">
                <Mountain className="w-3.5 h-3.5 text-amber-600" /> Geotechnical Slope Records
              </span>
              {insuranceReport.historical_hazard_information.historical_landslide_events?.map((ev, i) => (
                <div key={i} className="text-[11px] text-[#68736D]">
                  <div><strong>Source:</strong> {ev.event_name} ({ev.year})</div>
                  <div><strong>Sinkhole/Karst Exposure:</strong> {ev.karst_sinkhole_exposure}</div>
                  <div className="text-[10px] text-gray-500 mt-1">{ev.note}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold mb-1">
                Historical Catastrophe Records Are Not Geocoded For This Image
              </strong>
              <p className="text-[11px] leading-relaxed">
                {insuranceReport?.historical_hazard_information?.status_note ||
                  'No verified historical catastrophe claim records are linked to this upload. In accordance with underwriting integrity guidelines, TerraScope AI does not invent or extrapolate unverified historical flood or seismic events.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Supporting Evidence & Explicit Data Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Supporting Evidence Card */}
        <div className="bg-white border border-[#DCE2DC] rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-[#17231F] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#286653]" />
            Measured Supporting Evidence
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-gray-50 rounded border border-gray-200">
              <span className="text-[10px] text-gray-500 block">Terrain Elevation Range</span>
              <strong className="text-gray-800">{insuranceReport?.supporting_evidence?.terrain_elevation_range_m?.toFixed(1) ?? '--'} m</strong>
            </div>
            <div className="p-2.5 bg-gray-50 rounded border border-gray-200">
              <span className="text-[10px] text-gray-500 block">Mean Terrain Slope</span>
              <strong className="text-gray-800">{insuranceReport?.supporting_evidence?.mean_slope_degrees?.toFixed(1) ?? '--'}°</strong>
            </div>
            <div className="p-2.5 bg-gray-50 rounded border border-gray-200">
              <span className="text-[10px] text-gray-500 block">Max Scenario Ponding Depth</span>
              <strong className="text-gray-800">{insuranceReport?.supporting_evidence?.modeled_scenario_max_ponding_depth_m?.toFixed(2) ?? '--'} m</strong>
            </div>
            <div className="p-2.5 bg-gray-50 rounded border border-gray-200">
              <span className="text-[10px] text-gray-500 block">Ground Motion PGA</span>
              <strong className="text-gray-800">{insuranceReport?.supporting_evidence?.modeled_peak_ground_acceleration_g?.toFixed(2) ?? '--'} g</strong>
            </div>
            <div className="p-2.5 bg-gray-50 rounded border border-gray-200">
              <span className="text-[10px] text-gray-500 block">Mean Structure Height</span>
              <strong className="text-gray-800">{insuranceReport?.supporting_evidence?.mean_building_height_m?.toFixed(1) ?? '--'} m</strong>
            </div>
            <div className="p-2.5 bg-gray-50 rounded border border-gray-200">
              <span className="text-[10px] text-gray-500 block">Image Spatial Scale (GSD)</span>
              <strong className="text-gray-800">{insuranceReport?.supporting_evidence?.ground_sampling_distance_m?.toFixed(2) ?? '--'} m/px</strong>
            </div>
          </div>
        </div>

        {/* Data Gaps & Uncertainty Disclosures */}
        <div className="bg-white border border-[#DCE2DC] rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-[#17231F] flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-600" />
            Explicit Data Gaps & Underwriting Assumptions
          </h3>
          <div className="space-y-2 text-xs">
            {insuranceReport?.data_gaps?.map((gap, i) => (
              <div key={i} className="p-2.5 bg-gray-50 rounded border border-gray-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-800">{gap.parameter}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      gap.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {gap.status}
                  </span>
                </div>
                <p className="text-[11px] text-[#68736D] leading-tight">{gap.impact}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actionable Engineering Recommendations */}
      <div className="bg-white border border-[#DCE2DC] rounded-xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-[#17231F] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#286653]" />
          Recommendations for On-Site Engineering Survey
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-[#17231F]">
          {insuranceReport?.recommendations?.map((rec, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 bg-[#F9FAF9] rounded border border-[#E0E6E0]">
              <span className="w-5 h-5 rounded-full bg-[#E8EFEA] text-[#286653] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-[11px] leading-relaxed">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Underwriting Legal & Regulatory Disclaimer */}
      <div className="p-4 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-600 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-semibold text-gray-800">
            Regulatory Notice — Preliminary Risk Screening Tool:
          </strong>
          <p className="text-[11px] leading-relaxed">
            {insuranceReport?.legal_disclaimer ||
              'This assessment is an automated preliminary underwriting screening report produced by TerraScope AI remote-sensing models. It DOES NOT constitute an automated insurance approval, underwriting rejection, or binding contractual offer. It does not predict structural failure or collapse without validated on-site professional structural and geotechnical engineering analysis.'}
          </p>
        </div>
      </div>
    </div>
  )
}
