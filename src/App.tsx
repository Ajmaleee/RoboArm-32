/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { RobotArmScene, CameraPreset } from './three/scene.ts';
import { armStore } from './state/armStore.ts';
import { useArmStore } from './ui/useArmStore.ts';
import { TopBar } from './ui/TopBar.tsx';
import { ControlPanel } from './ui/ControlPanel.tsx';
import { ToastContainer } from './ui/Toast.tsx';
import { SelfCheckModal } from './ui/SelfCheckModal.tsx';
import { ArmCalibration, ArmDimensions, JointAngles } from './types/arm.ts';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RobotArmScene | null>(null);
  const store = useArmStore();
  const [isSelfCheckOpen, setIsSelfCheckOpen] = useState(false);

  // Initialize Three.js scene once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new RobotArmScene(
      containerRef.current,
      armStore.dims,
      armStore.calib,
      armStore.configs,
      armStore.overlays,
      {
        onTargetChange: (angles) => {
          // Hot path: update both target and actual angles so the real solid arm moves directly!
          armStore.targetAngles.base = angles.base;
          armStore.targetAngles.shoulder = angles.shoulder;
          armStore.targetAngles.elbow = angles.elbow;
          armStore.actualAngles.base = angles.base;
          armStore.actualAngles.shoulder = angles.shoulder;
          armStore.actualAngles.elbow = angles.elbow;
        },
        onDragEnd: (finalAngles) => {
          armStore.onPointerRelease(finalAngles);
        },
        onDragStart: () => {
          // Interaction initiated
        },
      }
    );

    sceneRef.current = scene;

    // Subscribe to store updates to keep 3D scene in sync
    const unsubscribe = armStore.subscribe(() => {
      if (!sceneRef.current) return;
      sceneRef.current.setActualAngles(armStore.actualAngles);
      sceneRef.current.setTargetAngles(armStore.targetAngles);
      sceneRef.current.setInteractionMode(armStore.interactionMode);
      sceneRef.current.setOverlays(armStore.overlays);
      sceneRef.current.setConfigs(armStore.configs);
    });

    return () => {
      unsubscribe();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  const handleCameraPreset = (preset: CameraPreset) => {
    sceneRef.current?.setCameraPreset(preset);
  };

  const handleTargetChangeFromUI = (angles: JointAngles) => {
    sceneRef.current?.setTargetAngles(angles);
  };

  const handleDimensionsChange = (dims: ArmDimensions) => {
    sceneRef.current?.updateDimensions(dims);
  };

  const handleCalibrationChange = (calib: ArmCalibration) => {
    sceneRef.current?.setCalibration(calib);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#dfdcd5] text-[#2c3338] flex flex-col font-sans select-none touch-none">
      {/* Top Header Bar */}
      <TopBar
        onCameraPreset={handleCameraPreset}
        onOpenSelfCheck={() => setIsSelfCheckOpen(true)}
      />

      {/* Full-bleed 3D Viewport */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Minimal Mode Indicator Badge on top-left */}
        <div className="absolute top-3 left-3 pointer-events-none z-10 flex flex-col gap-1.5 font-mono">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full clay-card text-[11px] text-[#4a5860] font-bold tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d96b43] shadow-[0_1px_3px_rgba(217,107,67,0.4)]" />
            <span className="uppercase">{store.interactionMode} MODE</span>
          </div>
          {store.overlays.lockVerticalPlane && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#faedd9] border border-[#d4b08c] text-[10px] text-[#8c5825] font-semibold shadow-xs">
              <span>LOCKED TO VERTICAL PLANE</span>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Bottom Control Dock */}
      <ControlPanel
        onTargetChange={handleTargetChangeFromUI}
        onDimensionsChange={handleDimensionsChange}
        onCalibrationChange={handleCalibrationChange}
      />

      {/* Floating System Toasts */}
      <ToastContainer />

      {/* Kinematics Precision Self-Check Modal */}
      <SelfCheckModal
        isOpen={isSelfCheckOpen}
        onClose={() => setIsSelfCheckOpen(false)}
      />
    </div>
  );
}
