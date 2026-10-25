import React, { useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { useStore } from '../../store/useStore'
import { SceneData } from '../../types'

interface TerrainMeshInnerProps {
  sceneData: SceneData
  verticalExaggeration: number
  layerVisibility: {
    terrain: boolean
    buildings: boolean
    walls: boolean
    roofs: boolean
    roads: boolean
    vegetation: boolean
    satelliteTexture: boolean
    wireframe: boolean
    shadows: boolean
  }
  viewMode: string
  textureMode: 'sat' | 'hyp' | 'lc' | 'sihe'
  hypsometricTextureUrl: string | null
  showDsmSurface: boolean
  measuredDsmGrid: Float32Array | null
  measuredDtmGrid: Float32Array | null
  activeColormap: 'rgb' | 'hypsometric' | 'viridis' | 'magma' | 'slope' | 'aspect' | 'landcover'
  measurementMode: boolean
  addMeasurementPoint: (pt: [number, number, number]) => void
}

const TerrainMeshInner: React.FC<TerrainMeshInnerProps> = ({
  sceneData,
  verticalExaggeration,
  layerVisibility,
  viewMode,
  textureMode,
  hypsometricTextureUrl,
  showDsmSurface,
  measuredDsmGrid,
  measuredDtmGrid,
  activeColormap,
  measurementMode,
  addMeasurementPoint,
}) => {
  const routePickingMode = useStore((state) => state.routePickingMode)
  const setRoutePointA = useStore((state) => state.setRoutePointA)
  const setRoutePointB = useStore((state) => state.setRoutePointB)
  const setRoutePickingMode = useStore((state) => state.setRoutePickingMode)
  const networkPickingMode = useStore((state) => state.networkPickingMode)
  const setCustomTowerPos = useStore((state) => state.setCustomTowerPos)
  const setUserDevicePos = useStore((state) => state.setUserDevicePos)
  const setNetworkPickingMode = useStore((state) => state.setNetworkPickingMode)
  const runWirelessPrediction = useStore((state) => state.runWirelessPrediction)
  const floodPickingMode = useStore((state) => state.floodPickingMode)
  const setFloodPickingMode = useStore((state) => state.setFloodPickingMode)
  const floodWaterLevelM = useStore((state) => state.floodWaterLevelM)
  const setSelectedRegionHeight = useStore((state) => state.setSelectedRegionHeight)
  const earthquakePickingMode = useStore((state) => state.earthquakePickingMode)
  const setEarthquakePickingMode = useStore((state) => state.setEarthquakePickingMode)
  const setEpicenterPoint = useStore((state) => state.setEpicenterPoint)
  const richterScale = useStore((state) => state.richterScale)
  const setSelectedSeismicRegion = useStore((state) => state.setSelectedSeismicRegion)
  const runHazardPrediction = useStore((state) => state.runHazardPrediction)

  const { terrain_mesh_data, gsd_m, dimensions, image_url, classification_vis_url } = sceneData
  const { grid_width, grid_height, elevations } = terrain_mesh_data

  // Real world dimensions in meters
  const worldWidth = dimensions.width * gsd_m
  const worldHeight = dimensions.height * gsd_m

  // Choose texture based on textureMode and viewMode
  let textureUrl = image_url
  if (textureMode === 'hyp' && hypsometricTextureUrl) {
    textureUrl = hypsometricTextureUrl
  } else if (textureMode === 'lc' && classification_vis_url) {
    textureUrl = classification_vis_url
  } else if (textureMode === 'sihe' && sceneData.sihe?.visualization_url) {
    textureUrl = sceneData.sihe.visualization_url
  } else if (viewMode === 'classification' && classification_vis_url) {
    textureUrl = classification_vis_url
  } else if (viewMode === 'sihe' && sceneData.sihe?.visualization_url) {
    textureUrl = sceneData.sihe.visualization_url
  }

  const texture = useTexture(textureUrl)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = true
  texture.colorSpace = THREE.SRGBColorSpace

  // Dynamic Colormap Generation (Hypsometric, Viridis, Magma, Slope, Aspect)
  const colormapTexture = useMemo(() => {
    if (activeColormap === 'rgb' || !activeColormap) return null

    const cw = grid_width
    const ch = grid_height
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const imgData = ctx.createImageData(cw, ch)
    const data = imgData.data

    const activeElevs =
      showDsmSurface && measuredDsmGrid
        ? measuredDsmGrid
        : measuredDtmGrid || elevations
    if (!activeElevs || activeElevs.length !== cw * ch) return null

    let minE = Infinity, maxE = -Infinity
    for (let i = 0; i < activeElevs.length; i++) {
      const v = activeElevs[i]
      if (v < minE) minE = v
      if (v > maxE) maxE = v
    }
    const rangeE = Math.max(maxE - minE, 0.001)

    const viridisMap = (t: number): [number, number, number] => {
      const r = Math.floor(Math.sin(t * Math.PI) * 200 + 40 * (1 - t) + 250 * t * t)
      const g = Math.floor(t * 220 + 20)
      const b = Math.floor((1 - t) * 200 + 30)
      return [Math.min(255, Math.max(0, r)), Math.min(255, Math.max(0, g)), Math.min(255, Math.max(0, b))]
    }

    const magmaMap = (t: number): [number, number, number] => {
      const r = Math.floor(Math.min(255, Math.pow(t, 0.7) * 255))
      const g = Math.floor(Math.min(255, Math.pow(t, 2.0) * 220))
      const b = Math.floor(Math.min(255, Math.sin(t * Math.PI * 0.8) * 180 + 30 * (1 - t)))
      return [r, g, b]
    }

    const hypsometricMap = (t: number): [number, number, number] => {
      if (t < 0.2) return [46, 117, 89]      // lowland forest
      if (t < 0.45) return [115, 178, 68]    // meadow
      if (t < 0.7) return [230, 204, 115]    // upland
      if (t < 0.88) return [168, 112, 59]    // mountain ridge
      return [245, 245, 250]                 // snow peak
    }

    const cellM = worldWidth / Math.max(1, cw - 1)

    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const idx = y * cw + x
        const pxIdx = idx * 4
        const elev = activeElevs[idx]
        let rgb: [number, number, number] = [200, 200, 200]

        if (activeColormap === 'viridis') {
          const t = Math.max(0, Math.min(1, (elev - minE) / rangeE))
          rgb = viridisMap(t)
        } else if (activeColormap === 'magma') {
          const t = Math.max(0, Math.min(1, (elev - minE) / rangeE))
          rgb = magmaMap(t)
        } else if (activeColormap === 'hypsometric') {
          const t = Math.max(0, Math.min(1, (elev - minE) / rangeE))
          rgb = hypsometricMap(t)
        } else if (activeColormap === 'slope') {
          const left = activeElevs[y * cw + Math.max(0, x - 1)]
          const right = activeElevs[y * cw + Math.min(cw - 1, x + 1)]
          const up = activeElevs[Math.max(0, y - 1) * cw + x]
          const down = activeElevs[Math.min(ch - 1, y + 1) * cw + x]
          const dx = (right - left) / (2 * cellM)
          const dy = (down - up) / (2 * cellM)
          const slopeDeg = Math.atan(Math.sqrt(dx * dx + dy * dy)) * (180 / Math.PI)
          const st = Math.min(1, slopeDeg / 45.0)
          if (st < 0.33) {
            rgb = [34, 197, 94] // gentle/flat green
          } else if (st < 0.66) {
            rgb = [234, 179, 8] // moderate yellow
          } else {
            rgb = [239, 68, 68] // steep red
          }
        } else if (activeColormap === 'aspect') {
          const left = activeElevs[y * cw + Math.max(0, x - 1)]
          const right = activeElevs[y * cw + Math.min(cw - 1, x + 1)]
          const up = activeElevs[Math.max(0, y - 1) * cw + x]
          const down = activeElevs[Math.min(ch - 1, y + 1) * cw + x]
          const dx = right - left
          const dy = down - up
          let aspectRad = Math.atan2(-dx, dy)
          let aspectDeg = aspectRad * (180 / Math.PI)
          if (aspectDeg < 0) aspectDeg += 360
          const sector = Math.floor((aspectDeg + 22.5) / 45) % 8
          const compassColors: [number, number, number][] = [
            [239, 68, 68],   // N - Red
            [249, 115, 22],  // NE - Orange
            [234, 179, 8],   // E - Yellow
            [34, 197, 94],   // SE - Green
            [6, 182, 212],   // S - Cyan
            [59, 130, 246],  // SW - Blue
            [168, 85, 247],  // W - Purple
            [236, 72, 153],  // NW - Pink
          ]
          rgb = compassColors[sector]
        }

        data[pxIdx] = rgb[0]
        data[pxIdx + 1] = rgb[1]
        data[pxIdx + 2] = rgb[2]
        data[pxIdx + 3] = 255
      }
    }

    ctx.putImageData(imgData, 0, 0)
    const ct = new THREE.CanvasTexture(canvas)
    ct.wrapS = THREE.ClampToEdgeWrapping
    ct.wrapT = THREE.ClampToEdgeWrapping
    ct.needsUpdate = true
    return ct
  }, [
    activeColormap,
    grid_width,
    grid_height,
    elevations,
    measuredDtmGrid,
    measuredDsmGrid,
    showDsmSurface,
    worldWidth
  ])

  const geometry = useMemo(() => {
    // PlaneGeometry along X and Y; we rotate it so it lies in X-Z plane
    const geom = new THREE.PlaneGeometry(
      worldWidth,
      worldHeight,
      grid_width - 1,
      grid_height - 1
    )

    const pos = geom.attributes.position
    const activeElevs =
      showDsmSurface && measuredDsmGrid
        ? measuredDsmGrid
        : measuredDtmGrid || elevations

    for (let i = 0; i < pos.count; i++) {
      const elev = activeElevs[i] !== undefined && !isNaN(activeElevs[i]) ? activeElevs[i] : 0
      pos.setZ(i, elev * verticalExaggeration)
    }

    geom.computeVertexNormals()
    return geom
  }, [
    worldWidth,
    worldHeight,
    grid_width,
    grid_height,
    elevations,
    measuredDtmGrid,
    measuredDsmGrid,
    showDsmSurface,
    verticalExaggeration,
  ])

  return (
    <group>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh
          geometry={geometry}
          receiveShadow={layerVisibility.shadows}
          castShadow={false}
          onPointerDown={(e) => {
            if (measurementMode) {
              e.stopPropagation()
              // e.point is in world coordinates where y is elev * verticalExaggeration
              const pt: [number, number, number] = [
                Math.round(e.point.x * 100) / 100,
                Math.round((e.point.y / Math.max(0.01, verticalExaggeration)) * 100) / 100,
                Math.round(e.point.z * 100) / 100
              ]
              addMeasurementPoint(pt)
            } else if (routePickingMode === 'A' || routePickingMode === 'B') {
              e.stopPropagation()
              const px = Math.round((e.point.x / Math.max(0.01, gsd_m)) + dimensions.width / 2)
              const py = Math.round((e.point.z / Math.max(0.01, gsd_m)) + dimensions.height / 2)
              const clampedPx = Math.max(0, Math.min(dimensions.width - 1, px))
              const clampedPy = Math.max(0, Math.min(dimensions.height - 1, py))
              if (routePickingMode === 'A') {
                setRoutePointA([clampedPx, clampedPy])
              } else {
                setRoutePointB([clampedPx, clampedPy])
              }
              setRoutePickingMode(null)
            } else if (networkPickingMode === 'tower' || networkPickingMode === 'user') {
              e.stopPropagation()
              const px = Math.round((e.point.x / Math.max(0.01, gsd_m)) + dimensions.width / 2)
              const py = Math.round((e.point.z / Math.max(0.01, gsd_m)) + dimensions.height / 2)
              const clampedPx = Math.max(0, Math.min(dimensions.width - 1, px))
              const clampedPy = Math.max(0, Math.min(dimensions.height - 1, py))
              if (networkPickingMode === 'tower') {
                setCustomTowerPos([clampedPx, clampedPy])
                setNetworkPickingMode(null)
                runWirelessPrediction({
                  towers: [{
                    tower_id: 'CUSTOM-BS-01',
                    label: 'Custom Placed Cell Tower',
                    x_px: clampedPx,
                    y_px: clampedPy,
                    antenna_height_agl_m: 25.0,
                    frequency_ghz: 3.5,
                    tx_power_dbm: 43.0,
                    antenna_gain_dbi: 16.0,
                  }]
                })
              } else {
                setUserDevicePos([clampedPx, clampedPy])
                setNetworkPickingMode(null)
                runWirelessPrediction({
                  user_device_point: [clampedPx, clampedPy]
                })
              }
            } else if (floodPickingMode) {
              e.stopPropagation()
              const px = Math.round((e.point.x / Math.max(0.01, gsd_m)) + dimensions.width / 2)
              const py = Math.round((e.point.z / Math.max(0.01, gsd_m)) + dimensions.height / 2)
              const clampedPx = Math.max(0, Math.min(dimensions.width - 1, px))
              const clampedPy = Math.max(0, Math.min(dimensions.height - 1, py))
              
              const terrainElev = Math.round((e.point.y / Math.max(0.01, verticalExaggeration)) * 100) / 100
              
              let bldH = 0
              let bldId: string | null = null
              let bldCat = 'Ground Terrain / Roadway'
              if (sceneData.buildings) {
                for (const b of sceneData.buildings) {
                  const poly = b.polygon_px
                  if (poly && poly.length >= 3) {
                    const xs = poly.map((pt) => pt[0])
                    const ys = poly.map((pt) => pt[1])
                    if (clampedPx >= Math.min(...xs) && clampedPx <= Math.max(...xs) &&
                        clampedPy >= Math.min(...ys) && clampedPy <= Math.max(...ys)) {
                      bldH = b.estimated_height_m || 0
                      bldId = b.id
                      bldCat = `${b.building_type || 'Building'} (${b.id})`
                      break
                    }
                  }
                }
              }

              const totalElev = Math.round((terrainElev + bldH) * 100) / 100
              const inundationDepth = Math.round((floodWaterLevelM - totalElev) * 100) / 100

              setSelectedRegionHeight({
                x_px: clampedPx,
                y_px: clampedPy,
                world_3d: [
                  Math.round(e.point.x * 100) / 100,
                  totalElev,
                  Math.round(e.point.z * 100) / 100,
                ],
                elevation_m: totalElev,
                terrain_elev_m: terrainElev,
                building_height_m: bldH,
                building_id: bldId,
                building_name: bldCat,
                is_submerged: inundationDepth > 0,
                inundation_depth_m: Math.max(0, inundationDepth),
              })
              setFloodPickingMode(false)
            } else if (earthquakePickingMode) {
              e.stopPropagation()
              const px = Math.round((e.point.x / Math.max(0.01, gsd_m)) + dimensions.width / 2)
              const py = Math.round((e.point.z / Math.max(0.01, gsd_m)) + dimensions.height / 2)
              const clampedPx = Math.max(0, Math.min(dimensions.width - 1, px))
              const clampedPy = Math.max(0, Math.min(dimensions.height - 1, py))
              
              setEpicenterPoint([clampedPx, clampedPy])
              setEarthquakePickingMode(false)

              const terrainElev = Math.round((e.point.y / Math.max(0.01, verticalExaggeration)) * 100) / 100
              const pgaEstimate = Math.round((0.15 * Math.pow(10, (richterScale - 5.0) * 0.35)) * 100) / 100
              const mmiEstimate = Math.min(10.5, Math.max(3.0, Math.round((richterScale * 1.15) * 10) / 10))

              setSelectedSeismicRegion({
                x_px: clampedPx,
                y_px: clampedPy,
                world_3d: [
                  Math.round(e.point.x * 100) / 100,
                  terrainElev,
                  Math.round(e.point.z * 100) / 100,
                ],
                name: 'Seismic Epicenter Location',
                pga_g: pgaEstimate,
                mmi: mmiEstimate,
                distance_km: 0.0,
                damage_grade: richterScale >= 7.5 ? 'Catastrophic Ground Rupture' : 'Epicentral Peak Shaking Zone',
              })

              runHazardPrediction({
                epicenter_px: [clampedPx, clampedPy],
                earthquake_magnitude: richterScale,
              })
            }
          }}
        >
          <meshStandardMaterial
            map={
              layerVisibility.satelliteTexture !== false
                ? (colormapTexture || texture)
                : null
            }
            color={layerVisibility.satelliteTexture !== false ? '#ffffff' : '#d8d4c8'}
            roughness={0.85}
            metalness={0.05}
            wireframe={layerVisibility.wireframe}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Solid 3D Architectural / Geological Base Plinth beneath Terrain */}
      {!layerVisibility.wireframe && (
        <mesh position={[0, -2.2, 0]} receiveShadow={false} castShadow={false}>
          <boxGeometry args={[worldWidth, 4.0, worldHeight]} />
          <meshStandardMaterial
            color="#1e293b"
            roughness={0.92}
            metalness={0.08}
          />
        </mesh>
      )}
    </group>
  )
}

export const TerrainMesh: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const verticalExaggeration = useStore((state) => state.verticalExaggeration)
  const layerVisibility = useStore((state) => state.layerVisibility)
  const viewMode = useStore((state) => state.viewMode)
  const textureMode = useStore((state) => state.textureMode)
  const hypsometricTextureUrl = useStore((state) => state.hypsometricTextureUrl)
  const showDsmSurface = useStore((state) => state.showDsmSurface)
  const measuredDsmGrid = useStore((state) => state.measuredDsmGrid)
  const measuredDtmGrid = useStore((state) => state.measuredDtmGrid)
  const activeColormap = useStore((state) => state.activeColormap)
  const measurementMode = useStore((state) => state.measurementMode)
  const addMeasurementPoint = useStore((state) => state.addMeasurementPoint)

  if (!sceneData || !layerVisibility.terrain) return null

  // Unique key to prevent Hook order mismatch during texture switching
  const activeKey = `${sceneData.image_url}_${textureMode}_${Boolean(hypsometricTextureUrl)}_${showDsmSurface}_${activeColormap}`

  return (
    <TerrainMeshInner
      key={activeKey}
      sceneData={sceneData}
      verticalExaggeration={verticalExaggeration}
      layerVisibility={layerVisibility}
      viewMode={viewMode}
      textureMode={textureMode}
      hypsometricTextureUrl={hypsometricTextureUrl}
      showDsmSurface={showDsmSurface}
      measuredDsmGrid={measuredDsmGrid}
      measuredDtmGrid={measuredDtmGrid}
      activeColormap={activeColormap}
      measurementMode={measurementMode}
      addMeasurementPoint={addMeasurementPoint}
    />
  )
}

