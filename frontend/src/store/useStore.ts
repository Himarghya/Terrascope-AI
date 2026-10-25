import { create } from 'zustand'
import {
  SceneData,
  ImageMetadata,
  SampleDataset,
  BuildingFeature,
  TreeFeature,
  Building3DMesh,
  GeoreferenceBounds,
  MeasuredRasterMeta,
  ValidationReport,
  GeoDepthMeasurement,
  CalibrationData,
  TerrainAnalytics,
  GeoTwin3DOverlayMode,
  TerrainHazardReport,
  SafeRouteReport,
  WirelessCoverageReport,
  CityDetailData,
  BuildingDetailMesh,
  MeshValidationReport,
  CityExportResult,
  VoiceState,
  Agent37Message,
  Agent37ModelCatalog,
} from '../types'
import { formatBuildingNarration } from '../services/buildingNarration'

let currentAudioElement: HTMLAudioElement | null = null
let currentSpeechAbort: AbortController | null = null

import {
  loadGeoTiffMetadata,
  loadIntersectingGeoTiffWindow,
  sampleElevationAtWgs84,
  fillElevationGaps,
  bakeHypsometricAndContours,
  evaluateValidationCheckpoints,
  generateProceduralSatelliteSample,
  GeoTiffRasterData,
} from '../services/measuredElevation'

export type ViewMode = '3d' | 'satellite' | 'classification' | 'sihe' | 'split'
export type CameraPreset =
  | 'perspective'
  | 'top'
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'ground'
  | 'under'
  | 'side'
  | 'reset'

export type NavigationScreen =
  | 'projects'
  | 'image-analysis'
  | '3d-reconstruction'
  | 'city-detail-studio'
  | 'height-estimation'
  | 'disaster-intelligence'
  | 'geotwin-response'
  | 'feature-inventory'
  | 'exports'
  | 'settings'

interface StoreState {
  // Navigation & Workspace State
  activeScreen: NavigationScreen
  sidebarCollapsed: boolean
  inspectorOpen: boolean
  isGsdModalOpen: boolean

  // Processing & Job State
  samples: SampleDataset[]
  selectedSampleId: string | null
  currentJobId: string | null
  isProcessing: boolean
  jobProgress: number
  jobStep: string
  jobError: string | null

  // Active Scene Data
  sceneData: SceneData | null
  selectedFeature: {
    type: 'building' | 'vegetation' | 'terrain'
    id: string
    data: any
  } | null
  hoveredFeatureId: string | null

  // Visualization & Camera Controls
  viewMode: ViewMode
  cameraPreset: CameraPreset
  isAutoRotating: boolean
  targetFocusPosition: [number, number, number] | null
  verticalExaggeration: number
  sunAzimuth: number
  sunElevation: number

  // Layer Visibility
  layerVisibility: {
    terrain: boolean
    buildings: boolean
    walls: boolean
    roofs: boolean
    roads: boolean
    vegetation: boolean
    satelliteTexture: boolean
    water: boolean
    wireframe: boolean
    shadows: boolean
  }

  // Terra3D Measured Elevation & Georeference State
  georeferenceBounds: GeoreferenceBounds | null
  dtmMeta: MeasuredRasterMeta | null
  dsmMeta: MeasuredRasterMeta | null
  dtmRasterData: GeoTiffRasterData | null
  dsmRasterData: GeoTiffRasterData | null
  measuredDtmGrid: Float32Array | null
  measuredDsmGrid: Float32Array | null
  measuredGridResolution: [number, number] | null
  measuredOffsetRemoved: number | null
  validationPointsText: string
  validationReport: ValidationReport | null
  showDsmSurface: boolean
  textureMode: 'sat' | 'hyp' | 'lc' | 'sihe'
  hypsometricTextureUrl: string | null

  // GeoDepth 3D State
  inputMode: 'mode_a' | 'mode_b'
  isCalibrated: boolean
  calibrationData: CalibrationData | null
  terrainAnalytics: TerrainAnalytics | null
  measurementMode: boolean
  measurements: GeoDepthMeasurement[]
  activeMeasurementPoints: [number, number, number][]
  flythroughActive: boolean
  activeColormap: 'rgb' | 'hypsometric' | 'viridis' | 'magma' | 'slope' | 'aspect' | 'landcover'

  // Active Tab in Sidebar
  activeSidebarTab: 'upload' | 'reconstruction' | 'calibration' | 'analytics' | 'measurements' | 'exports' | 'source' | 'layers' | 'inspector'

  // Actions
  setActiveScreen: (screen: NavigationScreen) => void
  toggleSidebar: () => void
  setInspectorOpen: (open: boolean) => void
  toggleInspector: () => void
  fetchSamples: () => Promise<void>
  loadSampleScene: (sampleId: string, customGsd?: number) => Promise<void>
  setGsdModalOpen: (open: boolean) => void
  changeGsd: (newGsd: number, mode: 'scale' | 'rerun') => Promise<void>
  processUploadedFile: (file: File, gsd_m?: number) => Promise<void>
  pollJobStatus: (jobId: string) => Promise<void>
  setViewMode: (mode: ViewMode) => void
  setCameraPreset: (preset: CameraPreset) => void
  toggleAutoRotate: () => void
  setIsAutoRotating: (rotating: boolean) => void
  setTargetFocusPosition: (pos: [number, number, number] | null) => void
  setVerticalExaggeration: (scale: number) => void
  setSunLighting: (azimuth: number, elevation: number) => void
  toggleLayer: (layer: keyof StoreState['layerVisibility']) => void
  selectFeature: (feature: { type: 'building' | 'vegetation' | 'terrain'; id: string; data: any } | null) => void
  setHoveredFeatureId: (id: string | null) => void
  setActiveSidebarTab: (tab: 'upload' | 'reconstruction' | 'calibration' | 'analytics' | 'measurements' | 'exports' | 'source' | 'layers' | 'inspector') => void
  setGeoreferenceBounds: (bounds: GeoreferenceBounds | null) => void
  loadDtmFile: (file: File) => Promise<void>
  loadDsmFile: (file: File) => Promise<void>
  setValidationPointsText: (text: string) => void
  evaluateValidationPoints: () => void
  toggleDsmSurface: (show?: boolean) => void
  setTextureMode: (mode: 'sat' | 'hyp' | 'lc' | 'sihe') => void
  bakeHypsometricTexture: () => Promise<void>
  loadProceduralSample: () => Promise<void>
  editBuilding: (buildingId: string, height_m?: number, roof_shape?: string, base_color_hex?: string) => Promise<void>
  deleteBuilding: (buildingId: string) => Promise<void>
  splitBuilding: (buildingId: string, axis?: 'auto' | 'long' | 'short', splitRatio?: number) => Promise<void>
  mergeBuildings: (buildingIds: string[]) => Promise<void>
  editVegetation: (treeId: string, canopy_height_m?: number, vegetation_category?: string, tree_model_type?: string) => Promise<void>

  // GeoDepth 3D Actions
  setInputMode: (mode: 'mode_a' | 'mode_b') => void
  setMeasurementMode: (active: boolean) => void
  setFlythroughActive: (active: boolean) => void
  setActiveColormap: (colormap: 'rgb' | 'hypsometric' | 'viridis' | 'magma' | 'slope' | 'aspect' | 'landcover') => void
  addMeasurementPoint: (point: [number, number, number]) => void
  clearMeasurements: () => void
  deleteMeasurement: (id: string) => void
  runGeoDepthPipeline: (params: { file?: File; sampleId?: string; gsd_m?: number; mode?: string }) => Promise<void>
  calibrateKnownDistance: (pixelDist: number, knownM: number) => Promise<boolean>
  calibrateElevationControlPoints: (points: any[]) => Promise<boolean>
  calibrateCopernicusDEM: (bounds?: any) => Promise<boolean>
  exportGISAsset: (exportType: string, measurements?: any[]) => Promise<any>

  // GeoTwin ResponseOS Unified State & Actions
  geotwinOverlayMode: GeoTwin3DOverlayMode
  hazardReport: TerrainHazardReport | null
  routeReport: SafeRouteReport | null
  wirelessReport: WirelessCoverageReport | null
  disasterReport: any | null
  governanceReport: any | null
  predictionRecords: any[]
  isGeoTwinLoading: boolean
  routePointA: [number, number] | null
  routePointB: [number, number] | null
  routePickingMode: 'A' | 'B' | null
  setRoutePointA: (pt: [number, number] | null) => void
  setRoutePointB: (pt: [number, number] | null) => void
  setRoutePickingMode: (mode: 'A' | 'B' | null) => void
  customTowerPos: [number, number] | null
  userDevicePos: [number, number] | null
  networkPickingMode: 'tower' | 'user' | null
  setCustomTowerPos: (pt: [number, number] | null) => void
  setUserDevicePos: (pt: [number, number] | null) => void
  setNetworkPickingMode: (mode: 'tower' | 'user' | null) => void
  floodWaterLevelM: number
  isFloodAnimating: boolean
  floodAnimSpeed: number
  floodPickingMode: boolean
  selectedRegionHeight: {
    x_px: number
    y_px: number
    world_3d: [number, number, number]
    elevation_m: number
    terrain_elev_m: number
    building_height_m: number
    building_id?: string | null
    building_name?: string | null
    is_submerged: boolean
    inundation_depth_m: number
  } | null
  setFloodWaterLevelM: (level: number) => void
  setIsFloodAnimating: (animating: boolean) => void
  setFloodAnimSpeed: (speed: number) => void
  setFloodPickingMode: (picking: boolean) => void
  setSelectedRegionHeight: (info: any) => void
  richterScale: number
  isEarthquakeAnimating: boolean
  earthquakeAnimSpeed: number
  epicenterPoint: [number, number] | null
  earthquakePickingMode: 'epicenter' | 'building' | boolean | null
  selectedSeismicRegion: {
    x_px: number
    y_px: number
    world_3d: [number, number, number]
    name: string
    pga_g: number
    mmi: number
    distance_km?: number
    damage_grade?: string
    damage_state?: string
    location_name?: string
    mmi_intensity?: string | number
    epicenter_distance_m?: number
    building_period_s?: number
  } | null
  setRichterScale: (mag: number) => void
  setIsEarthquakeAnimating: (animating: boolean) => void
  setEarthquakeAnimSpeed: (spd: number) => void
  setEpicenterPoint: (pt: [number, number] | null) => void
  setEarthquakePickingMode: (picking: 'epicenter' | 'building' | boolean | null) => void
  setSelectedSeismicRegion: (info: any) => void
  setGeoTwinOverlayMode: (mode: GeoTwin3DOverlayMode) => void
  setDisasterReport: (report: any | null) => void
  runHazardPrediction: (params?: { rainfall_mm_hr?: number; soil_saturation?: number; earthquake_magnitude?: number; earthquake_depth_km?: number; epicenter_px?: [number, number] }) => Promise<TerrainHazardReport | null>
  runSafeRoutePrediction: (params?: { start_point?: any; destination?: any; travel_mode?: string; verified_closures?: any[]; rainfall_mm_hr?: number }) => Promise<SafeRouteReport | null>
  runWirelessPrediction: (params?: { frequency_ghz?: number; tx_power_dbm?: number; antenna_gain_dbi?: number; antenna_height_agl_m?: number; towers?: any[]; user_device_point?: [number, number]; optimize_placement?: boolean; field_measurements?: any[] }) => Promise<WirelessCoverageReport | null>
  runGeoTwinPredictAll: (params?: { rainfall_mm_hr?: number; soil_saturation?: number; destination?: any; travel_mode?: string; frequency_ghz?: number }) => Promise<void>

  // City Detail Studio State & Actions
  cityDetailData: CityDetailData | null
  isGeneratingCityDetail: boolean
  cityDetailTier: 'low' | 'medium' | 'high'
  cityStyle: string
  includeProps: boolean
  includeSidewalks: boolean
  cityPreviewMode: 'solid' | 'wireframe' | 'ucx_collision' | 'component_colors'
  selectedDetailedBuildingId: string | null
  cityExportResult: CityExportResult | null
  isExportingCity: boolean
  isCyberpunkCityMode: boolean

  setCityDetailTier: (tier: 'low' | 'medium' | 'high') => void
  setCityStyle: (style: string) => void
  setIsCyberpunkCityMode: (enabled: boolean) => void
  setIncludeProps: (include: boolean) => void
  setIncludeSidewalks: (include: boolean) => void
  setCityPreviewMode: (mode: 'solid' | 'wireframe' | 'ucx_collision' | 'component_colors') => void
  setSelectedDetailedBuildingId: (id: string | null) => void
  generateDetailedCity: (options?: { tier?: string; style?: string; props?: boolean; sidewalks?: boolean }) => Promise<CityDetailData | null>
  detailSingleBuilding: (buildingId: string, styleOverrides?: any, tier?: string) => Promise<BuildingDetailMesh | null>
  exportDetailedCity: (targetEngine?: string) => Promise<CityExportResult | null>
  validateCityGeometry: () => Promise<MeshValidationReport | null>

  // Voice & Agent37 State & Actions
  voiceState: VoiceState
  agent37Messages: Agent37Message[]
  isAgent37Thinking: boolean
  agent37Status: any | null
  agent37ModelCatalog: Agent37ModelCatalog | null
  fetchAgent37Models: () => Promise<void>
  selectAgent37Model: (modelId: string) => Promise<void>
  setVoiceState: (state: Partial<VoiceState>) => void
  checkVoiceAndAgent37Status: () => Promise<void>
  fetchAvailableVoices: () => Promise<void>
  setSelectedVoiceId: (voiceId: string) => void
  downloadLastSpokenAudio: () => void
  speakText: (text: string) => Promise<void>
  sendVoiceCommand: (command: string) => Promise<any>
  sendAgent37Query: (prompt: string) => Promise<any>
  clearAgent37History: () => void

  // Voice Narration on 3D Building Click
  voiceNarrationOnClick: boolean
  toggleVoiceNarrationOnClick: () => void
  setVoiceNarrationOnClick: (enabled: boolean) => void
  narrateBuilding: (building: any) => Promise<void>
}


export const useStore = create<StoreState>((set, get) => ({
  activeScreen: '3d-reconstruction',
  sidebarCollapsed: false,
  inspectorOpen: true,
  isGsdModalOpen: false,

  setActiveScreen: (screen) => set({ activeScreen: screen }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  toggleInspector: () => set((state) => ({ inspectorOpen: !state.inspectorOpen })),
  setGsdModalOpen: (open) => set({ isGsdModalOpen: open }),

  samples: [],
  selectedSampleId: 'jacksonville_aerial',
  currentJobId: null,
  isProcessing: false,
  jobProgress: 0,
  jobStep: '',
  jobError: null,

  sceneData: null,
  selectedFeature: null,
  hoveredFeatureId: null,

  viewMode: '3d',
  cameraPreset: 'perspective',
  isAutoRotating: false,
  toggleAutoRotate: () => set((state) => ({ isAutoRotating: !state.isAutoRotating })),
  setIsAutoRotating: (rotating) => set({ isAutoRotating: rotating }),
  targetFocusPosition: null,
  verticalExaggeration: 1.0,
  sunAzimuth: 135,
  sunElevation: 45,

  layerVisibility: {
    terrain: true,
    buildings: true,
    walls: true,
    roofs: true,
    roads: true,
    vegetation: true,
    satelliteTexture: true,
    water: true,
    wireframe: false,
    shadows: true,
  },

  // Terra3D Measured Elevation & Georeference State
  georeferenceBounds: null,
  dtmMeta: null,
  dsmMeta: null,
  dtmRasterData: null,
  dsmRasterData: null,
  measuredDtmGrid: null,
  measuredDsmGrid: null,
  measuredGridResolution: null,
  measuredOffsetRemoved: null,
  validationPointsText: '',
  validationReport: null,
  showDsmSurface: false,
  textureMode: 'sat',
  hypsometricTextureUrl: null,

  activeSidebarTab: 'reconstruction',

  // GeoDepth 3D Initial State
  inputMode: 'mode_a',
  isCalibrated: false,
  calibrationData: null,
  terrainAnalytics: null,
  measurementMode: false,
  measurements: [],
  activeMeasurementPoints: [],
  flythroughActive: false,
  activeColormap: 'rgb',

  // GeoTwin ResponseOS Initial State
  geotwinOverlayMode: 'none',
  hazardReport: null,
  routeReport: null,
  wirelessReport: null,
  disasterReport: null,
  governanceReport: null,
  predictionRecords: [],
  isGeoTwinLoading: false,
  routePointA: null,
  routePointB: null,
  routePickingMode: null,
  setRoutePointA: (pt) => set({ routePointA: pt }),
  setRoutePointB: (pt) => set({ routePointB: pt }),
  setRoutePickingMode: (mode) => set({ routePickingMode: mode }),
  customTowerPos: null,
  userDevicePos: null,
  networkPickingMode: null,
  setCustomTowerPos: (pt) => set({ customTowerPos: pt }),
  setUserDevicePos: (pt) => set({ userDevicePos: pt }),
  setNetworkPickingMode: (mode) => set({ networkPickingMode: mode }),
  floodWaterLevelM: 2.2,
  isFloodAnimating: false,
  floodAnimSpeed: 1.0,
  floodPickingMode: false,
  selectedRegionHeight: null,
  setFloodWaterLevelM: (level) => set({ floodWaterLevelM: Math.max(0, Math.round(level * 100) / 100) }),
  setIsFloodAnimating: (animating) => set({ isFloodAnimating: animating }),
  setFloodAnimSpeed: (speed) => set({ floodAnimSpeed: speed }),
  setFloodPickingMode: (picking) => set({ floodPickingMode: picking }),
  setSelectedRegionHeight: (info) => set({ selectedRegionHeight: info }),
  richterScale: 6.5,
  isEarthquakeAnimating: false,
  earthquakeAnimSpeed: 1.0,
  epicenterPoint: null,
  earthquakePickingMode: false,
  selectedSeismicRegion: null,
  setRichterScale: (mag) => set({ richterScale: Math.max(3.0, Math.min(9.5, Math.round(mag * 10) / 10)) }),
  setIsEarthquakeAnimating: (animating) => set({ isEarthquakeAnimating: animating }),
  setEarthquakeAnimSpeed: (spd) => set({ earthquakeAnimSpeed: spd }),
  setEpicenterPoint: (pt) => set({ epicenterPoint: pt }),
  setEarthquakePickingMode: (picking) => set({ earthquakePickingMode: picking }),
  setSelectedSeismicRegion: (info) => set({ selectedSeismicRegion: info }),
  setGeoTwinOverlayMode: (mode) => set({ geotwinOverlayMode: mode }),
  setDisasterReport: (report) => set({ disasterReport: report }),

  // City Detail Studio Initial State
  cityDetailData: null,
  isGeneratingCityDetail: false,
  cityDetailTier: 'medium',
  cityStyle: 'modern_urban',
  includeProps: true,
  includeSidewalks: true,
  cityPreviewMode: 'solid',
  selectedDetailedBuildingId: null,
  cityExportResult: null,
  isExportingCity: false,
  isCyberpunkCityMode: false,

  setCityDetailTier: (tier) => set({ cityDetailTier: tier }),
  setCityStyle: (style) => set({ cityStyle: style }),
  setIsCyberpunkCityMode: (enabled) => set({ isCyberpunkCityMode: enabled }),
  setIncludeProps: (include) => set({ includeProps: include }),
  setIncludeSidewalks: (include) => set({ includeSidewalks: include }),
  setCityPreviewMode: (mode) => set({ cityPreviewMode: mode }),
  setSelectedDetailedBuildingId: (id) => set({ selectedDetailedBuildingId: id }),

  // Voice & Agent37 Initial State
  voiceState: {
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    transcript: '',
    replyText: '',
    fallbackActive: false,
    connectionStatus: 'CHECKING',
    error: null,
    availableVoices: [],
    selectedVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    lastAudioBase64: undefined,
  },
  agent37Messages: [
    {
      id: 'welcome_1',
      role: 'assistant',
      text: 'TerraScope Geospatial Assistant online. Ask me about building heights, terrain slopes, damage assessments, or voice-command any 3D operation.',
      timestamp: Date.now(),
      verificationStatus: 'SYSTEM_READY',
    },
  ],
  isAgent37Thinking: false,
  agent37Status: null,
  agent37ModelCatalog: null,

  setVoiceState: (partial) => set((s) => ({ voiceState: { ...s.voiceState, ...partial } })),

  voiceNarrationOnClick: true,
  toggleVoiceNarrationOnClick: () =>
    set((s) => ({ voiceNarrationOnClick: !s.voiceNarrationOnClick })),
  setVoiceNarrationOnClick: (enabled) => set({ voiceNarrationOnClick: enabled }),
  narrateBuilding: async (building) => {
    if (!building) return
    const text = formatBuildingNarration(building)
    await get().speakText(text)
  },


  fetchSamples: async () => {
    try {
      const res = await fetch('/api/samples')
      if (res.ok) {
        const data = await res.json()
        set({ samples: data })
      }
    } catch (err) {
      console.error('Failed to fetch samples:', err)
    }
  },

  loadSampleScene: async (sampleId: string, customGsd?: number) => {
    const sample = get().samples.find((s) => s.id === sampleId)
    const gsdValue = customGsd ?? sample?.nominal_gsd_m ?? 0.35

    set({
      selectedSampleId: sampleId,
      isProcessing: true,
      jobProgress: 10,
      jobStep: `Submitting benchmark satellite scene (${gsdValue}m/px) for reconstruction...`,
      jobError: null,
      selectedFeature: null,
    })

    try {
      const formData = new FormData()
      formData.append('sample_id', sampleId)
      formData.append('gsd_m', String(gsdValue))
      formData.append('solar_azimuth', String(get().sunAzimuth))
      formData.append('solar_elevation', String(get().sunElevation))

      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`Failed to start job: ${res.statusText}`)
      }

      const { job_id } = await res.json()
      set({ currentJobId: job_id })
      await get().pollJobStatus(job_id)
    } catch (err: any) {
      set({
        isProcessing: false,
        jobError: err.message || 'Processing failed',
      })
    }
  },

  processUploadedFile: async (file: File, gsd_m?: number) => {
    set({
      isProcessing: true,
      jobProgress: 5,
      jobStep: 'Uploading and inspecting satellite imagery (Auto-GSD scale estimation)...',
      jobError: null,
      selectedFeature: null,
      selectedSampleId: null,
    })

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (gsd_m !== undefined && gsd_m > 0) {
        formData.append('gsd_m', String(gsd_m))
      }
      formData.append('solar_azimuth', String(get().sunAzimuth))
      formData.append('solar_elevation', String(get().sunElevation))

      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || `Upload failed: ${res.statusText}`)
      }

      const { job_id } = await res.json()
      set({ currentJobId: job_id })
      await get().pollJobStatus(job_id)
    } catch (err: any) {
      set({
        isProcessing: false,
        jobError: err.message || 'Image processing failed',
      })
    }
  },

  pollJobStatus: async (jobId: string) => {
    const checkInterval = 800
    const check = async () => {
      if (get().currentJobId !== jobId) return
      try {
        const res = await fetch(`/api/job/${jobId}`)
        if (!res.ok) throw new Error('Job status check failed')
        if (get().currentJobId !== jobId) return

        const data = await res.json()
        set({
          jobProgress: data.progress,
          jobStep: data.step,
        })

        if (data.status === 'COMPLETED') {
          // Fetch scene data
          const sceneRes = await fetch(`/api/scene/${jobId}`)
          if (sceneRes.ok) {
            const sceneData = await sceneRes.json()
            set({
              sceneData,
              isProcessing: false,
              jobProgress: 100,
              jobStep: 'Scene Ready',
              activeSidebarTab: 'analytics',
            })
          } else {
            throw new Error('Failed to load reconstructed 3D scene data')
          }
        } else if (data.status === 'FAILED') {
          set({
            isProcessing: false,
            jobError: data.error || 'Reconstruction job failed',
          })
        } else {
          // Still processing
          setTimeout(check, checkInterval)
        }
      } catch (err: any) {
        set({
          isProcessing: false,
          jobError: err.message || 'Polling error',
        })
      }
    }

    check()
  },

  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
  setCameraPreset: (preset: CameraPreset) => set({ cameraPreset: preset }),
  setTargetFocusPosition: (pos) => set({ targetFocusPosition: pos }),
  setVerticalExaggeration: (scale: number) => set({ verticalExaggeration: scale }),
  setSunLighting: (azimuth: number, elevation: number) =>
    set({ sunAzimuth: azimuth, sunElevation: elevation }),

  toggleLayer: (layer) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layer]: !state.layerVisibility[layer],
      },
    })),

  selectFeature: (feature) => {
    set({ selectedFeature: feature })
    if (feature) {
      set({ activeSidebarTab: 'inspector' })
      if (feature.type === 'building' && get().voiceNarrationOnClick) {
        get().narrateBuilding(feature.data)
      }
    }
  },

  setHoveredFeatureId: (id) => set({ hoveredFeatureId: id }),
  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),

  editBuilding: async (buildingId, height_m, roof_shape, base_color_hex) => {
    const { currentJobId, sceneData } = get()
    if (!currentJobId || !sceneData) return

    try {
      const res = await fetch(`/api/scene/${currentJobId}/edit_building`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          building_id: buildingId,
          height_m,
          roof_shape,
          base_color_hex,
        }),
      })

      if (res.ok) {
        const { building, mesh_3d } = await res.json()
        // Update local scene
        const updatedBuildings = sceneData.buildings.map((b) =>
          b.id === buildingId ? building : b
        )
        const updatedMeshes = sceneData.buildings_3d.map((m) =>
          m.building_id === buildingId ? mesh_3d : m
        )

        set({
          sceneData: {
            ...sceneData,
            buildings: updatedBuildings,
            buildings_3d: updatedMeshes,
          },
          selectedFeature: {
            type: 'building',
            id: buildingId,
            data: building,
          },
        })
      }
    } catch (err) {
      console.error('Failed to update building:', err)
    }
  },

  deleteBuilding: async (buildingId: string) => {
    const { currentJobId, sceneData, selectedFeature } = get()
    if (!currentJobId || !sceneData) return

    try {
      const res = await fetch(`/api/reconstruction/${currentJobId}/buildings/${buildingId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        if (selectedFeature?.id === buildingId) {
          set({ selectedFeature: null })
        }
        const sceneRes = await fetch(`/api/reconstruction/${currentJobId}/scene`)
        if (sceneRes.ok) {
          const updatedScene = await sceneRes.json()
          set({ sceneData: updatedScene })
        } else {
          set({
            sceneData: {
              ...sceneData,
              buildings: sceneData.buildings.filter((b) => b.id !== buildingId),
              buildings_3d: sceneData.buildings_3d.filter((m) => m.building_id !== buildingId),
            },
          })
        }
      }
    } catch (err) {
      console.error('Failed to delete building:', err)
    }
  },

  splitBuilding: async (buildingId: string, axis = 'auto', splitRatio = 0.5) => {
    const { currentJobId, sceneData } = get()
    if (!currentJobId || !sceneData) return

    try {
      const res = await fetch(`/api/reconstruction/${currentJobId}/buildings/${buildingId}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ axis, split_ratio: splitRatio }),
      })
      if (res.ok) {
        const sceneRes = await fetch(`/api/reconstruction/${currentJobId}/scene`)
        if (sceneRes.ok) {
          const updatedScene = await sceneRes.json()
          set({ sceneData: updatedScene, selectedFeature: null })
        }
      }
    } catch (err) {
      console.error('Failed to split building:', err)
    }
  },

  mergeBuildings: async (buildingIds: string[]) => {
    const { currentJobId, sceneData } = get()
    if (!currentJobId || !sceneData || buildingIds.length < 2) return

    try {
      const res = await fetch(`/api/reconstruction/${currentJobId}/buildings/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ building_ids: buildingIds }),
      })
      if (res.ok) {
        const sceneRes = await fetch(`/api/reconstruction/${currentJobId}/scene`)
        if (sceneRes.ok) {
          const updatedScene = await sceneRes.json()
          set({ sceneData: updatedScene, selectedFeature: null })
        }
      }
    } catch (err) {
      console.error('Failed to merge buildings:', err)
    }
  },

  editVegetation: async (treeId, canopy_height_m, vegetation_category, tree_model_type) => {
    const { currentJobId, sceneData } = get()
    if (!sceneData) return

    const existingTree = sceneData.trees.find((t) => t.id === treeId)
    if (!existingTree) return

    const newHeight = canopy_height_m !== undefined ? canopy_height_m : existingTree.estimated_canopy_height_m
    const newCategory = vegetation_category || existingTree.vegetation_category
    const newModelType = (tree_model_type as any) || existingTree.tree_model_type

    const updatedTree: TreeFeature = {
      ...existingTree,
      estimated_canopy_height_m: newHeight,
      vegetation_category: newCategory,
      tree_model_type: newModelType,
    }

    const updatedTrees = sceneData.trees.map((t) => (t.id === treeId ? updatedTree : t))
    const updatedVeg3D = sceneData.vegetation_3d.map((v) => {
      if (v.id === treeId) {
        return {
          ...v,
          scale: [v.scale[0], newHeight, v.scale[2]] as [number, number, number],
          canopy_height_m: newHeight,
          model_type: newModelType,
          category: newCategory,
        }
      }
      return v
    })

    set({
      sceneData: {
        ...sceneData,
        trees: updatedTrees,
        vegetation_3d: updatedVeg3D,
      },
      selectedFeature: {
        type: 'vegetation',
        id: treeId,
        data: updatedTree,
      },
    })

    if (currentJobId) {
      try {
        const res = await fetch(`/api/scene/${currentJobId}/edit_vegetation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tree_id: treeId,
            canopy_height_m: newHeight,
            vegetation_category: newCategory,
            tree_model_type: newModelType,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data?.tree) {
            // Server verified update
          }
        }
      } catch (err) {
        console.warn('Backend vegetation sync failed (local state preserved):', err)
      }
    }
  },

  setGeoreferenceBounds: (bounds) => {
    set({ georeferenceBounds: bounds })
  },

  setValidationPointsText: (text) => {
    set({ validationPointsText: text })
  },

  toggleDsmSurface: (show) => {
    set((state) => ({ showDsmSurface: show !== undefined ? show : !state.showDsmSurface }))
  },

  setTextureMode: (mode) => {
    set({ textureMode: mode })
    if (mode === 'hyp' && !get().hypsometricTextureUrl) {
      get().bakeHypsometricTexture()
    }
  },

  bakeHypsometricTexture: async () => {
    const { sceneData, measuredDtmGrid } = get()
    if (!sceneData) return

    const gw = sceneData.terrain_mesh_data.grid_width
    const gh = sceneData.terrain_mesh_data.grid_height
    const elevs = measuredDtmGrid || new Float32Array(sceneData.terrain_mesh_data.elevations)
    const landcover = new Uint8Array(gw * gh)
    const worldWidthM = sceneData.dimensions.width * sceneData.gsd_m
    const elevRangeM = sceneData.terrain_stats.elevation_range_m || 25.0

    try {
      const { hypsometricTextureCanvas } = bakeHypsometricAndContours(
        elevs,
        landcover,
        gw,
        gh,
        worldWidthM,
        elevRangeM
      )
      set({ hypsometricTextureUrl: hypsometricTextureCanvas.toDataURL('image/jpeg', 0.9) })
    } catch (err) {
      console.error('Failed to bake hypsometric texture:', err)
    }
  },

  loadDtmFile: async (file: File) => {
    try {
      set({ jobStep: 'Loading GeoTIFF DTM raster header...' })
      const meta = await loadGeoTiffMetadata(file, 'DTM')

      let bounds = get().georeferenceBounds
      if (!bounds) {
        if (meta.epsg === 4326 && meta.boundingBox) {
          bounds = {
            west: meta.boundingBox[0],
            south: meta.boundingBox[1],
            east: meta.boundingBox[2],
            north: meta.boundingBox[3],
          }
          set({ georeferenceBounds: bounds })
        } else {
          bounds = { west: -122.42, south: 37.77, east: -122.41, north: 37.78 }
          set({ georeferenceBounds: bounds })
        }
      }

      set({
        jobStep: `Sampling DTM raster window for ${bounds.west.toFixed(4)}°W to ${bounds.east.toFixed(4)}°E...`,
      })
      const rasterData = await loadIntersectingGeoTiffWindow(file, meta, bounds)

      const gridW = get().sceneData?.terrain_mesh_data.grid_width || 128
      const gridH = get().sceneData?.terrain_mesh_data.grid_height || 128

      const rawGrid = new Float32Array(gridW * gridH)
      for (let y = 0; y < gridH; y++) {
        const lat = bounds.north - (y / (gridH - 1)) * (bounds.north - bounds.south)
        for (let x = 0; x < gridW; x++) {
          const lon = bounds.west + (x / (gridW - 1)) * (bounds.east - bounds.west)
          rawGrid[y * gridW + x] = sampleElevationAtWgs84(rasterData, lon, lat)
        }
      }

      const { elevations, coverageRatio } = fillElevationGaps(rawGrid, gridW, gridH)

      let min = Infinity
      let max = -Infinity
      for (let i = 0; i < elevations.length; i++) {
        if (elevations[i] < min) min = elevations[i]
        if (elevations[i] > max) max = elevations[i]
      }

      const coveragePct = Math.round(coverageRatio * 100)
      const dtmRasterMeta: MeasuredRasterMeta = {
        filename: file.name,
        type: 'DTM',
        epsg: meta.epsg,
        crsDefinition: meta.crsDefinition,
        resolution_m: Math.round(meta.resolutionMetersPerPx * 100) / 100,
        min_elev_m: Math.round(min * 10) / 10,
        max_elev_m: Math.round(max * 10) / 10,
        coverage_pct: coveragePct,
        acquisition_date: meta.acquisitionDate,
        vertical_datum: meta.verticalDatum,
      }

      set({
        dtmMeta: dtmRasterMeta,
        dtmRasterData: rasterData,
        measuredDtmGrid: elevations,
        measuredGridResolution: [gridW, gridH],
        jobStep: `DTM Loaded: ${file.name} (Coverage: ${coveragePct}%, Range: ${min.toFixed(1)}m – ${max.toFixed(1)}m)`,
      })

      get().bakeHypsometricTexture()
      get().evaluateValidationPoints()
    } catch (err: any) {
      console.error('Failed to load DTM:', err)
      set({ jobError: `DTM Load Error: ${err.message}` })
    }
  },

  loadDsmFile: async (file: File) => {
    try {
      set({ jobStep: 'Loading GeoTIFF DSM raster header...' })
      const meta = await loadGeoTiffMetadata(file, 'DSM')

      let bounds = get().georeferenceBounds
      if (!bounds) {
        if (meta.epsg === 4326 && meta.boundingBox) {
          bounds = {
            west: meta.boundingBox[0],
            south: meta.boundingBox[1],
            east: meta.boundingBox[2],
            north: meta.boundingBox[3],
          }
          set({ georeferenceBounds: bounds })
        } else {
          bounds = { west: -122.42, south: 37.77, east: -122.41, north: 37.78 }
          set({ georeferenceBounds: bounds })
        }
      }

      set({
        jobStep: `Sampling DSM raster window for ${bounds.west.toFixed(4)}°W to ${bounds.east.toFixed(4)}°E...`,
      })
      const rasterData = await loadIntersectingGeoTiffWindow(file, meta, bounds)

      const gridW = get().sceneData?.terrain_mesh_data.grid_width || 128
      const gridH = get().sceneData?.terrain_mesh_data.grid_height || 128

      const rawGrid = new Float32Array(gridW * gridH)
      for (let y = 0; y < gridH; y++) {
        const lat = bounds.north - (y / (gridH - 1)) * (bounds.north - bounds.south)
        for (let x = 0; x < gridW; x++) {
          const lon = bounds.west + (x / (gridW - 1)) * (bounds.east - bounds.west)
          rawGrid[y * gridW + x] = sampleElevationAtWgs84(rasterData, lon, lat)
        }
      }

      const { elevations, coverageRatio } = fillElevationGaps(rawGrid, gridW, gridH)

      let min = Infinity
      let max = -Infinity
      for (let i = 0; i < elevations.length; i++) {
        if (elevations[i] < min) min = elevations[i]
        if (elevations[i] > max) max = elevations[i]
      }

      const coveragePct = Math.round(coverageRatio * 100)
      const dsmRasterMeta: MeasuredRasterMeta = {
        filename: file.name,
        type: 'DSM',
        epsg: meta.epsg,
        crsDefinition: meta.crsDefinition,
        resolution_m: Math.round(meta.resolutionMetersPerPx * 100) / 100,
        min_elev_m: Math.round(min * 10) / 10,
        max_elev_m: Math.round(max * 10) / 10,
        coverage_pct: coveragePct,
        acquisition_date: meta.acquisitionDate,
        vertical_datum: meta.verticalDatum,
      }

      const dtmGrid = get().measuredDtmGrid
      let offset = 0
      if (dtmGrid && dtmGrid.length === elevations.length) {
        const diffs: number[] = []
        for (let i = 0; i < elevations.length; i++) {
          const d = elevations[i] - dtmGrid[i]
          if (d > -5 && d < 5) diffs.push(d)
        }
        if (diffs.length > 0) {
          diffs.sort((a, b) => a - b)
          offset = diffs[Math.floor(diffs.length / 2)]
          for (let i = 0; i < elevations.length; i++) {
            elevations[i] -= offset
          }
        }
      }

      set({
        dsmMeta: dsmRasterMeta,
        dsmRasterData: rasterData,
        measuredDsmGrid: elevations,
        measuredGridResolution: [gridW, gridH],
        measuredOffsetRemoved: offset !== 0 ? offset : null,
        jobStep: `DSM Loaded: ${file.name} (Coverage: ${coveragePct}%, Range: ${min.toFixed(1)}m – ${max.toFixed(1)}m)`,
      })

      get().evaluateValidationPoints()
    } catch (err: any) {
      console.error('Failed to load DSM:', err)
      set({ jobError: `DSM Load Error: ${err.message}` })
    }
  },

  evaluateValidationPoints: () => {
    const { validationPointsText, dtmRasterData, dsmRasterData } = get()
    if (!validationPointsText.trim()) return

    const report = evaluateValidationCheckpoints(
      dtmRasterData,
      dsmRasterData,
      validationPointsText
    )
    set({ validationReport: report })
  },

  loadProceduralSample: async () => {
    try {
      set({
        isProcessing: true,
        jobProgress: 15,
        jobStep: 'Generating Terra3D synthetic procedural satellite terrain & city grid...',
        jobError: null,
      })

      const sample = generateProceduralSatelliteSample()
      const res = await fetch(sample.dataUrl)
      const blob = await res.blob()
      const syntheticFile = new File([blob], sample.filename, { type: 'image/jpeg' })

      const bounds: GeoreferenceBounds = {
        west: -122.42,
        south: 37.77,
        east: -122.41,
        north: 37.78,
      }
      const valText = `# Ground elevation checkpoints:\n37.7750,-122.4150,18.4\n37.7720,-122.4180,12.2\n# Building height check (flag 'h'):\n37.7762,-122.4138,15.5,h`

      set({
        georeferenceBounds: bounds,
        validationPointsText: valText,
      })

      await get().processUploadedFile(syntheticFile, 0.45)
      await get().bakeHypsometricTexture()
    } catch (err: any) {
      console.error('Failed to load procedural sample:', err)
      set({ isProcessing: false, jobError: err.message || 'Procedural generation failed' })
    }
  },

  // GeoDepth 3D Actions Implementation
  setInputMode: (mode) => set({ inputMode: mode }),
  setMeasurementMode: (active) => set({ measurementMode: active, activeMeasurementPoints: [] }),
  setFlythroughActive: (active) => set({ flythroughActive: active }),
  setActiveColormap: (colormap) => set({ activeColormap: colormap }),

  addMeasurementPoint: async (pt: [number, number, number]) => {
    const current = get().activeMeasurementPoints
    if (current.length === 0) {
      set({ activeMeasurementPoints: [pt] })
    } else {
      const p1 = current[0]
      const p2 = pt
      const dx = p2[0] - p1[0]
      const dy = p2[1] - p1[1]
      const dz = p2[2] - p1[2]
      const horiz = Math.sqrt(dx * dx + dz * dz)
      const surf = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const slope = Math.abs(Math.atan2(Math.abs(dy), Math.max(horiz, 0.001)) * (180 / Math.PI))

      const newM: GeoDepthMeasurement = {
        id: `M-${get().measurements.length + 1}`,
        point_a: [Math.round(p1[0] * 100) / 100, Math.round(p1[1] * 100) / 100, Math.round(p1[2] * 100) / 100],
        point_b: [Math.round(p2[0] * 100) / 100, Math.round(p2[1] * 100) / 100, Math.round(p2[2] * 100) / 100],
        horizontal_dist_m: Math.round(horiz * 100) / 100,
        surface_dist_m: Math.round(surf * 100) / 100,
        delta_elev_m: Math.round(dy * 100) / 100,
        slope_deg: Math.round(slope * 10) / 10,
        reliability: get().isCalibrated ? 'Calibrated Metric (m)' : 'Uncalibrated Relative',
        timestamp: new Date().toLocaleTimeString(),
      }
      set((s) => ({
        measurements: [...s.measurements, newM],
        activeMeasurementPoints: [],
      }))
    }
  },

  clearMeasurements: () => set({ measurements: [], activeMeasurementPoints: [] }),
  deleteMeasurement: (id) => set((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) })),

  runGeoDepthPipeline: async ({ file, sampleId, gsd_m, mode }) => {
    set({
      isProcessing: true,
      jobProgress: 25,
      jobStep: 'Executing GeoDepth 3D single-image metric reconstruction...',
      jobError: null,
    })
    try {
      const fd = new FormData()
      if (file) fd.append('file', file)
      if (sampleId) fd.append('sample_id', sampleId)
      if (gsd_m) fd.append('gsd_m', String(gsd_m))
      if (mode) fd.append('mode', mode)

      const res = await fetch('/api/geodepth/process', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'GeoDepth pipeline failed')
      }
      const data = await res.json()
      set({
        sceneData: data,
        currentJobId: data.job_id,
        calibrationData: data.calibration || null,
        terrainAnalytics: data.analytics || null,
        isCalibrated: Boolean(data.is_calibrated),
        isProcessing: false,
        jobProgress: 100,
        jobStep: 'Scene Ready',
      })
    } catch (err: any) {
      set({ isProcessing: false, jobError: err.message || 'GeoDepth execution failed' })
    }
  },

  calibrateKnownDistance: async (pixelDist: number, knownM: number) => {
    const job_id = get().currentJobId || get().sceneData?.job_id
    if (!job_id) return false
    try {
      const res = await fetch('/api/geodepth/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id,
          known_distance_px: pixelDist,
          known_distance_m: knownM,
        }),
      })
      if (!res.ok) return false
      const data = await res.json()
      set((s) => ({
        isCalibrated: true,
        calibrationData: data.calibration,
        terrainAnalytics: data.analytics,
        sceneData: s.sceneData ? { ...s.sceneData, gsd_m: data.gsd_m } : null,
      }))
      return true
    } catch {
      return false
    }
  },

  calibrateElevationControlPoints: async (points: any[]) => {
    const job_id = get().currentJobId || get().sceneData?.job_id
    if (!job_id) return false
    try {
      const res = await fetch('/api/geodepth/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id,
          control_points: points,
        }),
      })
      if (!res.ok) return false
      const data = await res.json()
      set({
        isCalibrated: true,
        calibrationData: data.calibration,
        terrainAnalytics: data.analytics,
      })
      return true
    } catch {
      return false
    }
  },

  calibrateCopernicusDEM: async (bounds?: any) => {
    const job_id = get().currentJobId || get().sceneData?.job_id
    if (!job_id) return false
    try {
      const res = await fetch('/api/geodepth/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id,
          use_copernicus_dem: true,
          bounds: bounds || { min_lon: -81.65, min_lat: 30.33, max_lon: -81.63, max_lat: 30.35 },
        }),
      })
      if (!res.ok) return false
      const data = await res.json()
      set({
        isCalibrated: true,
        calibrationData: data.calibration,
        terrainAnalytics: data.analytics,
      })
      return true
    } catch {
      return false
    }
  },

  exportGISAsset: async (exportType: string, measurements?: any[]) => {
    const job_id = get().currentJobId || get().sceneData?.job_id
    if (!job_id) throw new Error('No active scene to export')
    const res = await fetch('/api/geodepth/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id,
        export_type: exportType,
        measurements: measurements || get().measurements,
      }),
    })
    if (!res.ok) throw new Error('Export failed')
    return await res.json()
  },

  changeGsd: async (newGsd: number, mode: 'scale' | 'rerun' = 'scale') => {
    const currentScene = get().sceneData
    const jobId = get().currentJobId || currentScene?.job_id
    if (!currentScene || !jobId) return

    if (mode === 'scale') {
      try {
        const fd = new FormData()
        fd.append('job_id', jobId)
        fd.append('new_gsd_m', String(newGsd))
        const res = await fetch('/api/rescale-gsd', { method: 'POST', body: fd })
        if (res.ok) {
          const updatedScene = await res.json()
          set({ sceneData: updatedScene })
          return
        }
      } catch (e) {
        console.warn('Backend rescale-gsd failed, applying client-side rescale', e)
      }

      // Client-side fallback dynamic rescale
      const oldGsd = currentScene.gsd_m || 0.35
      const factor = newGsd / oldGsd
      const updatedBuildings = currentScene.buildings.map((b) => ({
        ...b,
        footprint_area_m2: Math.round(b.footprint_area_m2 * factor * factor * 10) / 10,
        area_m2: Math.round((b.area_m2 ?? b.footprint_area_m2) * factor * factor * 10) / 10,
        length_m: Math.round((b.length_m || 10) * factor * 10) / 10,
        width_m: Math.round((b.width_m || 8) * factor * 10) / 10,
        perimeter_m: Math.round((b.perimeter_m || 36) * factor * 10) / 10,
      }))

      const updatedBuildings3D = currentScene.buildings_3d.map((b) => ({
        ...b,
        vertices: b.vertices.map((v) => [v[0] * factor, v[1], v[2] * factor] as [number, number, number]),
        polygon_world: b.polygon_world ? b.polygon_world.map((p) => [p[0] * factor, p[1] * factor] as [number, number]) : undefined
      }))

      const updatedTrees = currentScene.trees.map((t) => ({
        ...t,
        crown_diameter_m: Math.round(t.crown_diameter_m * factor * 10) / 10
      }))

      const updatedVeg3D = currentScene.vegetation_3d.map((v) => ({
        ...v,
        position: [v.position[0] * factor, v.position[1], v.position[2] * factor] as [number, number, number],
        scale: [v.scale[0] * factor, v.scale[1], v.scale[2] * factor] as [number, number, number],
      }))

      set({
        sceneData: {
          ...currentScene,
          gsd_m: newGsd,
          buildings: updatedBuildings,
          buildings_3d: updatedBuildings3D,
          trees: updatedTrees,
          vegetation_3d: updatedVeg3D,
          metadata: {
            ...currentScene.metadata,
            gsd_m: newGsd,
          }
        }
      })
    } else {
      // Re-run the trained neural pipeline at the exact resolution!
      set({
        isProcessing: true,
        jobProgress: 5,
        jobStep: `Re-running neural inference at GSD ${newGsd}m/px...`,
        jobError: null,
      })

      try {
        const fd = new FormData()
        fd.append('job_id', jobId)
        if (get().selectedSampleId) {
          fd.append('sample_id', get().selectedSampleId!)
        }
        fd.append('gsd_m', String(newGsd))
        fd.append('solar_azimuth', String(get().sunAzimuth))
        fd.append('solar_elevation', String(get().sunElevation))

        const res = await fetch('/api/process', { method: 'POST', body: fd })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || `Re-run failed: ${res.statusText}`)
        }

        const { job_id: newJobId } = await res.json()
        set({ currentJobId: newJobId })
        await get().pollJobStatus(newJobId)
      } catch (err: any) {
        set({
          isProcessing: false,
          jobError: err.message || 'Re-run failed',
        })
      }
    }
  },

  runHazardPrediction: async (params = {}) => {
    set({ isGeoTwinLoading: true })
    try {
      const jobId = get().currentJobId || get().sceneData?.job_id
      const sampleId = get().selectedSampleId || 'jacksonville_aerial'
      const epi = params.epicenter_px || get().epicenterPoint || undefined
      const res = await fetch('/api/geotwin/hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          sample_id: sampleId,
          rainfall_mm_hr: params.rainfall_mm_hr ?? 55.0,
          soil_saturation: params.soil_saturation ?? 0.65,
          earthquake_magnitude: params.earthquake_magnitude ?? get().richterScale,
          earthquake_depth_km: params.earthquake_depth_km ?? 10.0,
          epicenter_px: epi,
        }),
      })
      if (!res.ok) throw new Error('Hazard prediction failed')
      const data = await res.json()
      set({ hazardReport: data, isGeoTwinLoading: false })
      return data
    } catch (err) {
      console.error('runHazardPrediction error:', err)
      set({ isGeoTwinLoading: false })
      return null
    }
  },

  runSafeRoutePrediction: async (params = {}) => {
    set({ isGeoTwinLoading: true })
    try {
      const jobId = get().currentJobId || get().sceneData?.job_id
      const sampleId = get().selectedSampleId || 'jacksonville_aerial'
      const res = await fetch('/api/geotwin/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          sample_id: sampleId,
          start_point: params.start_point ?? get().routePointA ?? 'auto_origin',
          destination: params.destination ?? get().routePointB ?? 'safest_point',
          travel_mode: params.travel_mode ?? 'human_safest_evacuation',
          verified_closures: params.verified_closures ?? [],
          rainfall_mm_hr: params.rainfall_mm_hr ?? 55.0,
        }),
      })
      if (!res.ok) throw new Error('Safe route prediction failed')
      const data = await res.json()
      const newA = get().routePointA || (data.origin?.pixel_xy as [number, number] | null)
      const newB = get().routePointB || (data.destination?.pixel_xy as [number, number] | null)
      set({
        routeReport: data,
        routePointA: newA,
        routePointB: newB,
        isGeoTwinLoading: false,
        geotwinOverlayMode: 'safe_routes',
      })
      set({ routeReport: data, isGeoTwinLoading: false, geotwinOverlayMode: 'safe_routes' })
      return data
    } catch (err) {
      console.error('runSafeRoutePrediction error:', err)
      set({ isGeoTwinLoading: false })
      return null
    }
  },

  runWirelessPrediction: async (params = {}) => {
    set({ isGeoTwinLoading: true })
    try {
      const jobId = get().currentJobId || get().sceneData?.job_id
      const sampleId = get().selectedSampleId || 'jacksonville_aerial'
      const customTower = get().customTowerPos
      const resolvedTowers = params.towers || (customTower ? [{
        tower_id: 'CUSTOM-BS-01',
        label: 'User-Placed 5G/6G Macro Sector',
        x_px: customTower[0],
        y_px: customTower[1],
        antenna_height_agl_m: params.antenna_height_agl_m ?? 25.0,
        frequency_ghz: params.frequency_ghz ?? 3.5,
        tx_power_dbm: params.tx_power_dbm ?? 43.0,
        antenna_gain_dbi: params.antenna_gain_dbi ?? 16.0,
      }] : undefined)
      const resolvedUserPoint = params.user_device_point || get().userDevicePos || undefined

      const res = await fetch('/api/geotwin/wireless', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          sample_id: sampleId,
          frequency_ghz: params.frequency_ghz ?? 3.5,
          tx_power_dbm: params.tx_power_dbm ?? 43.0,
          antenna_gain_dbi: params.antenna_gain_dbi ?? 16.0,
          antenna_height_agl_m: params.antenna_height_agl_m ?? 25.0,
          towers: resolvedTowers,
          user_device_point: resolvedUserPoint,
          optimize_placement: params.optimize_placement ?? false,
          field_measurements: params.field_measurements,
        }),
      })
      if (!res.ok) throw new Error('Wireless prediction failed')
      const data = await res.json()
      set({ wirelessReport: data, isGeoTwinLoading: false })
      return data
    } catch (err) {
      console.error('runWirelessPrediction error:', err)
      set({ isGeoTwinLoading: false })
      return null
    }
  },

  runGeoTwinPredictAll: async (params = {}) => {
    set({ isGeoTwinLoading: true })
    try {
      const jobId = get().currentJobId || get().sceneData?.job_id
      const sampleId = get().selectedSampleId || 'jacksonville_aerial'
      const res = await fetch('/api/geotwin/predict-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          sample_id: sampleId,
          rainfall_mm_hr: params.rainfall_mm_hr ?? 55.0,
          soil_saturation: params.soil_saturation ?? 0.65,
          destination: params.destination ?? 'high_ground_assembly',
          travel_mode: params.travel_mode ?? 'emergency_vehicle',
          frequency_ghz: params.frequency_ghz ?? 3.5,
        }),
      })
      if (!res.ok) throw new Error('Unified GeoTwin prediction failed')
      const data = await res.json()
      set({
        hazardReport: data.hazards,
        routeReport: data.safe_routes,
        wirelessReport: data.wireless,
        governanceReport: data.governance_and_validation,
        predictionRecords: data.prediction_records || [],
        isGeoTwinLoading: false,
      })
    } catch (err) {
      console.error('runGeoTwinPredictAll error:', err)
      set({ isGeoTwinLoading: false })
    }
  },

  // City Detail Studio Actions Implementation
  generateDetailedCity: async (options = {}) => {
    set({ isGeneratingCityDetail: true })
    try {
      const jobId = get().currentJobId || get().sceneData?.job_id
      const sampleId = get().selectedSampleId || 'jacksonville_aerial'
      const tier = options.tier || get().cityDetailTier
      const style = options.style || get().cityStyle
      const props = options.props !== undefined ? options.props : get().includeProps
      const sidewalks = options.sidewalks !== undefined ? options.sidewalks : get().includeSidewalks

      const res = await fetch('/api/city/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          sample_id: sampleId,
          detail_tier: tier,
          city_style: style,
          include_props: props,
          include_sidewalks: sidewalks,
        }),
      })

      if (!res.ok) throw new Error(`Detailed city generation failed: ${res.statusText}`)
      const data: CityDetailData = await res.json()
      set({
        cityDetailData: data,
        isGeneratingCityDetail: false,
      })
      return data
    } catch (err) {
      console.error('generateDetailedCity error:', err)
      set({ isGeneratingCityDetail: false })
      return null
    }
  },

  detailSingleBuilding: async (buildingId: string, styleOverrides?: any, tier?: string) => {
    try {
      const jobId = get().currentJobId || get().sceneData?.job_id
      const sampleId = get().selectedSampleId || 'jacksonville_aerial'
      const res = await fetch('/api/city/building/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          sample_id: sampleId,
          building_id: buildingId,
          style_overrides: styleOverrides,
          detail_tier: tier || 'high',
        }),
      })

      if (!res.ok) throw new Error(`Single building detail generation failed: ${res.statusText}`)
      const data: BuildingDetailMesh = await res.json()

      // Update in active cityDetailData if present
      const curr = get().cityDetailData
      if (curr) {
        const nextBuildings = curr.buildings.map((b) => (b.building_id === buildingId ? data : b))
        set({
          cityDetailData: {
            ...curr,
            buildings: nextBuildings,
          },
          selectedDetailedBuildingId: buildingId,
        })
      }
      return data
    } catch (err) {
      console.error('detailSingleBuilding error:', err)
      return null
    }
  },

  validateCityGeometry: async () => {
    try {
      const jobId = get().currentJobId || get().sceneData?.job_id
      const sampleId = get().selectedSampleId || 'jacksonville_aerial'
      const res = await fetch('/api/city/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, sample_id: sampleId }),
      })
      if (!res.ok) throw new Error('City geometry validation failed')
      const report: MeshValidationReport = await res.json()
      const curr = get().cityDetailData
      if (curr) {
        set({ cityDetailData: { ...curr, validation_report: report } })
      }
      return report
    } catch (err) {
      console.error('validateCityGeometry error:', err)
      return null
    }
  },

  exportDetailedCity: async (targetEngine = 'all') => {
    set({ isExportingCity: true })
    try {
      const jobId = get().currentJobId || get().sceneData?.job_id
      const sampleId = get().selectedSampleId || 'jacksonville_aerial'
      const res = await fetch('/api/city/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          sample_id: sampleId,
          target_engine: targetEngine,
        }),
      })
      if (!res.ok) throw new Error('Multi-engine export failed')
      const result: CityExportResult = await res.json()
      set({ cityExportResult: result, isExportingCity: false })
      return result
    } catch (err) {
      console.error('exportDetailedCity error:', err)
      set({ isExportingCity: false })
      return null
    }
  },

  // Voice & Agent37 Actions Implementation
  checkVoiceAndAgent37Status: async () => {
    try {
      const [vRes, aRes, voicesRes] = await Promise.all([
        fetch('/api/voice/status').catch(() => null),
        fetch('/api/agent37/status').catch(() => null),
        fetch('/api/voice/voices').catch(() => null),
      ])
      if (vRes && vRes.ok) {
        const vData = await vRes.json()
        const connStatus = vData.status === 'CONNECTED' ? 'CONNECTED' : 'FALLBACK'
        set((s) => ({
          voiceState: {
            ...s.voiceState,
            connectionStatus: connStatus,
            fallbackActive: connStatus !== 'CONNECTED',
          },
        }))
      }
      if (voicesRes && voicesRes.ok) {
        const voicesData = await voicesRes.json()
        if (voicesData.voices && Array.isArray(voicesData.voices)) {
          set((s) => ({
            voiceState: {
              ...s.voiceState,
              availableVoices: voicesData.voices,
            },
          }))
        }
      }
      if (aRes && aRes.ok) {
        const aData = await aRes.json()
        set({ agent37Status: aData })
      }
      get().fetchAgent37Models()
    } catch (err) {
      console.error('checkVoiceAndAgent37Status error:', err)
    }
  },

  fetchAgent37Models: async () => {
    try {
      const res = await fetch('/api/agent37/models')
      if (res.ok) {
        const data = await res.json()
        set({ agent37ModelCatalog: data })
      }
    } catch (err) {
      console.warn('Failed to fetch Agent37 model catalog:', err)
    }
  },

  selectAgent37Model: async (modelId: string) => {
    try {
      const res = await fetch('/api/agent37/models/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: modelId }),
      })
      if (res.ok) {
        get().fetchAgent37Models()
      }
    } catch (err) {
      console.warn('Failed to select Agent37 model:', err)
    }
  },

  setSelectedVoiceId: (voiceId: string) => {
    set((s) => ({ voiceState: { ...s.voiceState, selectedVoiceId: voiceId } }))
  },

  fetchAvailableVoices: async () => {
    try {
      const res = await fetch('/api/voice/voices')
      if (res.ok) {
        const data = await res.json()
        if (data.voices && Array.isArray(data.voices)) {
          set((s) => ({
            voiceState: {
              ...s.voiceState,
              availableVoices: data.voices,
            },
          }))
        }
      }
    } catch (err) {
      console.warn('Failed to fetch voices:', err)
    }
  },

  downloadLastSpokenAudio: () => {
    const b64 = get().voiceState.lastAudioBase64
    if (!b64) return
    try {
      const byteCharacters = atob(b64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `geospatial_voice_briefing_${Date.now()}.mp3`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('downloadLastSpokenAudio failed:', e)
    }
  },

  speakText: async (text: string) => {
    // 1. Interrupt and cancel any in-flight playback or pending speech request
    if (currentAudioElement) {
      try {
        currentAudioElement.pause()
        currentAudioElement.currentTime = 0
      } catch (e) {
        // ignore
      }
      currentAudioElement = null
    }
    if (currentSpeechAbort) {
      currentSpeechAbort.abort()
      currentSpeechAbort = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch (e) {
        // ignore
      }
    }

    const abortController = new AbortController()
    currentSpeechAbort = abortController

    set((s) => ({ voiceState: { ...s.voiceState, isSpeaking: true, error: null } }))
    try {
      const voiceId = get().voiceState.selectedVoiceId
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_id: voiceId }),
        signal: abortController.signal,
      })

      if (abortController.signal.aborted) return

      if (res.ok) {
        const data = await res.json()
        if (abortController.signal.aborted) return

        if (data.audio_base64 && !data.fallback_active) {
          set((s) => ({ voiceState: { ...s.voiceState, lastAudioBase64: data.audio_base64 } }))
          const audio = new Audio(`data:audio/mpeg;base64,${data.audio_base64}`)
          currentAudioElement = audio
          audio.onended = () => {
            if (currentAudioElement === audio) currentAudioElement = null
            set((s) => ({ voiceState: { ...s.voiceState, isSpeaking: false } }))
          }
          audio.onerror = () => {
            if (currentAudioElement === audio) currentAudioElement = null
            set((s) => ({ voiceState: { ...s.voiceState, isSpeaking: false } }))
          }
          await audio.play()
          return
        }
      }
      // Web Speech API Fallback
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 1.05
        utterance.pitch = 1.0
        utterance.onend = () => {
          set((s) => ({ voiceState: { ...s.voiceState, isSpeaking: false } }))
        }
        utterance.onerror = () => {
          set((s) => ({ voiceState: { ...s.voiceState, isSpeaking: false } }))
        }
        window.speechSynthesis.speak(utterance)
      } else {
        set((s) => ({ voiceState: { ...s.voiceState, isSpeaking: false } }))
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      console.error('speakText error:', err)
      set((s) => ({ voiceState: { ...s.voiceState, isSpeaking: false } }))
    }
  },

  sendVoiceCommand: async (command: string) => {
    set((s) => ({ voiceState: { ...s.voiceState, isProcessing: true, error: null, transcript: command } }))
    try {
      const jobId = get().currentJobId || get().sceneData?.job_id
      const sampleId = get().selectedSampleId || 'jacksonville_aerial'
      const selectedBId = get().selectedDetailedBuildingId || get().selectedFeature?.id
      const voiceId = get().voiceState.selectedVoiceId

      const res = await fetch('/api/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          job_id: jobId,
          sample_id: sampleId,
          selected_building_id: selectedBId,
          voice_id: voiceId,
        }),
      })

      if (!res.ok) throw new Error('Voice command routing failed')
      const result = await res.json()
      const reply = result.reply_text || 'Command processed.'

      set((s) => ({
        voiceState: {
          ...s.voiceState,
          isProcessing: false,
          replyText: reply,
          lastAudioBase64: result.audio_base64 || s.voiceState.lastAudioBase64,
        },
      }))

      // Speak response if available
      if (result.audio_base64) {
        const audio = new Audio(`data:audio/mpeg;base64,${result.audio_base64}`)
        set((s) => ({ voiceState: { ...s.voiceState, isSpeaking: true } }))
        audio.onended = () => {
          set((s) => ({ voiceState: { ...s.voiceState, isSpeaking: false } }))
        }
        audio.onerror = () => {
          set((s) => ({ voiceState: { ...s.voiceState, isSpeaking: false } }))
        }
        await audio.play()
      } else {
        await get().speakText(reply)
      }

      // Handle UI & 3D scene actions from unified assistant
      const actionType = result.action_triggered || result.action
      const payload = result.action_payload || result.payload || {}

      if ((actionType === 'FOCUS_BUILDING' || actionType === 'SELECT_BUILDING') && (payload.building_id || result.selected_building_id)) {
        const bId = payload.building_id || result.selected_building_id
        set({ selectedDetailedBuildingId: bId, activeScreen: '3d-reconstruction' })
      } else if (actionType === 'SHOW_BUILDINGS' || actionType === 'highlight_buildings') {
        set((s) => ({
          activeScreen: '3d-reconstruction',
          layerVisibility: { ...s.layerVisibility, buildings: true },
        }))
      } else if (actionType === 'HIGHLIGHT_CHANGES' || actionType === 'highlight_changes' || actionType === 'compare_bitemporal') {
        set({ activeScreen: '3d-reconstruction', geotwinOverlayMode: 'disaster_damage' })
      } else if (actionType === 'SHOW_TERRAIN' || actionType === 'summarize_terrain') {
        set({ activeScreen: '3d-reconstruction', textureMode: 'hyp' })
      } else if (actionType === 'SHOW_ROUTES') {
        set({ activeScreen: '3d-reconstruction', geotwinOverlayMode: 'safe_routes' })
      } else if (actionType === 'OPEN_REPORT' || actionType === 'generate_report') {
        set({ activeScreen: 'geotwin-response' })
      }

      // Preserve unified thread context between voice and Agent37
      const unifiedUserMsg: Agent37Message = {
        id: `voice_u_${Date.now()}`,
        role: 'user',
        text: command,
        timestamp: Date.now(),
      }
      const unifiedAsstMsg: Agent37Message = {
        id: `voice_a_${Date.now()}`,
        role: 'assistant',
        text: reply,
        timestamp: Date.now(),
        toolsUsed: result.tools_executed || ['get_analysis_results'],
        verificationStatus: 'VERIFIED_DETERMINISTIC',
        actionTriggered: actionType,
        investigationId: result.investigation_id,
        modelUsed: result.model_used,
        configuredModel: result.configured_model,
        scientificModelsUsed: result.scientific_models_used,
      }
      set((s) => ({
        agent37Messages: [...s.agent37Messages, unifiedUserMsg, unifiedAsstMsg]
      }))

      return result
    } catch (err: any) {
      console.error('sendVoiceCommand error:', err)
      set((s) => ({
        voiceState: {
          ...s.voiceState,
          isProcessing: false,
          error: err.message || 'Voice command error',
        },
      }))
      return null
    }
  },

  sendAgent37Query: async (prompt: string) => {
    const userMsg: Agent37Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: prompt,
      timestamp: Date.now(),
    }
    set((s) => ({
      agent37Messages: [...s.agent37Messages, userMsg],
      isAgent37Thinking: true,
    }))

    try {
      const jobId = get().currentJobId || get().sceneData?.job_id
      const sampleId = get().selectedSampleId || 'jacksonville_aerial'
      const selectedBId = get().selectedDetailedBuildingId || get().selectedFeature?.id

      const res = await fetch('/api/agent37/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          job_id: jobId,
          sample_id: sampleId,
          selected_building_id: selectedBId,
        }),
      })

      if (!res.ok) throw new Error('Agent37 query failed')
      const data = await res.json()

      const assistantMsg: Agent37Message = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        text: data.reply || data.explanation || 'Geospatial analysis recorded.',
        timestamp: Date.now(),
        toolsUsed: data.tools_executed || ['get_analysis_results'],
        verificationStatus: data.model_verification || 'VERIFIED_DETERMINISTIC',
        actionTriggered: data.action_triggered,
        investigationId: data.investigation_id,
        modelUsed: data.model_used,
        configuredModel: data.configured_model,
        scientificModelsUsed: data.scientific_models_used,
      }

      set((s) => ({
        agent37Messages: [...s.agent37Messages, assistantMsg],
        isAgent37Thinking: false,
      }))

      // Handle 3D scene actions triggered by Agent37 reasoning
      const actionType = data.action_triggered
      const payload = data.action_payload || {}

      if ((actionType === 'FOCUS_BUILDING' || actionType === 'SELECT_BUILDING') && (payload.building_id || data.selected_building_id)) {
        const bId = payload.building_id || data.selected_building_id
        set({ selectedDetailedBuildingId: bId, activeScreen: '3d-reconstruction' })
      } else if (actionType === 'SHOW_BUILDINGS') {
        set((s) => ({
          activeScreen: '3d-reconstruction',
          layerVisibility: { ...s.layerVisibility, buildings: true },
        }))
      } else if (actionType === 'HIGHLIGHT_CHANGES') {
        set({ activeScreen: '3d-reconstruction', geotwinOverlayMode: 'disaster_damage' })
      } else if (actionType === 'SHOW_TERRAIN') {
        set({ activeScreen: '3d-reconstruction', textureMode: 'hyp' })
      } else if (actionType === 'SHOW_ROUTES') {
        set({ activeScreen: '3d-reconstruction', geotwinOverlayMode: 'safe_routes' })
      } else if (actionType === 'OPEN_REPORT') {
        set({ activeScreen: 'geotwin-response' })
      }

      // Read reply aloud via ElevenLabs audio or browser fallback
      if (data.audio_base64) {
        try {
          const audio = new Audio(`data:audio/mpeg;base64,${data.audio_base64}`)
          set((s) => ({ voiceState: { ...s.voiceState, isSpeaking: true } }))
          audio.onended = () => set((s) => ({ voiceState: { ...s.voiceState, isSpeaking: false } }))
          audio.onerror = () => set((s) => ({ voiceState: { ...s.voiceState, isSpeaking: false } }))
          await audio.play()
        } catch {
          if (get().voiceState.isListening || prompt.toLowerCase().includes('speak')) {
            get().speakText(assistantMsg.text)
          }
        }
      } else if (get().voiceState.isListening || prompt.toLowerCase().includes('speak')) {
        get().speakText(assistantMsg.text)
      }
      return data
    } catch (err: any) {
      console.error('sendAgent37Query error:', err)
      const errorMsg: Agent37Message = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        text: `Notice: Agent37 encountered an issue: ${err.message || 'Connection failed'}. Reverting to standard local telemetry.`,
        timestamp: Date.now(),
        verificationStatus: 'ERROR_FALLBACK',
      }
      set((s) => ({
        agent37Messages: [...s.agent37Messages, errorMsg],
        isAgent37Thinking: false,
      }))
      return null
    }
  },

  clearAgent37History: () => {
    set({
      agent37Messages: [
        {
          id: 'welcome_reset',
          role: 'assistant',
          text: 'Agent37 session cleared. How can I assist with your 3D geospatial reconstruction?',
          timestamp: Date.now(),
          verificationStatus: 'READY',
        },
      ],
    })
  },
}))

