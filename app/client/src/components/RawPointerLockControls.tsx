import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface RawPointerLockControlsProps {
  sensitivity?: number;
  verticalClampDegrees?: number;
  cinematicMode?: boolean;
  viewBobbingOffsets?: {
    pitch: number;
    yaw: number;
    roll: number;
  };
}

export const RawPointerLockControls = forwardRef<any, RawPointerLockControlsProps>(
  ({ sensitivity = 0.002, verticalClampDegrees = 89, cinematicMode = false, viewBobbingOffsets }, ref) => {
    const { camera, gl } = useThree();
    const isLocked = useRef(false);
    
    // Camera rotation state (in radians)
    const yaw = useRef(0);
    const pitch = useRef(0);
    
    // Target rotation for cinematic mode
    const targetYaw = useRef(0);
    const targetPitch = useRef(0);
    
    // Convert degrees to radians
    const verticalClamp = (verticalClampDegrees * Math.PI) / 180;
    
    // Expose lock/unlock/getObject methods
    useImperativeHandle(ref, () => ({
      lock: () => {
        gl.domElement.requestPointerLock();
      },
      unlock: () => {
        if (document.pointerLockElement === gl.domElement) {
          document.exitPointerLock();
        }
      },
      getObject: () => camera,
      isLocked: () => isLocked.current
    }));

    useEffect(() => {
      const handlePointerLockChange = () => {
        isLocked.current = document.pointerLockElement === gl.domElement;
        
        // Initialize rotation from current camera rotation when locking
        if (isLocked.current) {
          const euler = camera.rotation.clone();
          yaw.current = euler.y;
          pitch.current = euler.x;
          targetYaw.current = euler.y;
          targetPitch.current = euler.x;
        }
      };

      const handleMouseMove = (event: MouseEvent) => {
        if (!isLocked.current) return;

        // Get raw mouse movement
        let movementX = event.movementX || 0;
        let movementY = event.movementY || 0;

        // Firefox fix: Firefox reports much higher movement values than other browsers
        const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        if (isFirefox) {
          movementX *= 0.65;
          movementY *= 0.65;
        }

        // Clamp to prevent huge spikes
        movementX = Math.max(-50, Math.min(50, movementX));
        movementY = Math.max(-50, Math.min(50, movementY));

        // Update target rotation
        targetYaw.current -= movementX * sensitivity;
        targetPitch.current -= movementY * sensitivity;

        // Clamp vertical rotation
        targetPitch.current = Math.max(-verticalClamp, Math.min(verticalClamp, targetPitch.current));

        // If not in cinematic mode, apply directly (raw input)
        if (!cinematicMode) {
          yaw.current = targetYaw.current;
          pitch.current = targetPitch.current;
          
          // Note: View bobbing offsets are applied in useFrame, not here
          // This ensures we always use the latest offset values without dependency issues
        }
      };

      document.addEventListener('pointerlockchange', handlePointerLockChange);
      document.addEventListener('mousemove', handleMouseMove);

      return () => {
        document.removeEventListener('pointerlockchange', handlePointerLockChange);
        document.removeEventListener('mousemove', handleMouseMove);
      };
    }, [camera, gl.domElement, sensitivity, verticalClamp, cinematicMode]);

    // Apply camera rotation every frame
    useFrame(() => {
      if (!isLocked.current) return;

      // In cinematic mode, interpolate towards target
      if (cinematicMode) {
        yaw.current = THREE.MathUtils.lerp(yaw.current, targetYaw.current, 0.05);
        pitch.current = THREE.MathUtils.lerp(pitch.current, targetPitch.current, 0.05);
      }
      // In raw mode, yaw/pitch are already set in mousemove handler
      
      // Always apply view bobbing offsets (updated every frame via props)
      const finalPitch = pitch.current + (viewBobbingOffsets?.pitch || 0);
      const finalYaw = yaw.current + (viewBobbingOffsets?.yaw || 0);
      const finalRoll = viewBobbingOffsets?.roll || 0;
      
      camera.rotation.set(finalPitch, finalYaw, finalRoll, 'YXZ');
    });

    return null;
  }
);

RawPointerLockControls.displayName = 'RawPointerLockControls';
