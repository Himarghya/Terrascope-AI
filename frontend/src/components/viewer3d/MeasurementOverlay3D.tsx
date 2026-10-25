import React, { useMemo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useStore } from '../../store/useStore'

export const MeasurementOverlay3D: React.FC = () => {
  const measurements = useStore((state) => state.measurements)
  const activeMeasurementPoints = useStore((state) => state.activeMeasurementPoints)
  const verticalExaggeration = useStore((state) => state.verticalExaggeration)
  const sceneData = useStore((state) => state.sceneData)

  // Scale marker sizes proportionally to scene dimensions
  const markerRadius = useMemo(() => {
    if (!sceneData) return 1.5
    const maxDim = Math.max(sceneData.dimensions.width, sceneData.dimensions.height) * (sceneData.gsd_m || 0.35)
    return Math.max(1.2, maxDim / 200)
  }, [sceneData])

  return (
    <group>
      {/* Active Measurement in progress (Point A waiting for Point B) */}
      {activeMeasurementPoints.length === 1 && (
        <group position={[
          activeMeasurementPoints[0][0],
          activeMeasurementPoints[0][1] * verticalExaggeration,
          activeMeasurementPoints[0][2]
        ]}>
          {/* Vertical Pin Needle */}
          <mesh position={[0, markerRadius * 1.5, 0]}>
            <cylinderGeometry args={[markerRadius * 0.1, markerRadius * 0.1, markerRadius * 3, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Point A Glowing Sphere */}
          <mesh position={[0, markerRadius * 3, 0]}>
            <sphereGeometry args={[markerRadius, 24, 24]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#d97706"
              emissiveIntensity={1.0}
              roughness={0.2}
            />
          </mesh>
          {/* Outer Pulsing Ring */}
          <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[markerRadius * 1.2, markerRadius * 1.8, 32]} />
            <meshBasicMaterial color="#f59e0b" side={THREE.DoubleSide} transparent opacity={0.8} />
          </mesh>

          {/* Point A Billboard Label (Fixed Screen Pixel Size for Maximum Visibility) */}
          <Html position={[0, markerRadius * 4.5, 0]} center zIndexRange={[100, 0]}>
            <div className="bg-[#f59e0b] text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs font-mono shadow-2xl border-2 border-white flex items-center gap-1.5 whitespace-nowrap pointer-events-none select-none ring-4 ring-black/30 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
              <span>POINT A SELECTED (Click Point B to Measure)</span>
            </div>
          </Html>
        </group>
      )}

      {/* Completed measurements */}
      {measurements.map((m, idx) => {
        const pa: [number, number, number] = [
          m.point_a[0],
          m.point_a[1] * verticalExaggeration,
          m.point_a[2]
        ]
        const pb: [number, number, number] = [
          m.point_b[0],
          m.point_b[1] * verticalExaggeration,
          m.point_b[2]
        ]
        const mid: [number, number, number] = [
          (pa[0] + pb[0]) / 2.0,
          (pa[1] + pb[1]) / 2.0 + markerRadius * 2.5,
          (pa[2] + pb[2]) / 2.0
        ]

        // Build 3D measurement line geometry connecting pa and pb
        const lineGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(...pa),
          new THREE.Vector3(...pb)
        ])

        return (
          <group key={m.id}>
            {/* 3D Measurement Laser Line */}
            <primitive object={new THREE.Line(
              lineGeom,
              new THREE.LineBasicMaterial({
                color: 0xf59e0b,
                linewidth: 4,
                depthTest: true
              })
            )} />

            {/* Point A Pin (Vibrant Cyan Pin) */}
            <group position={pa}>
              <mesh position={[0, markerRadius * 1.5, 0]}>
                <cylinderGeometry args={[markerRadius * 0.1, markerRadius * 0.1, markerRadius * 3, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0, markerRadius * 3, 0]}>
                <sphereGeometry args={[markerRadius, 24, 24]} />
                <meshStandardMaterial
                  color="#38bdf8"
                  emissive="#0284c7"
                  emissiveIntensity={0.9}
                  roughness={0.2}
                />
              </mesh>
              <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[markerRadius * 0.8, markerRadius * 1.4, 32]} />
                <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.6} />
              </mesh>
            </group>

            {/* Point B Pin (Vibrant Orange Pin) */}
            <group position={pb}>
              <mesh position={[0, markerRadius * 1.5, 0]}>
                <cylinderGeometry args={[markerRadius * 0.1, markerRadius * 0.1, markerRadius * 3, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0, markerRadius * 3, 0]}>
                <sphereGeometry args={[markerRadius, 24, 24]} />
                <meshStandardMaterial
                  color="#f97316"
                  emissive="#c2410c"
                  emissiveIntensity={0.9}
                  roughness={0.2}
                />
              </mesh>
              <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[markerRadius * 0.8, markerRadius * 1.4, 32]} />
                <meshBasicMaterial color="#f97316" side={THREE.DoubleSide} transparent opacity={0.6} />
              </mesh>
            </group>

            {/* High-Visibility Midpoint Distance Badge (Fixed Pixel Size, Zero Distance Scaling) */}
            <Html position={mid} center zIndexRange={[100, 0]}>
              <div className="bg-slate-900/95 border-2 border-[#f59e0b] text-white px-3 py-1.5 rounded-lg text-xs font-mono shadow-2xl flex items-center gap-2 whitespace-nowrap pointer-events-none select-none ring-4 ring-black/40">
                <span className="px-1.5 py-0.5 rounded bg-[#f59e0b] text-slate-950 font-bold text-[10px]">
                  #{idx + 1}
                </span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-xs tracking-wider">
                      {m.horizontal_dist_m} m
                    </span>
                    <span className="text-[10px] text-slate-400 font-sans">horiz</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-300">
                    <span className="text-amber-400 font-semibold">
                      ΔZ: {m.delta_elev_m > 0 ? `+${m.delta_elev_m}` : m.delta_elev_m}m
                    </span>
                    <span>·</span>
                    <span className="text-cyan-400">
                      3D: {m.surface_dist_m ?? m.slope_dist_3d_m}m
                    </span>
                    <span>·</span>
                    <span className="text-slate-400">
                      {m.slope_deg ?? m.slope_angle_deg}°
                    </span>
                  </div>
                </div>
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

export default MeasurementOverlay3D
