import React, { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'

export const CameraController: React.FC = () => {
  const { camera, controls } = useThree()

  const cameraPreset = useStore((state) => state.cameraPreset)
  const targetFocusPosition = useStore((state) => state.targetFocusPosition)
  const sceneData = useStore((state) => state.sceneData)

  const isTransitioning = useRef(false)
  const targetCamPos = useRef(new THREE.Vector3())
  const targetLookAt = useRef(new THREE.Vector3())

  // Calculate default bounds
  const sceneRadius = sceneData
    ? Math.max(sceneData.dimensions.width, sceneData.dimensions.height) * sceneData.gsd_m * 0.75
    : 250

  // Interrupt camera animation immediately if user starts manual orbit or pan
  useEffect(() => {
    const activeControls = controls as unknown as OrbitControlsImpl
    if (!activeControls) return
    const onStart = () => {
      isTransitioning.current = false
    }
    activeControls.addEventListener('start', onStart)
    return () => {
      activeControls.removeEventListener('start', onStart)
    }
  }, [controls])

  useEffect(() => {
    if (camera && 'far' in camera) {
      const pCam = camera as THREE.PerspectiveCamera
      if (pCam.far < 12000) {
        pCam.far = 12000
        pCam.updateProjectionMatrix()
      }
    }
  }, [camera])

  useEffect(() => {
    if (!sceneData) return

    isTransitioning.current = true
    targetLookAt.current.set(0, 0, 0)

    if (cameraPreset === 'top') {
      // Nadir 90° straight down
      targetCamPos.current.set(0, sceneRadius * 1.5, 0.001)
      targetLookAt.current.set(0, 0, 0)
    } else if (cameraPreset === 'north') {
      // North Elevation (From South looking North)
      targetCamPos.current.set(0, sceneRadius * 0.4, sceneRadius * 1.35)
    } else if (cameraPreset === 'south') {
      // South Elevation (From North looking South)
      targetCamPos.current.set(0, sceneRadius * 0.4, -sceneRadius * 1.35)
    } else if (cameraPreset === 'east') {
      // East Elevation (From West looking East)
      targetCamPos.current.set(-sceneRadius * 1.35, sceneRadius * 0.4, 0)
    } else if (cameraPreset === 'west') {
      // West Elevation (From East looking West)
      targetCamPos.current.set(sceneRadius * 1.35, sceneRadius * 0.4, 0)
    } else if (cameraPreset === 'ground') {
      // Street / Ground level view: close to surface, looking across and slightly up
      targetCamPos.current.set(sceneRadius * 0.4, 8, sceneRadius * 0.4)
      targetLookAt.current.set(0, 15, 0)
    } else if (cameraPreset === 'under') {
      // Underneath / Sub-surface upward angle
      targetCamPos.current.set(sceneRadius * 0.5, -sceneRadius * 0.6, sceneRadius * 0.5)
      targetLookAt.current.set(0, 5, 0)
    } else if (cameraPreset === 'side') {
      // Horizon flat side profile
      targetCamPos.current.set(0, sceneRadius * 0.12, sceneRadius * 1.35)
    } else if (cameraPreset === 'perspective' || cameraPreset === 'reset') {
      // Classic 45° oblique perspective
      targetCamPos.current.set(sceneRadius * 0.35, sceneRadius * 0.65, sceneRadius * 0.65)
      targetLookAt.current.set(0, 0, 0)
    }
  }, [cameraPreset, sceneData, sceneRadius])

  // React to feature selection focus
  useEffect(() => {
    if (targetFocusPosition) {
      isTransitioning.current = true
      const [fx, fy, fz] = targetFocusPosition
      targetLookAt.current.set(fx, fy, fz)
      // Position camera offset from feature
      targetCamPos.current.set(fx + 35, fy + 30, fz + 35)
    }
  }, [targetFocusPosition])

  useFrame(() => {
    if (isTransitioning.current) {
      camera.position.lerp(targetCamPos.current, 0.08)

      const activeControls = controls as unknown as OrbitControlsImpl
      if (activeControls) {
        activeControls.target.lerp(targetLookAt.current, 0.08)
        activeControls.update()
      }

      if (
        camera.position.distanceTo(targetCamPos.current) < 0.5 &&
        (!activeControls || activeControls.target.distanceTo(targetLookAt.current) < 0.5)
      ) {
        isTransitioning.current = false
      }
    }
  })

  return null
}

