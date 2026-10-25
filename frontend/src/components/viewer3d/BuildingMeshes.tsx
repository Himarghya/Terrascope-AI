import React, { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { ThreeEvent, useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { useStore } from '../../store/useStore'
import { Building3DMesh, BuildingFeature, BuildingDetailMesh } from '../../types'

interface BuildingItemProps {
  meshData: Building3DMesh
  feature: BuildingFeature
  detailedBuilding?: BuildingDetailMesh
  verticalExaggeration: number
  wireframe: boolean
  castShadows: boolean
  isSelected: boolean
  isHovered: boolean
  showWalls: boolean
  showRoofs: boolean
  worldWidth: number
  worldHeight: number
  satTexture: THREE.Texture | null
  facadeTexture: THREE.Texture | null
  onSelect: (e: ThreeEvent<MouseEvent>) => void
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void
}

let cachedFacadeTexture: THREE.CanvasTexture | null = null
const getArchitecturalFacadeTexture = (): THREE.CanvasTexture | null => {
  if (cachedFacadeTexture) return cachedFacadeTexture
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Base warm architectural concrete/stucco surface
  ctx.fillStyle = '#f4f5f7'
  ctx.fillRect(0, 0, 256, 256)

  // Subtle horizontal floor slab spandrel bands (4 floors per 256px tile)
  const floors = 4
  const cols = 4
  const cellW = 256 / cols
  const cellH = 256 / floors

  for (let r = 0; r < floors; r++) {
    const y0 = r * cellH
    // Floor slab shadow line
    ctx.fillStyle = '#cbd5e1'
    ctx.fillRect(0, y0, 256, 4)

    for (let c = 0; c < cols; c++) {
      const x0 = c * cellW
      // Subtle vertical pilaster line
      ctx.fillStyle = '#e2e8f0'
      ctx.fillRect(x0, y0, 2, cellH)

      // Recessed architectural window pane with frame
      const winX = x0 + 12
      const winY = y0 + 12
      const winW = cellW - 24
      const winH = cellH - 22

      // Window outer frame
      ctx.fillStyle = '#94a3b8'
      ctx.fillRect(winX - 2, winY - 2, winW + 4, winH + 4)

      // Tinted architectural glass
      const grad = ctx.createLinearGradient(winX, winY, winX + winW, winY + winH)
      grad.addColorStop(0, '#475569')
      grad.addColorStop(0.5, '#64748b')
      grad.addColorStop(1, '#334155')
      ctx.fillStyle = grad
      ctx.fillRect(winX, winY, winW, winH)

      // Center window mullion
      ctx.fillStyle = '#cbd5e1'
      ctx.fillRect(winX + winW / 2 - 1, winY, 2, winH)
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  cachedFacadeTexture = tex
  return tex
}

const buildComponentGeometry = (
  vertices: [number, number, number][],
  faces: [number, number, number][],
  verticalExaggeration: number = 1.0
): THREE.BufferGeometry | null => {
  if (!vertices || vertices.length === 0 || !faces || faces.length === 0) return null
  const geom = new THREE.BufferGeometry()
  const flatVerts = new Float32Array(faces.length * 3 * 3)
  let pIdx = 0
  for (let f = 0; f < faces.length; f++) {
    const face = faces[f]
    if (!face || face.length < 3) continue
    const v0 = vertices[face[0]]
    const v1 = vertices[face[1]]
    const v2 = vertices[face[2]]
    if (!v0 || !v1 || !v2) continue

    flatVerts[pIdx++] = v0[0]
    flatVerts[pIdx++] = v0[1] * verticalExaggeration
    flatVerts[pIdx++] = v0[2]

    flatVerts[pIdx++] = v1[0]
    flatVerts[pIdx++] = v1[1] * verticalExaggeration
    flatVerts[pIdx++] = v1[2]

    flatVerts[pIdx++] = v2[0]
    flatVerts[pIdx++] = v2[1] * verticalExaggeration
    flatVerts[pIdx++] = v2[2]
  }
  geom.setAttribute('position', new THREE.BufferAttribute(flatVerts, 3))
  geom.computeVertexNormals()
  return geom
}

const buildGeometryFromFaces = (
  rawVerts: [number, number, number][],
  faces: any[],
  verticalExaggeration: number,
  allFaces?: [number, number, number][],
  uvMode: 'roof' | 'wall' = 'roof',
  worldWidth: number = 400,
  worldHeight: number = 400,
  baseElevation: number = 0
) => {
  if (!faces || faces.length === 0 || !rawVerts || rawVerts.length === 0) return null
  const geom = new THREE.BufferGeometry()
  const posArray = new Float32Array(faces.length * 3 * 3)
  const uvArray = new Float32Array(faces.length * 3 * 2)
  let pIdx = 0
  let uIdx = 0

  const safeW = Math.max(1, worldWidth)
  const safeH = Math.max(1, worldHeight)

  for (let f = 0; f < faces.length; f++) {
    const rawFace = faces[f]
    const face = (typeof rawFace === 'number' && allFaces) ? allFaces[rawFace] : rawFace
    if (!face || face.length < 3) continue

    const v0 = rawVerts[face[0]]
    const v1 = rawVerts[face[1]]
    const v2 = rawVerts[face[2]]
    if (!v0 || !v1 || !v2) continue

    const triVerts = [v0, v1, v2]
    // Determine wall horizontal direction for metric facade UVs
    const dx1 = v1[0] - v0[0], dz1 = v1[2] - v0[2]
    const dx2 = v2[0] - v0[0], dz2 = v2[2] - v0[2]
    const len1 = Math.hypot(dx1, dz1)
    const len2 = Math.hypot(dx2, dz2)
    const ux = len1 >= len2 ? (len1 > 1e-4 ? dx1 / len1 : 1) : (len2 > 1e-4 ? dx2 / len2 : 1)
    const uz = len1 >= len2 ? (len1 > 1e-4 ? dz1 / len1 : 0) : (len2 > 1e-4 ? dz2 / len2 : 0)

    for (let v = 0; v < 3; v++) {
      const vert = triVerts[v]
      posArray[pIdx++] = vert[0]
      posArray[pIdx++] = vert[1] * verticalExaggeration
      posArray[pIdx++] = vert[2]

      if (uvMode === 'roof') {
        const u = Math.min(0.998, Math.max(0.002, vert[0] / safeW + 0.5))
        const vCoord = Math.min(0.998, Math.max(0.002, 0.5 - vert[2] / safeH))
        uvArray[uIdx++] = u
        uvArray[uIdx++] = vCoord
      } else {
        // Wall UV mapped in real metric bays (12.8m per 4-column tile horizontally, 12.4m per 4-floor tile vertically)
        const distAlongEdge = (vert[0] - v0[0]) * ux + (vert[2] - v0[2]) * uz
        const heightAgl = Math.max(0, vert[1] - baseElevation)
        uvArray[uIdx++] = distAlongEdge / 12.8
        uvArray[uIdx++] = heightAgl / 12.4
      }
    }
  }

  if (pIdx === 0) return null
  geom.setAttribute('position', new THREE.BufferAttribute(posArray.subarray(0, pIdx), 3))
  geom.setAttribute('uv', new THREE.BufferAttribute(uvArray.subarray(0, uIdx), 2))
  geom.computeVertexNormals()
  return geom
}

const SingleBuildingMesh: React.FC<BuildingItemProps> = ({
  meshData,
  feature,
  detailedBuilding,
  verticalExaggeration,
  wireframe,
  castShadows,
  isSelected,
  isHovered,
  showWalls,
  showRoofs,
  worldWidth,
  worldHeight,
  satTexture,
  facadeTexture,
  onSelect,
  onPointerOver,
  onPointerOut,
}) => {
  const detailedGeometries = useMemo(() => {
    if (!detailedBuilding || !detailedBuilding.components) return null
    const comps = detailedBuilding.components
    const res: Record<string, THREE.BufferGeometry | null> = {}
    for (const [key, comp] of Object.entries(comps)) {
      if (comp.vertices && comp.faces && comp.vertices.length > 0 && comp.faces.length > 0) {
        res[key] = buildComponentGeometry(comp.vertices as any, comp.faces as any, verticalExaggeration)
      }
    }
    return res
  }, [detailedBuilding, verticalExaggeration])
  const wallGeometry = useMemo(() => {
    if (!showWalls) return null
    if (meshData.wall_faces && meshData.wall_faces.length > 0) {
      return buildGeometryFromFaces(
        meshData.vertices,
        meshData.wall_faces,
        verticalExaggeration,
        meshData.faces,
        'wall',
        worldWidth,
        worldHeight,
        meshData.base_elevation
      )
    }
    return null
  }, [meshData, verticalExaggeration, showWalls, worldWidth, worldHeight])

  const roofGeometry = useMemo(() => {
    if (!showRoofs) return null
    if (meshData.roof_faces && meshData.roof_faces.length > 0) {
      return buildGeometryFromFaces(
        meshData.vertices,
        meshData.roof_faces,
        verticalExaggeration,
        meshData.faces,
        'roof',
        worldWidth,
        worldHeight,
        meshData.base_elevation
      )
    }
    return null
  }, [meshData, verticalExaggeration, showRoofs, worldWidth, worldHeight])

  const fallbackGeometry = useMemo(() => {
    if (wallGeometry || roofGeometry) return null
    if (meshData.faces && meshData.faces.length > 0) {
      return buildGeometryFromFaces(
        meshData.vertices,
        meshData.faces,
        verticalExaggeration,
        undefined,
        'roof',
        worldWidth,
        worldHeight,
        meshData.base_elevation
      )
    }
    // ExtrudeGeometry fallback from polygon_world if available
    if (meshData.polygon_world && meshData.polygon_world.length >= 3) {
      const shape = new THREE.Shape()
      meshData.polygon_world.forEach((pt: [number, number], idx: number) => {
        if (idx === 0) shape.moveTo(pt[0], pt[1])
        else shape.lineTo(pt[0], pt[1])
      })
      shape.closePath()
      const ext = new THREE.ExtrudeGeometry(shape, {
        depth: meshData.total_height * verticalExaggeration,
        bevelEnabled: false
      })
      ext.rotateX(-Math.PI / 2)
      return ext
    }
    return null
  }, [meshData, verticalExaggeration, wallGeometry, roofGeometry, worldWidth, worldHeight])

  const geotwinOverlayMode = useStore((state) => state.geotwinOverlayMode)
  const richterScale = useStore((state) => state.richterScale)
  const floodWaterLevelM = useStore((state) => state.floodWaterLevelM)
  const epicenterPoint = useStore((state) => state.epicenterPoint)

  // Real-time Hazard Damage States for this specific building
  const seismicState = useMemo(() => {
    if (geotwinOverlayMode !== 'earthquake_intensity') return null
    const h = feature.estimated_height_m || meshData.total_height || 10.0
    const epiPx = epicenterPoint || [256, 256]
    const cpx = feature.center_px || [256, 256]
    const dx = (cpx[0] - epiPx[0]) * 0.35
    const dy = (cpx[1] - epiPx[1]) * 0.35
    const distKm = Math.max(0.05, Math.hypot(dx, dy) / 1000.0)
    const hypoKm = Math.sqrt(distKm * distKm + 10.0 * 10.0)

    const lnPga = -1.75 + 0.82 * richterScale - 1.18 * Math.log(Math.sqrt(hypoKm * hypoKm + 5.5 * 5.5)) + 0.12
    const pga = Math.min(2.5, Math.max(0.02, Math.exp(lnPga)))
    const mmi = Math.min(11.5, Math.max(1.5, 3.66 * Math.log10(Math.max(pga * 980.0, 1.0)) - 1.66))

    const Tfund = 0.04 * Math.pow(h, 0.9)
    const specAmp = 1.0 + 1.2 * Math.exp(-Math.pow(Tfund - 0.35, 2) / 0.08)
    const driftDemand = pga * specAmp

    if (driftDemand > 0.82 || mmi >= 8.5) return 'collapsed'
    if (driftDemand > 0.52 || mmi >= 7.2) return 'severe'
    if (driftDemand > 0.28 || mmi >= 5.8) return 'moderate'
    return 'safe'
  }, [geotwinOverlayMode, richterScale, epicenterPoint, feature, meshData])

  const floodState = useMemo(() => {
    if (geotwinOverlayMode !== 'flood_susceptibility') return null
    const baseElev = meshData.base_elevation ?? 0.0
    const h = feature.estimated_height_m || meshData.total_height || 10.0
    const roofElev = baseElev + h
    if (floodWaterLevelM >= roofElev && h > 0) return 'submerged'
    if (floodWaterLevelM > baseElev + 0.15) return 'partially_flooded'
    return 'dry'
  }, [geotwinOverlayMode, floodWaterLevelM, feature, meshData])

  const landslideState = useMemo(() => {
    if (geotwinOverlayMode !== 'landslide_susceptibility') return null
    const lrisk = feature.landslide_susceptibility ?? 0.2
    if (lrisk >= 0.55) return 'high'
    if (lrisk >= 0.35) return 'moderate'
    return 'safe'
  }, [geotwinOverlayMode, feature])

  // Physical 3D collapse deformation (tilt & sink) for collapsed structures
  const physicalDeformation = useMemo(() => {
    if (seismicState === 'collapsed') {
      const seed = feature.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const tiltX = ((seed % 17) - 8) * 0.015
      const tiltZ = (((seed * 7) % 19) - 9) * 0.015
      const sinkY = -Math.min(1.8, (meshData.total_height || 10.0) * 0.25)
      return { rotation: [tiltX, 0, tiltZ] as [number, number, number], position: [0, sinkY, 0] as [number, number, number] }
    }
    if (seismicState === 'severe') {
      const seed = feature.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const tiltX = ((seed % 11) - 5) * 0.007
      return { rotation: [tiltX, 0, 0] as [number, number, number], position: [0, 0, 0] as [number, number, number] }
    }
    return { rotation: [0, 0, 0] as [number, number, number], position: [0, 0, 0] as [number, number, number] }
  }, [seismicState, feature.id, meshData.total_height])

  // Colors & Materials matching clean architectural digital twin and hazard damage state
  const roofColor = useMemo(() => {
    if (seismicState === 'collapsed') return new THREE.Color('#991b1b')
    if (seismicState === 'severe') return new THREE.Color('#c2410c')
    if (seismicState === 'moderate') return new THREE.Color('#b45309')
    if (seismicState === 'safe') return new THREE.Color('#065f46')

    if (floodState === 'submerged') return new THREE.Color('#0369a1')
    if (floodState === 'partially_flooded') return new THREE.Color('#0891b2')

    if (landslideState === 'high') return new THREE.Color('#9a3412')
    if (landslideState === 'moderate') return new THREE.Color('#b45309')

    const base = new THREE.Color(feature.base_color_hex || '#e2e8f0')
    if (satTexture) {
      // Blend base roof material hue with white so the satellite roof texture retains crisp contrast
      return base.clone().lerp(new THREE.Color('#ffffff'), 0.52)
    }
    return base
  }, [feature.base_color_hex, satTexture, seismicState, floodState, landslideState])

  const wallColor = useMemo(() => {
    if (seismicState === 'collapsed') return new THREE.Color('#ef4444') // Grade 4 Pancake Collapse Crimson
    if (seismicState === 'severe') return new THREE.Color('#f97316') // Grade 3 Red-Tagged Uninhabitable Orange
    if (seismicState === 'moderate') return new THREE.Color('#eab308') // Grade 2 Shear Cracking Amber
    if (seismicState === 'safe') return new THREE.Color('#10b981') // Grade 0/1 Safe Green

    if (floodState === 'submerged') return new THREE.Color('#0284c7') // Deep Aquatic Blue Submerged
    if (floodState === 'partially_flooded') return new THREE.Color('#06b6d4') // Inundated Ground Floor Cyan
    if (floodState === 'dry') return new THREE.Color('#10b981') // Dry High-Ground Green

    if (landslideState === 'high') return new THREE.Color('#c2410c') // Runout Slope Failure Terracotta
    if (landslideState === 'moderate') return new THREE.Color('#f59e0b')
    if (landslideState === 'safe') return new THREE.Color('#10b981')

    if (meshData.wall_color) {
      const [r, g, b] = meshData.wall_color
      return new THREE.Color(r, g, b)
    }
    return new THREE.Color('#f1f5f9')
  }, [meshData.wall_color, seismicState, floodState, landslideState])

  const isMetalRoof = Boolean(feature.roof_material && feature.roof_material.includes('Metal'))

  const emissiveColor = useMemo(() => {
    if (isSelected) return new THREE.Color('#f97316')
    if (isHovered) return new THREE.Color('#06b6d4')

    if (seismicState === 'collapsed') return new THREE.Color('#dc2626')
    if (seismicState === 'severe') return new THREE.Color('#ea580c')
    if (seismicState === 'moderate') return new THREE.Color('#ca8a04')
    if (seismicState === 'safe') return new THREE.Color('#059669')

    if (floodState === 'submerged') return new THREE.Color('#0284c7')
    if (floodState === 'partially_flooded') return new THREE.Color('#0891b2')

    if (landslideState === 'high') return new THREE.Color('#ea580c')
    return new THREE.Color('#000000')
  }, [isSelected, isHovered, seismicState, floodState, landslideState])

  const emissiveIntensity = useMemo(() => {
    if (isSelected) return 0.55
    if (isHovered) return 0.28

    if (seismicState === 'collapsed') return 0.70
    if (seismicState === 'severe') return 0.45
    if (seismicState === 'moderate') return 0.25
    if (seismicState === 'safe') return 0.12

    if (floodState === 'submerged') return 0.55
    if (floodState === 'partially_flooded') return 0.35

    if (landslideState === 'high') return 0.45
    return 0.0
  }, [isSelected, isHovered, seismicState, floodState, landslideState])

  const activeWallGeo = detailedGeometries?.walls || wallGeometry
  const activeRoofGeo = detailedGeometries?.roof || roofGeometry

  const wallEdges = useMemo(() => {
    if (!activeWallGeo) return null
    return new THREE.EdgesGeometry(activeWallGeo, 28)
  }, [activeWallGeo])

  const roofEdges = useMemo(() => {
    if (!activeRoofGeo) return null
    return new THREE.EdgesGeometry(activeRoofGeo, 15)
  }, [activeRoofGeo])

  return (
    <group
      position={physicalDeformation.position}
      rotation={physicalDeformation.rotation}
      onClick={onSelect}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* 1. Wall sub-mesh with multi-story architectural facade texture */}
      {activeWallGeo && showWalls && (
        <mesh
          geometry={activeWallGeo}
          castShadow={castShadows}
          receiveShadow={castShadows}
        >
          <meshStandardMaterial
            map={facadeTexture}
            color={wallColor}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
            roughness={0.68}
            metalness={0.12}
            wireframe={wireframe}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {wallEdges && showWalls && !wireframe && (
        <lineSegments geometry={wallEdges}>
          <lineBasicMaterial color="#334155" opacity={0.32} transparent />
        </lineSegments>
      )}

      {/* 2. Roof sub-mesh with UV-mapped satellite imagery + roof material tint */}
      {activeRoofGeo && showRoofs && (
        <mesh
          geometry={activeRoofGeo}
          castShadow={castShadows}
          receiveShadow={castShadows}
        >
          <meshStandardMaterial
            map={satTexture}
            color={roofColor}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
            roughness={isMetalRoof ? 0.42 : 0.62}
            metalness={isMetalRoof ? 0.35 : 0.14}
            wireframe={wireframe}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {roofEdges && showRoofs && !wireframe && (
        <lineSegments geometry={roofEdges}>
          <lineBasicMaterial color="#0f172a" opacity={0.5} transparent />
        </lineSegments>
      )}

      {/* 3. Detailed Cyberpunk / Architectural Modular Geometry Components */}
      {detailedGeometries?.windows && (
        <mesh geometry={detailedGeometries.windows} castShadow={castShadows}>
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={0.25}
            roughness={0.08}
            metalness={0.88}
            transparent
            opacity={0.88}
            wireframe={wireframe}
          />
        </mesh>
      )}

      {detailedGeometries?.doors && (
        <mesh geometry={detailedGeometries.doors} castShadow={castShadows}>
          <meshStandardMaterial
            color="#1e293b"
            roughness={0.35}
            metalness={0.75}
            wireframe={wireframe}
          />
        </mesh>
      )}

      {detailedGeometries?.balconies && (
        <mesh geometry={detailedGeometries.balconies} castShadow={castShadows} receiveShadow={castShadows}>
          <meshStandardMaterial
            color="#64748b"
            roughness={0.45}
            metalness={0.65}
            wireframe={wireframe}
          />
        </mesh>
      )}

      {detailedGeometries?.rooftop_equipment && (
        <mesh geometry={detailedGeometries.rooftop_equipment} castShadow={castShadows} receiveShadow={castShadows}>
          <meshStandardMaterial
            color="#475569"
            roughness={0.3}
            metalness={0.85}
            wireframe={wireframe}
          />
        </mesh>
      )}

      {detailedGeometries?.neon_signs && (
        <mesh geometry={detailedGeometries.neon_signs}>
          <meshStandardMaterial
            color="#ff007f"
            emissive="#ff007f"
            emissiveIntensity={3.2}
            roughness={0.15}
            metalness={0.4}
            toneMapped={false}
          />
        </mesh>
      )}

      {detailedGeometries?.conduits && (
        <mesh geometry={detailedGeometries.conduits} castShadow={castShadows} receiveShadow={castShadows}>
          <meshStandardMaterial
            color="#334155"
            roughness={0.35}
            metalness={0.8}
            wireframe={wireframe}
          />
        </mesh>
      )}

      {/* 4. Fallback monolithic mesh if sub-meshes are absent */}
      {!activeWallGeo && !activeRoofGeo && fallbackGeometry && (
        <mesh
          geometry={fallbackGeometry}
          castShadow={castShadows}
          receiveShadow={castShadows}
        >
          <meshStandardMaterial
            map={satTexture}
            color={roofColor}
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
            roughness={0.60}
            metalness={0.18}
            wireframe={wireframe}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

interface BuildingMeshesInnerProps {
  buildings_3d: Building3DMesh[]
  buildings: BuildingFeature[]
  verticalExaggeration: number
  wireframe: boolean
  castShadows: boolean
  showWalls: boolean
  showRoofs: boolean
  useSatRoofTexture: boolean
  imageUrl: string
  worldWidth: number
  worldHeight: number
  selectedFeatureId?: string
  hoveredFeatureId: string | null
  onSelectFeature: (feature: BuildingFeature, targetPos: [number, number, number]) => void
  onHoverFeature: (id: string | null) => void
}

const BuildingMeshesInner: React.FC<BuildingMeshesInnerProps> = ({
  buildings_3d,
  buildings,
  verticalExaggeration,
  wireframe,
  castShadows,
  showWalls,
  showRoofs,
  useSatRoofTexture,
  imageUrl,
  worldWidth,
  worldHeight,
  selectedFeatureId,
  hoveredFeatureId,
  onSelectFeature,
  onHoverFeature,
}) => {
  const loadedSatTex = useTexture(imageUrl)
  loadedSatTex.wrapS = THREE.ClampToEdgeWrapping
  loadedSatTex.wrapT = THREE.ClampToEdgeWrapping
  loadedSatTex.colorSpace = THREE.SRGBColorSpace

  const floodPickingMode = useStore((state) => state.floodPickingMode)
  const setFloodPickingMode = useStore((state) => state.setFloodPickingMode)
  const floodWaterLevelM = useStore((state) => state.floodWaterLevelM)
  const setSelectedRegionHeight = useStore((state) => state.setSelectedRegionHeight)
  const earthquakePickingMode = useStore((state) => state.earthquakePickingMode)
  const setEarthquakePickingMode = useStore((state) => state.setEarthquakePickingMode)
  const setSelectedSeismicRegion = useStore((state) => state.setSelectedSeismicRegion)
  const richterScale = useStore((state) => state.richterScale)
  const isEarthquakeAnimating = useStore((state) => state.isEarthquakeAnimating)
  const earthquakeAnimSpeed = useStore((state) => state.earthquakeAnimSpeed)

  const buildingsGroupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (buildingsGroupRef.current) {
      if (isEarthquakeAnimating) {
        const t = state.clock.getElapsedTime() * 18 * earthquakeAnimSpeed
        const swayAmp = Math.min(0.4, 0.015 * Math.pow(10, (richterScale - 4.5) * 0.35))
        buildingsGroupRef.current.position.x = Math.sin(t) * swayAmp
        buildingsGroupRef.current.position.z = Math.cos(t * 1.3) * (swayAmp * 0.8)
        buildingsGroupRef.current.rotation.y = Math.sin(t * 0.6) * (swayAmp * 0.006)
      } else {
        buildingsGroupRef.current.position.x = 0
        buildingsGroupRef.current.position.z = 0
        buildingsGroupRef.current.rotation.y = 0
      }
    }
  })

  const isCyberpunkCityMode = useStore((state) => state.isCyberpunkCityMode)
  const cityDetailData = useStore((state) => state.cityDetailData)
  const isGeneratingCityDetail = useStore((state) => state.isGeneratingCityDetail)
  const generateDetailedCity = useStore((state) => state.generateDetailedCity)

  useEffect(() => {
    if (isCyberpunkCityMode && !cityDetailData && !isGeneratingCityDetail && buildings_3d.length > 0) {
      generateDetailedCity({ style: 'cyberpunk_2077', tier: 'high' })
    }
  }, [isCyberpunkCityMode, cityDetailData, isGeneratingCityDetail, buildings_3d.length, generateDetailedCity])

  const facadeTexture = useMemo(() => getArchitecturalFacadeTexture(), [])

  const detailedBuildingMap = useMemo(() => {
    const map = new Map<string, BuildingDetailMesh>()
    if (cityDetailData?.buildings) {
      cityDetailData.buildings.forEach((b) => map.set(b.building_id, b))
    }
    return map
  }, [cityDetailData])

  const buildingMap = useMemo(() => {
    const map = new Map<string, BuildingFeature>()
    buildings.forEach((b) => map.set(b.id, b))
    return map
  }, [buildings])

  return (
    <group ref={buildingsGroupRef} name="buildings-layer">
      {buildings_3d.map((m) => {
        const feature = buildingMap.get(m.building_id)
        if (!feature) return null

        const isSelected = selectedFeatureId === feature.id
        const isHovered = hoveredFeatureId === feature.id
        const detailedBldg = isCyberpunkCityMode ? detailedBuildingMap.get(m.building_id) : undefined

        return (
          <SingleBuildingMesh
            key={m.building_id}
            meshData={m}
            feature={feature}
            detailedBuilding={detailedBldg}
            verticalExaggeration={verticalExaggeration}
            wireframe={wireframe}
            castShadows={castShadows}
            isSelected={isSelected}
            isHovered={isHovered}
            showWalls={showWalls}
            showRoofs={showRoofs}
            worldWidth={worldWidth}
            worldHeight={worldHeight}
            satTexture={useSatRoofTexture ? loadedSatTex : null}
            facadeTexture={facadeTexture}
            onSelect={(e) => {
              e.stopPropagation()
              if (floodPickingMode) {
                const baseElev = m.base_elevation || 0
                const roofH = m.total_height || feature.estimated_height_m || 0
                const totalElev = Math.round((baseElev + roofH) * 100) / 100
                const inundationDepth = Math.round((floodWaterLevelM - totalElev) * 100) / 100
                setSelectedRegionHeight({
                  x_px: Math.round(feature.center_px?.[0] || 0),
                  y_px: Math.round(feature.center_px?.[1] || 0),
                  world_3d: [
                    Math.round(m.vertices[0]?.[0] || 0),
                    totalElev,
                    Math.round(m.vertices[0]?.[2] || 0),
                  ],
                  elevation_m: totalElev,
                  terrain_elev_m: Math.round(baseElev * 100) / 100,
                  building_height_m: Math.round(roofH * 100) / 100,
                  building_id: feature.id,
                  building_name: `${feature.building_type || 'Building'} (${feature.id})`,
                  is_submerged: inundationDepth > 0,
                  inundation_depth_m: Math.max(0, inundationDepth),
                })
                setFloodPickingMode(false)
                return
              }
              if (earthquakePickingMode) {
                const baseElev = m.base_elevation || 0
                const roofH = m.total_height || feature.estimated_height_m || 0
                const totalElev = Math.round((baseElev + roofH) * 100) / 100
                const pgaVal = Math.round((0.18 * Math.pow(10, (richterScale - 5.0) * 0.35)) * 100) / 100
                const mmiVal = Math.min(10.5, Math.max(3.0, Math.round((richterScale * 1.15) * 10) / 10))

                setSelectedSeismicRegion({
                  x_px: Math.round(feature.center_px?.[0] || 0),
                  y_px: Math.round(feature.center_px?.[1] || 0),
                  world_3d: [
                    Math.round(m.vertices[0]?.[0] || 0),
                    totalElev,
                    Math.round(m.vertices[0]?.[2] || 0),
                  ],
                  name: `${feature.building_type || 'Structure'} (${feature.id})`,
                  pga_g: pgaVal,
                  mmi: mmiVal,
                  distance_km: 0.45,
                  damage_grade: richterScale >= 7.5
                    ? 'Grade 3/4 - High Structural Failure Hazard'
                    : richterScale >= 6.0
                    ? 'Grade 2 - Moderate Masonry Shear Cracks'
                    : 'Grade 0/1 - Minor Non-Structural Shaking',
                })
                setEarthquakePickingMode(false)
                return
              }
              const cx = m.vertices[0]?.[0] ?? 0
              const cy = (m.base_elevation * verticalExaggeration) + (m.total_height / 2)
              const cz = m.vertices[0]?.[2] ?? 0
              onSelectFeature(feature, [cx, cy, cz])
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              onHoverFeature(feature.id)
            }}
            onPointerOut={(e) => {
              e.stopPropagation()
              if (hoveredFeatureId === feature.id) {
                onHoverFeature(null)
              }
            }}
          />
        )
      })}
    </group>
  )
}

export const BuildingMeshes: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const verticalExaggeration = useStore((state) => state.verticalExaggeration)
  const layerVisibility = useStore((state) => state.layerVisibility)
  const selectedFeature = useStore((state) => state.selectedFeature)
  const hoveredFeatureId = useStore((state) => state.hoveredFeatureId)
  const selectFeature = useStore((state) => state.selectFeature)
  const setHoveredFeatureId = useStore((state) => state.setHoveredFeatureId)
  const setTargetFocusPosition = useStore((state) => state.setTargetFocusPosition)

  if (!sceneData || !layerVisibility.buildings) return null

  const showWalls = layerVisibility.walls !== false
  const showRoofs = layerVisibility.roofs !== false

  if (!showWalls && !showRoofs) return null

  const worldWidth = sceneData.dimensions.width * sceneData.gsd_m
  const worldHeight = sceneData.dimensions.height * sceneData.gsd_m

  return (
    <BuildingMeshesInner
      buildings_3d={sceneData.buildings_3d}
      buildings={sceneData.buildings}
      verticalExaggeration={verticalExaggeration}
      wireframe={layerVisibility.wireframe}
      castShadows={layerVisibility.shadows}
      showWalls={showWalls}
      showRoofs={showRoofs}
      useSatRoofTexture={layerVisibility.satelliteTexture !== false}
      imageUrl={sceneData.image_url}
      worldWidth={worldWidth}
      worldHeight={worldHeight}
      selectedFeatureId={selectedFeature?.id}
      hoveredFeatureId={hoveredFeatureId}
      onSelectFeature={(feature, targetPos) => {
        selectFeature({
          type: 'building',
          id: feature.id,
          data: feature,
        })
        setTargetFocusPosition(targetPos)
      }}
      onHoverFeature={setHoveredFeatureId}
    />
  )
}
