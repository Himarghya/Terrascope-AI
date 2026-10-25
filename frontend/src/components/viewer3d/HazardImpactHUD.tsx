import React, { useMemo, useState } from 'react'
import {
  Activity,
  Waves,
  Mountain,
  AlertTriangle,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  ShieldAlert,
  FileSpreadsheet,
  FileText,
  Building,
  Users,
  Layers,
} from 'lucide-react'
import { useStore } from '../../store/useStore'

export const HazardImpactHUD: React.FC = () => {
  const geotwinOverlayMode = useStore((state) => state.geotwinOverlayMode)
  const setGeoTwinOverlayMode = useStore((state) => state.setGeoTwinOverlayMode)
  const richterScale = useStore((state) => state.richterScale)
  const setRichterScale = useStore((state) => state.setRichterScale)
  const isEarthquakeAnimating = useStore((state) => state.isEarthquakeAnimating)
  const setIsEarthquakeAnimating = useStore((state) => state.setIsEarthquakeAnimating)
  const earthquakeAnimSpeed = useStore((state) => state.earthquakeAnimSpeed)
  const setEarthquakeAnimSpeed = useStore((state) => state.setEarthquakeAnimSpeed)
  const epicenterPoint = useStore((state) => state.epicenterPoint)
  const floodWaterLevelM = useStore((state) => state.floodWaterLevelM)
  const setFloodWaterLevelM = useStore((state) => state.setFloodWaterLevelM)
  const isFloodAnimating = useStore((state) => state.isFloodAnimating)
  const setIsFloodAnimating = useStore((state) => state.setIsFloodAnimating)
  const hazardReport = useStore((state) => state.hazardReport)
  const runHazardPrediction = useStore((state) => state.runHazardPrediction)
  const sceneData = useStore((state) => state.sceneData)

  const [isMinimized, setIsMinimized] = useState(false)
  const [showBuildingList, setShowBuildingList] = useState(false)
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null)

  const buildings = sceneData?.buildings || []
  const buildings3D = sceneData?.buildings_3d || []

  // Map 3D meshes by id
  const meshMap = useMemo(() => {
    const map = new Map<string, any>()
    buildings3D.forEach((m) => map.set(m.building_id, m))
    return map
  }, [buildings3D])

  // ==========================================
  // REAL-TIME SEISMIC DAMAGE ASSESSMENT ENGINE
  // ==========================================
  const seismicAssessment = useMemo(() => {
    const mag = richterScale
    let collapsed = 0
    let severe = 0
    let moderate = 0
    let safe = 0
    let totalRubbleM3 = 0
    let totalDisplaced = 0
    let criticalDamaged = 0

    const list: Array<{
      id: string
      name: string
      heightM: number
      areaM2: number
      pgaG: number
      mmi: number
      damageGrade: string
      status: 'collapsed' | 'severe' | 'moderate' | 'safe'
      rubbleM3: number
      displaced: number
      isCritical: boolean
    }> = []

    const epiPx = epicenterPoint || [256, 256]

    buildings.forEach((b, idx) => {
      const mesh = meshMap.get(b.id)
      const h = b.estimated_height_m || (mesh?.total_height) || 12.0
      const area = b.footprint_area_m2 || 140.0
      const floors = Math.max(1, Math.round(h / 3.0))
      const bType = (b.building_type || 'Residential').toLowerCase()
      const isCritical = ['hospital', 'clinic', 'school', 'emergency', 'power', 'police', 'fire'].some((k) =>
        bType.includes(k)
      )

      // Distance from epicenter in km
      const cpx = b.center_px || [256 + (idx % 10) * 20, 256 + Math.floor(idx / 10) * 20]
      const dx = (cpx[0] - epiPx[0]) * 0.35
      const dy = (cpx[1] - epiPx[1]) * 0.35
      const distKm = Math.max(0.05, Math.hypot(dx, dy) / 1000.0)
      const hypoKm = Math.sqrt(distKm * distKm + 10.0 * 10.0)

      // Campbell-Bozorgnia NGA Attenuation
      const lnPga = -1.75 + 0.82 * mag - 1.18 * Math.log(Math.sqrt(hypoKm * hypoKm + 5.5 * 5.5)) + 0.12
      const pga = Math.min(2.5, Math.max(0.02, Math.exp(lnPga)))
      const mmi = Math.min(11.5, Math.max(1.5, 3.66 * Math.log10(Math.max(pga * 980.0, 1.0)) - 1.66))

      // Fundamental structural period & drift demand
      const Tfund = 0.04 * Math.pow(h, 0.9)
      const specAmp = 1.0 + 1.2 * Math.exp(-Math.pow(Tfund - 0.35, 2) / 0.08)
      const driftDemand = pga * specAmp

      let status: 'collapsed' | 'severe' | 'moderate' | 'safe' = 'safe'
      let grade = 'Grade 0/1 - Minor / Negligible Tremor'
      let rubble = 0
      let displaced = 0

      if (driftDemand > 0.82 || mmi >= 8.5) {
        status = 'collapsed'
        grade = 'Grade 4 - Completely Collapsed (Pancake Failure)'
        collapsed++
        rubble = Math.round(area * h * 0.45)
        displaced = Math.round((area * floors) / 22.0)
        if (isCritical) criticalDamaged++
      } else if (driftDemand > 0.52 || mmi >= 7.2) {
        status = 'severe'
        grade = 'Grade 3 - Severe Structural Failure (Red-Tagged)'
        severe++
        rubble = Math.round(area * h * 0.18)
        displaced = Math.round((area * floors) / 28.0)
        if (isCritical) criticalDamaged++
      } else if (driftDemand > 0.28 || mmi >= 5.8) {
        status = 'moderate'
        grade = 'Grade 2 - Moderate Shear Cracking (Yellow-Tagged)'
        moderate++
        rubble = Math.round(area * h * 0.03)
      } else {
        status = 'safe'
        grade = 'Grade 0/1 - Habitable / Safe (Green-Tagged)'
        safe++
      }

      totalRubbleM3 += rubble
      totalDisplaced += displaced

      list.push({
        id: b.id,
        name: `${b.building_type || 'Structure'} (${b.id})`,
        heightM: Math.round(h * 10) / 10,
        areaM2: Math.round(area),
        pgaG: Math.round(pga * 100) / 100,
        mmi: Math.round(mmi * 10) / 10,
        damageGrade: grade,
        status,
        rubbleM3: rubble,
        displaced,
        isCritical,
      })
    })

    const total = buildings.length || 1
    const maxPga = list.length > 0 ? Math.max(...list.map((i) => i.pgaG)) : 0.45
    const meanPga = list.length > 0 ? list.reduce((a, b) => a + b.pgaG, 0) / list.length : 0.25
    const maxMmi = list.length > 0 ? Math.max(...list.map((i) => i.mmi)) : 6.5

    let mercalliDesc = 'VI - Strong (Felt by all; plaster cracks, furniture moves)'
    if (maxMmi >= 9.0) mercalliDesc = 'IX+ - Violent / Catastrophic (Widespread pancake collapses)'
    else if (maxMmi >= 8.0) mercalliDesc = 'VIII - Severe (Heavy structural shear cracks, high collapse risk)'
    else if (maxMmi >= 7.0) mercalliDesc = 'VII - Very Strong (Significant damage to unreinforced buildings)'
    else if (maxMmi < 5.0) mercalliDesc = 'IV - Light / Moderate (Windows rattle, negligible damage)'

    return {
      magnitude: mag,
      totalBuildings: buildings.length,
      collapsed,
      severe,
      moderate,
      safe,
      collapsedPct: Math.round((collapsed / total) * 100),
      severePct: Math.round((severe / total) * 100),
      moderatePct: Math.round((moderate / total) * 100),
      safePct: Math.round((safe / total) * 100),
      totalRubbleM3,
      totalDisplaced,
      criticalDamaged,
      maxPga,
      meanPga: Math.round(meanPga * 100) / 100,
      maxMmi,
      mercalliDesc,
      shakingDurationS: Math.round((5.0 + 3.8 * Math.max(0.0, mag - 4.0)) * 10) / 10,
      buildingsList: list.sort((a, b) => (b.status === 'collapsed' ? 1 : 0) - (a.status === 'collapsed' ? 1 : 0)),
    }
  }, [buildings, meshMap, richterScale, epicenterPoint])

  // ==========================================
  // REAL-TIME FLOOD INUNDATION ASSESSMENT
  // ==========================================
  const floodAssessment = useMemo(() => {
    const surgeLevel = floodWaterLevelM
    let submerged = 0
    let partiallyFlooded = 0
    let dry = 0
    let totalFloodedAreaM2 = 0
    let totalDisplaced = 0

    const list: Array<{
      id: string
      name: string
      baseElevM: number
      roofElevM: number
      inundationDepthM: number
      status: 'submerged' | 'partially_flooded' | 'dry'
      areaM2: number
      displaced: number
    }> = []

    buildings.forEach((b) => {
      const mesh = meshMap.get(b.id)
      const baseElev = mesh?.base_elevation ?? 0.0
      const h = b.estimated_height_m || (mesh?.total_height) || 10.0
      const roofElev = baseElev + h
      const area = b.footprint_area_m2 || 140.0
      const floors = Math.max(1, Math.round(h / 3.0))

      const depth = Math.max(0, surgeLevel - baseElev)

      let status: 'submerged' | 'partially_flooded' | 'dry' = 'dry'
      let displaced = 0

      if (surgeLevel >= roofElev && h > 0) {
        status = 'submerged'
        submerged++
        totalFloodedAreaM2 += area
        displaced = Math.round((area * floors) / 24.0)
      } else if (depth > 0.15) {
        status = 'partially_flooded'
        partiallyFlooded++
        totalFloodedAreaM2 += area
        displaced = Math.round((area * Math.min(2, floors)) / 28.0)
      } else {
        status = 'dry'
        dry++
      }

      totalDisplaced += displaced

      list.push({
        id: b.id,
        name: `${b.building_type || 'Structure'} (${b.id})`,
        baseElevM: Math.round(baseElev * 10) / 10,
        roofElevM: Math.round(roofElev * 10) / 10,
        inundationDepthM: Math.round(depth * 10) / 10,
        status,
        areaM2: Math.round(area),
        displaced,
      })
    })

    const total = buildings.length || 1
    const totalAreaM2 = buildings.reduce((acc, b) => acc + (b.footprint_area_m2 || 140.0), 0)
    const floodedPct = totalAreaM2 > 0 ? Math.round((totalFloodedAreaM2 / totalAreaM2) * 100) : 0
    const waterVolM3 = Math.round(totalFloodedAreaM2 * Math.max(0.5, surgeLevel * 0.75))
    const severedRoads = hazardReport?.flood_hazard?.flooded_road_corridors_count ?? Math.min(12, Math.round(surgeLevel * 1.8))

    return {
      waterLevelM: surgeLevel,
      totalBuildings: buildings.length,
      submerged,
      partiallyFlooded,
      dry,
      submergedPct: Math.round((submerged / total) * 100),
      partiallyFloodedPct: Math.round((partiallyFlooded / total) * 100),
      dryPct: Math.round((dry / total) * 100),
      totalFloodedAreaM2,
      floodedPct,
      waterVolM3,
      severedRoads,
      totalDisplaced,
      buildingsList: list.sort((a, b) => b.inundationDepthM - a.inundationDepthM),
    }
  }, [buildings, meshMap, floodWaterLevelM, hazardReport])

  // ==========================================
  // REAL-TIME LANDSLIDE RISK ASSESSMENT
  // ==========================================
  const landslideAssessment = useMemo(() => {
    const report = hazardReport?.landslide_hazard
    const minFos = report?.min_factor_of_safety ?? 0.88
    const meanFos = report?.mean_factor_of_safety ?? 1.42
    const riskTier = report?.geotechnical_risk_tier ?? (minFos < 1.0 ? 'Critical Failure (FoS < 1.0)' : 'Conditionally Unstable')

    const highSlopeCount = report?.high_risk_buildings_count ?? Math.round(buildings.length * 0.18)
    const severedRoads = report?.severed_roads_count ?? Math.min(8, Math.round(highSlopeCount * 0.6))
    const unstableAreaM2 = report?.high_risk_area_m2 ?? Math.round(highSlopeCount * 220)
    const debrisM3 = report?.estimated_debris_m3 ?? Math.round(unstableAreaM2 * 4.2)
    const displaced = report?.estimated_displaced_occupants ?? Math.round(highSlopeCount * 14)

    return {
      minFos,
      meanFos,
      riskTier,
      highSlopeCount,
      severedRoads,
      unstableAreaM2,
      debrisM3,
      displaced,
      hotspots: report?.hotspots || [],
    }
  }, [hazardReport, buildings])

  // Only render HUD if one of the hazard simulation modes is active
  if (
    geotwinOverlayMode !== 'earthquake_intensity' &&
    geotwinOverlayMode !== 'flood_susceptibility' &&
    geotwinOverlayMode !== 'landslide_susceptibility'
  ) {
    return null
  }

  // ==========================================
  // EXPORT HANDLERS (JSON & CSV & TEXT)
  // ==========================================
  const handleExportJSON = () => {
    let exportData: any = {}
    let filename = 'damage_assessment.json'

    if (geotwinOverlayMode === 'earthquake_intensity') {
      filename = `seismic_damage_report_M${richterScale.toFixed(1)}_${Date.now()}.json`
      exportData = {
        hazard_type: 'Earthquake (Seismic Ground Motion)',
        generated_at: new Date().toISOString(),
        richter_magnitude: richterScale,
        mercalli_intensity: seismicAssessment.mercalliDesc,
        peak_ground_acceleration_pga_g: {
          max: seismicAssessment.maxPga,
          mean: seismicAssessment.meanPga,
        },
        estimated_tremor_duration_s: seismicAssessment.shakingDurationS,
        damage_summary: {
          total_buildings_analyzed: seismicAssessment.totalBuildings,
          completely_collapsed_grade_4: seismicAssessment.collapsed,
          severe_damage_red_tagged_grade_3: seismicAssessment.severe,
          moderate_shear_damage_yellow_tagged_grade_2: seismicAssessment.moderate,
          safe_green_tagged_grade_0_1: seismicAssessment.safe,
          estimated_rubble_volume_m3: seismicAssessment.totalRubbleM3,
          estimated_displaced_occupants: seismicAssessment.totalDisplaced,
          critical_facilities_damaged: seismicAssessment.criticalDamaged,
        },
        building_damage_breakdown: seismicAssessment.buildingsList,
      }
    } else if (geotwinOverlayMode === 'flood_susceptibility') {
      filename = `flood_inundation_damage_report_${floodWaterLevelM.toFixed(1)}m_${Date.now()}.json`
      exportData = {
        hazard_type: 'Flood Susceptibility & Physical Surge',
        generated_at: new Date().toISOString(),
        simulated_water_level_m: floodWaterLevelM,
        damage_summary: {
          total_buildings_analyzed: floodAssessment.totalBuildings,
          completely_submerged_buildings: floodAssessment.submerged,
          partially_flooded_buildings: floodAssessment.partiallyFlooded,
          dry_unaffected_buildings: floodAssessment.dry,
          total_inundated_footprint_m2: floodAssessment.totalFloodedAreaM2,
          inundated_area_percentage: `${floodAssessment.floodedPct}%`,
          estimated_flood_water_volume_m3: floodAssessment.waterVolM3,
          severed_road_corridors: floodAssessment.severedRoads,
          estimated_displaced_population: floodAssessment.totalDisplaced,
        },
        building_inundation_breakdown: floodAssessment.buildingsList,
      }
    } else {
      filename = `landslide_geotechnical_risk_report_${Date.now()}.json`
      exportData = {
        hazard_type: 'Landslide Susceptibility & Slope Failure',
        generated_at: new Date().toISOString(),
        geotechnical_assessment: {
          min_factor_of_safety: landslideAssessment.minFos,
          mean_factor_of_safety: landslideAssessment.meanFos,
          risk_tier: landslideAssessment.riskTier,
          buildings_in_runout_zone: landslideAssessment.highSlopeCount,
          severed_road_corridors: landslideAssessment.severedRoads,
          unstable_slope_area_m2: landslideAssessment.unstableAreaM2,
          estimated_mass_runout_debris_m3: landslideAssessment.debrisM3,
          estimated_displaced_population: landslideAssessment.displaced,
        },
        hotspots: landslideAssessment.hotspots,
      }
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    let csvContent = ''
    let filename = 'damage_report.csv'

    if (geotwinOverlayMode === 'earthquake_intensity') {
      filename = `earthquake_damage_buildings_M${richterScale.toFixed(1)}.csv`
      csvContent = 'Building_ID,Name,Height_m,Area_m2,PGA_g,MMI,Damage_Grade,Collapse_Status,Debris_Rubble_m3,Displaced_Occupants,Critical_Facility\n'
      seismicAssessment.buildingsList.forEach((b) => {
        csvContent += `"${b.id}","${b.name}",${b.heightM},${b.areaM2},${b.pgaG},${b.mmi},"${b.damageGrade}","${b.status}",${b.rubbleM3},${b.displaced},${b.isCritical ? 'YES' : 'NO'}\n`
      })
    } else if (geotwinOverlayMode === 'flood_susceptibility') {
      filename = `flood_inundation_buildings_${floodWaterLevelM.toFixed(1)}m.csv`
      csvContent = 'Building_ID,Name,Base_Elev_m,Roof_Elev_m,Inundation_Depth_m,Flood_Status,Footprint_Area_m2,Displaced_Persons\n'
      floodAssessment.buildingsList.forEach((b) => {
        csvContent += `"${b.id}","${b.name}",${b.baseElevM},${b.roofElevM},${b.inundationDepthM},"${b.status}",${b.areaM2},${b.displaced}\n`
      })
    } else {
      filename = `landslide_hazard_assessment.csv`
      csvContent = 'Hotspot_ID,Slope_deg,Susceptibility_pct,Factor_of_Safety,Risk_Tier,Elevation_m\n'
      landslideAssessment.hotspots.forEach((h: any) => {
        csvContent += `"${h.id}",${h.slope_deg},${h.susceptibility_pct},${h.factor_of_safety},"${h.risk_tier}",${h.elevation_m}\n`
      })
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopySummary = () => {
    let summaryText = ''
    if (geotwinOverlayMode === 'earthquake_intensity') {
      summaryText = `[EMERGENCY DISPATCH REPORT: SEISMIC DAMAGE ASSESSMENT]
Scenario: Richter Magnitude ${richterScale.toFixed(1)} M | Intensity: ${seismicAssessment.mercalliDesc}
Max Peak Ground Acceleration (PGA): ${seismicAssessment.maxPga} g | Shaking Duration: ${seismicAssessment.shakingDurationS}s
-----------------------------------------------------------
Total Structures Analyzed: ${seismicAssessment.totalBuildings}
💥 Completely Collapsed (Grade 4): ${seismicAssessment.collapsed} (${seismicAssessment.collapsedPct}%)
⚠️ Severe Damage / Red-Tagged (Grade 3): ${seismicAssessment.severe} (${seismicAssessment.severePct}%)
🟡 Moderate Shear Damage / Yellow-Tagged: ${seismicAssessment.moderate} (${seismicAssessment.moderatePct}%)
🟢 Safe / Green-Tagged: ${seismicAssessment.safe} (${seismicAssessment.safePct}%)
-----------------------------------------------------------
Estimated Rubble & Debris: ${seismicAssessment.totalRubbleM3.toLocaleString()} m³
Estimated Displaced Persons: ${seismicAssessment.totalDisplaced.toLocaleString()}
Critical Facilities Damaged: ${seismicAssessment.criticalDamaged}`
    } else if (geotwinOverlayMode === 'flood_susceptibility') {
      summaryText = `[EMERGENCY DISPATCH REPORT: FLOOD INUNDATION DAMAGE]
Simulated Surge Water Level: +${floodWaterLevelM.toFixed(1)}m
-----------------------------------------------------------
Total Structures Analyzed: ${floodAssessment.totalBuildings}
🏊 Completely Submerged: ${floodAssessment.submerged} (${floodAssessment.submergedPct}%)
🌊 Partially Inundated: ${floodAssessment.partiallyFlooded} (${floodAssessment.partiallyFloodedPct}%)
🟢 Dry / Safe High Ground: ${floodAssessment.dry} (${floodAssessment.dryPct}%)
-----------------------------------------------------------
Total Inundated Footprint: ${floodAssessment.totalFloodedAreaM2.toLocaleString()} m² (${floodAssessment.floodedPct}% of city)
Estimated Flood Water Volume: ${floodAssessment.waterVolM3.toLocaleString()} m³
Severed Road Corridors: ${floodAssessment.severedRoads}
Estimated Displaced Persons: ${floodAssessment.totalDisplaced.toLocaleString()}`
    } else {
      summaryText = `[EMERGENCY DISPATCH REPORT: LANDSLIDE & SLOPE FAILURE RISK]
Geotechnical Stability: ${landslideAssessment.riskTier} | Min FoS: ${landslideAssessment.minFos}
-----------------------------------------------------------
Buildings in Runout Path: ${landslideAssessment.highSlopeCount}
Severed Road Corridors: ${landslideAssessment.severedRoads}
Unstable Slope Surface: ${landslideAssessment.unstableAreaM2.toLocaleString()} m²
Estimated Mass Runout Debris: ${landslideAssessment.debrisM3.toLocaleString()} m³
Estimated Displaced Persons: ${landslideAssessment.displaced.toLocaleString()}`
    }

    navigator.clipboard.writeText(summaryText)
    setCopiedNotification('Summary copied to clipboard!')
    setTimeout(() => setCopiedNotification(null), 2500)
  }

  // ==========================================
  // MINIMIZED FLOATING PILL
  // ==========================================
  if (isMinimized) {
    return (
      <div className="absolute bottom-4 left-4 z-30">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white shadow-2xl hover:bg-slate-800 transition-all cursor-pointer group"
        >
          {geotwinOverlayMode === 'earthquake_intensity' && (
            <>
              <Activity className="w-4 h-4 text-rose-500 animate-pulse" />
              <span className="font-mono text-xs font-bold text-rose-300">
                Seismic M {richterScale.toFixed(1)}:
              </span>
              <span className="text-xs font-bold text-rose-400">
                {seismicAssessment.collapsed} Collapsed
              </span>
              <span className="text-xs text-amber-400">
                {seismicAssessment.severe} Red-Tagged
              </span>
            </>
          )}

          {geotwinOverlayMode === 'flood_susceptibility' && (
            <>
              <Waves className="w-4 h-4 text-sky-400 animate-pulse" />
              <span className="font-mono text-xs font-bold text-sky-300">
                Flood Surge +{floodWaterLevelM.toFixed(1)}m:
              </span>
              <span className="text-xs font-bold text-sky-400">
                {floodAssessment.submerged + floodAssessment.partiallyFlooded} Inundated
              </span>
            </>
          )}

          {geotwinOverlayMode === 'landslide_susceptibility' && (
            <>
              <Mountain className="w-4 h-4 text-amber-400" />
              <span className="font-mono text-xs font-bold text-amber-300">
                Landslide FoS {landslideAssessment.minFos}:
              </span>
              <span className="text-xs font-bold text-amber-400">
                {landslideAssessment.highSlopeCount} Threatened
              </span>
            </>
          )}

          <Maximize2 className="w-3.5 h-3.5 text-slate-400 ml-1 group-hover:text-white" />
        </button>
      </div>
    )
  }

  // ==========================================
  // EXPANDED FLOATING DAMAGE ASSESSMENT HUD
  // ==========================================
  return (
    <div className="absolute bottom-4 left-4 z-30 w-96 max-w-[calc(100vw-32px)] bg-slate-950/95 backdrop-blur-lg border border-slate-700/90 rounded-2xl shadow-2xl text-slate-100 p-3.5 font-sans transition-all animate-in fade-in duration-200">
      {/* HUD Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {geotwinOverlayMode === 'earthquake_intensity' && (
            <div className="p-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
          )}
          {geotwinOverlayMode === 'flood_susceptibility' && (
            <div className="p-1.5 rounded-lg bg-sky-500/20 border border-sky-500/30 text-sky-400">
              <Waves className="w-4 h-4 animate-pulse" />
            </div>
          )}
          {geotwinOverlayMode === 'landslide_susceptibility' && (
            <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <Mountain className="w-4 h-4" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <span>
                {geotwinOverlayMode === 'earthquake_intensity'
                  ? 'Seismic Damage Assessment'
                  : geotwinOverlayMode === 'flood_susceptibility'
                  ? 'Flood Inundation Impact'
                  : 'Slope Failure & Landslide Risk'}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              GeoTwin ResponseOS • Physical Damage Model
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            title="Minimize HUD"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mode-Specific Parameter Slider Bar */}
      <div className="py-2.5 border-b border-slate-800/80 space-y-1.5">
        {geotwinOverlayMode === 'earthquake_intensity' && (
          <div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1">
                <span>Richter Magnitude:</span>
                <span className="text-rose-400 font-bold text-sm">
                  M {richterScale.toFixed(1)}
                </span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsEarthquakeAnimating(!isEarthquakeAnimating)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer flex items-center gap-1 ${
                    isEarthquakeAnimating
                      ? 'bg-amber-600 text-white animate-pulse'
                      : 'bg-rose-700 hover:bg-rose-600 text-white'
                  }`}
                >
                  {isEarthquakeAnimating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{isEarthquakeAnimating ? 'Pause' : 'Tremor'}</span>
                </button>
              </div>
            </div>
            <input
              type="range"
              min={3.0}
              max={9.5}
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
              className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg mt-1"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-400">
              <span>M 3.0</span>
              <span>M 5.5</span>
              <span>M 7.0 (Major)</span>
              <span>M 8.5 (Great)</span>
              <span>M 9.5</span>
            </div>
          </div>
        )}

        {geotwinOverlayMode === 'flood_susceptibility' && (
          <div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1">
                <span>Surge Water Level:</span>
                <span className="text-sky-400 font-bold text-sm">
                  +{floodWaterLevelM.toFixed(1)} m
                </span>
              </span>
              <button
                onClick={() => setIsFloodAnimating(!isFloodAnimating)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer flex items-center gap-1 ${
                  isFloodAnimating
                    ? 'bg-amber-600 text-white animate-pulse'
                    : 'bg-sky-700 hover:bg-sky-600 text-white'
                }`}
              >
                {isFloodAnimating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{isFloodAnimating ? 'Pause' : 'Surge'}</span>
              </button>
            </div>
            <input
              type="range"
              min={0.0}
              max={15.0}
              step={0.1}
              value={floodWaterLevelM}
              onChange={(e) => setFloodWaterLevelM(Number(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg mt-1"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-400">
              <span>0m Dry</span>
              <span>2.5m Moderate</span>
              <span>6.0m Severe</span>
              <span>15m Max Surge</span>
            </div>
          </div>
        )}

        {geotwinOverlayMode === 'landslide_susceptibility' && (
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300">Geotechnical Stability:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                landslideAssessment.minFos < 1.0
                  ? 'bg-rose-950 text-rose-300 border border-rose-700'
                  : 'bg-amber-950 text-amber-300 border border-amber-700'
              }`}
            >
              FoS {landslideAssessment.minFos} • {landslideAssessment.riskTier}
            </span>
          </div>
        )}
      </div>

      {/* PRIMARY DAMAGE KPIS GRID */}
      <div className="py-2.5">
        {geotwinOverlayMode === 'earthquake_intensity' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-700/80 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-rose-400 block tracking-wider">
                💥 Completely Collapsed
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black font-mono text-rose-200">
                  {seismicAssessment.collapsed}
                </span>
                <span className="text-[10px] font-mono text-rose-400">
                  / {seismicAssessment.totalBuildings} blds ({seismicAssessment.collapsedPct}%)
                </span>
              </div>
              <span className="text-[9px] text-rose-400/80 block mt-0.5">
                Grade 4 • Total Pancake Failure
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-orange-950/60 border border-orange-700/80 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-orange-400 block tracking-wider">
                ⚠️ Severe (Red-Tagged)
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black font-mono text-orange-200">
                  {seismicAssessment.severe}
                </span>
                <span className="text-[10px] font-mono text-orange-400">
                  ({seismicAssessment.severePct}%)
                </span>
              </div>
              <span className="text-[9px] text-orange-400/80 block mt-0.5">
                Grade 3 • Uninhabitable Structural
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
                🟡 Moderate (Yellow-Tag)
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-bold font-mono text-amber-200">
                  {seismicAssessment.moderate}
                </span>
                <span className="text-[10px] font-mono text-amber-400">
                  ({seismicAssessment.moderatePct}%)
                </span>
              </div>
              <span className="text-[9px] text-amber-400/80 block mt-0.5">
                Grade 2 • Shear Cracks
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                🟢 Safe / Green-Tagged
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-bold font-mono text-emerald-200">
                  {seismicAssessment.safe}
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                  ({seismicAssessment.safePct}%)
                </span>
              </div>
              <span className="text-[9px] text-emerald-400/80 block mt-0.5">
                Grade 0/1 • Minor/Negligible
              </span>
            </div>
          </div>
        )}

        {geotwinOverlayMode === 'flood_susceptibility' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-sky-950/60 border border-sky-700/80 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-sky-400 block tracking-wider">
                🏊 Submerged Buildings
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black font-mono text-sky-200">
                  {floodAssessment.submerged}
                </span>
                <span className="text-[10px] font-mono text-sky-400">
                  / {floodAssessment.totalBuildings} ({floodAssessment.submergedPct}%)
                </span>
              </div>
              <span className="text-[9px] text-sky-400/80 block mt-0.5">
                Roof Completely Submerged
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-cyan-950/50 border border-cyan-700/80 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-cyan-400 block tracking-wider">
                🌊 Ground Floor Flooded
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black font-mono text-cyan-200">
                  {floodAssessment.partiallyFlooded}
                </span>
                <span className="text-[10px] font-mono text-cyan-400">
                  ({floodAssessment.partiallyFloodedPct}%)
                </span>
              </div>
              <span className="text-[9px] text-cyan-400/80 block mt-0.5">
                Ground Inundation &gt; 0.15m
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                📐 Inundated Footprint
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-bold font-mono text-slate-200">
                  {floodAssessment.totalFloodedAreaM2.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono text-sky-400">
                  m² ({floodAssessment.floodedPct}%)
                </span>
              </div>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                Direct Footprint Exposure
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-rose-400 block tracking-wider">
                🛣️ Severed Roads
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-bold font-mono text-rose-200">
                  {floodAssessment.severedRoads}
                </span>
                <span className="text-[10px] font-mono text-rose-400">
                  Corridors Cut
                </span>
              </div>
              <span className="text-[9px] text-rose-400/80 block mt-0.5">
                Vehicular Access Blocked
              </span>
            </div>
          </div>
        )}

        {geotwinOverlayMode === 'landslide_susceptibility' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-700/80 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
                🚨 Runout Path Buildings
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black font-mono text-amber-200">
                  {landslideAssessment.highSlopeCount}
                </span>
                <span className="text-[10px] font-mono text-amber-400">
                  / {buildings.length}
                </span>
              </div>
              <span className="text-[9px] text-amber-400/80 block mt-0.5">
                High Slope Failure Zone
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-700/80 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-rose-400 block tracking-wider">
                🛑 Severed Roads
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-black font-mono text-rose-200">
                  {landslideAssessment.severedRoads}
                </span>
                <span className="text-[10px] font-mono text-rose-400">
                  Corridors
                </span>
              </div>
              <span className="text-[9px] text-rose-400/80 block mt-0.5">
                Debris Flow Blockage
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                📐 Unstable Slope Area
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-bold font-mono text-slate-200">
                  {landslideAssessment.unstableAreaM2.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono text-amber-400">
                  m²
                </span>
              </div>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                Slopes &gt; 22° with TWI Saturation
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                🪨 Mass Runout Debris
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-bold font-mono text-slate-200">
                  {landslideAssessment.debrisM3.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono text-amber-400">
                  m³
                </span>
              </div>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                Estimated Slump Volume
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SECONDARY IMPACT & LOGISTICS METRICS */}
      <div className="py-2 px-2.5 bg-slate-900/70 rounded-xl border border-slate-800/80 text-[11px] font-mono space-y-1.5">
        {geotwinOverlayMode === 'earthquake_intensity' && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>Estimated Debris / Rubble:</span>
              </span>
              <span className="font-bold text-rose-300">
                {seismicAssessment.totalRubbleM3.toLocaleString()} m³
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Estimated Displaced Persons:</span>
              </span>
              <span className="font-bold text-amber-300">
                ~{seismicAssessment.totalDisplaced.toLocaleString()} people
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                <span>Max Ground Motion (PGA):</span>
              </span>
              <span className="font-bold text-rose-400">
                {seismicAssessment.maxPga} g (MMI {seismicAssessment.maxMmi})
              </span>
            </div>
          </>
        )}

        {geotwinOverlayMode === 'flood_susceptibility' && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Waves className="w-3.5 h-3.5 text-sky-400" />
                <span>Estimated Inundation Volume:</span>
              </span>
              <span className="font-bold text-sky-300">
                ~{floodAssessment.waterVolM3.toLocaleString()} m³
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Estimated Displaced Persons:</span>
              </span>
              <span className="font-bold text-amber-300">
                ~{floodAssessment.totalDisplaced.toLocaleString()} people
              </span>
            </div>
          </>
        )}

        {geotwinOverlayMode === 'landslide_susceptibility' && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Mountain className="w-3.5 h-3.5 text-amber-400" />
                <span>Mean Factor of Safety:</span>
              </span>
              <span className="font-bold text-amber-300">
                {landslideAssessment.meanFos} (Target &gt; 1.5)
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Threatened Occupants:</span>
              </span>
              <span className="font-bold text-amber-300">
                ~{landslideAssessment.displaced.toLocaleString()} people
              </span>
            </div>
          </>
        )}
      </div>

      {/* Building Damage List Toggle */}
      <div className="pt-2">
        <button
          onClick={() => setShowBuildingList(!showBuildingList)}
          className="w-full py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1 cursor-pointer transition-colors"
        >
          <span>{showBuildingList ? 'Hide Individual Building Damage' : 'View Individual Building Damage'}</span>
          {showBuildingList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showBuildingList && (
          <div className="max-h-40 overflow-y-auto mt-1 space-y-1 pr-1 font-mono text-[10px]">
            {geotwinOverlayMode === 'earthquake_intensity' &&
              seismicAssessment.buildingsList.slice(0, 50).map((b) => (
                <div
                  key={b.id}
                  className={`p-1.5 rounded flex items-center justify-between border ${
                    b.status === 'collapsed'
                      ? 'bg-rose-950/80 border-rose-800 text-rose-200'
                      : b.status === 'severe'
                      ? 'bg-orange-950/60 border-orange-800 text-orange-200'
                      : b.status === 'moderate'
                      ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                      : 'bg-emerald-950/30 border-emerald-900 text-emerald-200'
                  }`}
                >
                  <div className="truncate pr-1">
                    <span className="font-bold">{b.name}</span>
                    <span className="text-[9px] opacity-75 block">
                      {b.heightM}m • {b.areaM2}m² • PGA: {b.pgaG}g
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                      b.status === 'collapsed'
                        ? 'bg-rose-600 text-white'
                        : b.status === 'severe'
                        ? 'bg-orange-600 text-white'
                        : b.status === 'moderate'
                        ? 'bg-amber-600 text-white'
                        : 'bg-emerald-700 text-white'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
              ))}

            {geotwinOverlayMode === 'flood_susceptibility' &&
              floodAssessment.buildingsList.slice(0, 50).map((b) => (
                <div
                  key={b.id}
                  className={`p-1.5 rounded flex items-center justify-between border ${
                    b.status === 'submerged'
                      ? 'bg-sky-950/80 border-sky-800 text-sky-200'
                      : b.status === 'partially_flooded'
                      ? 'bg-cyan-950/60 border-cyan-800 text-cyan-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="truncate pr-1">
                    <span className="font-bold">{b.name}</span>
                    <span className="text-[9px] opacity-75 block">
                      Base: +{b.baseElevM}m • Roof: +{b.roofElevM}m
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                      b.status === 'submerged'
                        ? 'bg-sky-600 text-white'
                        : b.status === 'partially_flooded'
                        ? 'bg-cyan-600 text-slate-900'
                        : 'bg-emerald-800 text-emerald-100'
                    }`}
                  >
                    {b.status === 'submerged'
                      ? 'Submerged'
                      : b.status === 'partially_flooded'
                      ? `-${b.inundationDepthM}m Under`
                      : 'Dry'}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* REPORT EXPORT & ANALYSIS ACTION BAR */}
      <div className="pt-2.5 mt-2 border-t border-slate-800/80 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportJSON}
            title="Download full forensic damage report in JSON format"
            className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] font-mono flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON Report</span>
          </button>

          <button
            onClick={handleExportCSV}
            title="Export building damage table to CSV spreadsheet"
            className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] font-mono flex items-center justify-center gap-1 cursor-pointer border border-slate-700 transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleCopySummary}
            title="Copy Executive Dispatch Summary to clipboard"
            className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] font-mono flex items-center justify-center gap-1 cursor-pointer border border-slate-700 transition-all active:scale-95"
          >
            {copiedNotification ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-300" />
            )}
            <span>Copy</span>
          </button>
        </div>

        {copiedNotification && (
          <div className="text-center font-mono text-[10px] text-emerald-400 bg-emerald-950/60 py-1 rounded border border-emerald-800/50 animate-in fade-in">
            {copiedNotification}
          </div>
        )}
      </div>
    </div>
  )
}

export default HazardImpactHUD
