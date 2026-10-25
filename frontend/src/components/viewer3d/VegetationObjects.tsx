import React, { useMemo } from 'react'
import * as THREE from 'three'
import { ThreeEvent } from '@react-three/fiber'
import { useStore } from '../../store/useStore'
import { Vegetation3DInstance, TreeFeature } from '../../types'

interface SingleTreeProps {
  veg: Vegetation3DInstance
  feature: TreeFeature
  verticalExaggeration: number
  isSelected: boolean
  isHovered: boolean
  castShadows: boolean
  onSelect: (e: ThreeEvent<MouseEvent>) => void
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void
}

const SingleTree: React.FC<SingleTreeProps> = ({
  veg,
  feature,
  verticalExaggeration,
  isSelected,
  isHovered,
  castShadows,
  onSelect,
  onPointerOver,
  onPointerOut,
}) => {
  const [posX, posY, posZ] = veg.position
  const [scaleX, scaleY, scaleZ] = veg.scale
  const adjustedY = posY * verticalExaggeration

  const emissiveColor = isSelected
    ? '#06b6d4'
    : isHovered
    ? '#4ade80'
    : '#000000'

  const foliageColor = veg.foliage_color || '#15803d'
  const highlightFoliageColor = useMemo(() => {
    return new THREE.Color(foliageColor).lerp(new THREE.Color('#86efac'), 0.18).getStyle()
  }, [foliageColor])
  const deepFoliageColor = useMemo(() => {
    return new THREE.Color(foliageColor).lerp(new THREE.Color('#052e16'), 0.22).getStyle()
  }, [foliageColor])
  const emissiveIntensity = isSelected ? 0.45 : isHovered ? 0.22 : 0

  // Procedural multi-lobed 3D botanical tree geometry based on model type
  const renderTreeGeometry = () => {
    const crownRadius = Math.max(0.65, scaleX / 2)
    const totalHeight = Math.max(1.8, scaleY)
    const trunkHeight = totalHeight * 0.34
    const trunkRadius = Math.max(0.12, crownRadius * 0.14)
    const crownHeight = totalHeight - trunkHeight

    if (veg.model_type === 'conifer') {
      return (
        <group position={[0, trunkHeight, 0]}>
          {/* Trunk */}
          <mesh position={[0, -trunkHeight / 2, 0]} castShadow={castShadows}>
            <cylinderGeometry args={[trunkRadius * 0.65, trunkRadius * 1.15, trunkHeight, 8]} />
            <meshStandardMaterial color="#452a18" roughness={0.92} />
          </mesh>
          {/* 3-Tiered Layered Pine Canopy */}
          <mesh position={[0, crownHeight * 0.22, 0]} castShadow={castShadows} receiveShadow={castShadows}>
            <coneGeometry args={[crownRadius * 1.05, crownHeight * 0.52, 9]} />
            <meshStandardMaterial color={deepFoliageColor} emissive={emissiveColor} emissiveIntensity={emissiveIntensity} roughness={0.78} />
          </mesh>
          <mesh position={[0, crownHeight * 0.50, 0]} castShadow={castShadows} receiveShadow={castShadows}>
            <coneGeometry args={[crownRadius * 0.82, crownHeight * 0.48, 9]} />
            <meshStandardMaterial color={foliageColor} emissive={emissiveColor} emissiveIntensity={emissiveIntensity} roughness={0.74} />
          </mesh>
          <mesh position={[0, crownHeight * 0.78, 0]} castShadow={castShadows} receiveShadow={castShadows}>
            <coneGeometry args={[crownRadius * 0.55, crownHeight * 0.42, 8]} />
            <meshStandardMaterial color={highlightFoliageColor} emissive={emissiveColor} emissiveIntensity={emissiveIntensity} roughness={0.70} />
          </mesh>
        </group>
      )
    } else if (veg.model_type === 'palm') {
      return (
        <group position={[0, 0, 0]}>
          {/* Tapered Palm Trunk */}
          <mesh position={[0, totalHeight * 0.45, 0]} castShadow={castShadows}>
            <cylinderGeometry args={[trunkRadius * 0.75, trunkRadius * 1.3, totalHeight * 0.9, 8]} />
            <meshStandardMaterial color="#5c4428" roughness={0.9} />
          </mesh>
          {/* Radiating Palm Fronds Cluster */}
          <group position={[0, totalHeight * 0.88, 0]}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const ang = (i * Math.PI) / 3
              return (
                <mesh
                  key={i}
                  position={[Math.cos(ang) * crownRadius * 0.45, 0.1, Math.sin(ang) * crownRadius * 0.45]}
                  rotation={[Math.sin(ang) * 0.35, -ang, -Math.cos(ang) * 0.35]}
                  castShadow={castShadows}
                  receiveShadow={castShadows}
                >
                  <boxGeometry args={[crownRadius * 0.95, 0.14, crownRadius * 0.28]} />
                  <meshStandardMaterial
                    color={i % 2 === 0 ? foliageColor : highlightFoliageColor}
                    emissive={emissiveColor}
                    emissiveIntensity={emissiveIntensity}
                    roughness={0.65}
                  />
                </mesh>
              )
            })}
          </group>
        </group>
      )
    } else if (veg.model_type === 'shrub') {
      return (
        <group position={[0, totalHeight * 0.38, 0]}>
          <mesh castShadow={castShadows} receiveShadow={castShadows}>
            <dodecahedronGeometry args={[crownRadius * 0.85, 1]} />
            <meshStandardMaterial color={foliageColor} emissive={emissiveColor} emissiveIntensity={emissiveIntensity} roughness={0.82} />
          </mesh>
          <mesh position={[crownRadius * 0.42, -crownRadius * 0.1, crownRadius * 0.25]} castShadow={castShadows} receiveShadow={castShadows}>
            <dodecahedronGeometry args={[crownRadius * 0.62, 1]} />
            <meshStandardMaterial color={deepFoliageColor} emissive={emissiveColor} emissiveIntensity={emissiveIntensity} roughness={0.84} />
          </mesh>
          <mesh position={[-crownRadius * 0.38, -crownRadius * 0.08, -crownRadius * 0.3]} castShadow={castShadows} receiveShadow={castShadows}>
            <dodecahedronGeometry args={[crownRadius * 0.58, 1]} />
            <meshStandardMaterial color={highlightFoliageColor} emissive={emissiveColor} emissiveIntensity={emissiveIntensity} roughness={0.80} />
          </mesh>
        </group>
      )
    } else {
      // Multi-lobed Broadleaf Tree Crown
      return (
        <group position={[0, trunkHeight, 0]}>
          {/* Trunk */}
          <mesh position={[0, -trunkHeight / 2, 0]} castShadow={castShadows}>
            <cylinderGeometry args={[trunkRadius * 0.72, trunkRadius * 1.25, trunkHeight, 8]} />
            <meshStandardMaterial color="#4a3525" roughness={0.92} />
          </mesh>
          {/* Central Main Canopy Dome */}
          <mesh position={[0, crownRadius * 0.75, 0]} castShadow={castShadows} receiveShadow={castShadows}>
            <dodecahedronGeometry args={[crownRadius * 0.88, 1]} />
            <meshStandardMaterial
              color={foliageColor}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              roughness={0.76}
            />
          </mesh>
          {/* Upper Sunlit Crown Lobe */}
          <mesh position={[crownRadius * 0.14, crownRadius * 1.18, -crownRadius * 0.1]} castShadow={castShadows} receiveShadow={castShadows}>
            <dodecahedronGeometry args={[crownRadius * 0.64, 1]} />
            <meshStandardMaterial
              color={highlightFoliageColor}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              roughness={0.72}
            />
          </mesh>
          {/* Lateral Foliage Clusters */}
          <mesh position={[crownRadius * 0.45, crownRadius * 0.58, crownRadius * 0.28]} castShadow={castShadows} receiveShadow={castShadows}>
            <dodecahedronGeometry args={[crownRadius * 0.62, 1]} />
            <meshStandardMaterial
              color={deepFoliageColor}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              roughness={0.80}
            />
          </mesh>
          <mesh position={[-crownRadius * 0.44, crownRadius * 0.62, -crownRadius * 0.24]} castShadow={castShadows} receiveShadow={castShadows}>
            <dodecahedronGeometry args={[crownRadius * 0.60, 1]} />
            <meshStandardMaterial
              color={foliageColor}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              roughness={0.76}
            />
          </mesh>
          <mesh position={[-crownRadius * 0.22, crownRadius * 0.52, crownRadius * 0.46]} castShadow={castShadows} receiveShadow={castShadows}>
            <dodecahedronGeometry args={[crownRadius * 0.55, 1]} />
            <meshStandardMaterial
              color={highlightFoliageColor}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              roughness={0.74}
            />
          </mesh>
        </group>
      )
    }
  }

  return (
    <group
      position={[posX, adjustedY, posZ]}
      rotation={[0, veg.rotation_y, 0]}
      onClick={onSelect}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {renderTreeGeometry()}
    </group>
  )
}

interface VegetationObjectsInnerProps {
  vegetation_3d: Vegetation3DInstance[]
  trees: TreeFeature[]
  verticalExaggeration: number
  castShadows: boolean
  selectedFeatureId?: string
  hoveredFeatureId: string | null
  onSelectFeature: (feature: TreeFeature, targetPos: [number, number, number]) => void
  onHoverFeature: (id: string | null) => void
}

const VegetationObjectsInner: React.FC<VegetationObjectsInnerProps> = ({
  vegetation_3d,
  trees,
  verticalExaggeration,
  castShadows,
  selectedFeatureId,
  hoveredFeatureId,
  onSelectFeature,
  onHoverFeature,
}) => {
  const treeMap = useMemo(() => {
    const map = new Map<string, TreeFeature>()
    trees.forEach((t) => map.set(t.id, t))
    return map
  }, [trees])

  return (
    <group name="vegetation-layer">
      {vegetation_3d.map((v) => {
        const feature = treeMap.get(v.id)
        if (!feature) return null

        const isSelected = selectedFeatureId === v.id
        const isHovered = hoveredFeatureId === v.id

        return (
          <SingleTree
            key={v.id}
            veg={v}
            feature={feature}
            verticalExaggeration={verticalExaggeration}
            isSelected={isSelected}
            isHovered={isHovered}
            castShadows={castShadows}
            onSelect={(e) => {
              e.stopPropagation()
              onSelectFeature(feature, [
                v.position[0],
                v.position[1] * verticalExaggeration + v.scale[1] / 2,
                v.position[2],
              ])
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              onHoverFeature(v.id)
            }}
            onPointerOut={(e) => {
              e.stopPropagation()
              if (hoveredFeatureId === v.id) {
                onHoverFeature(null)
              }
            }}
          />
        )
      })}
    </group>
  )
}

export const VegetationObjects: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const verticalExaggeration = useStore((state) => state.verticalExaggeration)
  const layerVisibility = useStore((state) => state.layerVisibility)
  const selectedFeature = useStore((state) => state.selectedFeature)
  const hoveredFeatureId = useStore((state) => state.hoveredFeatureId)
  const selectFeature = useStore((state) => state.selectFeature)
  const setHoveredFeatureId = useStore((state) => state.setHoveredFeatureId)
  const setTargetFocusPosition = useStore((state) => state.setTargetFocusPosition)

  if (!sceneData || !layerVisibility.vegetation) return null

  return (
    <VegetationObjectsInner
      vegetation_3d={sceneData.vegetation_3d}
      trees={sceneData.trees}
      verticalExaggeration={verticalExaggeration}
      castShadows={layerVisibility.shadows}
      selectedFeatureId={selectedFeature?.id}
      hoveredFeatureId={hoveredFeatureId}
      onSelectFeature={(feature, targetPos) => {
        selectFeature({
          type: 'vegetation',
          id: feature.id,
          data: feature,
        })
        setTargetFocusPosition(targetPos)
      }}
      onHoverFeature={setHoveredFeatureId}
    />
  )
}

