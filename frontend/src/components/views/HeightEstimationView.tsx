import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Mountain,
  Download,
  AlertCircle,
  CheckCircle2,
  Box,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
  Building2,
  MapPin,
  Crosshair,
  X,
  Eye,
  EyeOff,
  Tag,
  Sliders,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Maximize2
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { BuildingFeature, TreeFeature } from '../../types'

interface SihePin {
  x: number
  y: number
  height_m: number
  surface_type: 'building' | 'tree' | 'ground'
  id: string
  building?: BuildingFeature
  tree?: TreeFeature
  nearest_building?: {
    id: string
    height_m: number
    distance_m: number
    area_m2?: number
  } | null
}

interface SiheHover {
  x: number
  y: number
  text: string
  height_m?: number
  buildingId?: string
}

function isPointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
  if (!poly || poly.length < 3) return false
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function getBuildingCenter(poly: [number, number][]): [number, number] {
  if (!poly || poly.length === 0) return [0, 0]
  let sumX = 0
  let sumY = 0
  for (const pt of poly) {
    sumX += pt[0]
    sumY += pt[1]
  }
  return [sumX / poly.length, sumY / poly.length]
}

export const HeightEstimationView: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const currentJobId = useStore((state) => state.currentJobId)
  const setActiveScreen = useStore((state) => state.setActiveScreen)
  const setViewMode = useStore((state) => state.setViewMode)
  const selectedFeature = useStore((state) => state.selectedFeature)
  const selectFeature = useStore((state) => state.selectFeature)
  const setTargetFocusPosition = useStore((state) => state.setTargetFocusPosition)
  const verticalExaggeration = useStore((state) => state.verticalExaggeration)
  const setInspectorOpen = useStore((state) => state.setInspectorOpen)

  const numBuildings = sceneData?.buildings?.length || 0

  // View & Mode States
  const [compareMode, setCompareMode] = useState<'swipe' | 'split' | 'heightmap' | 'ortho'>('swipe')
  const [sliderPos, setSliderPos] = useState<number>(50)
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false)
  const [zoomLevel, setZoomLevel] = useState<number>(1.0)
  const [showFootprints, setShowFootprints] = useState<boolean>(true)
  // Smart default: if dense settlement (>60 buildings), start with tags OFF to prevent clutter
  const [showHeightLabels, setShowHeightLabels] = useState<boolean>(numBuildings <= 60)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [heightFilter, setHeightFilter] = useState<'all' | 'tall' | 'medium' | 'small'>('all')

  const [activePin, setActivePin] = useState<SihePin | null>(null)
  const [hoverInfo, setHoverInfo] = useState<SiheHover | null>(null)

  const swipeContainerRef = useRef<HTMLDivElement>(null)

  // Sync with store selectedFeature if user selected a building from outside
  useEffect(() => {
    if (selectedFeature?.type === 'building' && sceneData) {
      const bld = selectedFeature.data as BuildingFeature
      const [cx, cy] = bld.center_px || (bld.polygon_px ? getBuildingCenter(bld.polygon_px) : [0, 0])
      setActivePin({
        x: Math.round(bld.cx || cx),
        y: Math.round(bld.cy || cy),
        height_m: bld.height_m ?? bld.estimated_height_m,
        surface_type: 'building',
        id: bld.id,
        building: bld
      })
    }
  }, [selectedFeature, sceneData])

  // Drag handler for swipe divider
  useEffect(() => {
    if (!isDraggingSlider) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!swipeContainerRef.current) return
      const rect = swipeContainerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = Math.max(1, Math.min(99, (x / rect.width) * 100))
      setSliderPos(Math.round(pct))
    }

    const handleMouseUp = () => {
      setIsDraggingSlider(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingSlider])

  // Top building IDs by height for Level-of-Detail tag decluttering
  const topBuildingIds = useMemo(() => {
    if (!sceneData?.buildings) return new Set<string>()
    return new Set(
      [...sceneData.buildings]
        .sort((a, b) => (b.height_m ?? b.estimated_height_m) - (a.height_m ?? a.estimated_height_m))
        .slice(0, 35)
        .map((b) => b.id)
    )
  }, [sceneData?.buildings])

  // Filtered building list for the quick-select strip
  const filteredBuildings = useMemo(() => {
    if (!sceneData?.buildings) return []
    let list = [...sceneData.buildings]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (b) =>
          b.id.toLowerCase().includes(q) ||
          (b.building_type && b.building_type.toLowerCase().includes(q))
      )
    }

    if (heightFilter === 'tall') {
      list = list.filter((b) => (b.height_m ?? b.estimated_height_m) >= 10.0)
    } else if (heightFilter === 'medium') {
      list = list.filter((b) => {
        const h = b.height_m ?? b.estimated_height_m
        return h >= 5.0 && h < 10.0
      })
    } else if (heightFilter === 'small') {
      list = list.filter((b) => (b.height_m ?? b.estimated_height_m) < 5.0)
    }

    list.sort((a, b) => (b.height_m ?? b.estimated_height_m) - (a.height_m ?? a.estimated_height_m))
    return list.slice(0, 40)
  }, [sceneData?.buildings, searchQuery, heightFilter])

  if (!sceneData || !sceneData.sihe) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#F5F6F3] p-8 text-center text-[#68736D] text-xs">
        <p>No SIHE height model available. Please load a dataset or process an image first.</p>
        <button
          onClick={() => setActiveScreen('projects')}
          className="mt-3 px-3 py-1.5 rounded bg-[#286653] text-white font-medium cursor-pointer"
        >
          Go to Projects
        </button>
      </div>
    )
  }

  const { calibration, uncertainty_metrics, visualization_url, ndsm_raster_url } = sceneData.sihe
  const maxH = calibration.max_object_height_m || 40.0
  const imgWidth = sceneData.dimensions.width
  const imgHeight = sceneData.dimensions.height

  // Coordinate conversion helper
  const getRasterCoords = (e: React.MouseEvent<HTMLDivElement | SVGSVGElement>): { x: number; y: number } | null => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const u = Math.max(0, Math.min(1, clickX / rect.width))
    const v = Math.max(0, Math.min(1, clickY / rect.height))
    return {
      x: Math.round(u * imgWidth),
      y: Math.round(v * imgHeight)
    }
  }

  const handleSelectBuilding = (b: BuildingFeature, pxX?: number, pxY?: number) => {
    const [cx, cy] = b.center_px || (b.polygon_px ? getBuildingCenter(b.polygon_px) : [0, 0])
    const x = pxX !== undefined ? pxX : Math.round(b.cx || cx)
    const y = pxY !== undefined ? pxY : Math.round(b.cy || cy)
    const h = b.height_m ?? b.estimated_height_m
    setActivePin({
      x,
      y,
      height_m: h,
      surface_type: 'building',
      id: b.id,
      building: b
    })
    selectFeature({ type: 'building', id: b.id, data: b })
  }

  const handleRasterClick = async (e: React.MouseEvent<HTMLDivElement | SVGSVGElement>) => {
    const coords = getRasterCoords(e)
    if (!coords) return
    const { x, y } = coords

    // 1. Check if inside any building polygon
    let matchedBld = sceneData.buildings.find((b) => isPointInPolygon(x, y, b.polygon_px))

    // Proximity check (within 16px of center or polygon)
    if (!matchedBld) {
      matchedBld = sceneData.buildings.find((b) => {
        const [cx, cy] = b.center_px || getBuildingCenter(b.polygon_px)
        const dist = Math.hypot(x - cx, y - cy)
        return dist <= 16
      })
    }

    if (matchedBld) {
      handleSelectBuilding(matchedBld, x, y)
      return
    }

    // 2. Check if clicked a tree
    const matchedTree = sceneData.trees.find((t) => {
      const [cx, cy] = t.center_px
      const r = Math.max(5, (t.crown_diameter_m / 2) / sceneData.gsd_m)
      return Math.hypot(x - cx, y - cy) <= r * 1.3
    })

    if (matchedTree) {
      const tH = matchedTree.estimated_canopy_height_m || 6.0
      setActivePin({
        x,
        y,
        height_m: tH,
        surface_type: 'tree',
        id: matchedTree.id,
        tree: matchedTree
      })
      selectFeature({ type: 'vegetation', id: matchedTree.id, data: matchedTree })
      return
    }

    // 3. Ground / Open Surface Spot Height
    let groundH = 0.2
    let nearestBld: any = null

    let minDist = Infinity
    for (const b of sceneData.buildings) {
      const [cx, cy] = b.center_px || getBuildingCenter(b.polygon_px)
      const d = Math.hypot(x - cx, y - cy)
      if (d < minDist) {
        minDist = d
        nearestBld = {
          id: b.id,
          height_m: b.height_m ?? b.estimated_height_m,
          distance_m: Math.round(d * sceneData.gsd_m * 10) / 10,
          area_m2: Math.round(b.area_m2 ?? b.footprint_area_m2)
        }
      }
    }

    try {
      if (currentJobId) {
        const res = await fetch(`/api/scene/${currentJobId}/probe?x=${x}&y=${y}`)
        if (res.ok) {
          const probeData = await res.json()
          if (probeData.height_m !== undefined) {
            groundH = probeData.height_m
          }
          if (probeData.nearest_building) {
            nearestBld = probeData.nearest_building
          }
          if (probeData.is_building && probeData.building) {
            handleSelectBuilding(probeData.building, x, y)
            return
          }
        }
      }
    } catch (err) {
      // fallback
    }

    setActivePin({
      x,
      y,
      height_m: groundH,
      surface_type: 'ground',
      id: 'Ground Surface',
      nearest_building: nearestBld
    })
  }

  const handleRasterMouseMove = (e: React.MouseEvent<HTMLDivElement | SVGSVGElement>) => {
    const coords = getRasterCoords(e)
    if (!coords) {
      setHoverInfo(null)
      return
    }
    const { x, y } = coords

    const bld = sceneData.buildings.find((b) => isPointInPolygon(x, y, b.polygon_px))
    if (bld) {
      const h = bld.height_m ?? bld.estimated_height_m
      const stories = bld.estimated_floors || Math.max(1, Math.round(h / 3.0))
      setHoverInfo({
        x,
        y,
        text: `${bld.id} · ${bld.roof_shape || 'Building'} · Height: ${h.toFixed(1)}m AGL (${stories} Fl) · Area: ${Math.round(bld.area_m2 || bld.footprint_area_m2)} m²`,
        height_m: h,
        buildingId: bld.id
      })
      return
    }

    const tree = sceneData.trees.find((t) => {
      const [cx, cy] = t.center_px
      const r = Math.max(4, (t.crown_diameter_m / 2) / sceneData.gsd_m)
      return Math.hypot(x - cx, y - cy) <= r
    })
    if (tree) {
      const th = tree.estimated_canopy_height_m || 6.0
      setHoverInfo({
        x,
        y,
        text: `${tree.id} · Tree Canopy · Height: ${th.toFixed(1)}m AGL · Diam: ${tree.crown_diameter_m.toFixed(1)}m`,
        height_m: th
      })
      return
    }

    setHoverInfo({
      x,
      y,
      text: `Surface Spot at (${x}, ${y}) · Click to probe metric height`
    })
  }

  const handleRasterMouseLeave = () => {
    setHoverInfo(null)
  }

  const handleInspectIn3D = (bld: BuildingFeature) => {
    selectFeature({ type: 'building', id: bld.id, data: bld })
    if (sceneData.buildings_3d) {
      const target3D = sceneData.buildings_3d.find((m) => m.building_id === bld.id)
      if (target3D && target3D.vertices && target3D.vertices.length > 0) {
        setTargetFocusPosition([
          target3D.vertices[0][0],
          target3D.base_elevation * verticalExaggeration + (bld.height_m ?? bld.estimated_height_m) / 2,
          target3D.vertices[0][2]
        ])
      }
    }
    setViewMode('3d')
    setActiveScreen('3d-reconstruction')
  }

  // Helper: should a building display its in-scene rooftop height badge?
  const shouldShowTag = (b: BuildingFeature, isSelected: boolean, isHovered: boolean): boolean => {
    if (isSelected || isHovered) return true
    if (!showHeightLabels) return false
    // Level-of-Detail filtering: for dense settlements (>60 buildings), show top 35 landmarks
    // unless zoomed in to prevent tag overlap
    if (numBuildings > 60 && zoomLevel < 1.6) {
      return topBuildingIds.has(b.id)
    }
    return true
  }

  // Render SVG vector overlay of building footprints and height tags
  const renderSvgOverlay = () => {
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        viewBox={`0 0 ${imgWidth} ${imgHeight}`}
      >
        {/* Building Polygons */}
        {sceneData.buildings.map((b) => {
          const ptsStr = b.polygon_px.map((pt) => `${pt[0]},${pt[1]}`).join(' ')
          const isSelected = activePin?.id === b.id || selectedFeature?.id === b.id
          const isHovered = hoverInfo?.buildingId === b.id
          const [cx, cy] = b.center_px || getBuildingCenter(b.polygon_px)
          const h = b.height_m ?? b.estimated_height_m
          const showTag = shouldShowTag(b, isSelected, isHovered)

          return (
            <g key={b.id}>
              {/* Footprint Polygon */}
              <polygon
                points={ptsStr}
                fill={
                  isSelected
                    ? 'rgba(6, 182, 212, 0.50)'
                    : isHovered
                    ? 'rgba(56, 189, 248, 0.40)'
                    : showFootprints
                    ? 'rgba(40, 102, 83, 0.18)'
                    : 'transparent'
                }
                stroke={
                  isSelected
                    ? '#06b6d4'
                    : isHovered
                    ? '#38bdf8'
                    : showFootprints
                    ? 'rgba(40, 102, 83, 0.85)'
                    : 'transparent'
                }
                strokeWidth={isSelected ? 3.0 : isHovered ? 2.2 : 1.0}
                className="cursor-pointer transition-colors"
                onClick={(ev) => {
                  ev.stopPropagation()
                  handleSelectBuilding(b, cx, cy)
                }}
              >
                <title>{`${b.id} (${b.roof_shape || 'Building'}, Height: ${h.toFixed(1)}m AGL)`}</title>
              </polygon>

              {/* In-Scene Height Badge (Adaptive Level-of-Detail) */}
              {showTag && (
                <g
                  transform={`translate(${cx}, ${cy})`}
                  className="cursor-pointer pointer-events-none"
                >
                  <rect
                    x="-17"
                    y="-8"
                    width="34"
                    height="16"
                    rx="3"
                    fill={isSelected ? '#06b6d4' : isHovered ? '#0f172a' : 'rgba(15, 23, 42, 0.85)'}
                    stroke={isSelected ? '#ffffff' : '#38bdf8'}
                    strokeWidth={isSelected ? '1.5' : '0.8'}
                  />
                  <text
                    x="0"
                    y="4"
                    fill={isSelected ? '#0f172a' : '#ffffff'}
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {h.toFixed(1)}m
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* Tree Canopies */}
        {sceneData.trees.map((t) => {
          const [cx, cy] = t.center_px
          const r_px = (t.crown_diameter_m / 2) / sceneData.gsd_m
          const isSelected = activePin?.id === t.id
          return (
            <circle
              key={t.id}
              cx={cx}
              cy={cy}
              r={Math.max(4, r_px)}
              fill={isSelected ? 'rgba(6, 182, 212, 0.6)' : 'rgba(34, 197, 94, 0.28)'}
              stroke={isSelected ? '#06b6d4' : '#22c55e'}
              strokeWidth={isSelected ? 2.5 : 1}
              className="cursor-pointer"
              onClick={(ev) => {
                ev.stopPropagation()
                const tH = t.estimated_canopy_height_m || 6.0
                setActivePin({
                  x: cx,
                  y: cy,
                  height_m: tH,
                  surface_type: 'tree',
                  id: t.id,
                  tree: t
                })
                selectFeature({ type: 'vegetation', id: t.id, data: t })
              }}
            />
          )
        })}

        {/* Active Inspection Pin & Crosshair */}
        {activePin && (
          <g className="pointer-events-none">
            {/* Crosshair guidelines */}
            <line
              x1="0"
              y1={activePin.y}
              x2={imgWidth}
              y2={activePin.y}
              stroke="#38bdf8"
              strokeWidth="0.8"
              strokeDasharray="4,4"
              opacity="0.65"
            />
            <line
              x1={activePin.x}
              y1="0"
              x2={activePin.x}
              y2={imgHeight}
              stroke="#38bdf8"
              strokeWidth="0.8"
              strokeDasharray="4,4"
              opacity="0.65"
            />

            {/* Pulsing Outer Ping Ring */}
            <circle
              cx={activePin.x}
              cy={activePin.y}
              r="15"
              fill="none"
              stroke={activePin.surface_type === 'building' ? '#06b6d4' : '#f59e0b'}
              strokeWidth="2.5"
              opacity="0.9"
            />

            {/* Glowing Pin Center */}
            <circle
              cx={activePin.x}
              cy={activePin.y}
              r="5.5"
              fill={activePin.surface_type === 'building' ? '#06b6d4' : '#f59e0b'}
              stroke="#ffffff"
              strokeWidth="2"
            />

            {/* Floating In-Raster Pin Label */}
            <g transform={`translate(${activePin.x}, ${activePin.y - 14})`}>
              <rect
                x="-46"
                y="-22"
                width="92"
                height="22"
                rx="4"
                fill="rgba(15, 23, 42, 0.95)"
                stroke={activePin.surface_type === 'building' ? '#06b6d4' : '#f59e0b'}
                strokeWidth="1.5"
                filter="drop-shadow(0 4px 6px rgba(0,0,0,0.4))"
              />
              <text
                x="0"
                y="-7"
                fill="#38bdf8"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {activePin.height_m.toFixed(1)}m AGL
              </text>
            </g>
          </g>
        )}
      </svg>
    )
  }

  // 1. RENDER INTERACTIVE SWIPE SLIDER (Full Width, Full Height)
  const renderSwipeView = () => {
    return (
      <div
        ref={swipeContainerRef}
        className="relative w-full h-[580px] rounded border border-[#DCE2DC] overflow-hidden bg-slate-950 select-none shadow-inner cursor-crosshair"
        onMouseMove={handleRasterMouseMove}
        onMouseLeave={handleRasterMouseLeave}
        onClick={handleRasterClick}
        style={{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'center center',
          transition: 'transform 0.15s ease-out'
        }}
      >
        {/* Layer 1 (Base): Calibrated nDSM Heightfield (Turbo Ramp) */}
        <img
          src={visualization_url}
          alt="Calibrated nDSM Heightfield"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
        />

        {/* Layer 2 (Top, Clipped): TrueColor Satellite Ortho */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none select-none"
          style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
        >
          <img
            src={sceneData.image_url}
            alt="TrueColor Satellite Ortho"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
          />
        </div>

        {/* Interactive SVG Overlay on Top of Both Layers */}
        {renderSvgOverlay()}

        {/* Draggable Vertical Divider Line */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl z-20 cursor-ew-resize flex items-center justify-center pointer-events-auto"
          style={{ left: `${sliderPos}%` }}
          onMouseDown={(e) => {
            e.stopPropagation()
            setIsDraggingSlider(true)
          }}
        >
          <div className="w-8 h-8 rounded-full bg-white text-[#286653] shadow-xl flex items-center justify-center text-xs font-bold border border-[#DCE2DC] hover:scale-115 transition-transform cursor-ew-resize">
            <Sliders className="w-4 h-4 text-[#286653]" />
          </div>
        </div>

        {/* Floating Indicator Badges */}
        <div className="absolute top-3.5 left-3.5 px-3 py-1 rounded bg-[#17231F]/90 text-white text-[11px] font-mono shadow-md backdrop-blur-xs pointer-events-none z-10 flex items-center gap-1.5 border border-white/20">
          <span className="w-2 h-2 rounded-full bg-[#35f599]" />
          <span>TrueColor Ortho ({sliderPos}%)</span>
        </div>
        <div className="absolute top-3.5 right-3.5 px-3 py-1 rounded bg-[#286653]/95 text-white text-[11px] font-mono shadow-md backdrop-blur-xs pointer-events-none z-10 flex items-center gap-1.5 border border-white/20">
          <span>Calibrated nDSM ({100 - sliderPos}%)</span>
          <span className="w-2 h-2 rounded-full bg-[#fbbe23]" />
        </div>
      </div>
    )
  }

  // 2. RENDER SINGLE OR SPLIT PANE
  const renderInteractiveRasterPane = (
    imageUrl: string,
    label: string,
    badgeBg: string
  ) => {
    return (
      <div className="flex flex-col items-center border border-[#DCE2DC] rounded bg-[#FFFFFF] p-2 relative h-full w-full">
        {/* Layer Badge */}
        <span className={`absolute top-3 left-3 ${badgeBg} text-white text-[10px] font-mono px-2 py-0.5 rounded backdrop-blur-sm z-10 pointer-events-none shadow-sm`}>
          {label}
        </span>

        {/* Raster Image + SVG Container */}
        <div
          className="relative w-full h-[540px] overflow-hidden rounded border border-[#DCE2DC] shadow-inner cursor-crosshair select-none bg-slate-950 flex items-center justify-center"
          onMouseMove={handleRasterMouseMove}
          onMouseLeave={handleRasterMouseLeave}
          onClick={handleRasterClick}
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease-out'
          }}
        >
          <img
            src={imageUrl}
            alt={label}
            className="w-full h-full object-contain block pointer-events-none select-none"
          />
          {renderSvgOverlay()}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-[#F5F6F3] flex flex-col overflow-y-auto p-6 text-[#17231F] select-none">
      <div className="max-w-6xl mx-auto w-full space-y-4">
        {/* Title Bar */}
        <div className="flex items-center justify-between border-b border-[#DCE2DC] pb-4 flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-[#17231F] tracking-tight">
                Single-Image Height Estimation (SIHE)
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#E8EFEA] text-[#286653] font-semibold border border-[#DCE2DC]">
                {calibration.height_unit === 'meters_agl' ? 'CALIBRATED: m AGL' : 'RELATIVE / UNITLESS'}
              </span>
            </div>
            <p className="text-xs text-[#68736D] mt-0.5">
              Dense Normalized Digital Surface Model (nDSM) with point-and-click metric height interrogation and decluttered architectural footprints.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {ndsm_raster_url && (
              <a
                href={ndsm_raster_url}
                download
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded bg-[#FFFFFF] hover:bg-[#F5F6F3] border border-[#DCE2DC] text-[#286653] text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5 stroke-[2]" />
                <span>Export nDSM GeoTIFF</span>
              </a>
            )}
            <button
              onClick={() => {
                setViewMode('sihe')
                setActiveScreen('3d-reconstruction')
              }}
              className="px-3.5 py-1.5 rounded bg-[#286653] hover:bg-[#204F42] text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Box className="w-3.5 h-3.5 stroke-[2]" />
              <span>Inspect in 3D Scene</span>
            </button>
          </div>
        </div>

        {/* Main Raster Visualization Container */}
        <div className="bg-[#FFFFFF] border border-[#DCE2DC] rounded-xl p-4 shadow-sm space-y-3 relative">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-[#17231F] uppercase tracking-wide">
                Imagery & Surface Model Comparison
              </span>
              <span className="text-[10px] text-[#286653] font-medium bg-[#E8EFEA] px-2 py-0.5 rounded border border-[#DCE2DC]">
                💡 Click any building or spot to inspect height
              </span>
            </div>

            {/* Controls Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Footprints toggle */}
              <button
                onClick={() => setShowFootprints(!showFootprints)}
                className={`px-2.5 py-1 rounded border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showFootprints
                    ? 'bg-[#E8EFEA] border-[#286653] text-[#286653] font-semibold'
                    : 'bg-white border-[#DCE2DC] text-[#68736D]'
                }`}
                title="Toggle building footprint polygon outlines"
              >
                {showFootprints ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>Footprints</span>
              </button>

              {/* Height tags toggle */}
              <button
                onClick={() => setShowHeightLabels(!showHeightLabels)}
                className={`px-2.5 py-1 rounded border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showHeightLabels
                    ? 'bg-[#E8EFEA] border-[#286653] text-[#286653] font-semibold'
                    : 'bg-white border-[#DCE2DC] text-[#68736D]'
                }`}
                title={
                  numBuildings > 60
                    ? 'Showing Top 35 Tallest tags (Hover any building for height)'
                    : 'Toggle rooftop height labels'
                }
              >
                <Tag className="w-3 h-3" />
                <span>
                  {showHeightLabels && numBuildings > 60 ? 'Top Tags (35)' : 'Heights'}
                </span>
              </button>

              {/* Zoom controls */}
              <div className="flex items-center bg-[#F5F6F3] p-0.5 rounded border border-[#DCE2DC] text-xs">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.8, Math.round((z - 0.2) * 10) / 10))}
                  className="p-1 rounded text-[#68736D] hover:text-[#17231F] hover:bg-white transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 font-mono text-[10px] text-[#68736D]">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3.0, Math.round((z + 0.2) * 10) / 10))}
                  className="p-1 rounded text-[#68736D] hover:text-[#17231F] hover:bg-white transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                {zoomLevel !== 1.0 && (
                  <button
                    onClick={() => setZoomLevel(1.0)}
                    className="p-1 rounded text-[#286653] hover:bg-white transition-colors ml-0.5"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* View mode buttons */}
              <div className="flex items-center bg-[#F5F6F3] p-0.5 rounded border border-[#DCE2DC] text-xs">
                <button
                  onClick={() => setCompareMode('swipe')}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                    compareMode === 'swipe'
                      ? 'bg-[#FFFFFF] text-[#286653] font-semibold shadow-xs'
                      : 'text-[#68736D] hover:text-[#17231F]'
                  }`}
                  title="Drag vertical slider to compare satellite vs heightfield"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Swipe Slider</span>
                </button>
                <button
                  onClick={() => setCompareMode('split')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    compareMode === 'split'
                      ? 'bg-[#FFFFFF] text-[#286653] font-semibold shadow-xs'
                      : 'text-[#68736D] hover:text-[#17231F]'
                  }`}
                >
                  Side-by-Side Dual View
                </button>
                <button
                  onClick={() => setCompareMode('heightmap')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    compareMode === 'heightmap'
                      ? 'bg-[#FFFFFF] text-[#286653] font-semibold shadow-xs'
                      : 'text-[#68736D] hover:text-[#17231F]'
                  }`}
                >
                  nDSM False-Color
                </button>
                <button
                  onClick={() => setCompareMode('ortho')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    compareMode === 'ortho'
                      ? 'bg-[#FFFFFF] text-[#286653] font-semibold shadow-xs'
                      : 'text-[#68736D] hover:text-[#17231F]'
                  }`}
                >
                  TrueColor Ortho
                </button>
              </div>
            </div>
          </div>

          {/* Raster Visual Frame */}
          <div className="bg-[#F5F6F3] border border-[#DCE2DC] rounded-lg p-2 flex items-center justify-center min-h-[500px] overflow-hidden relative shadow-inner">
            {compareMode === 'swipe' ? (
              renderSwipeView()
            ) : compareMode === 'split' ? (
              <div className="grid grid-cols-2 gap-2 w-full h-[580px]">
                {renderInteractiveRasterPane(
                  sceneData.image_url,
                  'TrueColor Satellite Ortho',
                  'bg-[#17231F]/80'
                )}
                {renderInteractiveRasterPane(
                  visualization_url,
                  'Calibrated nDSM Heightfield (Turbo Ramp)',
                  'bg-[#286653]/90'
                )}
              </div>
            ) : compareMode === 'heightmap' ? (
              <div className="w-full h-[580px] flex justify-center">
                {renderInteractiveRasterPane(
                  visualization_url,
                  'Calibrated nDSM Heightfield (Turbo Ramp)',
                  'bg-[#286653]/90'
                )}
              </div>
            ) : (
              <div className="w-full h-[580px] flex justify-center">
                {renderInteractiveRasterPane(
                  sceneData.image_url,
                  'TrueColor Satellite Ortho',
                  'bg-[#17231F]/80'
                )}
              </div>
            )}

            {/* DOCKED FLOATING SIHE METRIC INSPECTION CARD */}
            {activePin && (
              <div className="absolute top-4 right-4 z-30 max-w-xs w-80 bg-white/95 backdrop-blur-md rounded-xl border-2 border-[#286653] shadow-2xl p-3.5 text-[#17231F] space-y-2.5 pointer-events-auto animate-in fade-in zoom-in-95">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#DCE2DC]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#E8EFEA] border border-[#286653] flex items-center justify-center text-[#286653]">
                      {activePin.surface_type === 'building' ? (
                        <Building2 className="w-4 h-4 stroke-[2]" />
                      ) : activePin.surface_type === 'tree' ? (
                        <Mountain className="w-4 h-4 stroke-[2]" />
                      ) : (
                        <MapPin className="w-4 h-4 stroke-[2]" />
                      )}
                    </div>
                    <div>
                      <div className="font-mono font-bold text-xs flex items-center gap-1.5">
                        <span>{activePin.id}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#286653] text-white font-sans font-semibold">
                          {activePin.surface_type === 'building'
                            ? 'Building'
                            : activePin.surface_type === 'tree'
                            ? 'Tree Canopy'
                            : 'Spot Elevation'}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#68736D] font-mono">
                        Pixel: ({activePin.x}, {activePin.y})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActivePin(null)}
                    className="text-[#68736D] hover:text-[#17231F] p-1 rounded hover:bg-[#F5F6F3] cursor-pointer"
                    title="Close Card"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Metric Height Readout */}
                <div className="bg-[#F5F6F3] p-2.5 rounded-lg border border-[#DCE2DC] flex items-baseline justify-between">
                  <div>
                    <div className="text-[10px] text-[#68736D] uppercase font-semibold tracking-wider">
                      {activePin.surface_type === 'building'
                        ? 'Apex Metric Height'
                        : activePin.surface_type === 'tree'
                        ? 'Canopy Height'
                        : 'Surface Spot Height'}
                    </div>
                    <div className="text-2xl font-mono font-bold text-[#286653]">
                      {activePin.height_m.toFixed(1)} m
                      <span className="text-xs text-[#68736D] font-normal ml-1">AGL</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#68736D] uppercase font-semibold tracking-wider">
                      {activePin.surface_type === 'building' ? 'Stories' : 'Datum'}
                    </div>
                    <div className="text-sm font-mono font-bold text-[#17231F]">
                      {activePin.surface_type === 'building'
                        ? `${activePin.building?.estimated_floors || Math.max(1, Math.round(activePin.height_m / 3.0))} Floors`
                        : 'Planar DEM'}
                    </div>
                  </div>
                </div>

                {/* Building Details Grid */}
                {activePin.surface_type === 'building' && activePin.building && (
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                    <div className="bg-[#F5F6F3] p-1.5 rounded border border-[#DCE2DC]">
                      <span className="text-[#68736D] text-[10px] block">Footprint Area:</span>
                      <span className="font-bold text-[#17231F]">
                        {Math.round(activePin.building.area_m2 || activePin.building.footprint_area_m2)} m²
                      </span>
                    </div>
                    <div className="bg-[#F5F6F3] p-1.5 rounded border border-[#DCE2DC]">
                      <span className="text-[#68736D] text-[10px] block">Confidence:</span>
                      <span className="font-bold text-[#286653]">
                        {Math.round((activePin.building.confidence || 0.9) * 100)}%
                      </span>
                    </div>
                    <div className="bg-[#F5F6F3] p-1.5 rounded border border-[#DCE2DC]">
                      <span className="text-[#68736D] text-[10px] block">Roof Profile:</span>
                      <span className="font-bold text-[#17231F] truncate block" title={activePin.building.roof_shape}>
                        {activePin.building.roof_shape || 'Pitched / Flat'}
                      </span>
                    </div>
                    <div className="bg-[#F5F6F3] p-1.5 rounded border border-[#DCE2DC]">
                      <span className="text-[#68736D] text-[10px] block">Dimensions:</span>
                      <span className="font-bold text-[#17231F]">
                        {(activePin.building.length_m || 12).toFixed(1)}m × {(activePin.building.width_m || 9).toFixed(1)}m
                      </span>
                    </div>
                  </div>
                )}

                {/* Ground Spot: Nearest Building Callout */}
                {activePin.surface_type === 'ground' && activePin.nearest_building && (
                  <div className="bg-[#F5F6F3] p-2 rounded-lg border border-[#DCE2DC] space-y-1 text-xs">
                    <div className="text-[10px] font-semibold text-[#68736D] uppercase">Nearest Structure:</div>
                    <div className="flex justify-between items-center font-mono">
                      <span className="font-bold text-[#286653]">{activePin.nearest_building.id}</span>
                      <span className="font-bold text-[#17231F]">{activePin.nearest_building.height_m.toFixed(1)}m height</span>
                    </div>
                    <div className="text-[10px] text-[#68736D] flex justify-between items-center">
                      <span>Distance: {activePin.nearest_building.distance_m} m</span>
                      <button
                        onClick={() => {
                          const b = sceneData.buildings.find((bld) => bld.id === activePin.nearest_building?.id)
                          if (b) handleSelectBuilding(b)
                        }}
                        className="text-[#286653] font-semibold hover:underline cursor-pointer"
                      >
                        Inspect Building →
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-1 flex gap-2">
                  {activePin.surface_type === 'building' && activePin.building && (
                    <button
                      onClick={() => handleInspectIn3D(activePin.building!)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-[#286653] hover:bg-[#204F42] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      <Box className="w-3.5 h-3.5 stroke-[2]" />
                      <span>Inspect in 3D Scene</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setInspectorOpen(true)
                    }}
                    className="py-1.5 px-3 rounded-lg bg-[#FFFFFF] hover:bg-[#F5F6F3] border border-[#DCE2DC] text-[#286653] text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm cursor-pointer"
                    title="Open Full Inspector"
                  >
                    <span>Inspector</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Real-Time Cursor Hover Telemetry Bar */}
          <div className="h-7 flex items-center justify-between text-[11px] font-mono px-3 bg-[#F5F6F3] border border-[#DCE2DC] rounded text-[#68736D]">
            <div className="flex items-center gap-2 truncate">
              <Crosshair className="w-3.5 h-3.5 text-[#286653] shrink-0" />
              <span className="truncate">
                {hoverInfo
                  ? hoverInfo.text
                  : 'Hover over any structure or terrain to preview height, click to pin & inspect.'}
              </span>
            </div>
            {hoverInfo && (
              <span className="text-[#286653] font-semibold shrink-0 ml-2">
                X: {hoverInfo.x}px · Y: {hoverInfo.y}px
              </span>
            )}
          </div>

          {/* Curated Quick-Access Building Strip with Search and Filters */}
          {sceneData.buildings.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#DCE2DC]">
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#17231F] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#286653]" />
                    <span>Quick Select Building ({sceneData.buildings.length} total)</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#68736D]">
                    Showing top {filteredBuildings.length} matches
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Search Box */}
                  <div className="relative">
                    <Search className="w-3 h-3 text-[#68736D] absolute left-2 top-2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search ID (e.g. 1296)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-7 pl-6 pr-2.5 rounded border border-[#DCE2DC] bg-white text-[11px] font-mono text-[#17231F] focus:outline-hidden focus:border-[#286653] w-36"
                    />
                  </div>

                  {/* Height Filter Chips */}
                  <div className="flex items-center bg-[#F5F6F3] p-0.5 rounded border border-[#DCE2DC] text-[11px]">
                    <button
                      onClick={() => setHeightFilter('all')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        heightFilter === 'all' ? 'bg-white font-semibold text-[#286653] shadow-2xs' : 'text-[#68736D]'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setHeightFilter('tall')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        heightFilter === 'tall' ? 'bg-white font-semibold text-[#286653] shadow-2xs' : 'text-[#68736D]'
                      }`}
                    >
                      &ge;10m
                    </button>
                    <button
                      onClick={() => setHeightFilter('medium')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        heightFilter === 'medium' ? 'bg-white font-semibold text-[#286653] shadow-2xs' : 'text-[#68736D]'
                      }`}
                    >
                      5-10m
                    </button>
                    <button
                      onClick={() => setHeightFilter('small')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        heightFilter === 'small' ? 'bg-white font-semibold text-[#286653] shadow-2xs' : 'text-[#68736D]'
                      }`}
                    >
                      &lt;5m
                    </button>
                  </div>
                </div>
              </div>

              {/* Buildings Chips Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {filteredBuildings.map((b, idx) => {
                  const h = (b.height_m ?? b.estimated_height_m).toFixed(1)
                  const isSelected = activePin?.id === b.id || selectedFeature?.id === b.id
                  return (
                    <button
                      key={b.id}
                      onClick={() => handleSelectBuilding(b)}
                      className={`shrink-0 px-2.5 py-1 rounded border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                        isSelected
                          ? 'bg-[#286653] text-white border-[#286653] shadow-md ring-2 ring-[#286653]/30'
                          : 'bg-[#FFFFFF] hover:bg-[#E8EFEA] border-[#DCE2DC] text-[#17231F]'
                      }`}
                    >
                      <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[#68736D]'}`}>
                        #{idx + 1}
                      </span>
                      <span className="font-bold">{b.id}</span>
                      <span className={`font-bold ${isSelected ? 'text-[#35f599]' : 'text-[#286653]'}`}>
                        {h}m
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Perceptual Scientific Color Scale Legend */}
          <div className="pt-2 border-t border-[#DCE2DC]">
            <div className="flex justify-between items-center text-xs font-mono text-[#17231F] mb-1">
              <span>0.0 m (Bare Ground DEM)</span>
              <span className="text-[#68736D] text-[11px]">Normalized Digital Surface Model (nDSM = DSM - DEM)</span>
              <span className="text-[#286653] font-bold">{maxH.toFixed(1)} m (Peak Apex)</span>
            </div>
            <div
              className="h-4 w-full rounded border border-[#DCE2DC] shadow-inner relative"
              style={{
                background:
                  'linear-gradient(to right, #30123b 0%, #4662d8 15%, #28bbec 35%, #35f599 55%, #a2fc3c 70%, #fbbe23 85%, #eb4a00 95%, #7a0403 100%)',
              }}
            />
            <div className="flex justify-between text-[10px] text-[#68736D] font-mono mt-1">
              <span>0m</span>
              <span>{(maxH * 0.25).toFixed(1)}m</span>
              <span>{(maxH * 0.5).toFixed(1)}m</span>
              <span>{(maxH * 0.75).toFixed(1)}m</span>
              <span>{maxH.toFixed(1)}m</span>
            </div>
          </div>
        </div>

        {/* Technical Telemetry Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Calibration Anchor */}
          <div className="bg-[#FFFFFF] border border-[#DCE2DC] rounded-xl p-4 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#DCE2DC] pb-2 font-semibold text-xs text-[#17231F] uppercase tracking-wide">
              <CheckCircle2 className="w-4 h-4 text-[#286653]" />
              <span>Physics Calibration</span>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[#68736D]">Vertical Unit:</span>
                <span className="font-semibold text-[#17231F]">meters AGL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#68736D]">Scale Factor (s):</span>
                <span className="font-semibold text-[#286653]">{calibration.scale_factor_m.toFixed(3)} m/unit</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#68736D]">Shadow Anchor:</span>
                <span className="text-[#17231F]">{calibration.shadow_anchor_used_m || '27.2'} m</span>
              </div>
              <div className="pt-1 text-[10px] font-sans text-[#68736D] leading-relaxed border-t border-[#DCE2DC]">
                Method: <strong className="text-[#17231F]">{calibration.calibration_method}</strong>
              </div>
            </div>
          </div>

          {/* 2. Uncertainty Quantification (95% CI) */}
          <div className="bg-[#FFFFFF] border border-[#DCE2DC] rounded-xl p-4 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#DCE2DC] pb-2 font-semibold text-xs text-[#17231F] uppercase tracking-wide">
              <Info className="w-4 h-4 text-[#426B8A]" />
              <span>Uncertainty (95% CI)</span>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[#68736D]">Mean Uncertainty:</span>
                <span className="font-semibold text-[#426B8A]">± {uncertainty_metrics.mean_uncertainty_m.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#68736D]">Median Uncertainty:</span>
                <span className="text-[#17231F]">± {uncertainty_metrics.median_uncertainty_m.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#68736D]">Confidence Score:</span>
                <span className="font-semibold text-[#286653]">
                  {Math.round(uncertainty_metrics.mean_confidence_score * 100)}%
                </span>
              </div>
              <div className="pt-1 text-[10px] font-sans text-[#68736D] leading-relaxed border-t border-[#DCE2DC]">
                Grounds uncertainty in local image gradient variance, building edges, and shadow contrast.
              </div>
            </div>
          </div>

          {/* 3. Surface Statistics */}
          <div className="bg-[#FFFFFF] border border-[#DCE2DC] rounded-xl p-4 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#DCE2DC] pb-2 font-semibold text-xs text-[#17231F] uppercase tracking-wide">
              <Mountain className="w-4 h-4 text-[#B7791F]" />
              <span>Height Aggregation</span>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[#68736D]">Peak Surface Elevation:</span>
                <span className="font-semibold text-[#17231F]">{calibration.max_object_height_m} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#68736D]">Mean AGL Height:</span>
                <span className="text-[#17231F]">{calibration.mean_above_ground_height_m} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#68736D]">Buildings Assessed:</span>
                <span className="text-[#286653] font-semibold">{sceneData.buildings.length} instances</span>
              </div>
              <div className="pt-1 text-[10px] font-sans text-[#68736D] leading-relaxed border-t border-[#DCE2DC]">
                Extracted via progressive morphological bare-earth filtering ($DEM$) and footprint interior sampling.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
