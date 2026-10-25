import React, { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'

export const RoadNetwork: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const verticalExaggeration = useStore((state) => state.verticalExaggeration)
  const layerVisibility = useStore((state) => state.layerVisibility)

  const roads3D = sceneData?.roads_3d

  const geometry = useMemo(() => {
    if (!roads3D || !roads3D.vertices || !roads3D.faces || roads3D.faces.length === 0) {
      return null
    }

    const geom = new THREE.BufferGeometry()
    const rawVerts = roads3D.vertices
    const rawFaces = roads3D.faces

    const posArray = new Float32Array(rawFaces.length * 3 * 3)
    let pIdx = 0

    for (let f = 0; f < rawFaces.length; f++) {
      const face = rawFaces[f]
      for (let v = 0; v < 3; v++) {
        const vIdx = face[v]
        const vert = rawVerts[vIdx]
        if (vert) {
          posArray[pIdx++] = vert[0]
          // Apply vertical exaggeration plus small elevation bias (+0.04m) to drape over DEM without z-fighting
          posArray[pIdx++] = (vert[1] * verticalExaggeration) + 0.04
          posArray[pIdx++] = vert[2]
        }
      }
    }

    geom.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
    geom.computeVertexNormals()
    return geom
  }, [roads3D, verticalExaggeration])

  if (!roads3D || !layerVisibility.roads || !geometry) {
    return null
  }

  return (
    <group name="road-network-layer">
      <mesh
        geometry={geometry}
        receiveShadow={layerVisibility.shadows}
        castShadow={false}
      >
        <meshStandardMaterial
          color="#334155"
          roughness={0.85}
          metalness={0.12}
          transparent
          opacity={0.45}
          wireframe={layerVisibility.wireframe}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
