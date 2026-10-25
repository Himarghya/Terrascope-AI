export interface ImageMetadata {
  filename: string
  file_size_kb: number
  dimensions: {
    width: number
    height: number
  }
  channels: number
  bit_depth: number
  spectral_bands: string[]
  georeferenced: boolean
  crs: string
  bounds: { min_x: number; max_y: number; max_x: number; min_y: number } | null
  gsd_m: number
  gsd_inferred: boolean
  elevation_data_available: boolean
  elevation_source: string
  quality_metrics: {
    mean_brightness: number
    dynamic_range: number
    sharpness_score: number
    rating: string
  }
  quality_warnings: string[]
}

export interface RooftopUnit {
  type: string
  x_px: number
  y_px: number
  approx_area_m2: number
}

export interface BuildingFeature {
  id: string
  center_px: [number, number]
  footprint_area_m2: number
  perimeter_m: number
  length_m: number
  width_m: number
  shape_regularity: number
  roof_shape: string
  roof_material: string
  base_color_hex: string
  roof_sections: number
  orientation_deg: number
  aspect_ratio: number
  has_solar_panels: boolean
  has_hvac_units: boolean
  rooftop_units: RooftopUnit[]
  estimated_height_m: number
  height_uncertainty_m: number
  estimated_floors: number
  height_source: string
  confidence: number
  polygon_px: [number, number][]
  sihe_height_m?: number
  sihe_peak_height_m?: number
  sihe_base_dem_m?: number
  sihe_uncertainty_m?: number
  sihe_iqr_m?: number
  sihe_roof_planarity?: string
  shadow_height_m?: number
  validation_status?: string
  building_type?: string
  height_m?: number
  h?: number
  area_m2?: number
  poly?: [number, number][]
  cx?: number
  cy?: number
  vegetation_proximity_m?: number | null
  vegetation_proximity_category?: string
  floor_count_category?: string
  floor_height_assumption_m?: number
  landslide_susceptibility?: number
  flood_susceptibility?: number
  seismic_pga_g?: number
  seismic_mmi?: number
  seismic_damage_grade?: string
  drift_demand?: number
  floor_estimate_note?: string
  roof_appearance_note?: string
  model_version?: string
  prediction_timestamp?: number
}

export interface Building3DMesh {
  building_id: string
  vertices: [number, number, number][]
  faces: [number, number, number][]
  wall_faces?: any[]
  roof_faces?: any[]
  polygon_world?: [number, number][]
  roof_shape?: string
  base_elevation: number
  total_height: number
  wall_color: [number, number, number, number]
  roof_color: [number, number, number, number]
}

export interface RoadCorridor {
  id: string
  polygon_px: [number, number][]
  centerline_px: [number, number][]
  width_m: number
  area_m2: number
}

export interface Road3DMesh {
  vertices: [number, number, number][]
  faces: [number, number, number][]
  color: [number, number, number, number]
}

export interface EvaluationMetrics {
  mean_iou: number
  precision: number
  recall: number
  f1_score: number
  height_mae_m: number
  height_rmse_m: number
  building_count_accuracy: number
  detected_buildings_count: number
  total_mesh_vertices: number
  total_mesh_triangles: number
  self_intersection_free: boolean
  evaluation_notes?: string
}

export interface TreeFeature {
  id: string
  center_px: [number, number]
  crown_area_m2: number
  crown_diameter_m: number
  estimated_canopy_height_m: number
  height_uncertainty_m: number
  vegetation_category: string
  tree_model_type: 'broadleaf' | 'conifer' | 'palm' | 'shrub'
  species_classification: string
  clustering_status: string
  nearest_neighbor_dist_m: number
  vitality_status: string
  exg_index: number
  crown_density: number
  detection_confidence: number
  polygon_px: [number, number][]
  sihe_canopy_height_m?: number
  height_source?: string
}

export interface Vegetation3DInstance {
  id: string
  position: [number, number, number]
  scale: [number, number, number]
  rotation_y: number
  model_type: 'broadleaf' | 'conifer' | 'palm' | 'shrub'
  foliage_color: string
  crown_diameter_m: number
  canopy_height_m: number
  category: string
  species_note: string
  confidence: number
}

export interface TerrainMeshData {
  grid_width: number
  grid_height: number
  elevations: number[]
  min_elev: number
  max_elev: number
}

export interface TerrainStats {
  elevation_source: string
  is_approximate_relative: boolean
  elevation_min_m: number
  elevation_max_m: number
  elevation_range_m: number
  mean_slope_deg: number
  max_slope_deg: number
  surface_roughness_m: number
  ground_area_sq_km: number
}

export interface LandcoverClassStat {
  code: number
  pixel_count: number
  percentage: number
}

export interface SummaryStats {
  total_buildings: number
  built_up_area_m2: number
  building_density_pct: number
  total_trees_detected: number
  vegetation_coverage_pct: number
  road_coverage_pct: number
  water_coverage_pct: number
  scene_dimensions_m: {
    width: number
    length: number
  }
  mean_building_height_m: number
  tallest_building_m: number
  overall_reconstruction_confidence: number
}

export interface SceneData {
  job_id: string
  metadata: ImageMetadata
  image_url: string
  classification_vis_url: string
  glb_url: string
  obj_url?: string
  geojson_url: string
  metadata_json_url?: string
  gsd_m: number
  dimensions: { width: number; height: number }
  landcover_stats: Record<string, LandcoverClassStat>
  terrain_stats: TerrainStats
  terrain_mesh_data: TerrainMeshData
  buildings: BuildingFeature[]
  buildings_3d: Building3DMesh[]
  trees: TreeFeature[]
  vegetation_3d: Vegetation3DInstance[]
  road_corridors?: RoadCorridor[]
  roads_3d?: Road3DMesh
  evaluation?: EvaluationMetrics
  summary_stats: SummaryStats
  dem_shape: [number, number]
  sihe?: SiheMetadata
  analytics?: TerrainAnalytics
  calibration?: CalibrationData
  is_calibrated?: boolean
  depth_map?: number[][]
}

export interface SiheCalibrationData {
  height_unit: 'meters_agl' | 'meters_amsl' | 'relative_unitless'
  is_calibrated: boolean
  calibration_method: string
  scale_factor_m: number
  max_object_height_m: number
  mean_above_ground_height_m: number
  shadow_anchor_used_m?: number
}

export interface SiheUncertaintyMetrics {
  mean_uncertainty_m: number
  median_uncertainty_m: number
  min_uncertainty_m: number
  max_uncertainty_m: number
  mean_confidence_score: number
}

export interface SiheMetadata {
  model_metadata?: Record<string, any>
  calibration: SiheCalibrationData
  uncertainty_metrics: SiheUncertaintyMetrics
  visualization_url: string
  ndsm_raster_url: string
  dsm_raster_url?: string
  dem_raster_url?: string
}

export interface SampleDataset {
  id: string
  name: string
  description: string
  nominal_gsd_m: number
  preview_url: string
}

export interface GeoreferenceBounds {
  west: number
  south: number
  east: number
  north: number
}

export interface MeasuredRasterMeta {
  filename: string
  type: 'DTM' | 'DSM'
  epsg: number
  crsDefinition?: string
  resolution_m: number
  min_elev_m: number
  max_elev_m: number
  coverage_pct: number
  acquisition_date?: string
  vertical_datum?: string
}

export interface ValidationReport {
  groundElevation?: {
    count: number
    biasM: number
    rmseM: number
  }
  objectHeight?: {
    count: number
    biasM: number
    rmseM: number
  }
  summaryText: string
  isValidated: boolean
}

export interface GeoDepthMeasurement {
  id: string
  point_a: [number, number, number]
  point_b: [number, number, number]
  horizontal_dist_m: number
  surface_dist_m: number
  slope_dist_3d_m?: number
  delta_elev_m: number
  slope_deg: number
  slope_angle_deg?: number
  slope_pct?: number
  reliability: string
  timestamp: string
}

export interface CalibrationData {
  status: string
  calibration_method?: string
  depth_convention?: string
  scale_parameter_a?: number
  offset_parameter_b?: number
  total_control_points?: number
  training_samples?: number
  validation_samples?: number
  rmse_m?: number
  mae_m?: number
  max_residual_m?: number
  reliability_category?: string
  uncertainty_bound_95_pct_m?: number
  reference_dataset?: string
  caveat?: string
  elevation_units?: string
}

export interface TerrainAnalytics {
  slope: {
    mean_slope_deg: number
    max_slope_deg: number
    mean_slope_pct: number
    categories: {
      flat_lt_5deg: number
      gentle_5_to_15deg: number
      moderate_15_to_30deg: number
      steep_gt_30deg: number
    }
  }
  aspect: {
    dominant_direction: string
    distribution: Record<string, number>
  }
  elevation: {
    elevation_min_m: number
    elevation_max_m: number
    elevation_mean_m: number
    elevation_median_m: number
    elevation_std_m: number
    elevation_range_m: number
    histogram: Array<{ bin_start: number; bin_end: number; count: number; pct: number }>
    depressions_detected: number
    peaks_detected: number
  }
  drainage: {
    pooling_area_sq_m: number
    susceptibility_area_pct: number
    max_ponding_depth_m: number
    mean_ponding_depth_m: number
    drainage_flow_indicator: string
    scientific_disclaimer: string
  }
  landslide_screening: {
    risk_level: string
    slopes_over_30_deg_pct: number
    slopes_over_45_deg_pct: number
    steep_concave_chute_area_sq_m: number
    scientific_disclaimer: string
  }
}

export type GeoTwin3DOverlayMode =
  | 'none'
  | 'flood_susceptibility'
  | 'landslide_susceptibility'
  | 'earthquake_intensity'
  | 'safe_routes'
  | 'wireless_coverage'
  | 'disaster_damage'

export interface TerrainHazardReport {
  job_id?: string
  timestamp: number
  model_version: string
  gsd_m: number
  scenario_parameters: {
    rainfall_mm_hr: number
    soil_saturation: number
    earthquake_magnitude?: number
    earthquake_depth_km?: number
  }
  flood_hazard: {
    mean_susceptibility: number
    max_susceptibility: number
    mean_uncertainty: number
    high_risk_area_m2: number
    high_risk_area_pct: number
    moderate_risk_area_pct: number
    max_scenario_ponding_depth_m: number
    mean_scenario_ponding_depth_m: number
    water_rise_m?: number
    simulated_water_level_m?: number
    submerged_buildings_count?: number
    severely_flooded_buildings_count?: number
    flooded_road_corridors_count?: number
    estimated_water_volume_m3?: number
    estimated_displaced_occupants?: number
    heatmap_png_b64: string
  }
  earthquake_hazard?: {
    richter_magnitude: number
    focal_depth_km: number
    epicenter_px: [number, number]
    epicenter_world_3d: [number, number, number]
    mean_pga_g: number
    max_pga_g: number
    mean_mmi: number
    max_mmi: number
    mercalli_descriptor: string
    high_seismic_risk_area_pct: number
    buildings_at_collapse_risk_count: number
    completely_collapsed_count?: number
    severe_damage_count?: number
    moderate_damage_count?: number
    slight_damage_count?: number
    estimated_rubble_m3?: number
    estimated_displaced_occupants?: number
    critical_facilities_damaged?: number
    p_wave_velocity_kms: number
    s_wave_velocity_kms: number
    estimated_tremor_duration_s: number
    heatmap_png_b64: string
    seismic_disclaimer: string
  }
  safest_point?: {
    pixel_xy: [number, number]
    world_3d: [number, number, number]
    elevation_m: number
    elevation_above_ground_m?: number
    label: string
    flood_risk_pct: number
    landslide_risk_pct: number
    slope_deg: number
    is_safest_point: boolean
  }
  water_rise_m?: number
  simulated_water_level_m?: number
  landslide_hazard: {
    mean_susceptibility: number
    max_susceptibility: number
    mean_uncertainty: number
    high_risk_area_m2: number
    high_risk_area_pct: number
    moderate_risk_area_pct: number
    min_factor_of_safety?: number
    mean_factor_of_safety?: number
    critical_slope_threshold_deg?: number
    geotechnical_risk_tier?: string
    failure_mechanism?: string
    hotspots?: Array<{
      id: string
      pixel_xy: [number, number]
      world_3d: [number, number, number]
      slope_deg: number
      susceptibility_pct: number
      factor_of_safety: number
      risk_tier: string
      elevation_m: number
    }>
    buildings_at_slope_risk?: number
    high_risk_buildings_count?: number
    severed_roads_count?: number
    threatened_area_m2?: number
    estimated_debris_m3?: number
    estimated_displaced_occupants?: number
    stabilization_recommendations?: string[]
    heatmap_png_b64: string
  }
  exposed_buildings: Array<{
    building_id: string
    flood_susceptibility: number
    flood_risk_class: string
    estimated_ponding_depth_m: number
    landslide_susceptibility: number
    landslide_risk_class: string
    combined_hazard_score: number
    uncertainty: number
  }>
  exposed_roads: Array<{
    road_id: string
    flood_susceptibility: number
    landslide_susceptibility: number
    traversability_status: string
  }>
  validation_metrics: Record<string, any>
  scientific_limitations: string[]
}

export interface RouteSummary {
  route_id: string
  label: string
  total_distance_m: number
  estimated_travel_time_s: number
  estimated_travel_time_min: number
  mean_hazard_exposure: number
  max_segment_risk: number
  mean_flood_exposure: number
  mean_landslide_exposure: number
  mean_obstruction_probability: number
  cumulative_elevation_climb_m?: number
  cumulative_elevation_descent_m?: number
  elevation_gain_m?: number
  max_slope_deg?: number
  mean_slope_deg?: number
  debris_free_clearance_pct?: number
  water_clearance_pct?: number
  terrain_smoothness?: string
  human_walkability_rating?: string
  high_risk_segment_count: number
  high_risk_segment_ids: string[]
  confidence: number
  waypoints_px: [number, number][]
  waypoints_3d: [number, number, number][]
  segments: Array<{
    edge_id: string
    length_m: number
    slope_deg: number
    hazard_exposure_score: number
    flood_exposure: number
    landslide_exposure: number
    obstruction_probability: number
    traversability_class: string
    confidence: number
    avoidance_reasons: string[]
    path_px: [number, number][]
  }>
}

export interface SafeRouteReport {
  job_id?: string
  route_plan_id: string
  timestamp: number
  processing_time_s: number
  model_version: string
  verification_status: string
  travel_mode: string
  travel_mode_label: string
  safest_point?: {
    pixel_xy: [number, number]
    world_3d: [number, number, number]
    elevation_m: number
    elevation_above_ground_m?: number
    label: string
    flood_risk_pct: number
    landslide_risk_pct: number
    slope_deg: number
    is_safest_point: boolean
  }
  origin: {
    node_id: number
    label: string
    pixel_xy: [number, number]
    world_3d: [number, number, number]
  }
  destination: {
    node_id: number
    label: string
    pixel_xy: [number, number]
    world_3d: [number, number, number]
  }
  recommended_route: RouteSummary | null
  shortest_route: RouteSummary | null
  alternative_route: RouteSummary | null
  route_comparison: {
    relative_risk_reduction_pct: number
    distance_detour_pct: number
    avoided_high_risk_segments: Array<{
      edge_id: string
      hazard_exposure_score: number
      reasons: string[]
    }>
  }
  road_network_summary: {
    total_nodes: number
    total_segments: number
    open_segments: number
    caution_segments: number
    high_risk_segments: number
    blocked_segments: number
    segments_3d: Array<{
      edge_id: string
      path_px: [number, number][]
      path_3d: [number, number, number][]
      hazard_exposure_score: number
      traversability_class: string
      avoidance_reasons: string[]
    }>
  }
  validation_and_limitations: {
    prediction_vs_algorithm_separation: string
    safety_disclaimer: string
  }
}

export interface WirelessCoverageReport {
  job_id?: string
  simulation_id: string
  timestamp: number
  processing_time_s: number
  model_version: string
  verification_status: string
  frequency_ghz: number
  band_classification: {
    band_name: string
    regime: string
    is_experimental_6g: boolean
  }
  active_towers: Array<{
    tower_id: string
    label: string
    x_px: number
    y_px: number
    antenna_height_agl_m: number
    frequency_ghz: number
    tx_power_dbm: number
    antenna_gain_dbi: number
    azimuth_deg: number
    downtilt_deg: number
    base_elevation_m: number
    rooftop_height_m: number
    world_3d: [number, number, number]
    antenna_tip_3d: [number, number, number]
  }>
  coverage_kpis: {
    mean_rsrp_dbm: number
    min_rsrp_dbm: number
    max_rsrp_dbm: number
    mean_path_loss_db: number
    mean_uncertainty_db: number
    strong_coverage_pct: number
    moderate_coverage_pct: number
    weak_coverage_pct: number
    coverage_gap_dead_zone_pct: number
    usable_coverage_pct: number
    clear_los_pct: number
    foliage_attenuated_los_pct: number
    obstructed_nlos_pct: number
    calibration_bias_db: number
    calibration_rmse_db: number | null
  }
  candidate_sites: Array<{
    candidate_id: string
    rank: number
    site_type: string
    x_px: number
    y_px: number
    surface_elevation_m: number
    recommended_antenna_agl_m: number
    predicted_coverage_gain_pct: number
    predicted_los_unlock_pct: number
    placement_rationale: string
    world_3d: [number, number, number]
  }>
  optimal_placement?: {
    candidate_id: string
    x_px: number
    y_px: number
    world_3d: [number, number, number]
    antenna_height_agl_m: number
    surface_elevation_m: number
    recommended_specs?: {
      frequency_ghz: number
      band_name: string
      tx_power_dbm: number
      tx_power_watts: number
      antenna_gain_dbi: number
      antenna_height_agl_m: number
      downtilt_deg: number
      optimal_tradeoff_summary: string
    }
    projected_city_mean_rsrp_dbm: number
    projected_city_coverage_pct: number
    projected_building_mean_rsrp_dbm?: number
    predicted_coverage_gain_pct: number
    predicted_los_unlock_pct: number
    rationale: string
  } | null
  building_coverage_telemetry?: Array<{
    building_id: string
    building_type: string
    estimated_height_m: number
    total_floors: number
    center_px: [number, number]
    average_rsrp_dbm: number
    ground_floor_rsrp_dbm: number
    top_floor_rsrp_dbm: number
    signal_grade: string
    floors: Array<{
      floor_number: number
      height_agl_m: number
      rsrp_dbm: number
      grade: string
      is_los: boolean
    }>
  }>
  user_evaluation?: {
    user_point_px: [number, number]
    world_3d: [number, number, number]
    is_los: boolean
    los_status: string
    obstructing_entity: string
    obstructing_building_id?: string | null
    intercept_3d?: [number, number, number] | null
    distance_2d_m: number
    distance_3d_m: number
    rsrp_dbm: number
    sinr_db: number
    path_loss_db: number
    free_space_pl_db: number
    obstruction_excess_loss_db: number
    foliage_loss_db: number
    indoor_penetration_loss_db: number
    signal_grade: string
    rating_color: string
    estimated_throughput_mbps: number
    serving_tower_id: string
    serving_tower_label: string
    ray_path_3d: [[number, number, number], [number, number, number]]
    recommendation: string
  } | null
  coverage_heatmap_b64: string
  scientific_methodology: {
    baseline_model: string
    learned_component: string
    assumptions_and_limitations: string[]
  }
}

// ==============================================================================
// CITY DETAIL STUDIO & MULTI-ENGINE EXPORT TYPES
// ==============================================================================

export interface ArchitecturalComponentMesh {
  component_type: string // "walls", "windows", "doors", "roof", "canopies", "balconies", "rooftop_equipment", "neon_signs", "conduits", "details"
  vertices: [number, number, number][]
  faces: [number, number, number][]
  material_name: string
  color_rgba: [number, number, number, number]
  emissive?: boolean
  emissive_hex?: string
  face_count?: number
  vertex_count?: number
}

export interface CollisionHullUCX {
  name: string
  vertices: [number, number, number][]
  faces: [number, number, number][]
  bounds: {
    min: [number, number, number]
    max: [number, number, number]
  }
}

export interface BuildingDetailMesh {
  building_id: string
  classification: {
    building_type: string
    category: string
    floors: number
    floor_height_m: number
    roof_style: string
    has_solar: boolean
    has_hvac: boolean
    has_balconies: boolean
    has_entrance_canopy: boolean
    has_ground_storefront: boolean
    wall_material: string
    trim_material: string
    roof_material: string
    base_color_hex: string
  }
  total_height: number
  base_elevation: number
  footprint_area_m2: number
  detail_tier: string
  components: Record<string, ArchitecturalComponentMesh>
  combined_mesh: {
    vertices: [number, number, number][]
    faces: [number, number, number][]
    vertex_count: number
    face_count: number
  }
  collision_ucx: CollisionHullUCX
  validation: {
    is_valid: boolean
    vertex_count: number
    triangle_count: number
    degenerate_count: number
    duplicate_face_count: number
    has_reversed_normals: boolean
    has_uv_coordinates: boolean
    terrain_penetration_detected: boolean
  }
}

export interface UrbanPropMesh {
  id: string
  prop_type: string // "streetlight", "bench", "tree"
  position: [number, number, number]
  rotation_y_deg: number
  vertices: [number, number, number][]
  faces: [number, number, number][]
  color_rgba: [number, number, number, number]
}

export interface SidewalkMesh {
  id: string
  vertices: [number, number, number][]
  faces: [number, number, number][]
  curb_height_m: number
  color_rgba: [number, number, number, number]
}

export interface MeshValidationReport {
  is_valid: boolean
  total_buildings_checked: number
  valid_buildings_count: number
  failed_buildings_count: number
  total_triangles: number
  total_vertices: number
  degenerate_faces: number
  duplicate_faces: number
  reversed_normals_detected: number
  missing_uv_count: number
  terrain_penetrations: number
  issues: string[]
}

export interface CityDetailData {
  job_id: string
  summary: {
    total_detailed_buildings: number
    total_triangles: number
    total_vertices: number
    detail_tier: string
    city_style: string
    urban_props_count: number
    sidewalk_segments_count: number
  }
  buildings: BuildingDetailMesh[]
  urban_props: UrbanPropMesh[]
  sidewalks: SidewalkMesh[]
  validation_report: MeshValidationReport
}

export interface ExportManifest {
  manifest_version: string
  project: string
  job_id: string
  export_timestamp: string
  units: {
    system: string
    unit: string
    scale_factor: number
  }
  coordinate_system: {
    axes: string
    handedness: string
    unreal_axes: string
    unity_axes: string
  }
  assets: {
    buildings_count: number
    props_count: number
    sidewalks_count: number
  }
  collision_hulls: {
    format: string
    total_ucx_hulls: number
    unreal_ready: boolean
    unity_mesh_collider_ready: boolean
  }
  lod_specifications: {
    lod0_full_detail: string
    lod1_medium_detail: string
    lod2_collision_hull: string
  }
  export_files: Record<string, string>
  validation_summary: {
    is_valid: boolean
    total_triangles: number
    total_vertices: number
    status: string
  }
}

export interface CityExportResult {
  job_id: string
  formats: string[]
  manifest_path: string
  manifest_url: string
  manifest: ExportManifest
  glb_url?: string
  fbx_url?: string
  obj_url?: string
  blender_script_url?: string
  blend_file_url?: string
  files: Record<string, string>
  validation: MeshValidationReport
}

// ==============================================================================
// VOICE & AGENT37 TYPES
// ==============================================================================

export interface VoiceState {
  isListening: boolean
  isSpeaking: boolean
  isProcessing: boolean
  transcript: string
  replyText: string
  audioUrl?: string
  lastAudioBase64?: string
  fallbackActive: boolean
  connectionStatus: "CHECKING" | "CONNECTED" | "FALLBACK" | "DISCONNECTED"
  error?: string | null
  availableVoices?: Array<{ voice_id: string; name: string; category?: string; description?: string }>
  selectedVoiceId?: string
}

export interface Agent37Message {
  id: string
  role: "user" | "assistant" | "system"
  text: string
  timestamp: number
  toolsUsed?: string[]
  verificationStatus?: string
  actionTriggered?: string
  investigationId?: string
  modelUsed?: string
  configuredModel?: string
  scientificModelsUsed?: string[]
}

export interface Agent37ModelInfo {
  id: string
  name: string
  harness: string
  template: string
  description: string
  tier: string
  status: string
  is_default: boolean
}

export interface Agent37ModelCatalog {
  status: string
  configured_model: string
  default_model: string
  active_instances_count: number
  discovered_templates_count: number
  available_models: Agent37ModelInfo[]
  scientific_models: Array<{
    id: string
    name: string
    role: string
    checkpoint?: string
    accuracy?: string
    status: string
  }>
  account_restrictions: {
    paid_key_verified: boolean
    active_instances_count: number
    instance_creation_policy: string
    compute_billing: string
    local_fallback_active: boolean
    secret_protection: string
  }
}

// ==============================================================================
// INSURANCE RISK ASSESSMENT MODE TYPES
// ==============================================================================

export interface InsuranceUnderwritingTier {
  code: 'TIER_1_PREFERRED' | 'TIER_2_STANDARD' | 'TIER_3_ELEVATED' | 'TIER_4_HIGH_RISK'
  label: string
  action: string
  deductible_recommendation: string
}

export interface InsuranceHazardItem {
  score: number
  weight: number
  rating: string
  key_metric: string
}

export interface HistoricalHazardEvent {
  event_name: string
  year: number
  recorded_surge_height_m?: number
  impact_summary?: string
  seismic_zone_rating?: string
  historical_events_recorded?: number
  note?: string
  landslide_events_recorded?: number
  karst_sinkhole_exposure?: string
}

export interface HistoricalHazardTelemetry {
  location_name: string
  historical_records_available: boolean
  status_note?: string
  fema_flood_zone?: string
  historical_flood_events?: HistoricalHazardEvent[]
  historical_earthquake_events?: HistoricalHazardEvent[]
  historical_landslide_events?: HistoricalHazardEvent[]
  data_source_provenance: string
}

export interface InsuranceBuildingScheduleItem {
  building_id: string
  height_m: number
  stories: number
  footprint_area_m2: number
  roof_shape: string
  sub_scores: {
    flood_score: number
    earthquake_score: number
    landslide_score: number
    structural_score: number
  }
  building_risk_score: number
  underwriting_tier: string
  dominant_peril: string
  underwriting_flags: string[]
  recommended_survey_focus: string
}

export interface InsuranceDataGap {
  parameter: string
  status: 'AVAILABLE' | 'UNAVAILABLE'
  impact: string
}

export interface InsuranceRiskReport {
  report_id: string
  generated_at: string
  evaluation_time_ms: number
  asset_identifier: string
  overall_risk_score: number
  underwriting_tier: InsuranceUnderwritingTier
  hazard_scores: {
    flood: InsuranceHazardItem
    earthquake: InsuranceHazardItem
    landslide: InsuranceHazardItem
    structural: InsuranceHazardItem
  }
  historical_hazard_information: HistoricalHazardTelemetry
  building_schedule: InsuranceBuildingScheduleItem[]
  total_buildings_evaluated: number
  supporting_evidence: {
    terrain_elevation_range_m: number
    terrain_min_elevation_m: number
    terrain_max_elevation_m: number
    mean_slope_degrees: number
    critical_slope_threshold_exceeded: boolean
    modeled_scenario_max_ponding_depth_m: number
    modeled_peak_ground_acceleration_g: number
    modeled_modified_mercalli_intensity: number
    building_count_evaluated: number
    mean_building_height_m: number
    max_building_height_m: number
    total_built_up_area_m2: number
    ground_sampling_distance_m: number
  }
  data_gaps: InsuranceDataGap[]
  recommendations: string[]
  methodology: {
    scoring_formula: string
    scale: string
    assumptions: string[]
    uncertainty_level: string
  }
  legal_disclaimer: string
}

// 2D-to-3D Inference API Response
export interface TwoDToThreeDPredictionResponse {
  prediction_id: string
  status: string
  model_version: string
  device: string
  inference_time_ms: number
  input: {
    filename: string
    width: number
    height: number
    gsd_m: number
    gsd_source: string
    is_calibrated: boolean
  }
  summary: {
    building_count: number
    tree_count: number
    mean_building_height_m: number
    max_building_height_m: number
    built_up_area_m2: number
    vegetation_coverage_pct: number
    building_density_pct: number
    overall_reconstruction_confidence: number
  }
  buildings: any[]
  trees: any[]
  classification_outputs: {
    vegetation_coverage_pct: number
    building_density_pct: number
    impervious_surface_pct: number
    landcover_classes: string[]
  }
  terrain_stats: any
  terrain_mesh?: any
  artifacts: {
    heightmap_png_url: string
    heightmap_tif_url: string
    metadata_url: string
  }
  caveats?: string[]
}




