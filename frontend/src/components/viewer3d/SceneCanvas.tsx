import React, { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Volume2, VolumeX } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { TerrainMesh } from './TerrainMesh'
import { BuildingMeshes } from './BuildingMeshes'
import { VegetationObjects } from './VegetationObjects'
import { RoadNetwork } from './RoadNetwork'
import { CameraController } from './CameraController'
import { MeasurementOverlay3D } from './MeasurementOverlay3D'
import { GeoTwinOverlays3D } from './GeoTwinOverlays3D'
import { FlythroughController } from './FlythroughController'
import { SiheHeightLegend } from './SiheHeightLegend'
import { CanvasErrorBoundary } from '../common/CanvasErrorBoundary'

export const SceneCanvas: React.FC = () => {
  const sceneData = useStore((state) => state.sceneData)
  const sunAzimuth = useStore((state) => state.sunAzimuth)
  const sunElevation = useStore((state) => state.sunElevation)
  const layerVisibility = useStore((state) => state.layerVisibility)
  const selectFeature = useStore((state) => state.selectFeature)
  const isAutoRotating = useStore((state) => state.isAutoRotating)
  const flythroughActive = useStore((state) => state.flythroughActive)
  const setFlythroughActive = useStore((state) => state.setFlythroughActive)
  const routePickingMode = useStore((state) => state.routePickingMode)
  const setRoutePickingMode = useStore((state) => state.setRoutePickingMode)
  const networkPickingMode = useStore((state) => state.networkPickingMode)
  const setNetworkPickingMode = useStore((state) => state.setNetworkPickingMode)
  const floodPickingMode = useStore((state) => state.floodPickingMode)
  const setFloodPickingMode = useStore((state) => state.setFloodPickingMode)
  const earthquakePickingMode = useStore((state) => state.earthquakePickingMode)
  const setEarthquakePickingMode = useStore((state) => state.setEarthquakePickingMode)
  const voiceNarrationOnClick = useStore((state) => state.voiceNarrationOnClick)
  const toggleVoiceNarrationOnClick = useStore((state) => state.toggleVoiceNarrationOnClick)
  const isSpeaking = useStore((state) => state.voiceState.isSpeaking)

  // Compute sunlight position vector based on spherical coordinates (azimuth & elevation)
  const sunPosition = useMemo(() => {
    const phi = (90 - sunElevation) * (Math.PI / 180)
    const theta = (sunAzimuth + 180) * (Math.PI / 180)
    const radius = 400

    const x = radius * Math.sin(phi) * Math.sin(theta)
    const y = radius * Math.cos(phi)
    const z = radius * Math.sin(phi) * Math.cos(theta)

    return [x, Math.max(10, y), z] as [number, number, number]
  }, [sunAzimuth, sunElevation])

  const worldExtent = sceneData
    ? Math.max(sceneData.dimensions.width, sceneData.dimensions.height) * sceneData.gsd_m
    : 400

  return (
    <div className="w-full h-full relative bg-slate-950 overflow-hidden">
      <CanvasErrorBoundary>
        <Canvas
          shadows={layerVisibility.shadows ? { type: THREE.PCFShadowMap } : false}
          camera={{ position: [0, worldExtent * 0.7, worldExtent * 0.6], fov: 45, far: 12000 }}
          onPointerDown={(e) => {
            // If clicked directly on the canvas background, deselect
            if (e.target === e.currentTarget) {
              selectFeature(null)
            }
          }}
        >

        <Suspense fallback={null}>
          <color attach="background" args={['#0b1120']} />
          <ambientLight intensity={0.46} />
          <hemisphereLight args={['#f1f5f9', '#1e293b', 0.48]} />
          <directionalLight
            position={sunPosition}
            intensity={1.62}
            castShadow={layerVisibility.shadows}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={10}
            shadow-camera-far={1200}
            shadow-camera-left={-worldExtent * 0.8}
            shadow-camera-right={worldExtent * 0.8}
            shadow-camera-top={worldExtent * 0.8}
            shadow-camera-bottom={-worldExtent * 0.8}
            shadow-bias={-0.0002}
          />

          {!flythroughActive && <CameraController />}
          <FlythroughController />

          {/* 3D Reconstruction Layers */}
          {sceneData && (
            <>
              <TerrainMesh />
              <RoadNetwork />
              <BuildingMeshes />
              <VegetationObjects />
              <MeasurementOverlay3D />
              <GeoTwinOverlays3D />
            </>
          )}

          {/* Metric Ground Reference Grid (Positioned beneath 3D Terrain Plinth) */}
          <gridHelper
            args={[worldExtent * 1.4, 28, '#1e293b', '#0f172a']}
            position={[0, -4.3, 0]}
          />

          {/* Fully Flexible 360° Orbit from ALL Angles (Disabled when Flythrough active) */}
          <OrbitControls
            makeDefault
            enabled={!flythroughActive}
            enableDamping
            dampingFactor={0.05}
            minDistance={1}
            maxDistance={worldExtent * 6}
            minPolarAngle={0}
            maxPolarAngle={Math.PI}
            screenSpacePanning={true}
            autoRotate={isAutoRotating && !flythroughActive}
            autoRotateSpeed={1.5}
          />
        </Suspense>
      </Canvas>
    </CanvasErrorBoundary>

      {/* Floating 3D Voice Inspector Toggle Pill */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto">
        <button
          onClick={toggleVoiceNarrationOnClick}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono backdrop-blur-md shadow-lg transition-all cursor-pointer ${
            voiceNarrationOnClick
              ? 'bg-[#090d16]/90 border-emerald-500/80 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-[#0c1424]'
              : 'bg-[#090d16]/90 border-[#1e293b] text-[#94a3b8] hover:text-white hover:border-[#38bdf8]'
          }`}
          title="Toggle ElevenLabs Voice Agent to speak building height, dimensions, and features when clicking any building in the 3D scene"
        >
          {isSpeaking ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
          ) : voiceNarrationOnClick ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span className="font-semibold text-[11px]">Voice Inspector:</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
              voiceNarrationOnClick
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-[#1e293b] text-[#64748b]'
            }`}
          >
            {voiceNarrationOnClick ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Flythrough Active HUD Banner */}
      {flythroughActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-cyan-500/80 text-white px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-4 text-xs font-mono z-30 pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="font-bold text-cyan-300">WASD Flythrough Active</span>
          </div>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300">WASD: Move • Q/E: Altitude • Shift: Boost • Drag Mouse: Look</span>
          <button
            onClick={() => setFlythroughActive(false)}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-[11px] cursor-pointer"
          >
            Exit (Esc)
          </button>
        </div>
      )}

      {/* Route Interactive Point A / Point B Map-Picking Banner */}
      {routePickingMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-950/95 border-2 border-emerald-400 text-white px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-4 text-xs font-mono z-30 pointer-events-auto animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold text-emerald-300">
              {routePickingMode === 'A'
                ? '📍 Click on 3D Map to Place Point A (Start Origin)'
                : '🎯 Click on 3D Map to Place Point B (Target Destination)'}
            </span>
          </div>
          <button
            onClick={() => setRoutePickingMode(null)}
            className="px-2.5 py-1 rounded bg-emerald-800 hover:bg-emerald-700 text-white font-bold border border-emerald-500 text-[11px] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 5G/6G RF Interactive Tower & User Device Picking Banner */}
      {networkPickingMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-cyan-950/95 border-2 border-cyan-400 text-white px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-4 text-xs font-mono z-30 pointer-events-auto animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-bold text-cyan-200">
              {networkPickingMode === 'tower'
                ? '📡 Click on 3D City/Rooftop to Erect 5G/6G Cell Tower'
                : '📱 Click on 3D Map to Test User Device Signal & 3D Ray-Trace'}
            </span>
          </div>
          <button
            onClick={() => setNetworkPickingMode(null)}
            className="px-2.5 py-1 rounded bg-cyan-800 hover:bg-cyan-700 text-white font-bold border border-cyan-500 text-[11px] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Flood Region Height Sampling HUD Banner */}
      {floodPickingMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-sky-950/95 border-2 border-sky-400 text-white px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-4 text-xs font-mono z-30 pointer-events-auto animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
            <span className="font-bold text-sky-200">
              🌊 Click on any Terrain, Street, or Rooftop to Sample Region Height & Submergence
            </span>
          </div>
          <button
            onClick={() => setFloodPickingMode(false)}
            className="px-2.5 py-1 rounded bg-sky-800 hover:bg-sky-700 text-white font-bold border border-sky-500 text-[11px] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Earthquake Epicenter & Structural Stress Picking Banner */}
      {earthquakePickingMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-950/95 border-2 border-amber-400 text-white px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-4 text-xs font-mono z-30 pointer-events-auto animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="font-bold text-amber-200">
              🌋 Click on 3D Map to Position Epicenter / Inspect Building Structural Seismic Stress
            </span>
          </div>
          <button
            onClick={() => setEarthquakePickingMode(false)}
            className="px-2.5 py-1 rounded bg-amber-800 hover:bg-amber-700 text-white font-bold border border-amber-500 text-[11px] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Floating SIHE Height Legend & Calibrated Metrics */}
      <SiheHeightLegend />
    </div>
  )
}
export default SceneCanvas
