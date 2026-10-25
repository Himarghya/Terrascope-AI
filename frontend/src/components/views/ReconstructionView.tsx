import React, { useState, useRef } from 'react'
import {
  Box,
  Compass,
  Layers,
  Sun,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  ChevronDown,
  Navigation,
  Sliders,
  Eye,
  Grid,
  CheckSquare,
  Square,
  X,
  Palette,
  Activity,
  Ruler
} from 'lucide-react'
import { useStore, CameraPreset } from '../../store/useStore'
import { SceneCanvas } from '../viewer3d/SceneCanvas'
import { SatelliteViewer2D } from '../viewer2d/SatelliteViewer2D'

export const ReconstructionView: React.FC = () => {
  const viewMode = useStore((state) => state.viewMode)
  const cameraPreset = useStore((state) => state.cameraPreset)
  const setCameraPreset = useStore((state) => state.setCameraPreset)
  const isAutoRotating = useStore((state) => state.isAutoRotating)
  const toggleAutoRotate = useStore((state) => state.toggleAutoRotate)
  const layerVisibility = useStore((state) => state.layerVisibility)
  const toggleLayer = useStore((state) => state.toggleLayer)
  const verticalExaggeration = useStore((state) => state.verticalExaggeration)
  const setVerticalExaggeration = useStore((state) => state.setVerticalExaggeration)
  const sunAzimuth = useStore((state) => state.sunAzimuth)
  const sunElevation = useStore((state) => state.sunElevation)
  const setSunLighting = useStore((state) => state.setSunLighting)
  const sceneData = useStore((state) => state.sceneData)

  // Measure 3D State
  const measurementMode = useStore((state) => state.measurementMode)
  const setMeasurementMode = useStore((state) => state.setMeasurementMode)
  const measurements = useStore((state) => state.measurements)
  const clearMeasurements = useStore((state) => state.clearMeasurements)
  const activeMeasurementPoints = useStore((state) => state.activeMeasurementPoints)

  // Terra3D Shading & Surface State
  const textureMode = useStore((state) => state.textureMode)
  const setTextureMode = useStore((state) => state.setTextureMode)
  const showDsmSurface = useStore((state) => state.showDsmSurface)
  const toggleDsmSurface = useStore((state) => state.toggleDsmSurface)
  const isCyberpunkCityMode = useStore((state) => state.isCyberpunkCityMode)
  const setIsCyberpunkCityMode = useStore((state) => state.setIsCyberpunkCityMode)

  const [anglesMenuOpen, setAnglesMenuOpen] = useState(false)
  const [layersMenuOpen, setLayersMenuOpen] = useState(false)
  const [lightingMenuOpen, setLightingMenuOpen] = useState(false)
  const [textureMenuOpen, setTextureMenuOpen] = useState(false)
  const [showNavHelp, setShowNavHelp] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)


  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true))
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }

  const layersList: { key: keyof typeof layerVisibility; label: string; count?: number }[] = [
    { key: 'terrain', label: 'Terrain Relief Mesh' },
    { key: 'buildings', label: '3D Extruded Buildings', count: sceneData?.buildings.length },
    { key: 'vegetation', label: 'Vegetation & Tree Canopies', count: sceneData?.trees.length },
    { key: 'roads', label: 'Roads & Paved Surfaces' },
    { key: 'water', label: 'Water Reservoirs & Basins' },
    { key: 'shadows', label: 'Directional Solar Shadows' },
    { key: 'wireframe', label: 'Polygonal Wireframe' },
  ]

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-[#111614] overflow-hidden flex select-none"
    >
      {/* Central Viewport */}
      {viewMode === 'split' ? (
        <div className="w-full h-full flex">
          <div className="w-1/2 h-full border-r border-[#DCE2DC]/30 relative bg-[#F5F6F3]">
            <SatelliteViewer2D />
            <div className="absolute top-3 left-3 bg-[#FFFFFF]/90 backdrop-blur-sm border border-[#DCE2DC] px-2 py-0.5 rounded text-[10px] font-mono text-[#286653] font-semibold pointer-events-none shadow-sm">
              2D ORTHORECTIFIED IMAGERY
            </div>
          </div>
          <div className="w-1/2 h-full relative">
            <SceneCanvas />
            <div className="absolute top-3 left-3 bg-[#17231F]/80 backdrop-blur-sm border border-[#DCE2DC]/30 px-2 py-0.5 rounded text-[10px] font-mono text-white font-semibold pointer-events-none shadow-sm">
              INTERACTIVE 3D RECONSTRUCTION
            </div>
          </div>
        </div>
      ) : viewMode === 'satellite' ? (
        <div className="w-full h-full bg-[#F5F6F3]">
          <SatelliteViewer2D />
        </div>
      ) : viewMode === 'classification' ? (
        <div className="w-full h-full bg-[#F5F6F3]">
          <SatelliteViewer2D forceMode="classification" />
        </div>
      ) : (
        <SceneCanvas />
      )}

      {/* Compact Docked Scene Toolbar (Top-Left overlay) */}
      {(viewMode === '3d' || viewMode === 'sihe' || viewMode === 'split') && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-[#FFFFFF]/95 backdrop-blur-sm border border-[#DCE2DC] p-1 rounded shadow-md text-xs font-mono">
          {/* Flexible Camera Angles Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setAnglesMenuOpen(!anglesMenuOpen)
                setLayersMenuOpen(false)
                setLightingMenuOpen(false)
              }}
              title="Select Camera View Angle"
              className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                anglesMenuOpen
                  ? 'bg-[#E8EFEA] text-[#286653] font-semibold'
                  : 'text-[#68736D] hover:text-[#17231F]'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-[#286653] stroke-[1.75]" />
              <span className="capitalize">{cameraPreset}</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {anglesMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-60 bg-[#FFFFFF] border border-[#DCE2DC] rounded shadow-lg p-1.5 z-30 font-sans text-xs space-y-0.5">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#68736D] border-b border-[#DCE2DC] mb-1 flex items-center justify-between">
                  <span>Camera Orientations</span>
                  <span className="text-[9px] text-[#286653] font-mono">360° Free</span>
                </div>
                <button
                  onClick={() => { setCameraPreset('perspective'); setAnglesMenuOpen(false) }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    cameraPreset === 'perspective' ? 'bg-[#E8EFEA] text-[#286653] font-medium' : 'hover:bg-[#F5F6F3] text-[#17231F]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-[#286653]" />
                    <span>Isometric Aerial (45°)</span>
                  </span>
                  <span className="text-[10px] text-[#68736D] font-mono">Aerial</span>
                </button>
                <button
                  onClick={() => { setCameraPreset('top'); setAnglesMenuOpen(false) }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    cameraPreset === 'top' ? 'bg-[#E8EFEA] text-[#286653] font-medium' : 'hover:bg-[#F5F6F3] text-[#17231F]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 text-center font-bold text-xs text-[#286653]">⬇</span>
                    <span>Nadir (Top-Down Ortho)</span>
                  </span>
                  <span className="text-[10px] text-[#68736D] font-mono">90°</span>
                </button>
                <button
                  onClick={() => { setCameraPreset('north'); setAnglesMenuOpen(false) }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    cameraPreset === 'north' ? 'bg-[#E8EFEA] text-[#286653] font-medium' : 'hover:bg-[#F5F6F3] text-[#17231F]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 text-center font-bold text-xs text-[#426B8A]">N</span>
                    <span>North Elevation (Face N)</span>
                  </span>
                  <span className="text-[10px] text-[#68736D] font-mono">0° N</span>
                </button>
                <button
                  onClick={() => { setCameraPreset('east'); setAnglesMenuOpen(false) }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    cameraPreset === 'east' ? 'bg-[#E8EFEA] text-[#286653] font-medium' : 'hover:bg-[#F5F6F3] text-[#17231F]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 text-center font-bold text-xs text-[#426B8A]">E</span>
                    <span>East Elevation (Face E)</span>
                  </span>
                  <span className="text-[10px] text-[#68736D] font-mono">90° E</span>
                </button>
                <button
                  onClick={() => { setCameraPreset('south'); setAnglesMenuOpen(false) }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    cameraPreset === 'south' ? 'bg-[#E8EFEA] text-[#286653] font-medium' : 'hover:bg-[#F5F6F3] text-[#17231F]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 text-center font-bold text-xs text-[#426B8A]">S</span>
                    <span>South Elevation (Face S)</span>
                  </span>
                  <span className="text-[10px] text-[#68736D] font-mono">180° S</span>
                </button>
                <button
                  onClick={() => { setCameraPreset('west'); setAnglesMenuOpen(false) }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    cameraPreset === 'west' ? 'bg-[#E8EFEA] text-[#286653] font-medium' : 'hover:bg-[#F5F6F3] text-[#17231F]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 text-center font-bold text-xs text-[#426B8A]">W</span>
                    <span>West Elevation (Face W)</span>
                  </span>
                  <span className="text-[10px] text-[#68736D] font-mono">270° W</span>
                </button>
                <button
                  onClick={() => { setCameraPreset('ground'); setAnglesMenuOpen(false) }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    cameraPreset === 'ground' ? 'bg-[#E8EFEA] text-[#286653] font-medium' : 'hover:bg-[#F5F6F3] text-[#17231F]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-[#286653]" />
                    <span>Ground-Level Eye Height</span>
                  </span>
                  <span className="text-[10px] text-[#68736D] font-mono">Surface</span>
                </button>
                <button
                  onClick={() => { setCameraPreset('under'); setAnglesMenuOpen(false) }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    cameraPreset === 'under' ? 'bg-[#E8EFEA] text-[#286653] font-medium' : 'hover:bg-[#F5F6F3] text-[#17231F]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 text-center font-bold text-xs text-[#B7791F]">⬆</span>
                    <span>Sub-Surface / Low Tilt</span>
                  </span>
                  <span className="text-[10px] text-[#68736D] font-mono">Tilt Up</span>
                </button>
                <button
                  onClick={() => { setCameraPreset('side'); setAnglesMenuOpen(false) }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    cameraPreset === 'side' ? 'bg-[#E8EFEA] text-[#286653] font-medium' : 'hover:bg-[#F5F6F3] text-[#17231F]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 text-center font-bold text-xs">━</span>
                    <span>Horizon Side Profile</span>
                  </span>
                  <span className="text-[10px] text-[#68736D] font-mono">Side</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Preset Access Pills */}
          <button
            onClick={() => setCameraPreset('perspective')}
            title="Isometric 45° Perspective"
            className={`px-1.5 py-1 rounded text-[11px] transition-colors cursor-pointer ${
              cameraPreset === 'perspective'
                ? 'bg-[#E8EFEA] text-[#286653] font-semibold'
                : 'text-[#68736D] hover:text-[#17231F]'
            }`}
          >
            45°
          </button>
          <button
            onClick={() => setCameraPreset('top')}
            title="Nadir 90° Top-Down Ortho"
            className={`px-1.5 py-1 rounded text-[11px] transition-colors cursor-pointer ${
              cameraPreset === 'top'
                ? 'bg-[#E8EFEA] text-[#286653] font-semibold'
                : 'text-[#68736D] hover:text-[#17231F]'
            }`}
          >
            Nadir
          </button>
          <button
            onClick={() => setCameraPreset('ground')}
            title="Ground / Street Level Eye View"
            className={`px-1.5 py-1 rounded text-[11px] transition-colors cursor-pointer ${
              cameraPreset === 'ground'
                ? 'bg-[#E8EFEA] text-[#286653] font-semibold'
                : 'text-[#68736D] hover:text-[#17231F]'
            }`}
          >
            Ground
          </button>

          {/* 360° Turntable Auto-Tour */}
          <button
            onClick={toggleAutoRotate}
            title={isAutoRotating ? 'Pause 360° Turntable' : 'Start Smooth 360° Turntable Tour'}
            className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 transition-colors border-l border-[#DCE2DC] pl-2 cursor-pointer ${
              isAutoRotating
                ? 'bg-[#E8EFEA] text-[#286653] font-semibold'
                : 'text-[#68736D] hover:text-[#17231F]'
            }`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isAutoRotating ? 'animate-spin text-[#286653]' : ''}`} />
            <span className="font-sans">360° Tour</span>
          </button>

          {/* Reset Camera */}
          <button
            onClick={() => setCameraPreset('reset')}
            title="Reset Camera to Default Perspective"
            className="p-1 rounded text-[#68736D] hover:text-[#17231F] hover:bg-[#F5F6F3] transition-colors border-l border-[#DCE2DC] pl-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Separator */}
          <div className="w-px h-4 bg-[#DCE2DC]" />

          {/* Prominent Measure 3D Button */}
          <button
            onClick={() => setMeasurementMode(!measurementMode)}
            title="Measure 3D: Click any two points in the scene for metric distance & elevation relief"
            className={`px-2.5 py-1 rounded text-[11px] font-sans flex items-center gap-1.5 transition-all border cursor-pointer ${
              measurementMode
                ? 'bg-[#f59e0b] border-[#d97706] text-slate-950 font-bold ring-2 ring-[#f59e0b]/40 shadow-sm animate-pulse'
                : measurements.length > 0
                ? 'bg-[#E8EFEA] border-[#286653] text-[#286653] font-semibold'
                : 'bg-white hover:bg-[#F5F6F3] border-[#DCE2DC] text-[#17231F] font-medium'
            }`}
          >
            <Ruler className={`w-3.5 h-3.5 ${measurementMode ? 'text-slate-950 stroke-[2.5]' : 'text-[#286653]'}`} />
            <span>{measurementMode ? 'Measuring Mode' : 'Measure 3D'}</span>
            {measurements.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                measurementMode ? 'bg-slate-950 text-amber-400' : 'bg-[#286653] text-white'
              }`}>
                {measurements.length}
              </span>
            )}
          </button>

          {/* Separator */}
          <div className="w-px h-4 bg-[#DCE2DC]" />

          {/* Layer Visibility Toggle */}
          <div className="relative">
            <button
              onClick={() => {
                setLayersMenuOpen(!layersMenuOpen)
                setLightingMenuOpen(false)
              }}
              title="Toggle Layer Visibility"
              className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 transition-colors ${
                layersMenuOpen
                  ? 'bg-[#E8EFEA] text-[#286653] font-semibold'
                  : 'text-[#68736D] hover:text-[#17231F]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 stroke-[1.75]" />
              <span className="font-sans">Layers</span>
            </button>

            {layersMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-60 bg-[#FFFFFF] border border-[#DCE2DC] rounded shadow-lg p-3 z-30 font-sans text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-[#DCE2DC] pb-1.5 font-semibold text-[11px] text-[#17231F] uppercase tracking-wide">
                  <span>Scene Layers</span>
                  <button onClick={() => setLayersMenuOpen(false)} className="text-[#68736D] hover:text-[#17231F]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {layersList.map((layer) => {
                    const active = layerVisibility[layer.key]
                    return (
                      <div
                        key={layer.key}
                        onClick={() => toggleLayer(layer.key)}
                        className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[#F5F6F3] cursor-pointer"
                      >
                        <span className="text-[11px] text-[#17231F]">{layer.label}</span>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 rounded accent-[#286653] cursor-pointer"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Terra3D Texture Shading Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setTextureMenuOpen(!textureMenuOpen)
                setAnglesMenuOpen(false)
                setLayersMenuOpen(false)
                setLightingMenuOpen(false)
              }}
              title="Texture Shading & Contour Baking"
              className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer border-l border-[#DCE2DC] pl-2 ${
                textureMenuOpen
                  ? 'bg-[#E8EFEA] text-[#286653] font-semibold'
                  : 'text-[#68736D] hover:text-[#17231F]'
              }`}
            >
              <Palette className="w-3.5 h-3.5 text-[#286653] stroke-[1.75]" />
              <span className="font-sans capitalize">
                {textureMode === 'sat'
                  ? 'Satellite'
                  : textureMode === 'hyp'
                  ? 'Contours'
                  : textureMode === 'lc'
                  ? 'Land Cover'
                  : 'SIHE Height'}
              </span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {textureMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-60 bg-[#FFFFFF] border border-[#DCE2DC] rounded shadow-lg p-1.5 z-30 font-sans text-xs space-y-0.5">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#68736D] border-b border-[#DCE2DC] mb-1">
                  Surface Shading & Contours
                </div>
                <button
                  onClick={() => {
                    setTextureMode('sat')
                    setTextureMenuOpen(false)
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    textureMode === 'sat'
                      ? 'bg-[#E8EFEA] text-[#286653] font-medium'
                      : 'hover:bg-[#F5F6F3] text-[#17231F]'
                  }`}
                >
                  <span>Satellite Orthophoto</span>
                  <span className="text-[10px] text-[#68736D] font-mono">RGB</span>
                </button>
                <button
                  onClick={() => {
                    setTextureMode('hyp')
                    setTextureMenuOpen(false)
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    textureMode === 'hyp'
                      ? 'bg-[#E8EFEA] text-[#286653] font-medium'
                      : 'hover:bg-[#F5F6F3] text-[#17231F]'
                  }`}
                >
                  <span>Hypsometric + 5m Contours</span>
                  <span className="text-[10px] text-[#286653] font-mono">Relief</span>
                </button>
                <button
                  onClick={() => {
                    setTextureMode('lc')
                    setTextureMenuOpen(false)
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    textureMode === 'lc'
                      ? 'bg-[#E8EFEA] text-[#286653] font-medium'
                      : 'hover:bg-[#F5F6F3] text-[#17231F]'
                  }`}
                >
                  <span>Thematic Land Cover</span>
                  <span className="text-[10px] text-[#68736D] font-mono">Classes</span>
                </button>
                <button
                  onClick={() => {
                    setTextureMode('sihe')
                    setTextureMenuOpen(false)
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    textureMode === 'sihe'
                      ? 'bg-[#E8EFEA] text-[#286653] font-medium'
                      : 'hover:bg-[#F5F6F3] text-[#17231F]'
                  }`}
                >
                  <span>SIHE Relative Height Map</span>
                  <span className="text-[10px] text-[#B7791F] font-mono">Heatmap</span>
                </button>
              </div>
            )}
          </div>

          {/* Direct 1-Click Solar Shadows Quick Toggle */}
          <button
            onClick={() => toggleLayer('shadows')}
            title={
              layerVisibility.shadows
                ? 'Directional Solar Shadows Active (Click to remove shadow regions)'
                : 'Shadows Disabled (Click to enable directional solar shadows)'
            }
            className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer border-l border-[#DCE2DC] pl-2 ${
              layerVisibility.shadows
                ? 'bg-[#E8EFEA] text-[#286653] font-semibold'
                : 'text-[#68736D] hover:text-[#17231F]'
            }`}
          >
            <Sun className={`w-3.5 h-3.5 ${layerVisibility.shadows ? 'text-[#286653]' : 'text-[#68736D]'}`} />
            <span className="font-sans">{layerVisibility.shadows ? 'Shadows: On' : 'Shadows: Off'}</span>
          </button>

          {/* Terra3D Continuous DSM Surface Mode Switch */}
          <button
            onClick={() => toggleDsmSurface()}
            title={
              showDsmSurface
                ? 'Active: Continuous DSM Surface Mesh (Click for Bare-Earth DTM + 3D Building Geometry)'
                : 'Click to view Continuous DSM Surface Mesh (Canopy & Roof Elevations)'
            }
            className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 transition-colors border-l border-[#DCE2DC] pl-2 cursor-pointer ${
              showDsmSurface
                ? 'bg-[#286653] text-white font-semibold shadow-sm'
                : 'text-[#68736D] hover:text-[#17231F]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 stroke-[1.75]" />
            <span className="font-sans">DSM Surface</span>
          </button>

          {/* Cyberpunk 2077 / AAA Game-Ready Procedural City Toggle */}
          <button
            onClick={() => setIsCyberpunkCityMode(!isCyberpunkCityMode)}
            title={
              isCyberpunkCityMode
                ? 'Cyberpunk / Game-Ready Mode Active (Modular Sub-Meshes, Neon Signs, Spires, HVAC, Conduits)'
                : 'Enable Cyberpunk 2077 AAA Game-Ready Modular Details (Glowing Neon, Rooftop Helipads/Antennas, Industrial Ducts)'
            }
            className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 transition-colors border-l border-[#DCE2DC] pl-2 cursor-pointer ${
              isCyberpunkCityMode
                ? 'bg-gradient-to-r from-pink-600 to-cyan-600 text-white font-semibold shadow-sm'
                : 'text-[#68736D] hover:text-[#17231F]'
            }`}
          >
            <Box className="w-3.5 h-3.5 stroke-[1.75]" />
            <span className="font-sans">Cyberpunk 3D</span>
          </button>

          {/* Solar & Relief Exaggeration Trigger */}
          <div className="relative">
            <button
              onClick={() => {
                setLightingMenuOpen(!lightingMenuOpen)
                setLayersMenuOpen(false)
              }}
              title="Sun Position & Relief Exaggeration"
              className={`p-1 rounded transition-colors ${
                lightingMenuOpen
                  ? 'bg-[#E8EFEA] text-[#286653]'
                  : 'text-[#68736D] hover:text-[#17231F]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 stroke-[1.75]" />
            </button>

            {lightingMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-64 bg-[#FFFFFF] border border-[#DCE2DC] rounded shadow-lg p-3 z-30 font-sans text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-[#DCE2DC] pb-1.5 font-semibold text-[11px] text-[#17231F] uppercase tracking-wide">
                  <span>Relief & Lighting</span>
                  <button onClick={() => setLightingMenuOpen(false)} className="text-[#68736D] hover:text-[#17231F]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Vertical Relief Slider */}
                <div>
                  <div className="flex justify-between text-[11px] text-[#68736D] mb-1">
                    <span>Vertical Exaggeration</span>
                    <span className="font-mono text-[#286653] font-semibold">{verticalExaggeration.toFixed(1)}×</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="4.0"
                    step="0.1"
                    value={verticalExaggeration}
                    onChange={(e) => setVerticalExaggeration(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#DCE2DC] rounded appearance-none cursor-pointer accent-[#286653]"
                  />
                </div>

                {/* Sun Azimuth Slider */}
                <div>
                  <div className="flex justify-between text-[11px] text-[#68736D] mb-1">
                    <span>Sun Azimuth</span>
                    <span className="font-mono text-[#17231F]">{sunAzimuth}° N</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={sunAzimuth}
                    onChange={(e) => setSunLighting(parseFloat(e.target.value), sunElevation)}
                    className="w-full h-1 bg-[#DCE2DC] rounded appearance-none cursor-pointer accent-[#286653]"
                  />
                </div>

                {/* Sun Elevation Slider */}
                <div>
                  <div className="flex justify-between text-[11px] text-[#68736D] mb-1">
                    <span>Sun Elevation</span>
                    <span className="font-mono text-[#17231F]">{sunElevation}°</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="85"
                    step="2"
                    value={sunElevation}
                    onChange={(e) => setSunLighting(sunAzimuth, parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#DCE2DC] rounded appearance-none cursor-pointer accent-[#286653]"
                  />
                </div>

                {/* Directional Solar Shadows Checkbox */}
                <div className="pt-2 border-t border-[#DCE2DC] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-[#17231F] block">Directional Solar Shadows</span>
                    <span className="text-[10px] text-[#68736D]">Toggle ground & building cast shadows</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={layerVisibility.shadows}
                    onChange={() => toggleLayer('shadows')}
                    className="w-3.5 h-3.5 rounded accent-[#286653] cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="p-1 rounded text-[#68736D] hover:text-[#17231F] hover:bg-[#F5F6F3] transition-colors border-l border-[#DCE2DC] pl-1.5"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* Floating 360° Orbit Navigation Tips Badge */}
      {showNavHelp && (viewMode === '3d' || viewMode === 'sihe' || viewMode === 'split') && (
        <div className="absolute bottom-4 left-4 z-10 bg-[#FFFFFF]/92 backdrop-blur-sm border border-[#DCE2DC] px-2.5 py-1.5 rounded shadow-sm flex items-center gap-2.5 text-[10px] text-[#68736D] font-mono select-none">
          <span className="flex items-center gap-1 text-[#286653] font-sans font-medium">
            <Compass className="w-3.5 h-3.5" />
            <span>360° Free Angles</span>
          </span>
          <span className="hidden md:inline text-[#DCE2DC]">|</span>
          <span className="hidden md:inline">Left-Drag: <strong className="text-[#17231F] font-sans">Orbit Any Angle</strong></span>
          <span className="hidden md:inline text-[#DCE2DC]">|</span>
          <span className="hidden md:inline">Right-Drag: <strong className="text-[#17231F] font-sans">Pan</strong></span>
          <span className="hidden md:inline text-[#DCE2DC]">|</span>
          <span className="hidden md:inline">Scroll: <strong className="text-[#17231F] font-sans">Zoom</strong></span>
          <button
            onClick={() => setShowNavHelp(false)}
            className="text-[#68736D] hover:text-[#17231F] ml-1 p-0.5 cursor-pointer"
            title="Dismiss navigation tips"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Floating 3D Metric Measurements HUD Card */}
      {(measurementMode || measurements.length > 0) && (
        <div className="absolute top-16 right-4 z-20 max-w-xs w-80 bg-[#FFFFFF]/95 backdrop-blur-md border-2 border-[#f59e0b] rounded-xl shadow-2xl overflow-hidden font-sans text-xs animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 bg-[#fef3c7] border-b border-[#fde68a] text-[#92400e] flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <Ruler className="w-4 h-4 text-[#d97706]" />
              <span>3D Metric Measurements</span>
              {measurements.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#f59e0b] text-slate-950 font-mono text-[10px] font-bold">
                  {measurements.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {measurements.length > 0 && (
                <button
                  type="button"
                  onClick={clearMeasurements}
                  className="text-[10px] font-medium text-[#dc2626] hover:underline cursor-pointer px-1 py-0.5"
                  title="Clear all recorded measurements"
                >
                  Clear All
                </button>
              )}
              <button
                type="button"
                onClick={() => setMeasurementMode(false)}
                className="text-[#92400e] hover:text-black p-0.5 rounded cursor-pointer"
                title="Close measurement tool"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {measurementMode && (
            <div className="p-3 bg-[#fffbeb] border-b border-[#fde68a] text-[11px] text-[#b45309] flex items-start gap-2.5 leading-relaxed">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] animate-ping shrink-0 mt-1" />
              <div>
                {activeMeasurementPoints.length === 0 ? (
                  <p>
                    <strong>Click Point A</strong> on any 3D terrain surface, road corridor, or building rooftop.
                  </p>
                ) : (
                  <p className="text-[#92400e]">
                    <strong>Point A locked!</strong> Click <strong>Point B</strong> to instantly measure 3D Euclidean distance and vertical height difference.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Recorded Measurements List */}
          {measurements.length > 0 ? (
            <div className="max-h-56 overflow-y-auto p-2.5 space-y-2 divide-y divide-[#DCE2DC]">
              {measurements.map((m, idx) => (
                <div key={m.id} className="pt-2 first:pt-0 font-mono text-xs">
                  <div className="flex items-center justify-between text-[#17231F]">
                    <span className="font-bold text-[#286653] flex items-center gap-1">
                      <span className="px-1 py-0.2 rounded bg-[#E8EFEA] text-[10px]">#{idx + 1}</span>
                      <span>Line {m.id}</span>
                    </span>
                    <span className="font-bold text-sm text-[#17231F]">
                      {m.horizontal_dist_m} m <span className="text-[10px] text-[#68736D] font-normal">horiz</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-[#68736D] mt-1 bg-[#F5F6F3] p-1.5 rounded border border-[#DCE2DC]">
                    <div>
                      Slope 3D: <strong className="text-[#17231F]">{m.surface_dist_m ?? m.slope_dist_3d_m}m</strong>
                    </div>
                    <div>
                      Relief ΔZ:{' '}
                      <strong className="text-[#286653]">
                        {m.delta_elev_m > 0 ? `+${m.delta_elev_m}` : m.delta_elev_m}m
                      </strong>
                    </div>
                    <div>
                      Slope Angle: <strong className="text-[#17231F]">{m.slope_deg ?? m.slope_angle_deg}°</strong>
                    </div>
                    <div>
                      Grade: <strong className="text-[#17231F]">{m.slope_pct ?? Math.round(Math.tan(((m.slope_deg ?? 0) * Math.PI) / 180) * 100)}%</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !measurementMode ? (
            <div className="p-3 text-center text-[#68736D] text-[11px]">
              No measurements recorded yet. Click <strong>Measure 3D</strong> to begin.
            </div>
          ) : null}
        </div>
      )}
    </div>

  )
}
