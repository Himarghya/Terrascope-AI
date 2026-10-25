import React, { useEffect, useState } from 'react'
import {
  Route,
  Waves,
  Radio,
  ShieldCheck,
  Play,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Navigation,
  Cpu,
  Building2,
  Sparkles,
  Footprints,
  Compass,
  Check,
  MapPin,
  Crosshair,
  Shield,
  ArrowRight,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  Activity,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Pin,
  PinOff,
  FoldHorizontal,
  ChevronDown,
  ChevronUp,
  Signal,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { SceneCanvas } from '../viewer3d/SceneCanvas'
import { HazardImpactHUD } from '../viewer3d/HazardImpactHUD'
import { GeoTwin3DOverlayMode } from '../../types'

type ModuleTab = 'hazards' | 'wireless' | 'validation'

export const GeoTwinResponseView: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const geotwinOverlayMode = useStore((state) => state.geotwinOverlayMode)
  const setGeoTwinOverlayMode = useStore((state) => state.setGeoTwinOverlayMode)
  const hazardReport = useStore((state) => state.hazardReport)
  const routeReport = useStore((state) => state.routeReport)
  const wirelessReport = useStore((state) => state.wirelessReport)
  const governanceReport = useStore((state) => state.governanceReport)
  const predictionRecords = useStore((state) => state.predictionRecords)
  const isGeoTwinLoading = useStore((state) => state.isGeoTwinLoading)
  const routePointA = useStore((state) => state.routePointA)
  const routePointB = useStore((state) => state.routePointB)
  const routePickingMode = useStore((state) => state.routePickingMode)
  const setRoutePointA = useStore((state) => state.setRoutePointA)
  const setRoutePointB = useStore((state) => state.setRoutePointB)
  const setRoutePickingMode = useStore((state) => state.setRoutePickingMode)
  const customTowerPos = useStore((state) => state.customTowerPos)
  const userDevicePos = useStore((state) => state.userDevicePos)
  const networkPickingMode = useStore((state) => state.networkPickingMode)
  const setCustomTowerPos = useStore((state) => state.setCustomTowerPos)
  const setUserDevicePos = useStore((state) => state.setUserDevicePos)
  const setNetworkPickingMode = useStore((state) => state.setNetworkPickingMode)
  const floodWaterLevelM = useStore((state) => state.floodWaterLevelM)
  const isFloodAnimating = useStore((state) => state.isFloodAnimating)
  const floodAnimSpeed = useStore((state) => state.floodAnimSpeed)
  const floodPickingMode = useStore((state) => state.floodPickingMode)
  const setFloodWaterLevelM = useStore((state) => state.setFloodWaterLevelM)
  const setIsFloodAnimating = useStore((state) => state.setIsFloodAnimating)
  const setFloodAnimSpeed = useStore((state) => state.setFloodAnimSpeed)
  const setFloodPickingMode = useStore((state) => state.setFloodPickingMode)
  const setSelectedRegionHeight = useStore((state) => state.setSelectedRegionHeight)
  const selectedRegionHeight = useStore((state) => state.selectedRegionHeight)

  const richterScale = useStore((state) => state.richterScale)
  const isEarthquakeAnimating = useStore((state) => state.isEarthquakeAnimating)
  const earthquakeAnimSpeed = useStore((state) => state.earthquakeAnimSpeed)
  const epicenterPoint = useStore((state) => state.epicenterPoint)
  const earthquakePickingMode = useStore((state) => state.earthquakePickingMode)
  const selectedSeismicRegion = useStore((state) => state.selectedSeismicRegion)
  const setRichterScale = useStore((state) => state.setRichterScale)
  const setIsEarthquakeAnimating = useStore((state) => state.setIsEarthquakeAnimating)
  const setEarthquakeAnimSpeed = useStore((state) => state.setEarthquakeAnimSpeed)
  const setEpicenterPoint = useStore((state) => state.setEpicenterPoint)
  const setEarthquakePickingMode = useStore((state) => state.setEarthquakePickingMode)
  const setSelectedSeismicRegion = useStore((state) => state.setSelectedSeismicRegion)

  const runHazardPrediction = useStore((state) => state.runHazardPrediction)
  const runSafeRoutePrediction = useStore((state) => state.runSafeRoutePrediction)
  const runWirelessPrediction = useStore((state) => state.runWirelessPrediction)
  const runGeoTwinPredictAll = useStore((state) => state.runGeoTwinPredictAll)

  const [activeTab, setActiveTab] = useState<ModuleTab>('hazards')
  const [isSidebarFloating, setIsSidebarFloating] = useState<boolean>(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false)
  const [isGlassMode, setIsGlassMode] = useState<boolean>(false)
  const [isCompactWidth, setIsCompactWidth] = useState<boolean>(false)
  const [expandedBuildingId, setExpandedBuildingId] = useState<string | null>(null)
  const safestPointObj = hazardReport?.safest_point || routeReport?.safest_point

  // Keyboard shortcut: Ctrl+B or Cmd+B to quickly slide panel in/out
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setIsSidebarCollapsed((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Scenario Controls
  const [rainfallMmHr, setRainfallMmHr] = useState<number>(60)
  const [soilSaturation, setSoilSaturation] = useState<number>(0.68)
  const [travelMode, setTravelMode] = useState<string>('emergency_vehicle')
  const [destinationSpec, setDestinationSpec] = useState<string>('high_ground_assembly')
  const [frequencyGhz, setFrequencyGhz] = useState<number>(3.5)
  const [txPowerDbm, setTxPowerDbm] = useState<number>(43)
  const [antennaGainDbi, setAntennaGainDbi] = useState<number>(16)
  const [antennaHeightM, setAntennaHeightM] = useState<number>(25)

  useEffect(() => {
    if (!hazardReport && !routeReport && !wirelessReport && !isGeoTwinLoading) {
      runGeoTwinPredictAll({
        rainfall_mm_hr: rainfallMmHr,
        soil_saturation: soilSaturation,
        destination: destinationSpec,
        travel_mode: travelMode,
        frequency_ghz: frequencyGhz,
      })
    }
  }, [sceneData?.job_id])

  const overlayButtons: Array<{ id: GeoTwin3DOverlayMode; label: string }> = [
    { id: 'none', label: 'Base 3D Twin' },
    { id: 'flood_susceptibility', label: 'Flood Susceptibility' },
    { id: 'landslide_susceptibility', label: 'Landslide Susceptibility' },
    { id: 'earthquake_intensity', label: '🌋 Earthquake (Richter)' },
    { id: 'wireless_coverage', label: '5G/6G RF Coverage & Towers' },
  ]

  return (
    <div className="w-full h-full flex overflow-hidden bg-slate-950 text-slate-100 relative">
      {/* Sliding Left AI Control & Telemetry Drawer Panel */}
      <div
        className={`${
          isSidebarFloating
            ? `absolute top-3 left-3 z-30 max-h-[calc(100vh-24px)] rounded-2xl shadow-2xl border border-slate-700/80 ${
                isGlassMode
                  ? 'bg-slate-900/75 hover:bg-slate-900/95 backdrop-blur-xl'
                  : 'bg-slate-900/95 backdrop-blur-xl'
              } ${isCompactWidth ? 'w-[360px]' : 'w-[460px]'} ${
                isSidebarCollapsed
                  ? '-translate-x-[115%] pointer-events-none opacity-0'
                  : 'translate-x-0 opacity-100'
              }`
            : `h-full border-r border-slate-800 shrink-0 ${
                isGlassMode ? 'bg-slate-900/85 backdrop-blur-md' : 'bg-slate-900'
              } ${
                isSidebarCollapsed
                  ? 'w-0 border-r-0 overflow-hidden pointer-events-none -translate-x-full opacity-0'
                  : isCompactWidth
                  ? 'w-[360px] translate-x-0 opacity-100'
                  : 'w-[460px] translate-x-0 opacity-100'
              }`
        } flex flex-col transition-all duration-300 ease-in-out relative`}
      >
        {/* Quick Edge Tab on Panel Border to Slide Out / Hide */}
        {!isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(true)}
            title="Slide Panel Left (Hide / Ctrl+B)"
            className="absolute top-1/2 -right-3.5 -translate-y-1/2 z-40 w-7 h-16 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-y border-r border-slate-700 shadow-2xl rounded-r-xl flex flex-col items-center justify-center cursor-pointer transition-all hover:translate-x-0.5 group"
          >
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 text-emerald-400" />
            <span className="text-[8px] font-mono font-bold text-slate-400 group-hover:text-slate-200 mt-1 [writing-mode:vertical-lr] rotate-180 tracking-widest">
              HIDE
            </span>
          </button>
        )}

        {/* Top Module Header with Floating, Docking, Glass HUD, Compact Width & Sideways Slide Controls */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-1">
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-[9px] font-bold tracking-wider">
                GEOTWIN RESPONSEOS
              </span>
              <span className="text-xs font-bold text-slate-100 truncate">
                Unified AI Pipeline
              </span>
            </div>
            <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
              Direct Neural Inference • Zero LLM Intermediary
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Glass / Translucent Mode Toggle */}
            <button
              onClick={() => setIsGlassMode(!isGlassMode)}
              title={isGlassMode ? "Switch to Solid Opaque Panel" : "Switch to Translucent HUD (Map visible beneath)"}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isGlassMode
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700'
              }`}
            >
              {isGlassMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>

            {/* Slim / Compact Width Toggle */}
            <button
              onClick={() => setIsCompactWidth(!isCompactWidth)}
              title={isCompactWidth ? "Expand to Standard Width (460px)" : "Shrink to Slim Width (360px)"}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isCompactWidth
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700'
              }`}
            >
              <FoldHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* Floating vs Docked Mode Toggle */}
            <button
              onClick={() => setIsSidebarFloating(!isSidebarFloating)}
              title={isSidebarFloating ? 'Dock to Side (Canvas resizes so map is never covered)' : 'Float over 3D Map'}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isSidebarFloating
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700'
              }`}
            >
              {isSidebarFloating ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>

            {/* Slide Out Sideways / Collapse */}
            <button
              onClick={() => setIsSidebarCollapsed(true)}
              title="Slide Panel Sideways (Ctrl+B to restore)"
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Slide Left</span>
            </button>

            <button
              onClick={() =>
                runGeoTwinPredictAll({
                  rainfall_mm_hr: rainfallMmHr,
                  soil_saturation: soilSaturation,
                  destination: destinationSpec,
                  travel_mode: travelMode,
                  frequency_ghz: frequencyGhz,
                })
              }
              disabled={isGeoTwinLoading}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-semibold flex items-center gap-1 cursor-pointer shadow-md shadow-emerald-950/40 ml-0.5 transition-all"
            >
                <Sparkles className="w-3 h-3" />
                <span>{isGeoTwinLoading ? 'Running...' : 'Run All'}</span>
              </button>
            </div>
          </div>

          {/* Module Navigation Tabs (Sideways Scrollable) */}
          <div className="flex items-center overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap border-b border-slate-800 bg-slate-950/90 text-[11px] font-medium px-2 py-1.5 gap-1 shrink-0">
            <button
              onClick={() => {
                setActiveTab('hazards')
                if (geotwinOverlayMode === 'none' || geotwinOverlayMode === 'safe_routes') {
                  setGeoTwinOverlayMode('flood_susceptibility')
                }
              }}
              className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 border transition-all cursor-pointer ${
                activeTab === 'hazards'
                  ? 'border-emerald-500/80 text-emerald-300 bg-slate-800/90 font-semibold shadow-xs'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Waves className="w-3.5 h-3.5 text-sky-400" />
              <span>Terrain Hazards</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('wireless')
                setGeoTwinOverlayMode('wireless_coverage')
              }}
              className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 border transition-all cursor-pointer ${
                activeTab === 'wireless'
                  ? 'border-emerald-500/80 text-emerald-300 bg-slate-800/90 font-semibold shadow-xs'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>5G/6G RF</span>
            </button>
            <button
              onClick={() => setActiveTab('validation')}
              className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 border transition-all cursor-pointer ${
                activeTab === 'validation'
                  ? 'border-emerald-500/80 text-emerald-300 bg-slate-800/90 font-semibold shadow-xs'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Validation</span>
            </button>
          </div>

        {/* Scrollable Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-200">
          {/* TAB 1: MODULE D - TERRAIN HAZARD SUSCEPTIBILITY */}
          {activeTab === 'hazards' && (
            <div className="space-y-4">
              <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-200">
                    Module D: Terrain Hazard Susceptibility
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                    {hazardReport?.model_version || 'GeoTwin-HazardGBM-v2.1'}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono mb-1">
                      <span className="text-slate-400">Scenario Rainfall Intensity:</span>
                      <span className="font-bold text-emerald-400">{rainfallMmHr} mm/hr</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={150}
                      step={5}
                      value={rainfallMmHr}
                      onChange={(e) => setRainfallMmHr(Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-mono mb-1">
                      <span className="text-slate-400">Antecedent Soil Saturation:</span>
                      <span className="font-bold text-emerald-400">{Math.round(soilSaturation * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={soilSaturation}
                      onChange={(e) => setSoilSaturation(Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                {/* Physical 3D Flood Surge Water Height Controller */}
                <div className="bg-gradient-to-b from-sky-950/40 to-slate-900/90 p-3.5 rounded-xl border border-sky-500/30 space-y-3 shadow-lg shadow-sky-950/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sky-300 font-bold text-xs uppercase tracking-wider">
                      <Waves className="w-4 h-4 text-sky-400" />
                      <span>Physical 3D Flood Surge Height</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={15}
                        step={0.1}
                        value={floodWaterLevelM}
                        onChange={(e) => {
                          setFloodWaterLevelM(Number(e.target.value))
                          setGeoTwinOverlayMode('flood_susceptibility')
                        }}
                        className="w-16 px-2 py-1 text-right font-mono font-bold text-xs bg-slate-950 rounded-lg border border-sky-500/50 text-sky-200 outline-none focus:ring-1 focus:ring-sky-400"
                      />
                      <span className="text-[10px] font-mono text-sky-400 font-semibold">m</span>
                    </div>
                  </div>

                  {/* Range Slider for immediate real-time 3D elevation adjustment */}
                  <div>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      step={0.1}
                      value={floodWaterLevelM}
                      onChange={(e) => {
                        setFloodWaterLevelM(Number(e.target.value))
                        setGeoTwinOverlayMode('flood_susceptibility')
                      }}
                      className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-sky-400/80 px-0.5 mt-1">
                      <span>0m (Dry)</span>
                      <span>3m (Moderate)</span>
                      <span>6m (Severe)</span>
                      <span>12m (Max Surge)</span>
                    </div>
                  </div>

                  {/* Rapid Flood Height Scenario Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: 'Dry (0m)', val: 0.0 },
                      { label: 'Surge (1.2m)', val: 1.2 },
                      { label: 'Moderate (2.5m)', val: 2.5 },
                      { label: '100-Yr (4.8m)', val: 4.8 },
                      { label: 'Extreme (8.0m)', val: 8.0 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setFloodWaterLevelM(preset.val)
                          setGeoTwinOverlayMode('flood_susceptibility')
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-medium transition-all cursor-pointer border ${
                          Math.abs(floodWaterLevelM - preset.val) < 0.1
                            ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-950/50 font-bold'
                            : 'bg-slate-900/90 hover:bg-sky-950 text-slate-300 border-slate-700 hover:border-sky-500'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Dynamic Flood Surge Animation Controls */}
                  <div className="pt-2.5 border-t border-sky-500/20 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setIsFloodAnimating(!isFloodAnimating)
                        setGeoTwinOverlayMode('flood_susceptibility')
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all ${
                        isFloodAnimating
                          ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                          : 'bg-sky-600 hover:bg-sky-500 text-white'
                      }`}
                    >
                      <span>{isFloodAnimating ? '⏸' : '▶'}</span>
                      <span>{isFloodAnimating ? 'Pause Surge Animation' : 'Animate Flood Surge 3D'}</span>
                    </button>

                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      {[0.5, 1.0, 2.0].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => setFloodAnimSpeed(spd)}
                          className={`px-2 py-1 rounded-lg font-bold cursor-pointer border transition-colors ${
                            floodAnimSpeed === spd
                              ? 'bg-sky-500 text-slate-950 border-sky-400 font-black'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Region Height Sampling & Submergence Inspector */}
                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                      <span>📍</span>
                      <span>Region Height & Submergence Check</span>
                    </span>
                    {selectedRegionHeight && (
                      <button
                        onClick={() => setSelectedRegionHeight(null)}
                        className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                      >
                        Clear Pin
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setFloodPickingMode(!floodPickingMode)
                      setGeoTwinOverlayMode('flood_susceptibility')
                    }}
                    className={`w-full py-2 px-3 rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      floodPickingMode
                        ? 'bg-sky-600 text-white border-sky-400 ring-2 ring-sky-500/50 animate-pulse shadow-md shadow-sky-900/40'
                        : selectedRegionHeight
                        ? 'bg-sky-950/60 border-sky-500/40 text-sky-200'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-200'
                    }`}
                  >
                    <span>🎯</span>
                    <span>
                      {floodPickingMode
                        ? 'Click on 3D Map to Sample Region...'
                        : selectedRegionHeight
                        ? `Sampled: ${selectedRegionHeight.building_name}`
                        : 'Click Map to Sample Region Height'}
                    </span>
                  </button>

                  {selectedRegionHeight && (
                    <div className="bg-slate-950/80 p-3 rounded-lg border border-sky-500/30 space-y-2.5 font-mono text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[12px] text-sky-200 flex items-center gap-1.5">
                          <span>{selectedRegionHeight.is_submerged ? '🌊' : '📍'}</span>
                          <span className="truncate">{selectedRegionHeight.building_name}</span>
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          selectedRegionHeight.is_submerged
                            ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                            : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {selectedRegionHeight.is_submerged ? 'SUBMERGED' : 'DRY ELEVATED'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                          <span className="text-slate-400 block mb-0.5">Region Elevation</span>
                          <span className="font-bold text-sky-300">+{selectedRegionHeight.elevation_m} m</span>
                        </div>
                        <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                          <span className="text-slate-400 block mb-0.5">Current Flood Line</span>
                          <span className="font-bold text-sky-300">+{floodWaterLevelM} m</span>
                        </div>
                        <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                          <span className="text-slate-400 block mb-0.5">Terrain Base</span>
                          <span className="font-bold text-slate-200">+{selectedRegionHeight.terrain_elev_m} m</span>
                        </div>
                        <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                          <span className="text-slate-400 block mb-0.5">Inundation Delta</span>
                          <span className={`font-bold ${
                            selectedRegionHeight.is_submerged ? 'text-rose-400' : 'text-emerald-400'
                          }`}>
                            {selectedRegionHeight.is_submerged
                              ? `-${selectedRegionHeight.inundation_depth_m}m Under`
                              : `+${(selectedRegionHeight.elevation_m - floodWaterLevelM).toFixed(1)}m Dry`
                            }
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setFloodWaterLevelM(selectedRegionHeight.elevation_m)
                          setGeoTwinOverlayMode('flood_susceptibility')
                        }}
                        className="w-full py-2 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] cursor-pointer shadow-md shadow-sky-900/30 flex items-center justify-center gap-1.5 transition-all"
                      >
                        <span>⚡</span>
                        <span>Set Flood Height to this Region's Elevation (+{selectedRegionHeight.elevation_m}m)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Physical 3D Seismic Ground Motion & Richter Scale Controller */}
                <div className="bg-gradient-to-b from-rose-950/30 via-slate-900/90 to-slate-900/95 p-3.5 rounded-xl border border-rose-500/30 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-rose-200 font-semibold text-[11px]">
                      <Activity className="w-4 h-4 text-rose-400" />
                      <span>Physical 3D Seismic Tremor & Richter Scale</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-rose-400 font-bold">M</span>
                      <input
                        type="number"
                        min={3.0}
                        max={9.0}
                        step={0.1}
                        value={richterScale}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setRichterScale(val)
                          setGeoTwinOverlayMode('earthquake_intensity')
                          runHazardPrediction({
                            earthquake_magnitude: val,
                            epicenter_px: epicenterPoint ?? undefined,
                          })
                        }}
                        className="w-16 py-1 px-1.5 text-right font-mono font-bold text-xs bg-slate-950 rounded-lg border border-rose-500/40 text-rose-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>
                  </div>

                  {/* Range Slider for immediate real-time Richter magnitude adjustment */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min={3.0}
                      max={9.0}
                      step={0.1}
                      value={richterScale}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        setRichterScale(val)
                        setGeoTwinOverlayMode('earthquake_intensity')
                        runHazardPrediction({
                          earthquake_magnitude: val,
                          epicenter_px: epicenterPoint ?? undefined,
                        })
                      }}
                      className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-rose-400/80 px-0.5">
                      <span>M 3.0 (Minor)</span>
                      <span>M 5.0 (Moderate)</span>
                      <span>M 7.0 (Major)</span>
                      <span>M 9.0 (Great)</span>
                    </div>
                  </div>

                  {/* Rapid Richter Magnitude Scenario Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: 'M 4.5 (Light)', val: 4.5 },
                      { label: 'M 6.0 (Strong)', val: 6.0 },
                      { label: 'M 7.2 (Major)', val: 7.2 },
                      { label: 'M 8.5 (Great)', val: 8.5 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setRichterScale(preset.val)
                          setGeoTwinOverlayMode('earthquake_intensity')
                          runHazardPrediction({
                            earthquake_magnitude: preset.val,
                            epicenter_px: epicenterPoint ?? undefined,
                          })
                        }}
                        className={`px-2 py-1 rounded-md text-[10px] font-mono font-medium transition-all cursor-pointer border ${
                          Math.abs(richterScale - preset.val) < 0.1
                            ? 'bg-rose-600 text-white border-rose-500 shadow-sm shadow-rose-900/50'
                            : 'bg-slate-950 hover:bg-rose-950/40 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Dynamic Seismic Tremor Animation Controls */}
                  <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setIsEarthquakeAnimating(!isEarthquakeAnimating)
                        setGeoTwinOverlayMode('earthquake_intensity')
                      }}
                      className={`flex-1 py-2 px-3 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all ${
                        isEarthquakeAnimating
                          ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse shadow-amber-900/40'
                          : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40'
                      }`}
                    >
                      <span>{isEarthquakeAnimating ? '⏸' : '▶'}</span>
                      <span>{isEarthquakeAnimating ? 'Pause Tremor Animation' : 'Simulate Earthquake Tremor 3D'}</span>
                    </button>

                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      {[0.5, 1.0, 2.0].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => setEarthquakeAnimSpeed(spd)}
                          className={`px-2 py-1 rounded font-bold cursor-pointer border transition-all ${
                            earthquakeAnimSpeed === spd
                              ? 'bg-rose-600 text-white border-rose-500 shadow-sm shadow-rose-900/40'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-850'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Epicenter Placement & Structural Stress Sampling */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        setEarthquakePickingMode(earthquakePickingMode === 'epicenter' ? null : 'epicenter')
                        setGeoTwinOverlayMode('earthquake_intensity')
                      }}
                      className={`py-2 px-2.5 rounded-lg font-semibold text-[10px] flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        earthquakePickingMode === 'epicenter'
                          ? 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-500/50 animate-pulse shadow-md shadow-rose-900/40'
                          : 'bg-slate-950 border-rose-500/30 hover:bg-rose-950/40 text-rose-200'
                      }`}
                    >
                      <span>🎯</span>
                      <span>{earthquakePickingMode === 'epicenter' ? 'Click Map for Epicenter' : 'Set Epicenter on Map'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setEarthquakePickingMode(earthquakePickingMode === 'building' ? null : 'building')
                        setGeoTwinOverlayMode('earthquake_intensity')
                      }}
                      className={`py-2 px-2.5 rounded-lg font-semibold text-[10px] flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        earthquakePickingMode === 'building'
                          ? 'bg-amber-600 text-white border-amber-400 ring-2 ring-amber-500/50 animate-pulse shadow-md shadow-amber-900/40'
                          : 'bg-slate-950 border-rose-500/30 hover:bg-rose-950/40 text-rose-200'
                      }`}
                    >
                      <span>🏢</span>
                      <span>{earthquakePickingMode === 'building' ? 'Click Building to Test' : 'Test Building Stress'}</span>
                    </button>
                  </div>
                </div>

                {/* Sampled Building Seismic Stress Card */}
                {selectedSeismicRegion && (
                  <div className="bg-slate-950/90 p-3.5 rounded-xl border border-rose-500/40 space-y-2.5 font-mono text-[11px] shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[12px] text-rose-200 flex items-center gap-1.5 truncate">
                        <span>🏢</span>
                        <span className="truncate">{selectedSeismicRegion.location_name || selectedSeismicRegion.name}</span>
                      </span>
                      <button
                        onClick={() => setSelectedSeismicRegion(null)}
                        className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer ml-1 shrink-0"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 block mb-0.5">Peak Ground Accel (PGA)</span>
                        <span className="font-bold text-rose-300">{selectedSeismicRegion.pga_g} g</span>
                      </div>
                      <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 block mb-0.5">Mercalli Intensity</span>
                        <span className="font-bold text-rose-300">{selectedSeismicRegion.mmi_intensity || `MMI ${selectedSeismicRegion.mmi}`}</span>
                      </div>
                      <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 block mb-0.5">Distance to Epicenter</span>
                        <span className="font-bold text-slate-200">{selectedSeismicRegion.epicenter_distance_m || Math.round((selectedSeismicRegion.distance_km || 0) * 1000)} m</span>
                      </div>
                      <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 block mb-0.5">Vibration Period</span>
                        <span className="font-bold text-slate-200">{selectedSeismicRegion.building_period_s ? `${selectedSeismicRegion.building_period_s}s` : 'N/A'}</span>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-[10px]">
                      <span className="font-bold text-rose-300">Structural Vulnerability: </span>
                      <span className="text-rose-200 font-semibold">{selectedSeismicRegion.damage_state || selectedSeismicRegion.damage_grade || 'Moderate Shaking'}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      runHazardPrediction({ rainfall_mm_hr: rainfallMmHr, soil_saturation: soilSaturation, earthquake_magnitude: richterScale, epicenter_px: epicenterPoint ?? undefined })
                      setGeoTwinOverlayMode('flood_susceptibility')
                    }}
                    className="py-2 px-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/80 border border-sky-500/40 text-sky-200 text-[11px] font-semibold cursor-pointer text-center transition-all shadow-sm"
                  >
                    Flood Risk 3D
                  </button>
                  <button
                    onClick={() => {
                      runHazardPrediction({ rainfall_mm_hr: rainfallMmHr, soil_saturation: soilSaturation, earthquake_magnitude: richterScale, epicenter_px: epicenterPoint ?? undefined })
                      setGeoTwinOverlayMode('landslide_susceptibility')
                    }}
                    className="py-2 px-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 text-amber-200 text-[11px] font-semibold cursor-pointer text-center transition-all shadow-sm"
                  >
                    Landslide 3D
                  </button>
                  <button
                    onClick={() => {
                      runHazardPrediction({ rainfall_mm_hr: rainfallMmHr, soil_saturation: soilSaturation, earthquake_magnitude: richterScale, epicenter_px: epicenterPoint ?? undefined })
                      setGeoTwinOverlayMode('earthquake_intensity')
                    }}
                    className="py-2 px-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-200 text-[11px] font-semibold cursor-pointer text-center transition-all shadow-sm"
                  >
                    Earthquake 3D
                  </button>
                </div>
              </div>

              {hazardReport && (
                <>
                  <div className="grid grid-cols-2 gap-2.5 font-mono text-[11px]">
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-sky-500/30 space-y-2 shadow-lg">
                      <div className="font-sans font-bold text-[10px] text-sky-300 uppercase tracking-wider">
                        Flood Susceptibility
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sky-400/80">Mean Prob:</span>
                        <span className="font-bold text-slate-100">{(hazardReport.flood_hazard.mean_susceptibility * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sky-400/80">High Risk Area:</span>
                        <span className="font-bold text-slate-100">{hazardReport.flood_hazard.high_risk_area_pct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sky-400/80">Max Ponding:</span>
                        <span className="font-bold text-slate-100">{hazardReport.flood_hazard.max_scenario_ponding_depth_m} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sky-400/80">Uncertainty:</span>
                        <span className="text-slate-300">±{(hazardReport.flood_hazard.mean_uncertainty * 100).toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2 shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-sans font-bold text-[10px] text-amber-300 uppercase tracking-wider">
                          Landslide & Slope
                        </span>
                        {hazardReport.landslide_hazard.min_factor_of_safety && (
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold border ${
                            hazardReport.landslide_hazard.min_factor_of_safety < 1.0
                              ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                              : hazardReport.landslide_hazard.min_factor_of_safety < 1.3
                              ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                          }`}>
                            Min FoS: {hazardReport.landslide_hazard.min_factor_of_safety}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-400/80">Mean Prob:</span>
                        <span className="font-bold text-slate-100">{(hazardReport.landslide_hazard.mean_susceptibility * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-400/80">High Risk Area:</span>
                        <span className="font-bold text-slate-100">{hazardReport.landslide_hazard.high_risk_area_pct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-400/80">High Area (m²):</span>
                        <span className="font-bold text-slate-100">{hazardReport.landslide_hazard.high_risk_area_m2} m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-400/80">Threshold:</span>
                        <span className="font-bold text-slate-100">{hazardReport.landslide_hazard.critical_slope_threshold_deg ?? '21.5'}° Slope</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-amber-400/80">Uncertainty:</span>
                        <span className="text-slate-300">±{(hazardReport.landslide_hazard.mean_uncertainty * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Landslide Geotechnical Slope Hotspots */}
                  {hazardReport.landslide_hazard?.hotspots && hazardReport.landslide_hazard.hotspots.length > 0 && (
                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-amber-500/40 space-y-2.5 shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[10px] uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Identified Unstable Slope Hotspots ({hazardReport.landslide_hazard.hotspots.length})</span>
                        </span>
                        <span className="text-[9px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40 font-semibold">
                          3D Visualized
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono text-[10px]">
                        {hazardReport.landslide_hazard.hotspots.map((hs: any) => (
                          <div key={hs.id} className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                            <div>
                              <div className="font-bold text-amber-200 flex items-center gap-1.5">
                                <span>{hs.id}</span>
                                <span className="text-slate-400 font-normal">({hs.pixel_xy[0]}, {hs.pixel_xy[1]})</span>
                              </div>
                              <div className="text-[9px] text-slate-400">
                                Slope: {hs.slope_deg}° • Elev: {hs.elevation_m}m
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`px-2 py-0.5 rounded font-bold text-[9px] border ${
                                hs.factor_of_safety < 1.0
                                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                              }`}>
                                FoS {hs.factor_of_safety}
                              </span>
                              <div className="text-[9px] text-amber-300 font-semibold mt-1">
                                {hs.susceptibility_pct}% Risk
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {hazardReport.landslide_hazard.stabilization_recommendations && (
                        <div className="pt-2 border-t border-amber-500/20 text-[10px] text-amber-200/90 space-y-1">
                          <span className="font-bold block text-amber-300">Stabilization Countermeasures:</span>
                          <p>• {hazardReport.landslide_hazard.stabilization_recommendations[0]}</p>
                          <p>• {hazardReport.landslide_hazard.stabilization_recommendations[2]}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Earthquake Seismic KPI Summary Card */}
                  {hazardReport.earthquake_hazard && (
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-rose-500/40 space-y-2.5 font-mono text-[11px] shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-sans font-bold text-[10px] text-rose-200 uppercase flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-rose-400" />
                          <span>Seismic Hazard & Ground Motion (M {hazardReport.earthquake_hazard.richter_magnitude})</span>
                        </span>
                        <span className="text-[9px] px-2 py-0.5 rounded font-bold bg-rose-950/80 text-rose-300 border border-rose-500/40">
                          {hazardReport.earthquake_hazard.mercalli_descriptor}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="flex justify-between p-1.5 bg-slate-950/80 rounded-lg border border-slate-800">
                          <span className="text-rose-400">Max PGA:</span>
                          <span className="font-bold text-slate-100">{hazardReport.earthquake_hazard.max_pga_g} g</span>
                        </div>
                        <div className="flex justify-between p-1.5 bg-slate-950/80 rounded-lg border border-slate-800">
                          <span className="text-rose-400">Mean PGA:</span>
                          <span className="font-bold text-slate-100">{hazardReport.earthquake_hazard.mean_pga_g} g</span>
                        </div>
                        <div className="flex justify-between p-1.5 bg-slate-950/80 rounded-lg border border-slate-800">
                          <span className="text-rose-400">Mercalli Scale:</span>
                          <span className="font-bold text-slate-100">MMI {hazardReport.earthquake_hazard.max_mmi}</span>
                        </div>
                        <div className="flex justify-between p-1.5 bg-slate-950/80 rounded-lg border border-slate-800">
                          <span className="text-rose-400">Collapse Risk:</span>
                          <span className="font-bold text-rose-300">{hazardReport.earthquake_hazard.buildings_at_collapse_risk_count} bldgs</span>
                        </div>
                        <div className="flex justify-between p-1.5 bg-slate-950/80 rounded-lg border border-slate-800">
                          <span className="text-rose-400">Focal Depth:</span>
                          <span className="text-slate-200">{hazardReport.earthquake_hazard.focal_depth_km} km</span>
                        </div>
                        <div className="flex justify-between p-1.5 bg-slate-950/80 rounded-lg border border-slate-800">
                          <span className="text-rose-400">P/S Velocity:</span>
                          <span className="text-slate-200">{hazardReport.earthquake_hazard.p_wave_velocity_kms} / {hazardReport.earthquake_hazard.s_wave_velocity_kms} km/s</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* POINT A & POINT B INTERACTIVE SAFEST ROUTE NAVIGATOR */}
                  <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-slate-900/90 space-y-3.5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Footprints className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-[12px] uppercase tracking-wider text-emerald-300">
                          Interactive Safest Route (A ➔ B)
                        </span>
                      </div>
                      <span className="font-mono text-[9px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded shadow-sm">
                        ZERO DEBRIS • FLAT GROUND
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-300 leading-relaxed">
                      Select two points (<b>Point A</b> and <b>Point B</b>) on the map to find the safest route avoiding rising flood water, structural collapse debris, and steep climbs.
                    </p>

                    {/* AI-IDENTIFIED SAFEST POINT ON MAP BANNER */}
                    {safestPointObj && (
                      <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 shadow-sm flex items-center justify-between text-[11px]">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                            <Shield className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20" />
                            <span>Safest Point on Map (Sanctuary)</span>
                          </div>
                          <div className="text-[10px] font-mono text-emerald-400/80">
                            Coord: ({safestPointObj.pixel_xy[0]}, {safestPointObj.pixel_xy[1]}) • Elev: +{safestPointObj.elevation_above_ground_m ?? 1.4}m
                          </div>
                          <div className="text-[9px] text-emerald-400">
                            {safestPointObj.flood_risk_pct}% Flood • Zero Rubble • Low Slope
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setRoutePointB(safestPointObj.pixel_xy)
                            runSafeRoutePrediction({
                              start_point: routePointA ?? 'auto_origin',
                              destination: safestPointObj.pixel_xy,
                              travel_mode: travelMode,
                              rainfall_mm_hr: rainfallMmHr,
                            })
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold cursor-pointer shadow-md shadow-emerald-900/30 flex items-center gap-1.5 transition-all"
                        >
                          <span>Route A ➔ Safest</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* POINT A & POINT B SELECTION MATRIX */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* POINT A: START */}
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[10px] text-sky-300 uppercase flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-sky-400" />
                            Point A (Start)
                          </span>
                          <span className="font-mono text-[9px] text-sky-400 font-semibold">
                            {routePointA ? `(${routePointA[0]}, ${routePointA[1]})` : 'Auto-Origin'}
                          </span>
                        </div>
                        <button
                          onClick={() => setRoutePickingMode(routePickingMode === 'A' ? null : 'A')}
                          className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-all border ${
                            routePickingMode === 'A'
                              ? 'bg-sky-600 text-white animate-pulse border-sky-400 shadow-md shadow-sky-900/40'
                              : 'bg-slate-900 text-sky-300 hover:bg-slate-850 border-slate-700'
                          }`}
                        >
                          <Crosshair className="w-3 h-3" />
                          <span>{routePickingMode === 'A' ? 'Click Map for A...' : 'Click Map to Set A'}</span>
                        </button>
                        <select
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === 'auto_origin') {
                              setRoutePointA(null)
                            } else {
                              const bld = sceneData?.buildings?.find((b) => String(b.id) === val)
                              if (bld && bld.center_px) {
                                setRoutePointA([Math.round(bld.center_px[0]), Math.round(bld.center_px[1])])
                              }
                            }
                          }}
                          className="w-full p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="auto_origin">Preset: Incident Origin Sector</option>
                          {sceneData?.buildings?.slice(0, 6).map((b) => (
                            <option key={b.id} value={b.id}>
                              Building {b.id} ({b.building_type || 'Structure'})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* POINT B: DESTINATION */}
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[10px] text-rose-300 uppercase flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-rose-400" />
                            Point B (Target)
                          </span>
                          <span className="font-mono text-[9px] text-rose-400 font-semibold">
                            {routePointB ? `(${routePointB[0]}, ${routePointB[1]})` : 'Safest High-Ground'}
                          </span>
                        </div>
                        <button
                          onClick={() => setRoutePickingMode(routePickingMode === 'B' ? null : 'B')}
                          className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-all border ${
                            routePickingMode === 'B'
                              ? 'bg-rose-600 text-white animate-pulse border-rose-400 shadow-md shadow-rose-900/40'
                              : 'bg-slate-900 text-rose-300 hover:bg-slate-850 border-slate-700'
                          }`}
                        >
                          <Crosshair className="w-3 h-3" />
                          <span>{routePickingMode === 'B' ? 'Click Map for B...' : 'Click Map to Set B'}</span>
                        </button>
                        <select
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === 'safest_point' && safestPointObj) {
                              setRoutePointB(safestPointObj.pixel_xy)
                            } else {
                              const bld = sceneData?.buildings?.find((b) => String(b.id) === val)
                              if (bld && bld.center_px) {
                                setRoutePointB([Math.round(bld.center_px[0]), Math.round(bld.center_px[1])])
                              }
                            }
                          }}
                          className="w-full p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="safest_point">Preset: Safest High-Ground Sanctuary</option>
                          {sceneData?.buildings?.slice(0, 6).map((b) => (
                            <option key={b.id} value={b.id}>
                              Building {b.id} ({b.building_type || 'Structure'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* TRAVEL MODE SELECTION */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-medium text-emerald-300">Evacuation Travel Mode:</label>
                      <select
                        value={travelMode}
                        onChange={(e) => setTravelMode(e.target.value)}
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="human_safest_evacuation">Safest Human Foot Evacuation (Zero Debris • Flat Ground • Low Elevation)</option>
                        <option value="emergency_vehicle">Emergency Response Vehicle (Fire / Rescue / Medic)</option>
                        <option value="standard_vehicle">Standard Civilian Vehicle</option>
                      </select>
                    </div>

                    {/* ACTION BUTTON */}
                    <button
                      onClick={() =>
                        runSafeRoutePrediction({
                          start_point: routePointA ?? 'auto_origin',
                          destination: routePointB ?? 'safest_point',
                          travel_mode: travelMode,
                          rainfall_mm_hr: rainfallMmHr,
                        })
                      }
                      disabled={isGeoTwinLoading}
                      className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-900/30 transition-all"
                    >
                      <Footprints className="w-3.5 h-3.5" />
                      <span>{isGeoTwinLoading ? 'Calculating Dynamic Safe Route...' : 'Calculate Safest Route (Point A ➔ Point B)'}</span>
                    </button>

                    {routeReport?.recommended_route && (
                      <div className="space-y-2 pt-2 border-t border-emerald-500/20">
                        {/* Human Walkability Rating Badge */}
                        <div className="p-2.5 rounded-lg bg-slate-950/90 border border-emerald-500/40 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                            <span className="font-bold text-emerald-300">
                              {routeReport.recommended_route.human_walkability_rating || 'Optimal Flat Foot-Path (Zero Debris • Low Elevation)'}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] font-bold text-emerald-400">
                            {routeReport.recommended_route.total_distance_m} m
                          </span>
                        </div>

                        {/* Traversability Performance Matrix */}
                        <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                          {/* 1. Low Elevation / Climb */}
                          <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 space-y-0.5">
                            <div className="font-sans text-[9px] uppercase font-bold text-emerald-400">Elevation Climb (ΔZ)</div>
                            <div className="font-bold text-[12px] text-slate-100">
                              {routeReport.recommended_route.cumulative_elevation_climb_m ?? 0.3} m
                            </div>
                            <div className="font-sans text-[9px] text-slate-400">Low Elevation • Easy Crossing</div>
                          </div>

                          {/* 2. Flat / Smooth Terrain */}
                          <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 space-y-0.5">
                            <div className="font-sans text-[9px] uppercase font-bold text-emerald-400">Max Slope Grade</div>
                            <div className="font-bold text-[12px] text-slate-100">
                              {routeReport.recommended_route.max_slope_deg ?? 3.4}°
                            </div>
                            <div className="font-sans text-[9px] text-slate-400">
                              {routeReport.recommended_route.terrain_smoothness || 'Smooth / Flat Ground (<4°)'}
                            </div>
                          </div>

                          {/* 3. Zero Debris Clearance */}
                          <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 space-y-0.5">
                            <div className="font-sans text-[9px] uppercase font-bold text-emerald-400">Debris-Free Path</div>
                            <div className="font-bold text-[12px] text-slate-100">
                              {routeReport.recommended_route.debris_free_clearance_pct ?? 100}% Clear
                            </div>
                            <div className="font-sans text-[9px] text-slate-400">Zero Structural Rubble</div>
                          </div>

                          {/* 4. Dry Ground / Flood Clearance */}
                          <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 space-y-0.5">
                            <div className="font-sans text-[9px] uppercase font-bold text-emerald-400">Dry Ground Path</div>
                            <div className="font-bold text-[12px] text-slate-100">
                              {routeReport.recommended_route.water_clearance_pct ?? 100}% Dry
                            </div>
                            <div className="font-sans text-[9px] text-slate-400">Avoids Rising Water</div>
                          </div>
                        </div>

                        {/* Walking Time & Detour Summary */}
                        <div className="flex items-center justify-between text-[10px] text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-mono">
                          <span>Est. Travel Time: <b className="font-bold text-slate-100">{routeReport.recommended_route.estimated_travel_time_min} min</b></span>
                          <span>Multi-Hazard Risk: <b className="font-bold text-slate-100">{(routeReport.recommended_route.mean_hazard_exposure * 100).toFixed(1)}%</b></span>
                        </div>

                        {/* 3D Viewport Layer Toggles */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[9px] font-sans text-emerald-400 font-medium">3D View:</span>
                          <button
                            onClick={() => setGeoTwinOverlayMode('safe_routes')}
                            className={`px-2 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-all border ${
                              geotwinOverlayMode === 'safe_routes'
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-slate-950 text-emerald-300 border-slate-800 hover:bg-slate-850'
                            }`}
                          >
                            Route Corridors
                          </button>
                          <button
                            onClick={() => setGeoTwinOverlayMode('flood_susceptibility')}
                            className={`px-2 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-all border ${
                              geotwinOverlayMode === 'flood_susceptibility'
                                ? 'bg-sky-600 text-white border-sky-500'
                                : 'bg-slate-950 text-sky-300 border-slate-800 hover:bg-slate-850'
                            }`}
                          >
                            Route + 3D Flood Rise
                          </button>
                          <button
                            onClick={() => setGeoTwinOverlayMode('landslide_susceptibility')}
                            className={`px-2 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-all border ${
                              geotwinOverlayMode === 'landslide_susceptibility'
                                ? 'bg-amber-600 text-white border-amber-500'
                                : 'bg-slate-950 text-amber-300 border-slate-800 hover:bg-slate-850'
                            }`}
                          >
                            Route + Slope 3D
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Exposed Buildings */}
                  <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2.5 shadow-lg">
                    <span className="font-semibold text-[10px] uppercase tracking-wider text-slate-400 block">
                      Top Exposed Buildings in 3D Scene
                    </span>
                    <div className="max-h-44 overflow-y-auto space-y-1.5">
                      {hazardReport.exposed_buildings?.slice(0, 10).map((eb: any) => (
                        <div
                          key={eb.building_id}
                          className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between font-mono text-[11px]"
                        >
                          <div>
                            <span className="font-bold text-slate-200">{eb.building_id}</span>
                            <span className="ml-2 text-[10px] font-sans text-slate-400">
                              {eb.dominant_hazard || eb.flood_risk_class}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sky-400 font-bold">
                              F:{(eb.flood_susceptibility * 100).toFixed(0)}%
                            </span>
                            <span className="ml-2 text-amber-400 font-bold">
                              L:{(eb.landslide_susceptibility * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: MODULE F - 5G / 6G WIRELESS COVERAGE & POINT-TO-POINT LINK */}
          {activeTab === 'wireless' && (
            <div className="space-y-4">
              {/* 1. Custom Tower Deployment & RF Specifications */}
              <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Module F: 5G/6G RF Propagation & Tower Specs</span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-300 bg-slate-950 border border-emerald-500/30 px-2 py-0.5 rounded">
                    {wirelessReport?.model_version || 'GeoTwin-RFPropNet-v1.2'}
                  </span>
                </div>

                {/* Map Placement Trigger for Tower */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setNetworkPickingMode(networkPickingMode === 'tower' ? null : 'tower')
                      setGeoTwinOverlayMode('wireless_coverage')
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      networkPickingMode === 'tower'
                        ? 'bg-cyan-600 text-white border-cyan-400 ring-2 ring-cyan-500/50 animate-pulse shadow-md shadow-cyan-900/40'
                        : customTowerPos
                        ? 'bg-sky-950/60 border-sky-500/40 text-sky-200'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-200'
                    }`}
                  >
                    <span>🗼</span>
                    <span>
                      {networkPickingMode === 'tower'
                        ? 'Click on 3D Map to Place Tower...'
                        : customTowerPos
                        ? `Custom Tower: (${customTowerPos[0]}, ${customTowerPos[1]})`
                        : 'Place Imaginary Tower on 3D Map'}
                    </span>
                  </button>

                  {customTowerPos && (
                    <button
                      onClick={() => {
                        setCustomTowerPos(null)
                        runWirelessPrediction({
                          frequency_ghz: frequencyGhz,
                          tx_power_dbm: txPowerDbm,
                          antenna_gain_dbi: antennaGainDbi,
                          antenna_height_agl_m: antennaHeightM,
                        })
                      }}
                      className="px-2.5 py-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-[10px] font-bold cursor-pointer transition-all"
                      title="Reset to default rooftop site"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Tower Specifications Controls */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-medium">Carrier Frequency Band</label>
                    <select
                      value={frequencyGhz}
                      onChange={(e) => setFrequencyGhz(Number(e.target.value))}
                      className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value={0.7}>0.7 GHz (5G Low-Band n28)</option>
                      <option value={3.5}>3.5 GHz (5G C-Band FR1)</option>
                      <option value={28.0}>28.0 GHz (5G mmWave FR2)</option>
                      <option value={100.0}>100.0 GHz (Experimental 6G Sub-THz)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-medium">
                      Tower Height AGL ({antennaHeightM}m)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={60}
                      step={5}
                      value={antennaHeightM}
                      onChange={(e) => setAntennaHeightM(Number(e.target.value))}
                      className="w-full mt-2 accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-medium">
                      Tx Power ({txPowerDbm} dBm / {Math.round(Math.pow(10, (txPowerDbm - 30) / 10) * 10) / 10}W)
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={49}
                      step={1}
                      value={txPowerDbm}
                      onChange={(e) => setTxPowerDbm(Number(e.target.value))}
                      className="w-full mt-2 accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-medium">
                      Antenna Gain ({antennaGainDbi} dBi)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={24}
                      step={1}
                      value={antennaGainDbi}
                      onChange={(e) => setAntennaGainDbi(Number(e.target.value))}
                      className="w-full mt-2 accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    runWirelessPrediction({
                      frequency_ghz: frequencyGhz,
                      tx_power_dbm: txPowerDbm,
                      antenna_gain_dbi: antennaGainDbi,
                      antenna_height_agl_m: antennaHeightM,
                    })
                    setGeoTwinOverlayMode('wireless_coverage')
                  }}
                  disabled={isGeoTwinLoading}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] cursor-pointer shadow-md shadow-emerald-900/30 transition-all"
                >
                  Recalculate 3D RF Propagation
                </button>
              </div>

              {/* 2. User Equipment (UE) Placement & Real-Time Link Budget */}
              <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                    <span>📱</span>
                    <span>User Device Signal & 3D Ray-Trace</span>
                  </span>
                  {userDevicePos && (
                    <button
                      onClick={() => {
                        setUserDevicePos(null)
                        runWirelessPrediction({
                          frequency_ghz: frequencyGhz,
                          tx_power_dbm: txPowerDbm,
                          antenna_gain_dbi: antennaGainDbi,
                          antenna_height_agl_m: antennaHeightM,
                          user_device_point: undefined,
                        })
                      }}
                      className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline font-medium cursor-pointer"
                    >
                      Clear Device
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    setNetworkPickingMode(networkPickingMode === 'user' ? null : 'user')
                    setGeoTwinOverlayMode('wireless_coverage')
                  }}
                  className={`w-full py-2 px-3 rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    networkPickingMode === 'user'
                      ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-500/50 animate-pulse shadow-md shadow-emerald-900/40'
                      : userDevicePos
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-200'
                  }`}
                >
                  <span>📍</span>
                  <span>
                    {networkPickingMode === 'user'
                      ? 'Click on 3D Map to Place User Device...'
                      : userDevicePos
                      ? `Device Position: (${userDevicePos[0]}, ${userDevicePos[1]})`
                      : 'Click Map to Place User Device (Test Signal)'}
                  </span>
                </button>

                {/* Point-to-Point Link Diagnostic Card */}
                {wirelessReport?.user_evaluation && (
                  <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 space-y-2.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[12px] text-slate-100 flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          wirelessReport.user_evaluation.is_los ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-rose-500 shadow-sm shadow-rose-500'
                        }`} />
                        <span>{wirelessReport.user_evaluation.signal_grade}</span>
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        wirelessReport.user_evaluation.is_los ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                      }`}>
                        {wirelessReport.user_evaluation.los_status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 block mb-0.5">Received Power (RSRP)</span>
                        <span className="font-bold text-sm text-slate-100">{wirelessReport.user_evaluation.rsrp_dbm} dBm</span>
                      </div>
                      <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 block mb-0.5">Est. Throughput</span>
                        <span className="font-bold text-sm text-emerald-300">{wirelessReport.user_evaluation.estimated_throughput_mbps} Mbps</span>
                      </div>
                      <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 block mb-0.5">SINR</span>
                        <span className="font-bold text-slate-200">{wirelessReport.user_evaluation.sinr_db} dB</span>
                      </div>
                      <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 block mb-0.5">Total Path Loss</span>
                        <span className="font-bold text-slate-200">{wirelessReport.user_evaluation.path_loss_db} dB</span>
                      </div>
                      <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 block mb-0.5">3D Distance</span>
                        <span className="font-bold text-slate-200">{wirelessReport.user_evaluation.distance_3d_m} m</span>
                      </div>
                      <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 block mb-0.5">Obstruction Loss</span>
                        <span className="font-bold text-amber-400">+{wirelessReport.user_evaluation.obstruction_excess_loss_db} dB</span>
                      </div>
                    </div>

                    {!wirelessReport.user_evaluation.is_los && (
                      <div className="p-2.5 bg-rose-950/60 border border-rose-500/40 rounded-lg text-rose-200 text-[10px] font-sans">
                        <span className="font-bold block text-rose-300">⚠️ Line-of-Sight Obstructed:</span>
                        <span>{wirelessReport.user_evaluation.obstructing_entity}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 font-sans italic">
                      💡 {wirelessReport.user_evaluation.recommendation}
                    </p>
                  </div>
                )}
              </div>

              {/* 3. Auto-Compute Optimal Tower Placement (City-Wide Signal Optimization) */}
              <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                    <span>🤖</span>
                    <span>City-Wide Optimal Tower Optimizer</span>
                  </span>
                </div>

                <button
                  onClick={async () => {
                    const res = await runWirelessPrediction({
                      frequency_ghz: frequencyGhz,
                      tx_power_dbm: txPowerDbm,
                      antenna_gain_dbi: antennaGainDbi,
                      antenna_height_agl_m: antennaHeightM,
                      optimize_placement: true,
                    })
                    if (res?.optimal_placement) {
                      setCustomTowerPos([res.optimal_placement.x_px, res.optimal_placement.y_px])
                    }
                    setGeoTwinOverlayMode('wireless_coverage')
                  }}
                  disabled={isGeoTwinLoading}
                  className="w-full py-2 px-3 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-semibold text-[11px] cursor-pointer shadow-md shadow-purple-900/40 flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>⚡</span>
                  <span>Auto-Compute Optimal Tower Location</span>
                </button>

                {wirelessReport?.optimal_placement && (
                  <div className="bg-slate-950/80 p-3.5 rounded-lg border border-purple-500/40 space-y-3 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-300">
                        Top Optimal Site: {wirelessReport.optimal_placement.candidate_id}
                      </span>
                      <span className="font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40 text-[10px]">
                        +{wirelessReport.optimal_placement.predicted_coverage_gain_pct}% City Gain
                      </span>
                    </div>

                    {/* Recommended Optimal Specs Card */}
                    <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/30 space-y-2">
                      <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-purple-200 flex items-center justify-between">
                        <span>🎯 Recommended Tower Specifications</span>
                        <span className="text-[9px] text-emerald-300 font-mono">
                          Avg Bld RSRP: {wirelessReport.optimal_placement.projected_building_mean_rsrp_dbm ?? wirelessReport.optimal_placement.projected_city_mean_rsrp_dbm} dBm
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[9px]">Carrier Band</span>
                          <span className="font-bold text-slate-100 truncate block">
                            {wirelessReport.optimal_placement.recommended_specs?.band_name || 'Mid-Band 5G NR C-Band (FR1 n78)'}
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[9px]">Transmit Power</span>
                          <span className="font-bold text-emerald-300">
                            {wirelessReport.optimal_placement.recommended_specs?.tx_power_dbm ?? 43} dBm ({wirelessReport.optimal_placement.recommended_specs?.tx_power_watts ?? 20}W)
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[9px]">Antenna Height</span>
                          <span className="font-bold text-purple-300">
                            {wirelessReport.optimal_placement.antenna_height_agl_m}m AGL
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[9px]">Antenna Gain / Tilt</span>
                          <span className="font-bold text-slate-100">
                            {wirelessReport.optimal_placement.recommended_specs?.antenna_gain_dbi ?? 16} dBi / {wirelessReport.optimal_placement.recommended_specs?.downtilt_deg ?? 6}° tilt
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[9px]">Location (Px)</span>
                          <span className="font-bold text-slate-100">
                            ({wirelessReport.optimal_placement.x_px}, {wirelessReport.optimal_placement.y_px})
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[9px]">Projected City Coverage</span>
                          <span className="font-bold text-purple-300">
                            {wirelessReport.optimal_placement.projected_city_coverage_pct}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-300 font-sans leading-relaxed">
                      {wirelessReport.optimal_placement.recommended_specs?.optimal_tradeoff_summary || wirelessReport.optimal_placement.rationale}
                    </p>

                    <button
                      onClick={() => {
                        if (wirelessReport?.optimal_placement) {
                          const specs = wirelessReport.optimal_placement.recommended_specs
                          if (specs) {
                            setFrequencyGhz(specs.frequency_ghz)
                            setTxPowerDbm(specs.tx_power_dbm)
                            setAntennaGainDbi(specs.antenna_gain_dbi)
                            setAntennaHeightM(specs.antenna_height_agl_m)
                          } else {
                            setAntennaHeightM(wirelessReport.optimal_placement.antenna_height_agl_m)
                          }
                          setCustomTowerPos([wirelessReport.optimal_placement.x_px, wirelessReport.optimal_placement.y_px])
                          runWirelessPrediction({
                            frequency_ghz: specs?.frequency_ghz ?? frequencyGhz,
                            tx_power_dbm: specs?.tx_power_dbm ?? txPowerDbm,
                            antenna_gain_dbi: specs?.antenna_gain_dbi ?? antennaGainDbi,
                            antenna_height_agl_m: specs?.antenna_height_agl_m ?? wirelessReport.optimal_placement.antenna_height_agl_m,
                            towers: [{
                              tower_id: wirelessReport.optimal_placement.candidate_id,
                              label: 'Optimal Macro Base Station',
                              x_px: wirelessReport.optimal_placement.x_px,
                              y_px: wirelessReport.optimal_placement.y_px,
                              antenna_height_agl_m: specs?.antenna_height_agl_m ?? wirelessReport.optimal_placement.antenna_height_agl_m,
                              frequency_ghz: specs?.frequency_ghz ?? frequencyGhz,
                              tx_power_dbm: specs?.tx_power_dbm ?? txPowerDbm,
                              antenna_gain_dbi: specs?.antenna_gain_dbi ?? antennaGainDbi,
                            }]
                          })
                        }
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-purple-700 hover:bg-purple-600 text-white border border-purple-400 font-bold text-[11px] cursor-pointer transition-all shadow-md shadow-purple-950/50 flex items-center justify-center gap-1.5"
                    >
                      <span>🚀</span>
                      <span>Apply Optimal Location & Recommended Specs</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Overall City Coverage KPIs */}
              {wirelessReport && (
                <>
                  <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2.5 font-mono text-[11px] shadow-lg">
                    <div className="font-sans font-semibold text-[10px] text-emerald-400 uppercase tracking-wider">
                      {wirelessReport.band_classification.band_name}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Mean RSRP</span>
                        <span className="font-bold text-sm text-slate-100">{wirelessReport.coverage_kpis.mean_rsrp_dbm} dBm</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Usable Coverage</span>
                        <span className="font-bold text-sm text-emerald-400">
                          {wirelessReport.coverage_kpis.usable_coverage_pct}%
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Clear 3D LoS</span>
                        <span className="font-bold text-slate-200">{wirelessReport.coverage_kpis.clear_los_pct}%</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block mb-0.5">Dead Zones (&lt;-110dBm)</span>
                        <span className="font-bold text-rose-400">
                          {wirelessReport.coverage_kpis.coverage_gap_dead_zone_pct}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Candidate Tower Sites (Ranked) */}
                  <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2.5 shadow-lg">
                    <span className="font-semibold text-[10px] uppercase tracking-wider text-slate-400 block">
                      AI-Ranked Candidate Tower Sites (Coverage Gap Fill)
                    </span>
                    <div className="space-y-2">
                      {wirelessReport.candidate_sites?.map((cand) => (
                        <div key={cand.candidate_id} className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                          <div className="flex justify-between font-mono text-[11px]">
                            <span className="font-bold text-purple-300">
                              #{cand.rank} {cand.candidate_id} ({cand.site_type})
                            </span>
                            <span className="font-bold text-emerald-400">
                              +{cand.predicted_coverage_gain_pct}% Gain
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400">{cand.placement_rationale}</p>
                          <button
                            onClick={() => {
                              setCustomTowerPos([cand.x_px, cand.y_px])
                              runWirelessPrediction({
                                frequency_ghz: frequencyGhz,
                                tx_power_dbm: txPowerDbm,
                                antenna_gain_dbi: antennaGainDbi,
                                antenna_height_agl_m: cand.recommended_antenna_agl_m,
                                towers: [{
                                  tower_id: cand.candidate_id,
                                  label: `Candidate Site #${cand.rank}`,
                                  x_px: cand.x_px,
                                  y_px: cand.y_px,
                                  antenna_height_agl_m: cand.recommended_antenna_agl_m,
                                  frequency_ghz: frequencyGhz,
                                  tx_power_dbm: txPowerDbm,
                                  antenna_gain_dbi: antennaGainDbi,
                                }]
                              })
                            }}
                            className="text-[10px] font-bold text-purple-400 hover:text-purple-300 cursor-pointer underline"
                          >
                            Deploy Tower at This Site
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5. Building & Per-Floor Signal Inspector */}
                  {wirelessReport.building_coverage_telemetry && wirelessReport.building_coverage_telemetry.length > 0 && (
                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-cyan-500/30 space-y-3 shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[11px] uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Building & Per-Floor Signal Inspector</span>
                        </span>
                        <span className="font-mono text-[9px] text-cyan-300 bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded font-bold">
                          {wirelessReport.building_coverage_telemetry.length} Buildings Analyzed
                        </span>
                      </div>

                      {/* Aggregated Building Telemetry KPI Bar */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                          <span className="text-slate-400 block mb-0.5">Avg Building Signal</span>
                          <span className="font-bold text-sm text-cyan-300">
                            {(
                              wirelessReport.building_coverage_telemetry.reduce((acc, b) => acc + b.average_rsrp_dbm, 0) /
                              wirelessReport.building_coverage_telemetry.length
                            ).toFixed(1)} dBm
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                          <span className="text-slate-400 block mb-0.5">High Coverage Buildings</span>
                          <span className="font-bold text-sm text-emerald-400">
                            {wirelessReport.building_coverage_telemetry.filter((b) => b.average_rsrp_dbm >= -100).length} / {wirelessReport.building_coverage_telemetry.length}
                          </span>
                        </div>
                      </div>

                      {/* Scrollable Building-by-Building List */}
                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1 font-mono text-[11px]">
                        {wirelessReport.building_coverage_telemetry.map((bld) => {
                          const isExpanded = expandedBuildingId === bld.building_id
                          const isGood = bld.average_rsrp_dbm >= -85
                          const isAcceptable = bld.average_rsrp_dbm >= -100
                          const isMarginal = bld.average_rsrp_dbm >= -110

                          const statusColor = isGood
                            ? 'text-emerald-400 bg-emerald-950/80 border-emerald-500/40'
                            : isAcceptable
                            ? 'text-cyan-300 bg-cyan-950/80 border-cyan-500/40'
                            : isMarginal
                            ? 'text-amber-300 bg-amber-950/80 border-amber-500/40'
                            : 'text-rose-400 bg-rose-950/80 border-rose-500/40'

                          return (
                            <div
                              key={bld.building_id}
                              className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/90 space-y-2 hover:border-slate-700 transition-all"
                            >
                              {/* Header: Building ID + Average RSRP */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-100">{bld.building_id}</span>
                                  <span className="text-[10px] text-slate-400 font-sans">
                                    ({bld.building_type || 'Building'} • {bld.estimated_height_m}m)
                                  </span>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${statusColor}`}>
                                  {bld.average_rsrp_dbm} dBm • {bld.signal_grade}
                                </span>
                              </div>

                              {/* Quick Floor Delta (Ground vs Top Floor) */}
                              <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-300 bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Ground Floor:</span>
                                  <span className="font-bold text-slate-200">{bld.ground_floor_rsrp_dbm} dBm</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Top Floor:</span>
                                  <span className="font-bold text-emerald-300">{bld.top_floor_rsrp_dbm} dBm</span>
                                </div>
                              </div>

                              {/* Expand / Collapse Per-Floor Breakdown Button */}
                              <button
                                onClick={() => setExpandedBuildingId(isExpanded ? null : bld.building_id)}
                                className="w-full pt-1 flex items-center justify-between text-[10px] text-cyan-400 hover:text-cyan-300 cursor-pointer font-sans"
                              >
                                <span className="flex items-center gap-1">
                                  <Signal className="w-3 h-3 text-cyan-400" />
                                  <span>{isExpanded ? 'Hide Floor-by-Floor Signal' : `Inspect All ${bld.total_floors} Floors`}</span>
                                </span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>

                              {/* Floor Breakdown Details */}
                              {isExpanded && bld.floors && (
                                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans font-semibold">
                                    Vertical Height Profile & Floor Penetration:
                                  </div>
                                  <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                                    {bld.floors.map((fl) => (
                                      <div
                                        key={fl.floor_number}
                                        className="flex items-center justify-between p-1.5 rounded bg-slate-900/90 border border-slate-800 text-[10px]"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span className={`w-1.5 h-1.5 rounded-full ${fl.is_los ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                          <span className="font-bold text-slate-200">
                                            {fl.floor_number === 1 ? 'Floor 1 (Ground)' : fl.floor_number === bld.total_floors ? `Floor ${fl.floor_number} (Roof)` : `Floor ${fl.floor_number}`}
                                          </span>
                                          <span className="text-[9px] text-slate-400 font-sans">
                                            (+{fl.height_agl_m}m)
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-slate-100">{fl.rsrp_dbm} dBm</span>
                                          <span
                                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                              fl.rsrp_dbm >= -85
                                                ? 'text-emerald-300 bg-emerald-950/60'
                                                : fl.rsrp_dbm >= -100
                                                ? 'text-cyan-300 bg-cyan-950/60'
                                                : fl.rsrp_dbm >= -110
                                                ? 'text-amber-300 bg-amber-950/60'
                                                : 'text-rose-300 bg-rose-950/60'
                                            }`}
                                          >
                                            {fl.grade}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 4: MODULE G - SCIENTIFIC VALIDATION & GOVERNANCE */}
          {activeTab === 'validation' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/40 space-y-1.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Direct Model Inference Verified</span>
                  </span>
                  <span className="font-mono text-[10px] bg-slate-950 text-slate-300 px-2 py-0.5 rounded border border-slate-800">
                    LLM in Loop: FALSE
                  </span>
                </div>
                <p className="text-[10px] text-slate-300">
                  All predictions flow directly from trained neural checkpoints (height_v2.pt) and calibrated
                  geospatial ensembles into the 3D scene.
                </p>
              </div>

              {/* Module Status & Held-Out Validation Table */}
              <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2.5 shadow-lg">
                <span className="font-semibold text-[10px] uppercase tracking-wider text-slate-400 block">
                  Module Implementation & Validation Registry
                </span>
                <div className="space-y-2">
                  {(governanceReport?.modules || []).map((m: any) => (
                    <div key={m.module_id} className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-slate-100">
                          {m.module_id}: {m.name}
                        </span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-semibold">
                          {m.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">{m.model_architecture}</div>
                      <div className="text-[10px] font-mono text-emerald-400">
                        Dataset: {m.training_dataset}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Standardized Prediction Records Sample */}
              {predictionRecords.length > 0 && (
                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2.5 shadow-lg">
                  <span className="font-semibold text-[10px] uppercase tracking-wider text-slate-400 block">
                    Standardized Prediction Records ({predictionRecords.length} Records)
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 font-mono text-[10px]">
                    {predictionRecords.slice(0, 8).map((rec: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80">
                        <div className="flex justify-between font-bold text-slate-200">
                          <span>{rec.object_or_location_id}</span>
                          <span className="text-emerald-400">{rec.prediction_type}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">
                          Model: {rec.model_version} | Status: {rec.validation_status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Interactive 3D Digital Twin Viewport with Overlay Bar */}
      <div className="flex-1 h-full relative flex flex-col overflow-hidden">
        {/* Floating Top Button to Reopen Sidebar when Collapsed */}
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            title="Slide Open GeoTwin Panel (Ctrl+B)"
            className="absolute top-3 left-3 z-30 px-3 py-1.5 rounded-lg bg-slate-900/95 backdrop-blur-md border border-slate-700 text-slate-100 font-semibold text-xs shadow-2xl flex items-center gap-1.5 hover:bg-slate-800 cursor-pointer transition-all"
          >
            <ChevronRight className="w-4 h-4 text-emerald-400" />
            <span>Slide Open AI Panel</span>
            <span className="text-[9px] text-slate-400 font-mono bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded font-bold">
              Ctrl+B
            </span>
          </button>
        )}

        {/* Floating Middle-Left Edge Slide Tab Handle (Always easily clickable to pull drawer back out) */}
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            title="Slide Open GeoTwin AI Panel (Ctrl+B)"
            className="absolute top-1/2 left-0 -translate-y-1/2 z-40 pl-2 pr-3.5 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white shadow-2xl rounded-r-2xl flex items-center gap-1.5 cursor-pointer transition-all hover:translate-x-1 group border-y border-r border-slate-700"
          >
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 text-emerald-400" />
            <span className="text-[10px] font-bold font-mono tracking-widest [writing-mode:vertical-lr] rotate-180">
              AI PANEL
            </span>
          </button>
        )}

        {/* Top Floating 3D Overlay Mode Switcher */}
        <div
          className={`absolute top-3 z-20 flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-700 shadow-lg transition-all duration-300 ${
            isSidebarCollapsed
              ? 'left-[225px]'
              : isSidebarFloating
              ? isCompactWidth
                ? 'left-[385px]'
                : 'left-[485px]'
              : 'left-3'
          }`}
        >
          <span className="text-[10px] font-mono uppercase text-slate-400 px-2 flex items-center gap-1">
            <Layers className="w-3 h-3 text-emerald-400" />
            <span>3D AI Layer:</span>
          </span>
          {overlayButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => {
                setGeoTwinOverlayMode(btn.id)
                if (btn.id === 'flood_susceptibility' || btn.id === 'landslide_susceptibility' || btn.id === 'earthquake_intensity') {
                  setActiveTab('hazards')
                  if (btn.id === 'earthquake_intensity' && !hazardReport?.earthquake_hazard) {
                    runHazardPrediction({
                      earthquake_magnitude: richterScale,
                      epicenter_px: epicenterPoint ?? undefined,
                    })
                  }
                } else if (btn.id === 'wireless_coverage') {
                  setActiveTab('wireless')
                }
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                geotwinOverlayMode === btn.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {btn.label}
            </button>
          ))}

          {/* Quick Floating Flood Controls Bar when Flood Mode is active */}
          {geotwinOverlayMode === 'flood_susceptibility' && (
            <div className="flex items-center gap-2 ml-auto bg-sky-950/95 border border-sky-400/80 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-sky-200 shadow-md">
              <span className="flex items-center gap-1">
                <span>🌊</span>
                <span>Surge:</span>
                <input
                  type="number"
                  min={0}
                  max={15}
                  step={0.1}
                  value={floodWaterLevelM}
                  onChange={(e) => setFloodWaterLevelM(Number(e.target.value))}
                  className="w-14 px-1 py-0.5 text-center font-bold bg-sky-900 border border-sky-400 rounded text-white text-[11px]"
                />
                <span>m</span>
              </span>
              <button
                onClick={() => setIsFloodAnimating(!isFloodAnimating)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  isFloodAnimating ? 'bg-amber-500 text-white animate-pulse' : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
              >
                {isFloodAnimating ? '⏸ Pause' : '▶ Animate'}
              </button>
              <button
                onClick={() => setFloodPickingMode(!floodPickingMode)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  floodPickingMode ? 'bg-cyan-400 text-slate-900 ring-2 ring-cyan-300' : 'bg-sky-800 hover:bg-sky-700 text-sky-100'
                }`}
                title="Sample Region Height"
              >
                📍 Sample Region
              </button>
            </div>
          )}

          {/* Quick Floating Earthquake Controls Bar when Earthquake Mode is active */}
          {geotwinOverlayMode === 'earthquake_intensity' && (
            <div className="flex items-center gap-2 ml-auto bg-rose-950/95 border border-rose-400/80 px-2.5 py-0.5 rounded-lg text-[11px] font-mono text-rose-200 shadow-md">
              <span className="flex items-center gap-1">
                <span>🌋</span>
                <span>Richter:</span>
                <input
                  type="number"
                  min={3.0}
                  max={9.0}
                  step={0.1}
                  value={richterScale}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setRichterScale(val)
                    runHazardPrediction({
                      earthquake_magnitude: val,
                      epicenter_px: epicenterPoint ?? undefined,
                    })
                  }}
                  className="w-14 px-1 py-0.5 text-center font-bold bg-rose-900 border border-rose-400 rounded text-white text-[11px]"
                />
                <span>M</span>
              </span>
              <button
                onClick={() => setIsEarthquakeAnimating(!isEarthquakeAnimating)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  isEarthquakeAnimating ? 'bg-amber-500 text-white animate-pulse' : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {isEarthquakeAnimating ? '⏸ Pause' : '▶ Animate'}
              </button>
              <button
                onClick={() => setEarthquakePickingMode(earthquakePickingMode === 'epicenter' ? null : 'epicenter')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  earthquakePickingMode === 'epicenter' ? 'bg-rose-400 text-slate-900 ring-2 ring-rose-300' : 'bg-rose-850 hover:bg-rose-800 text-rose-100'
                }`}
                title="Position Epicenter"
              >
                🎯 Epicenter
              </button>
            </div>
          )}
        </div>

        <SceneCanvas />
        <HazardImpactHUD />
      </div>
    </div>
  )
}
export default GeoTwinResponseView
