import React, { useState, useEffect, useRef } from 'react'
import {
  Upload,
  Image as ImageIcon,
  Sun,
  Compass,
  AlertCircle,
  CheckCircle2,
  Play,
  Layers,
  Sparkles,
  Globe,
  MapPin,
  FileText,
  ShieldCheck,
  Check,
  RefreshCw,
  Activity
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import {
  suggestRegionalDatasets,
  validateGeoreferenceBounds,
} from '../../services/measuredElevation'

export const SourceDataPanel: React.FC = () => {
  const samples = useStore((state) => state.samples)
  const fetchSamples = useStore((state) => state.fetchSamples)
  const loadSampleScene = useStore((state) => state.loadSampleScene)
  const processUploadedFile = useStore((state) => state.processUploadedFile)
  const selectedSampleId = useStore((state) => state.selectedSampleId)
  const isProcessing = useStore((state) => state.isProcessing)
  const sceneData = useStore((state) => state.sceneData)

  const sunAzimuth = useStore((state) => state.sunAzimuth)
  const sunElevation = useStore((state) => state.sunElevation)
  const setSunLighting = useStore((state) => state.setSunLighting)

  // Terra3D Measured Elevation & Georeference Store
  const georeferenceBounds = useStore((state) => state.georeferenceBounds)
  const setGeoreferenceBounds = useStore((state) => state.setGeoreferenceBounds)
  const dtmMeta = useStore((state) => state.dtmMeta)
  const dsmMeta = useStore((state) => state.dsmMeta)
  const loadDtmFile = useStore((state) => state.loadDtmFile)
  const loadDsmFile = useStore((state) => state.loadDsmFile)
  const validationPointsText = useStore((state) => state.validationPointsText)
  const setValidationPointsText = useStore((state) => state.setValidationPointsText)
  const evaluateValidationPoints = useStore((state) => state.evaluateValidationPoints)
  const validationReport = useStore((state) => state.validationReport)
  const loadProceduralSample = useStore((state) => state.loadProceduralSample)
  const measuredOffsetRemoved = useStore((state) => state.measuredOffsetRemoved)
  const runGeoDepthPipeline = useStore((state) => state.runGeoDepthPipeline)

  // Local state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileGsd, setFileGsd] = useState<number>(0.4)
  const [isAutoGsd, setIsAutoGsd] = useState<boolean>(true)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dtmInputRef = useRef<HTMLInputElement>(null)
  const dsmInputRef = useRef<HTMLInputElement>(null)

  // Georeference Bounds inputs
  const [westStr, setWestStr] = useState<string>(
    georeferenceBounds ? String(georeferenceBounds.west) : '-122.4200'
  )
  const [southStr, setSouthStr] = useState<string>(
    georeferenceBounds ? String(georeferenceBounds.south) : '37.7700'
  )
  const [eastStr, setEastStr] = useState<string>(
    georeferenceBounds ? String(georeferenceBounds.east) : '-122.4100'
  )
  const [northStr, setNorthStr] = useState<string>(
    georeferenceBounds ? String(georeferenceBounds.north) : '37.7800'
  )
  const [boundsError, setBoundsError] = useState<string | null>(null)

  useEffect(() => {
    fetchSamples()
  }, [fetchSamples])

  useEffect(() => {
    if (georeferenceBounds) {
      setWestStr(String(georeferenceBounds.west))
      setSouthStr(String(georeferenceBounds.south))
      setEastStr(String(georeferenceBounds.east))
      setNorthStr(String(georeferenceBounds.north))
    }
  }, [georeferenceBounds])

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0])
    }
  }

  const handleStartProcessing = () => {
    if (selectedFile) {
      processUploadedFile(selectedFile, isAutoGsd ? undefined : fileGsd)
    } else if (selectedSampleId) {
      loadSampleScene(selectedSampleId)
    }
  }

  const handleBoundsApply = () => {
    try {
      const valid = validateGeoreferenceBounds(westStr, southStr, eastStr, northStr)
      if (valid) {
        setGeoreferenceBounds(valid)
        setBoundsError(null)
      }
    } catch (err: any) {
      setBoundsError(err.message)
    }
  }

  // Calculate ground footprint metrics
  const w = parseFloat(westStr)
  const s = parseFloat(southStr)
  const e = parseFloat(eastStr)
  const n = parseFloat(northStr)
  const isValidCoords = !isNaN(w) && !isNaN(s) && !isNaN(e) && !isNaN(n) && w < e && s < n

  let spanWE = 0
  let spanSN = 0
  let aspect = 1.0
  let areaHa = 0
  let regionalAdvisor = ''

  if (isValidCoords) {
    const midLat = (s + n) / 2
    spanWE = Math.round((e - w) * 111320 * Math.cos((midLat * Math.PI) / 180))
    spanSN = Math.round((n - s) * 110574)
    aspect = spanSN > 0 ? Math.round((spanWE / spanSN) * 100) / 100 : 1.0
    areaHa = Math.round(((spanWE * spanSN) / 10000) * 10) / 10
    regionalAdvisor = suggestRegionalDatasets({ west: w, south: s, east: e, north: n })
  }

  return (
    <div className="p-4 space-y-5 text-xs text-slate-300">
      {/* 1. Benchmark Remote Sensing Datasets & Procedural Generator */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="font-semibold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Benchmark & Procedural Datasets</span>
          </label>
          <span className="text-[10px] text-slate-500">1-Click Test</span>
        </div>

        {/* GeoDepth 3D Jacksonville Aerial Benchmark (Trained ResNet50 Height Model) */}
        <button
          onClick={() => runGeoDepthPipeline({ sampleId: 'jax_018_015', gsd_m: 0.35 })}
          disabled={isProcessing}
          className="w-full mb-2.5 p-2.5 rounded-lg border border-sky-500/60 bg-gradient-to-r from-sky-950/80 to-blue-950/80 hover:from-sky-900/90 hover:to-blue-900/90 text-left transition-all shadow-md shadow-sky-500/10 cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-white text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>GeoDepth 3D Jacksonville Aerial</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-sky-900/60 border border-sky-700 text-[10px] text-sky-300 font-mono">
              0.35m GSD
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            DFC2019 validation tile JAX_018_015 with trained ResNet50 height estimation, extruded 3D buildings, procedural trees, and Horn's slope/aspect analytics.
          </p>
        </button>

        {/* Terra3D Procedural Sample Button */}
        <button
          onClick={() => loadProceduralSample()}
          disabled={isProcessing}
          className="w-full mb-2.5 p-2.5 rounded-lg border border-cyan-500/50 bg-gradient-to-r from-cyan-950/70 to-emerald-950/70 hover:from-cyan-900/80 hover:to-emerald-900/80 text-left transition-all shadow-sm shadow-cyan-500/10 cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-white text-xs flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Terra3D Synthetic Benchmark</span>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-900/60 border border-cyan-700 text-[10px] text-cyan-300 font-mono">
              Procedural
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Generates synthetic multi-tone terrain, curved river, street grid, 24 volumetric buildings, and survey check-points.
          </p>
        </button>

        {/* Existing Benchmark Samples */}
        <div className="space-y-2">
          {samples.map((s) => {
            const isSelected = selectedSampleId === s.id && !selectedFile
            return (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedFile(null)
                  loadSampleScene(s.id)
                }}
                disabled={isProcessing}
                className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-500 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-white text-xs">{s.name}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-cyan-300 font-mono">
                    {s.nominal_gsd_m}m GSD
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {s.description}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Custom Satellite / Aerial Image Ingestion */}
      <div>
        <label className="font-semibold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider text-[11px] mb-2">
          <Upload className="w-3.5 h-3.5 text-emerald-400" />
          <span>Upload Satellite / Drone Image</span>
        </label>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-cyan-500 bg-cyan-950/30'
              : selectedFile
              ? 'border-emerald-500 bg-emerald-950/20'
              : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.tif,.tiff"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setSelectedFile(e.target.files[0])
              }
            }}
          />

          {selectedFile ? (
            <div className="space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
              <div className="font-medium text-white text-xs truncate">
                {selectedFile.name}
              </div>
              <div className="text-[10px] text-slate-400">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for analysis
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <ImageIcon className="w-6 h-6 text-slate-400 mx-auto" />
              <div className="font-medium text-slate-200 text-xs">
                Drop PNG, JPG, or GeoTIFF here
              </div>
              <div className="text-[10px] text-slate-500">
                Supports GeoTIFF with embedded scale & CRS
              </div>
            </div>
          )}
        </div>

        {/* GSD Scale Selector & Auto-Estimate Toggle */}
        <div className="mt-3 flex items-center justify-between bg-slate-800/40 p-2 rounded border border-slate-700/60">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-300 font-medium">Meters / Pixel (GSD)</span>
              {isAutoGsd && (
                <span className="px-1.5 py-0.2 text-[9px] bg-emerald-950/80 text-emerald-400 rounded border border-emerald-600/60 font-mono font-semibold">
                  AUTO DETECT
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-500">
              {isAutoGsd ? "Automatically derived from road & roof morphology" : "Manual pixel-scale override in m/px"}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsAutoGsd(!isAutoGsd)}
              className={`px-2 py-0.5 text-[10px] rounded border font-semibold transition-all cursor-pointer ${
                isAutoGsd
                  ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/60"
                  : "bg-slate-700 text-slate-300 border-slate-600"
              }`}
            >
              {isAutoGsd ? "AUTO" : "MANUAL"}
            </button>
            {!isAutoGsd && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="5.0"
                  value={fileGsd}
                  onChange={(e) => setFileGsd(parseFloat(e.target.value) || 0.4)}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-xs text-cyan-300"
                />
                <span className="text-[10px] text-slate-400">m/px</span>
              </div>
            )}
          </div>
        </div>

        {selectedFile && (
          <div className="mt-3 space-y-2">
            <button
              onClick={() => runGeoDepthPipeline({
                file: selectedFile,
                gsd_m: isAutoGsd ? undefined : fileGsd,
                mode: selectedFile.name.toLowerCase().endsWith('.tif') || selectedFile.name.toLowerCase().endsWith('.tiff') ? 'mode_b' : 'mode_a'
              })}
              disabled={isProcessing}
              className="w-full py-2.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium flex items-center justify-center gap-2 shadow-lg shadow-sky-600/25 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-sky-200" />
              <span>Run GeoDepth Metric Pipeline</span>
            </button>
            <button
              onClick={handleStartProcessing}
              disabled={isProcessing}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer text-xs"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>Standard Reconstruction Pipeline</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. WGS84 Georeferencing & Spatial Extent */}
      <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/70 space-y-3">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>WGS84 Georeferencing Extent</span>
          </label>
          <span className="text-[10px] font-mono text-slate-400">EPSG:4326</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-[10px] text-slate-400">West Longitude (°)</span>
            <input
              type="text"
              value={westStr}
              onChange={(e) => setWestStr(e.target.value)}
              onBlur={handleBoundsApply}
              placeholder="-122.4200"
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-xs text-white"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-400">East Longitude (°)</span>
            <input
              type="text"
              value={eastStr}
              onChange={(e) => setEastStr(e.target.value)}
              onBlur={handleBoundsApply}
              placeholder="-122.4100"
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-xs text-white"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-400">South Latitude (°)</span>
            <input
              type="text"
              value={southStr}
              onChange={(e) => setSouthStr(e.target.value)}
              onBlur={handleBoundsApply}
              placeholder="37.7700"
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-xs text-white"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-400">North Latitude (°)</span>
            <input
              type="text"
              value={northStr}
              onChange={(e) => setNorthStr(e.target.value)}
              onBlur={handleBoundsApply}
              placeholder="37.7800"
              className="w-full mt-0.5 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-xs text-white"
            />
          </div>
        </div>

        {boundsError && (
          <div className="p-2 rounded bg-red-950/50 border border-red-800 text-red-300 text-[10px]">
            {boundsError}
          </div>
        )}

        {/* Real-time Footprint Metrics */}
        {isValidCoords && (
          <div className="bg-slate-900/80 p-2 rounded border border-slate-800 text-[10px] space-y-1 font-mono">
            <div className="flex justify-between text-slate-300">
              <span>Ground Footprint:</span>
              <span className="text-cyan-300 font-semibold">{spanWE}m W-E × {spanSN}m S-N</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Total Ground Area:</span>
              <span>{areaHa} ha ({((spanWE * spanSN) / 1e6).toFixed(3)} km²)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Aspect Ratio:</span>
              <span>{aspect} : 1</span>
            </div>
          </div>
        )}

        {/* Regional Dataset Advisor */}
        {regionalAdvisor && (
          <div className="p-2 rounded bg-blue-950/40 border border-blue-800/60 text-blue-200 text-[10px] leading-relaxed">
            <span className="font-semibold text-blue-300 block mb-0.5">Authoritative Regional LiDAR:</span>
            {regionalAdvisor}
          </div>
        )}
      </div>

      {/* 4. Measured LiDAR Elevation Ingestion (GeoTIFF DTM & DSM) */}
      <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/70 space-y-3">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Measured Elevation (GeoTIFF)</span>
          </label>
          <span className="text-[10px] text-purple-300 font-mono">LiDAR Ingestion</span>
        </div>

        <div className="space-y-2">
          {/* DTM File Input */}
          <input
            ref={dtmInputRef}
            type="file"
            accept=".tif,.tiff"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                loadDtmFile(e.target.files[0])
              }
            }}
          />
          <button
            onClick={() => dtmInputRef.current?.click()}
            className={`w-full p-2 rounded border text-left flex items-center justify-between transition-colors cursor-pointer ${
              dtmMeta
                ? 'bg-purple-950/40 border-purple-500/70 text-purple-200'
                : 'bg-slate-900/80 border-slate-700 hover:border-slate-600 text-slate-300'
            }`}
          >
            <div className="truncate mr-2">
              <div className="font-semibold text-[11px] flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-purple-400" />
                <span>Bare-Earth DTM (Terrain)</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {dtmMeta ? `${dtmMeta.filename} (${dtmMeta.resolution_m}m/px)` : 'Select GeoTIFF DTM file...'}
              </div>
            </div>
            {dtmMeta ? (
              <span className="px-1.5 py-0.5 rounded bg-purple-900/80 text-[9px] font-mono text-purple-300 border border-purple-700 shrink-0">
                {dtmMeta.coverage_pct}% Cov
              </span>
            ) : (
              <Upload className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
          </button>

          {/* DSM File Input */}
          <input
            ref={dsmInputRef}
            type="file"
            accept=".tif,.tiff"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                loadDsmFile(e.target.files[0])
              }
            }}
          />
          <button
            onClick={() => dsmInputRef.current?.click()}
            className={`w-full p-2 rounded border text-left flex items-center justify-between transition-colors cursor-pointer ${
              dsmMeta
                ? 'bg-purple-950/40 border-purple-500/70 text-purple-200'
                : 'bg-slate-900/80 border-slate-700 hover:border-slate-600 text-slate-300'
            }`}
          >
            <div className="truncate mr-2">
              <div className="font-semibold text-[11px] flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-purple-400" />
                <span>Surface DSM (Buildings + Trees)</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {dsmMeta ? `${dsmMeta.filename} (${dsmMeta.resolution_m}m/px)` : 'Select GeoTIFF DSM file...'}
              </div>
            </div>
            {dsmMeta ? (
              <span className="px-1.5 py-0.5 rounded bg-purple-900/80 text-[9px] font-mono text-purple-300 border border-purple-700 shrink-0">
                {dsmMeta.coverage_pct}% Cov
              </span>
            ) : (
              <Upload className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
          </button>
        </div>

        {/* DSM - DTM Offset Removal Badge */}
        {measuredOffsetRemoved !== null && (
          <div className="p-2 rounded bg-purple-950/30 border border-purple-800/50 text-[10px] text-purple-200 font-mono flex items-center justify-between">
            <span>Datum Offset Leveled:</span>
            <span className="font-semibold text-purple-300">{measuredOffsetRemoved > 0 ? `+${measuredOffsetRemoved.toFixed(2)}m` : `${measuredOffsetRemoved.toFixed(2)}m`}</span>
          </div>
        )}
      </div>

      {/* 5. Ground-Truth Validation Check-Points */}
      <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/70 space-y-3">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Survey Accuracy Validation</span>
          </label>
          <span className="text-[10px] font-mono text-teal-400">Checkpoints</span>
        </div>

        <div>
          <div className="text-[10px] text-slate-400 mb-1">
            Format: <code className="text-cyan-300 font-mono">lat,lon,elev_m</code> or <code className="text-cyan-300 font-mono">lat,lon,height_m,h</code>
          </div>
          <textarea
            value={validationPointsText}
            onChange={(e) => setValidationPointsText(e.target.value)}
            placeholder={`# Ground elevation checkpoints:\n37.7750,-122.4150,24.5\n# Building height check (flag 'h'):\n37.7762,-122.4138,12.8,h`}
            rows={4}
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 font-mono text-[11px] text-slate-200 leading-tight focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <button
          onClick={() => evaluateValidationPoints()}
          className="w-full py-1.5 px-3 rounded bg-teal-700 hover:bg-teal-600 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Evaluate Checkpoints Accuracy</span>
        </button>

        {/* Validation Report Card */}
        {validationReport && validationReport.isValidated && (
          <div className="bg-slate-900/90 p-2.5 rounded border border-teal-800/80 space-y-2 text-[10px] font-mono">
            <div className="text-teal-300 font-semibold uppercase tracking-wider border-b border-teal-800/50 pb-1">
              Survey Check Report
            </div>
            {validationReport.groundElevation && (
              <div className="flex justify-between items-center text-slate-300">
                <span>Ground Elev (n={validationReport.groundElevation.count}):</span>
                <span className="text-teal-300">
                  Bias: {validationReport.groundElevation.biasM > 0 ? `+${validationReport.groundElevation.biasM.toFixed(2)}m` : `${validationReport.groundElevation.biasM.toFixed(2)}m`} • RMSE: {validationReport.groundElevation.rmseM.toFixed(2)}m
                </span>
              </div>
            )}
            {validationReport.objectHeight && (
              <div className="flex justify-between items-center text-slate-300">
                <span>Object Ht (n={validationReport.objectHeight.count}):</span>
                <span className="text-teal-300">
                  Bias: {validationReport.objectHeight.biasM > 0 ? `+${validationReport.objectHeight.biasM.toFixed(2)}m` : `${validationReport.objectHeight.biasM.toFixed(2)}m`} • RMSE: {validationReport.objectHeight.rmseM.toFixed(2)}m
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Solar & Shadow Geometry Controls */}
      <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/70 space-y-3">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Solar Trigonometry</span>
          </label>
          <span className="text-[10px] font-mono text-cyan-400">
            Az {sunAzimuth}° / El {sunElevation}°
          </span>
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Solar Azimuth (Sun Heading)</span>
            <span className="font-mono">{sunAzimuth}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            value={sunAzimuth}
            onChange={(e) => setSunLighting(parseInt(e.target.value), sunElevation)}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Solar Elevation (Altitude Angle)</span>
            <span className="font-mono">{sunElevation}°</span>
          </div>
          <input
            type="range"
            min="10"
            max="85"
            value={sunElevation}
            onChange={(e) => setSunLighting(sunAzimuth, parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>
      </div>

      {/* 7. Image Inspection Quality Report (if sceneData loaded) */}
      {sceneData && (
        <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/70 space-y-2">
          <div className="font-semibold text-slate-200 text-[11px] uppercase tracking-wider flex items-center justify-between">
            <span>Sensor & Image Provenance</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono text-[10px]">
              {sceneData.metadata.quality_metrics.rating} Quality
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">DIMENSIONS</div>
              <div className="text-white font-semibold">
                {sceneData.dimensions.width} × {sceneData.dimensions.height}
              </div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">CHANNELS</div>
              <div className="text-white font-semibold">
                {sceneData.metadata.channels} ({sceneData.metadata.bit_depth}-bit)
              </div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">SHARPNESS</div>
              <div className="text-cyan-400 font-semibold">
                {sceneData.metadata.quality_metrics.sharpness_score}
              </div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">DYNAMIC RANGE</div>
              <div className="text-cyan-400 font-semibold">
                {sceneData.metadata.quality_metrics.dynamic_range}
              </div>
            </div>
          </div>

          {sceneData.metadata.quality_warnings.length > 0 && (
            <div className="mt-2 p-2 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[11px] space-y-1">
              <div className="font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Quality Caveats</span>
              </div>
              {sceneData.metadata.quality_warnings.map((w, idx) => (
                <div key={idx} className="text-[10px] text-amber-200/80 pl-4 list-disc">
                  • {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
