import React, { useEffect, useMemo, useState, useRef } from 'react'
import * as THREE from 'three'
import { Html, Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useStore } from '../../store/useStore'

const AnimatedFloodWaterSurface: React.FC<{
  wPx: number
  hPx: number
  gsd: number
  verticalExaggeration: number
}> = ({ wPx, hPx, gsd, verticalExaggeration }) => {
  const floodWaterLevelM = useStore((state) => state.floodWaterLevelM)
  const isFloodAnimating = useStore((state) => state.isFloodAnimating)
  const floodAnimSpeed = useStore((state) => state.floodAnimSpeed)

  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const animPhase = useRef<number>(0)
  const [displayLevel, setDisplayLevel] = useState<number>(floodWaterLevelM)

  useEffect(() => {
    if (!isFloodAnimating) {
      setDisplayLevel(floodWaterLevelM)
    }
  }, [floodWaterLevelM, isFloodAnimating])

  useFrame((state, delta) => {
    if (isFloodAnimating) {
      animPhase.current += delta * floodAnimSpeed * 0.95
      const peakSurge = Math.max(floodWaterLevelM, 2.0)
      const animatedH = 0.2 + (Math.sin(animPhase.current - Math.PI / 2) * 0.5 + 0.5) * peakSurge
      setDisplayLevel(animatedH)
      if (groupRef.current) {
        groupRef.current.position.y = animatedH * verticalExaggeration
      }
    } else {
      if (groupRef.current) {
        groupRef.current.position.y = floodWaterLevelM * verticalExaggeration
      }
    }

    if (meshRef.current) {
      const t = state.clock.getElapsedTime()
      meshRef.current.position.z = Math.sin(t * 2.5) * 0.05
      meshRef.current.rotation.z = Math.sin(t * 1.2) * 0.003
    }
  })

  if (displayLevel < 0.02) return null

  return (
    <group
      ref={groupRef}
      position={[0, displayLevel * verticalExaggeration, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      {/* 3D Dynamic Ocean / Flood Water Surface */}
      <mesh ref={meshRef} renderOrder={6}>
        <planeGeometry args={[wPx * gsd * 1.08, hPx * gsd * 1.08, 48, 48]} />
        <meshStandardMaterial
          color="#0284c7"
          emissive="#0369a1"
          emissiveIntensity={0.22}
          transparent
          opacity={0.72}
          roughness={0.08}
          metalness={0.4}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Foam Shoreline / Secondary Caustic Layer */}
      <mesh position={[0, 0, -0.02]} renderOrder={5}>
        <planeGeometry args={[wPx * gsd * 1.09, hPx * gsd * 1.09, 16, 16]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.32}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floating 3D Watermark Billboard */}
      <Html distanceFactor={180} position={[0, -hPx * gsd * 0.38, 1.8]} center>
        <div className="px-3 py-1.5 rounded-lg bg-sky-950/95 border-2 border-sky-400 text-sky-200 text-xs font-mono font-bold whitespace-nowrap shadow-2xl flex items-center gap-2 backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          <span>🌊 FLOOD SURGE WATERLINE: +{displayLevel.toFixed(2)}m</span>
          {isFloodAnimating && (
            <span className="text-[9px] bg-sky-800 text-white px-1.5 py-0.5 rounded font-sans uppercase">
              ANIMATING SURGE
            </span>
          )}
        </div>
      </Html>
    </group>
  )
}

const AnimatedEarthquakeShockwaves: React.FC<{
  epicenter3d: [number, number, number]
  maxRadius: number
  isAnimating: boolean
  animSpeed: number
  richterScale: number
}> = ({ epicenter3d, maxRadius, isAnimating, animSpeed, richterScale }) => {
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const ring3Ref = useRef<THREE.Mesh>(null)
  const pulseBeaconRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const phase = useRef<number>(0)

  useFrame((state, delta) => {
    if (!isAnimating) return
    phase.current += delta * animSpeed * 0.85

    // Physical high-frequency oscillatory tremor jitter
    const tremorAmp = Math.min(1.2, 0.05 * Math.pow(10, (richterScale - 4.5) * 0.35))
    if (groupRef.current) {
      const t = state.clock.getElapsedTime() * (14 + richterScale * 2.2)
      groupRef.current.position.y = epicenter3d[1] + Math.sin(t) * tremorAmp * 0.3
      groupRef.current.position.x = epicenter3d[0] + Math.cos(t * 1.3) * tremorAmp * 0.2
      groupRef.current.position.z = epicenter3d[2] + Math.sin(t * 0.8) * tremorAmp * 0.2
    }

    // P-wave (fast primary compression wave ring)
    const pRadius = Math.max(1.0, ((phase.current * 1.8) % 1.0) * maxRadius)
    if (ring1Ref.current) {
      ring1Ref.current.scale.set(pRadius, pRadius, 1)
      const mat = ring1Ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 0.9 * (1.0 - pRadius / maxRadius))
    }

    // S-wave (slower, violent secondary shear wave ring)
    const sRadius = Math.max(1.0, ((phase.current * 1.1) % 1.0) * maxRadius)
    if (ring2Ref.current) {
      ring2Ref.current.scale.set(sRadius, sRadius, 1)
      const mat = ring2Ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 0.95 * (1.0 - sRadius / maxRadius))
    }

    // Rayleigh wave (ground ripple wave)
    const rRadius = Math.max(1.0, ((phase.current * 0.65) % 1.0) * maxRadius)
    if (ring3Ref.current) {
      ring3Ref.current.scale.set(rRadius, rRadius, 1)
      const mat = ring3Ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 0.75 * (1.0 - rRadius / maxRadius))
    }

    if (pulseBeaconRef.current) {
      const pScale = 1.0 + Math.sin(state.clock.getElapsedTime() * 6) * 0.25
      pulseBeaconRef.current.scale.set(pScale, pScale, pScale)
    }
  })

  return (
    <group ref={groupRef} position={epicenter3d}>
      {/* P-wave concentric ring (Fast compressional wavefront) */}
      <mesh ref={ring1Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[0.96, 1.0, 64]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* S-wave concentric ring (Violent shear wavefront) */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, 0]}>
        <ringGeometry args={[0.92, 1.0, 64]} />
        <meshBasicMaterial color="#f43f5e" transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Surface Rayleigh wave (Elliptical ground roll) */}
      <mesh ref={ring3Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[0.94, 1.0, 64]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Epicenter Core Beacon Mast */}
      <mesh position={[0, 4.5, 0]}>
        <cylinderGeometry args={[0.35, 1.3, 9, 16]} />
        <meshStandardMaterial color="#f43f5e" emissive="#e11d48" emissiveIntensity={1.2} />
      </mesh>
      <mesh ref={pulseBeaconRef} position={[0, 10, 0]}>
        <octahedronGeometry args={[2.2, 0]} />
        <meshStandardMaterial color="#fb7185" emissive="#f43f5e" emissiveIntensity={1.5} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 2.8, 32]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* 3D Floating Epicenter Label */}
      <Html distanceFactor={180} position={[0, 14, 0]} center>
        <div className="px-3 py-1.5 rounded-lg bg-rose-950/95 border-2 border-rose-400 text-rose-200 text-xs font-mono font-bold whitespace-nowrap shadow-2xl flex items-center gap-2 backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
          <span>🌋 EPICENTER: Richter M {richterScale.toFixed(1)}</span>
          {isAnimating && (
            <span className="text-[9px] bg-rose-800 text-white px-1.5 py-0.5 rounded font-sans uppercase">
              ANIMATING TREMOR
            </span>
          )}
        </div>
      </Html>
    </group>
  )
}

export const GeoTwinOverlays3D: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const verticalExaggeration = useStore((state) => state.verticalExaggeration)
  const geotwinOverlayMode = useStore((state) => state.geotwinOverlayMode)
  const hazardReport = useStore((state) => state.hazardReport)
  const routeReport = useStore((state) => state.routeReport)
  const wirelessReport = useStore((state) => state.wirelessReport)
  const disasterReport = useStore((state) => state.disasterReport)
  const routePointA = useStore((state) => state.routePointA)
  const routePointB = useStore((state) => state.routePointB)
  const selectedRegionHeight = useStore((state) => state.selectedRegionHeight)
  const floodWaterLevelM = useStore((state) => state.floodWaterLevelM)
  const setFloodWaterLevelM = useStore((state) => state.setFloodWaterLevelM)
  const richterScale = useStore((state) => state.richterScale)
  const isEarthquakeAnimating = useStore((state) => state.isEarthquakeAnimating)
  const earthquakeAnimSpeed = useStore((state) => state.earthquakeAnimSpeed)
  const epicenterPoint = useStore((state) => state.epicenterPoint)
  const selectedSeismicRegion = useStore((state) => state.selectedSeismicRegion)

  const [drapedTexture, setDrapedTexture] = useState<THREE.Texture | null>(null)

  const activeHeatmapB64 = useMemo(() => {
    if (geotwinOverlayMode === 'flood_susceptibility') {
      return hazardReport?.flood_hazard?.heatmap_png_b64 || null
    }
    if (geotwinOverlayMode === 'landslide_susceptibility') {
      return hazardReport?.landslide_hazard?.heatmap_png_b64 || null
    }
    if (geotwinOverlayMode === 'earthquake_intensity') {
      return hazardReport?.earthquake_hazard?.heatmap_png_b64 || null
    }
    if (geotwinOverlayMode === 'wireless_coverage') {
      return wirelessReport?.coverage_heatmap_b64 || null
    }
    return null
  }, [geotwinOverlayMode, hazardReport, wirelessReport])

  useEffect(() => {
    if (!activeHeatmapB64) {
      setDrapedTexture(null)
      return
    }
    const loader = new THREE.TextureLoader()
    loader.load(activeHeatmapB64, (tex) => {
      tex.wrapS = THREE.ClampToEdgeWrapping
      tex.wrapT = THREE.ClampToEdgeWrapping
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      setDrapedTexture(tex)
    })
  }, [activeHeatmapB64])

  const overlayGeometry = useMemo(() => {
    if (!sceneData) return null
    const { terrain_mesh_data, gsd_m, dimensions } = sceneData
    const { grid_width, grid_height, elevations } = terrain_mesh_data
    const worldWidth = dimensions.width * gsd_m
    const worldHeight = dimensions.height * gsd_m

    const geom = new THREE.PlaneGeometry(
      worldWidth,
      worldHeight,
      grid_width - 1,
      grid_height - 1
    )
    const pos = geom.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const elev = elevations[i] !== undefined && !isNaN(elevations[i]) ? elevations[i] : 0
      pos.setZ(i, elev * verticalExaggeration + 0.05)
    }
    geom.computeVertexNormals()
    return geom
  }, [sceneData, verticalExaggeration])

  // Build 3D tube geometry for Recommended Lower-Risk Route
  const recommendedTubeGeom = useMemo(() => {
    const pts = routeReport?.recommended_route?.waypoints_3d
    if (!pts || pts.length < 2) return null
    const vectors = pts.map(
      (p) => new THREE.Vector3(p[0], p[1] * verticalExaggeration + 1.5, p[2])
    )
    const curve = new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', 0.08)
    return new THREE.TubeGeometry(curve, Math.max(32, vectors.length * 4), 1.5, 12, false)
  }, [routeReport, verticalExaggeration])

  // Build 3D points for Shortest Route comparison line
  const shortestRoutePoints = useMemo(() => {
    const pts = routeReport?.shortest_route?.waypoints_3d
    if (!pts || pts.length < 2) return null
    return pts.map(
      (p) => [p[0], p[1] * verticalExaggeration + 0.9, p[2]] as [number, number, number]
    )
  }, [routeReport, verticalExaggeration])

  const getElevationAtPx = (px: number, py: number) => {
    if (!sceneData?.terrain_mesh_data) return 0
    const { grid_width, grid_height, elevations } = sceneData.terrain_mesh_data
    const gx = Math.min(grid_width - 1, Math.max(0, Math.floor((px / sceneData.dimensions.width) * grid_width)))
    const gy = Math.min(grid_height - 1, Math.max(0, Math.floor((py / sceneData.dimensions.height) * grid_height)))
    const idx = gy * grid_width + gx
    return elevations[idx] !== undefined && !isNaN(elevations[idx]) ? elevations[idx] : 0
  }

  const pointA_3d = useMemo(() => {
    if (!sceneData) return null
    const pt = routePointA || routeReport?.origin?.pixel_xy
    if (!pt) return null
    const elev = getElevationAtPx(pt[0], pt[1])
    const xw = (pt[0] - sceneData.dimensions.width / 2) * sceneData.gsd_m
    const zw = (pt[1] - sceneData.dimensions.height / 2) * sceneData.gsd_m
    const yw = elev * verticalExaggeration + 1.2
    return [xw, yw, zw] as [number, number, number]
  }, [routePointA, routeReport?.origin, sceneData, verticalExaggeration])

  const pointB_3d = useMemo(() => {
    if (!sceneData) return null
    const pt = routePointB || routeReport?.destination?.pixel_xy
    if (!pt) return null
    const elev = getElevationAtPx(pt[0], pt[1])
    const xw = (pt[0] - sceneData.dimensions.width / 2) * sceneData.gsd_m
    const zw = (pt[1] - sceneData.dimensions.height / 2) * sceneData.gsd_m
    const yw = elev * verticalExaggeration + 1.2
    return [xw, yw, zw] as [number, number, number]
  }, [routePointB, routeReport?.destination, sceneData, verticalExaggeration])

  const safestPointObj = hazardReport?.safest_point || routeReport?.safest_point
  const safestPoint_3d = useMemo(() => {
    if (!safestPointObj) return null
    if (safestPointObj.world_3d) {
      return [
        safestPointObj.world_3d[0],
        safestPointObj.world_3d[1] * verticalExaggeration,
        safestPointObj.world_3d[2],
      ] as [number, number, number]
    }
    if (safestPointObj.pixel_xy && sceneData) {
      const pt = safestPointObj.pixel_xy
      const elev = getElevationAtPx(pt[0], pt[1])
      const xw = (pt[0] - sceneData.dimensions.width / 2) * sceneData.gsd_m
      const zw = (pt[1] - sceneData.dimensions.height / 2) * sceneData.gsd_m
      const yw = elev * verticalExaggeration + 1.2
      return [xw, yw, zw] as [number, number, number]
    }
    return null
  }, [safestPointObj, sceneData, verticalExaggeration])

  const epicenter_3d = useMemo(() => {
    if (!sceneData) return null
    const pt = epicenterPoint || hazardReport?.earthquake_hazard?.epicenter_px || [
      Math.floor(sceneData.dimensions.width * 0.45),
      Math.floor(sceneData.dimensions.height * 0.45),
    ]
    const elev = getElevationAtPx(pt[0], pt[1])
    const xw = (pt[0] - sceneData.dimensions.width / 2) * sceneData.gsd_m
    const zw = (pt[1] - sceneData.dimensions.height / 2) * sceneData.gsd_m
    const yw = elev * verticalExaggeration + 0.4
    return [xw, yw, zw] as [number, number, number]
  }, [epicenterPoint, hazardReport?.earthquake_hazard?.epicenter_px, sceneData, verticalExaggeration])

  const waterRiseM = useMemo(() => {
    return hazardReport?.flood_hazard?.water_rise_m ?? hazardReport?.water_rise_m ?? 0
  }, [hazardReport])

  if (!sceneData) return null

  const wPx = sceneData.dimensions.width
  const hPx = sceneData.dimensions.height
  const gsd = sceneData.gsd_m

  return (
    <group>
      {/* 1. Draped 3D Terrain Heatmap Overlay (Flood / Landslide / 5G-6G RSRP Coverage) */}
      {drapedTexture && overlayGeometry && (
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <mesh geometry={overlayGeometry} renderOrder={5}>
            <meshBasicMaterial
              map={drapedTexture}
              transparent
              opacity={
                geotwinOverlayMode === 'landslide_susceptibility'
                  ? 0.88
                  : geotwinOverlayMode === 'earthquake_intensity'
                  ? 0.84
                  : 0.72
              }
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/* 1b. Physical 3D Animated Rising Flood Water Surface */}
      {geotwinOverlayMode === 'flood_susceptibility' && (
        <AnimatedFloodWaterSurface
          wPx={wPx}
          hPx={hPx}
          gsd={gsd}
          verticalExaggeration={verticalExaggeration}
        />
      )}

      {/* 1c. Sampled Region Height & Inundation Gauge Pin */}
      {selectedRegionHeight && (
        <group position={[
          selectedRegionHeight.world_3d[0],
          selectedRegionHeight.world_3d[1] * verticalExaggeration,
          selectedRegionHeight.world_3d[2]
        ]}>
          <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.4, 2.0, 32]} />
            <meshBasicMaterial
              color={selectedRegionHeight.is_submerged ? "#f43f5e" : "#0284c7"}
              transparent
              opacity={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 2.5, 0]}>
            <cylinderGeometry args={[0.2, 0.35, 5, 16]} />
            <meshStandardMaterial
              color={selectedRegionHeight.is_submerged ? "#f43f5e" : "#38bdf8"}
              emissive={selectedRegionHeight.is_submerged ? "#e11d48" : "#0284c7"}
              emissiveIntensity={0.9}
            />
          </mesh>
          <mesh position={[0, 5.5, 0]}>
            <sphereGeometry args={[1.1, 16, 16]} />
            <meshStandardMaterial
              color={selectedRegionHeight.is_submerged ? "#f43f5e" : "#0284c7"}
              emissive={selectedRegionHeight.is_submerged ? "#f43f5e" : "#38bdf8"}
              emissiveIntensity={1.2}
            />
          </mesh>
          <Html distanceFactor={170} position={[0, 7.5, 0]} center>
            <div className={`p-2.5 rounded-lg font-mono text-[10px] whitespace-nowrap shadow-2xl border-2 backdrop-blur-md ${
              selectedRegionHeight.is_submerged
                ? 'bg-rose-950/95 border-rose-400 text-rose-200'
                : 'bg-sky-950/95 border-sky-400 text-sky-200'
            }`}>
              <div className="flex items-center gap-1.5 font-bold text-[11px]">
                <span>{selectedRegionHeight.is_submerged ? '🌊' : '📍'}</span>
                <span>{selectedRegionHeight.building_name}</span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] ${
                  selectedRegionHeight.is_submerged ? 'bg-rose-800 text-white' : 'bg-sky-800 text-white'
                }`}>
                  {selectedRegionHeight.is_submerged ? 'SUBMERGED' : 'DRY GROUND'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 mt-1 text-[10px]">
                <div>Surface Elev: <span className="font-bold">+{selectedRegionHeight.elevation_m}m</span></div>
                <div>Flood Line: <span className="font-bold">+{floodWaterLevelM}m</span></div>
                <div>Terrain Base: <span>+{selectedRegionHeight.terrain_elev_m}m</span></div>
                <div>Status: <span className="font-bold">
                  {selectedRegionHeight.is_submerged
                    ? `-${selectedRegionHeight.inundation_depth_m}m Under Water`
                    : `+${(selectedRegionHeight.elevation_m - floodWaterLevelM).toFixed(1)}m Above Water`
                  }
                </span></div>
              </div>
              <div className="mt-1.5 pt-1 border-t border-sky-800/60 flex items-center justify-between gap-2">
                <button
                  onClick={() => setFloodWaterLevelM(selectedRegionHeight.elevation_m)}
                  className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-[9px] font-bold cursor-pointer"
                >
                  ⚡ Set Flood Line to +{selectedRegionHeight.elevation_m}m
                </button>
              </div>
            </div>
          </Html>
        </group>
      )}

      {/* 2. Module E: AI Safe Route 3D Visualization */}
      {(geotwinOverlayMode === 'safe_routes' || routeReport) && routeReport && (
        <group>
          {/* High-Risk Blocked Road Warnings (Clean 3D markers instead of cluttered wireframe lattice) */}
          {geotwinOverlayMode === 'safe_routes' &&
            routeReport.road_network_summary?.segments_3d
              ?.filter((seg) => seg.hazard_exposure_score >= 0.75)
              ?.slice(0, 8)
              ?.map((seg) => {
                const p1 = seg.path_3d[0]
                if (!p1) return null
                return (
                  <group key={seg.edge_id} position={[p1[0], p1[1] * verticalExaggeration + 1.2, p1[2]]}>
                    <Html distanceFactor={160} center>
                      <div className="px-2 py-0.5 rounded bg-rose-950/95 border-2 border-rose-500 text-[9px] font-mono font-bold text-rose-200 whitespace-nowrap shadow-xl">
                        ⛔ BLOCKED: {seg.avoidance_reasons?.[0] ?? 'Inundated / Rubble'}
                      </div>
                    </Html>
                  </group>
                )
              })}

          {/* Shortest Baseline Route (Amber/Red Dashed Comparison Line) */}
          {shortestRoutePoints && (
            <Line
              points={shortestRoutePoints}
              color="#fb7185"
              lineWidth={3.5}
              dashed
              dashSize={3}
              gapSize={2}
            />
          )}

          {/* Recommended Lower-Predicted-Risk Route (Glowing Emerald 3D Tube) */}
          {recommendedTubeGeom && (
            <mesh geometry={recommendedTubeGeom} renderOrder={12}>
              <meshStandardMaterial
                color="#10b981"
                emissive="#059669"
                emissiveIntensity={0.85}
                roughness={0.25}
                metalness={0.1}
              />
            </mesh>
          )}

          {/* Point A 3D Marker */}
          {pointA_3d && (
            <group position={pointA_3d}>
              <mesh position={[0, 5, 0]}>
                <cylinderGeometry args={[0.3, 1.2, 10, 16]} />
                <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={1.0} />
              </mesh>
              <mesh position={[0, 11, 0]}>
                <sphereGeometry args={[1.5, 16, 16]} />
                <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.8} />
              </mesh>
              <Html distanceFactor={180} position={[0, 14, 0]} center>
                <div className="px-2.5 py-1 rounded bg-sky-950/95 border-2 border-sky-400 text-[10px] font-mono font-bold text-sky-200 whitespace-nowrap shadow-xl">
                  📍 POINT A (START): ({routePointA?.[0] ?? routeReport.origin?.pixel_xy?.[0]}, {routePointA?.[1] ?? routeReport.origin?.pixel_xy?.[1]})
                </div>
              </Html>
            </group>
          )}

          {/* Point B 3D Marker */}
          {pointB_3d && (
            <group position={pointB_3d}>
              <mesh position={[0, 5, 0]}>
                <cylinderGeometry args={[0.3, 1.2, 10, 16]} />
                <meshStandardMaterial color="#f43f5e" emissive="#e11d48" emissiveIntensity={1.0} />
              </mesh>
              <mesh position={[0, 11, 0]}>
                <sphereGeometry args={[1.5, 16, 16]} />
                <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.8} />
              </mesh>
              <Html distanceFactor={180} position={[0, 14, 0]} center>
                <div className="px-2.5 py-1 rounded bg-rose-950/95 border-2 border-rose-400 text-[10px] font-mono font-bold text-rose-200 whitespace-nowrap shadow-xl">
                  🎯 POINT B (DESTINATION): ({routePointB?.[0] ?? routeReport.destination?.pixel_xy?.[0]}, {routePointB?.[1] ?? routeReport.destination?.pixel_xy?.[1]})
                </div>
              </Html>
            </group>
          )}

          {/* AI-Predicted Safest Point on Map 3D Beacon */}
          {safestPoint_3d && (
            <group position={safestPoint_3d}>
              <mesh position={[0, 7, 0]}>
                <cylinderGeometry args={[0.35, 1.3, 14, 16]} />
                <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={1.2} />
              </mesh>
              <mesh position={[0, 15, 0]}>
                <octahedronGeometry args={[2.0, 0]} />
                <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={1.4} roughness={0.1} />
              </mesh>
              <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.5, 3.2, 32]} />
                <meshBasicMaterial color="#10b981" transparent opacity={0.65} side={THREE.DoubleSide} />
              </mesh>
              <Html distanceFactor={180} position={[0, 19, 0]} center>
                <div className="px-3 py-1.5 rounded-lg bg-emerald-950/95 border-2 border-emerald-400 text-[11px] font-mono font-bold text-emerald-200 whitespace-nowrap shadow-2xl flex items-center gap-1.5">
                  <span>🛡️ SAFEST POINT ON MAP</span>
                  <span className="text-[9px] font-normal text-emerald-300">
                    (+{safestPointObj?.elevation_above_ground_m ?? safestPointObj?.elevation_m ?? 1.4}m • 0% Flood)
                  </span>
                </div>
              </Html>
            </group>
          )}
        </group>
      )}

      {/* 3. Module F: 3D Wireless Cellular Towers, User Device & 3D Ray-Trace Line */}
      {geotwinOverlayMode === 'wireless_coverage' && wirelessReport && (
        <group>
          {wirelessReport.active_towers?.map((tw) => {
            const bx = tw.world_3d[0]
            const by = tw.world_3d[1] * verticalExaggeration
            const bz = tw.world_3d[2]
            const mastH = tw.antenna_height_agl_m
            const isCustom = tw.tower_id.includes('CUSTOM')
            return (
              <group key={tw.tower_id} position={[bx, by, bz]}>
                {/* Lattice Mast */}
                <mesh position={[0, mastH / 2, 0]}>
                  <cylinderGeometry args={[0.45, 1.2, mastH, 8]} />
                  <meshStandardMaterial color={isCustom ? "#38bdf8" : "#f8fafc"} metalness={0.8} roughness={0.2} />
                </mesh>
                {/* 5G/6G Transceiver Array */}
                <mesh position={[0, mastH, 0]}>
                  <sphereGeometry args={[1.8, 16, 16]} />
                  <meshStandardMaterial color={isCustom ? "#0284c7" : "#22d3ee"} emissive="#06b6d4" emissiveIntensity={1.3} />
                </mesh>
                {/* Sector Antenna Arrays */}
                <mesh position={[0, mastH - 1.2, 0]}>
                  <boxGeometry args={[1.6, 2.4, 1.6]} />
                  <meshStandardMaterial color="#0f172a" />
                </mesh>
                {/* Flashing Aviation Warning Beacon */}
                <mesh position={[0, mastH + 1.2, 0]}>
                  <sphereGeometry args={[0.45, 8, 8]} />
                  <meshBasicMaterial color="#ef4444" />
                </mesh>
                <Html distanceFactor={190} position={[0, mastH + 4.5, 0]} center>
                  <div className={`px-2.5 py-1 rounded font-mono text-[10px] whitespace-nowrap shadow-xl border flex items-center gap-1.5 ${
                    isCustom 
                      ? 'bg-sky-950/95 border-sky-400 text-sky-200 ring-2 ring-sky-500/50' 
                      : 'bg-cyan-950/90 border-cyan-400 text-cyan-200'
                  }`}>
                    <span>{isCustom ? '🗼' : '📡'}</span>
                    <span className="font-bold">{tw.label || tw.tower_id}</span>
                    <span className="opacity-80">({tw.frequency_ghz} GHz • {tw.tx_power_dbm} dBm)</span>
                  </div>
                </Html>
              </group>
            )
          })}

          {wirelessReport.candidate_sites?.map((cand) => {
            const cx = cand.world_3d[0]
            const cy = cand.world_3d[1] * verticalExaggeration
            const cz = cand.world_3d[2]
            return (
              <group key={cand.candidate_id} position={[cx, cy, cz]}>
                <mesh position={[0, 8, 0]}>
                  <cylinderGeometry args={[0.3, 0.3, 16, 8]} />
                  <meshStandardMaterial color="#a855f7" emissive="#9333ea" emissiveIntensity={0.8} transparent opacity={0.8} />
                </mesh>
                <Html distanceFactor={190} position={[0, 18, 0]} center>
                  <div className="px-2 py-0.5 rounded bg-purple-950/90 border border-purple-400 text-[10px] font-mono text-purple-200 whitespace-nowrap">
                    #{cand.rank} {cand.candidate_id} (+{cand.predicted_coverage_gain_pct}% cov)
                  </div>
                </Html>
              </group>
            )
          })}

          {/* User Equipment Device 3D Marker & Point-to-Point Ray-Trace Laser */}
          {wirelessReport.user_evaluation && (
            <group>
              {/* User Device 3D Marker */}
              <group position={[
                wirelessReport.user_evaluation.world_3d[0],
                wirelessReport.user_evaluation.world_3d[1] * verticalExaggeration,
                wirelessReport.user_evaluation.world_3d[2]
              ]}>
                {/* Glowing Ground Base Ring */}
                <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[1.5, 2.2, 32]} />
                  <meshBasicMaterial 
                    color={wirelessReport.user_evaluation.is_los ? "#10b981" : "#f43f5e"} 
                    transparent 
                    opacity={0.8} 
                    side={THREE.DoubleSide} 
                  />
                </mesh>
                {/* Device Pedestal */}
                <mesh position={[0, 1.8, 0]}>
                  <cylinderGeometry args={[0.2, 0.4, 3.6, 12]} />
                  <meshStandardMaterial 
                    color={wirelessReport.user_evaluation.is_los ? "#34d399" : "#fb7185"} 
                    emissive={wirelessReport.user_evaluation.is_los ? "#059669" : "#e11d48"} 
                    emissiveIntensity={0.9} 
                  />
                </mesh>
                {/* Floating User Signal HUD */}
                <Html distanceFactor={170} position={[0, 6.0, 0]} center>
                  <div className={`p-2 rounded-lg font-mono text-[10px] whitespace-nowrap shadow-2xl border-2 backdrop-blur-md ${
                    wirelessReport.user_evaluation.is_los
                      ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                      : 'bg-rose-950/95 border-rose-400 text-rose-200'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold text-[11px]">
                      <span>📱 USER DEVICE</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] ${
                        wirelessReport.user_evaluation.is_los ? 'bg-emerald-800 text-white' : 'bg-rose-800 text-white'
                      }`}>
                        {wirelessReport.user_evaluation.los_status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 mt-1 text-[10px]">
                      <div>RSRP: <span className="font-bold">{wirelessReport.user_evaluation.rsrp_dbm} dBm</span></div>
                      <div>Speed: <span className="font-bold">{wirelessReport.user_evaluation.estimated_throughput_mbps} Mbps</span></div>
                      <div>SINR: <span className="font-bold">{wirelessReport.user_evaluation.sinr_db} dB</span></div>
                      <div>3D Dist: <span className="font-bold">{wirelessReport.user_evaluation.distance_3d_m}m</span></div>
                    </div>
                    {!wirelessReport.user_evaluation.is_los && wirelessReport.user_evaluation.obstructing_entity && (
                      <div className="mt-1 text-[9px] text-amber-300 font-sans border-t border-rose-800/60 pt-0.5">
                        ⚠️ Blocked by: {wirelessReport.user_evaluation.obstructing_entity}
                      </div>
                    )}
                  </div>
                </Html>
              </group>

              {/* 3D Ray-Trace Laser Beam */}
              {wirelessReport.user_evaluation.ray_path_3d && (
                <Line
                  points={[
                    [
                      wirelessReport.user_evaluation.ray_path_3d[0][0],
                      wirelessReport.user_evaluation.ray_path_3d[0][1] * verticalExaggeration,
                      wirelessReport.user_evaluation.ray_path_3d[0][2],
                    ],
                    [
                      wirelessReport.user_evaluation.ray_path_3d[1][0],
                      wirelessReport.user_evaluation.ray_path_3d[1][1] * verticalExaggeration,
                      wirelessReport.user_evaluation.ray_path_3d[1][2],
                    ],
                  ]}
                  color={wirelessReport.user_evaluation.is_los ? "#10b981" : "#f43f5e"}
                  lineWidth={4}
                  dashed={!wirelessReport.user_evaluation.is_los}
                  dashSize={2.5}
                  gapSize={1.5}
                />
              )}

              {/* Obstruction Intercept Pin if NLoS */}
              {!wirelessReport.user_evaluation.is_los && wirelessReport.user_evaluation.intercept_3d && (
                <group position={[
                  wirelessReport.user_evaluation.intercept_3d[0],
                  wirelessReport.user_evaluation.intercept_3d[1] * verticalExaggeration,
                  wirelessReport.user_evaluation.intercept_3d[2]
                ]}>
                  <mesh>
                    <sphereGeometry args={[1.2, 16, 16]} />
                    <meshStandardMaterial color="#f43f5e" emissive="#e11d48" emissiveIntensity={1.5} />
                  </mesh>
                  <Html distanceFactor={180} position={[0, 3, 0]} center>
                    <div className="px-2 py-0.5 rounded bg-rose-950/90 border border-rose-400 text-[9px] font-mono font-bold text-rose-200 whitespace-nowrap shadow-xl">
                      🚫 Obstacle Intercept
                    </div>
                  </Html>
                </group>
              )}
            </group>
          )}
        </group>
      )}

      {/* 4. Module C: 3D Disaster Change Markers over Damaged Buildings */}
      {geotwinOverlayMode === 'disaster_damage' && disasterReport?.assessed_buildings && (
        <group>
          {disasterReport.assessed_buildings
            .filter((b: any) => b.damage_class >= 2)
            .slice(0, 25)
            .map((b: any) => {
              const cpx = b.center_px || [wPx / 2, hPx / 2]
              const xw = (cpx[0] - wPx / 2) * gsd
              const zw = (cpx[1] - hPx / 2) * gsd
              const yw = (b.pre_height_m || 8) * verticalExaggeration + 4
              const isDestroyed = b.damage_class === 3
              return (
                <group key={b.building_id} position={[xw, yw, zw]}>
                  <mesh>
                    <octahedronGeometry args={[1.6, 0]} />
                    <meshStandardMaterial
                      color={isDestroyed ? '#ef4444' : '#f97316'}
                      emissive={isDestroyed ? '#dc2626' : '#ea580c'}
                      emissiveIntensity={0.9}
                    />
                  </mesh>
                </group>
              )
            })}
        </group>
      )}

      {/* 5. Module D: Landslide & Slope Hazard Hotspot Pins */}
      {geotwinOverlayMode === 'landslide_susceptibility' && hazardReport?.landslide_hazard?.hotspots && (
        <group>
          {hazardReport.landslide_hazard.hotspots.map((hs: any) => {
            const hx = hs.world_3d[0]
            const hy = hs.world_3d[1] * verticalExaggeration
            const hz = hs.world_3d[2]
            const isCritical = hs.factor_of_safety < 1.0 || hs.susceptibility_pct >= 60
            return (
              <group key={hs.id} position={[hx, hy, hz]}>
                <mesh position={[0, 4.5, 0]}>
                  <cylinderGeometry args={[0.2, 0.8, 9, 16]} />
                  <meshStandardMaterial
                    color={isCritical ? '#f43f5e' : '#f97316'}
                    emissive={isCritical ? '#e11d48' : '#ea580c'}
                    emissiveIntensity={0.8}
                  />
                </mesh>
                <mesh position={[0, 9.5, 0]} rotation={[Math.PI, 0, 0]}>
                  <coneGeometry args={[1.4, 2.2, 16]} />
                  <meshStandardMaterial
                    color={isCritical ? '#f43f5e' : '#f97316'}
                    emissive={isCritical ? '#e11d48' : '#ea580c'}
                    emissiveIntensity={1.0}
                  />
                </mesh>
                <Html distanceFactor={180} position={[0, 13, 0]} center>
                  <div className="px-2.5 py-1 rounded bg-amber-950/95 border border-amber-400 text-[10px] font-mono text-amber-200 whitespace-nowrap shadow-xl">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span>⚠️ {hs.id}</span>
                      <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${isCritical ? 'bg-rose-900 text-rose-200' : 'bg-amber-900 text-amber-200'}`}>
                        FoS {hs.factor_of_safety} ({hs.risk_tier})
                      </span>
                    </div>
                    <div className="text-[9px] text-amber-400">
                      Slope: {hs.slope_deg}° • {hs.susceptibility_pct}% Propensity
                    </div>
                  </div>
                </Html>
              </group>
            )
          })}
        </group>
      )}

      {/* 6. Module D2: 3D Seismic Shockwaves & Epicenter Tremor */}
      {(geotwinOverlayMode === 'earthquake_intensity' || isEarthquakeAnimating || epicenterPoint) && epicenter_3d && (
        <AnimatedEarthquakeShockwaves
          epicenter3d={epicenter_3d}
          maxRadius={Math.max(wPx, hPx) * gsd * 0.7}
          isAnimating={isEarthquakeAnimating}
          animSpeed={earthquakeAnimSpeed}
          richterScale={richterScale}
        />
      )}

      {/* 7. Sampled Seismic Stress / Building Resonance 3D Marker */}
      {selectedSeismicRegion && (
        <group position={[
          selectedSeismicRegion.world_3d[0],
          selectedSeismicRegion.world_3d[1] * verticalExaggeration,
          selectedSeismicRegion.world_3d[2]
        ]}>
          <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.5, 2.4, 32]} />
            <meshBasicMaterial
              color={(selectedSeismicRegion.damage_state || selectedSeismicRegion.damage_grade || '').includes('Collapse') ? '#ef4444' : '#f59e0b'}
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[0.25, 0.45, 6, 16]} />
            <meshStandardMaterial
              color={(selectedSeismicRegion.damage_state || selectedSeismicRegion.damage_grade || '').includes('Collapse') ? '#ef4444' : '#f59e0b'}
              emissive={(selectedSeismicRegion.damage_state || selectedSeismicRegion.damage_grade || '').includes('Collapse') ? '#dc2626' : '#d97706'}
              emissiveIntensity={1.0}
            />
          </mesh>
          <mesh position={[0, 6.8, 0]}>
            <sphereGeometry args={[1.2, 16, 16]} />
            <meshStandardMaterial
              color={(selectedSeismicRegion.damage_state || selectedSeismicRegion.damage_grade || '').includes('Collapse') ? '#ef4444' : '#f59e0b'}
              emissive={(selectedSeismicRegion.damage_state || selectedSeismicRegion.damage_grade || '').includes('Collapse') ? '#ef4444' : '#fbbf24'}
              emissiveIntensity={1.2}
            />
          </mesh>
          <Html distanceFactor={170} position={[0, 9.5, 0]} center>
            <div className={`p-2.5 rounded-lg font-mono text-[10px] whitespace-nowrap shadow-2xl border-2 backdrop-blur-md ${
              (selectedSeismicRegion.damage_state || selectedSeismicRegion.damage_grade || '').includes('Collapse')
                ? 'bg-rose-950/95 border-rose-400 text-rose-200'
                : 'bg-amber-950/95 border-amber-400 text-amber-200'
            }`}>
              <div className="flex items-center gap-1.5 font-bold text-[11px]">
                <span>🏢</span>
                <span>{selectedSeismicRegion.location_name || selectedSeismicRegion.name}</span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-sans ${
                  (selectedSeismicRegion.damage_state || selectedSeismicRegion.damage_grade || '').includes('Collapse')
                    ? 'bg-rose-800 text-white'
                    : 'bg-amber-800 text-white'
                }`}>
                  {selectedSeismicRegion.damage_state || selectedSeismicRegion.damage_grade || 'Moderate Shaking'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 mt-1 text-[10px]">
                <div>PGA: <span className="font-bold">{selectedSeismicRegion.pga_g} g</span></div>
                <div>Intensity: <span className="font-bold">{selectedSeismicRegion.mmi_intensity || `MMI ${selectedSeismicRegion.mmi}`}</span></div>
                <div>Dist to Epi: <span>{selectedSeismicRegion.epicenter_distance_m || Math.round((selectedSeismicRegion.distance_km || 0) * 1000)} m</span></div>
                <div>Resonance: <span>{selectedSeismicRegion.building_period_s ? `${selectedSeismicRegion.building_period_s}s` : 'N/A'}</span></div>
              </div>
            </div>
          </Html>
        </group>
      )}
    </group>
  )
}
