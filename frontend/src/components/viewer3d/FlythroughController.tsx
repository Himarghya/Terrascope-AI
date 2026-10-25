import React, { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'

export const FlythroughController: React.FC = () => {
  const { camera } = useThree()
  const flythroughActive = useStore((state) => state.flythroughActive)
  const setFlythroughActive = useStore((state) => state.setFlythroughActive)

  const keys = useRef<{ [key: string]: boolean }>({})
  const mouseState = useRef<{ isDragging: boolean; prevX: number; prevY: number }>({
    isDragging: false,
    prevX: 0,
    prevY: 0,
  })

  useEffect(() => {
    if (!flythroughActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true
      if (e.code === 'Escape') {
        setFlythroughActive(false)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        mouseState.current.isDragging = true
        mouseState.current.prevX = e.clientX
        mouseState.current.prevY = e.clientY
      }
    }

    const handleMouseUp = () => {
      mouseState.current.isDragging = false
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseState.current.isDragging) return
      const dx = e.clientX - mouseState.current.prevX
      const dy = e.clientY - mouseState.current.prevY
      mouseState.current.prevX = e.clientX
      mouseState.current.prevY = e.clientY

      const rotSpeed = 0.003
      // Yaw around global Y
      camera.rotation.order = 'YXZ'
      camera.rotation.y -= dx * rotSpeed
      // Pitch around local X
      camera.rotation.x = Math.max(
        -Math.PI / 2.2,
        Math.min(Math.PI / 2.2, camera.rotation.x - dy * rotSpeed)
      )
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [flythroughActive, camera, setFlythroughActive])

  useFrame((_, delta) => {
    if (!flythroughActive) return

    const speed = (keys.current['ShiftLeft'] || keys.current['ShiftRight'] ? 60.0 : 25.0) * delta
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)

    const right = new THREE.Vector3()
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    if (keys.current['KeyW'] || keys.current['ArrowUp']) {
      camera.position.addScaledVector(forward, speed)
    }
    if (keys.current['KeyS'] || keys.current['ArrowDown']) {
      camera.position.addScaledVector(forward, -speed)
    }
    if (keys.current['KeyD'] || keys.current['ArrowRight']) {
      camera.position.addScaledVector(right, speed)
    }
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) {
      camera.position.addScaledVector(right, -speed)
    }
    if (keys.current['KeyE']) {
      camera.position.y += speed
    }
    if (keys.current['KeyQ']) {
      camera.position.y -= speed
    }
  })

  return null
}
export default FlythroughController
