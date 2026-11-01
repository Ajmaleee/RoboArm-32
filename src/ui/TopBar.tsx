/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useArmStore } from './useArmStore.ts';
import { CameraPreset } from '../three/scene.ts';
import { TransportType } from '../types/arm.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import {
  Camera,
  Layers,
  OctagonAlert,
  Radio,
  Plug,
  Unplug,
  Cpu,
  ShieldCheck,
  MousePointer,
  RotateCw,
} from 'lucide-react';

interface TopBarProps {
  onCameraPreset: (preset: CameraPreset) => void;
  onOpenSelfCheck: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onCameraPreset, onOpenSelfCheck }) => {
  const store = useArmStore();
  const [showOverlaysMenu, setShowOverlaysMenu] = useState(false);
  const [showCameraMenu, setShowCameraMenu] = useState(false);

  const handleConnectToggle = () => {
    if (store.connectionStatus === 'connected' || store.connectionStatus === 'connecting') {
      store.disconnect();
    } else {
      store.connect();
    }
  };

  return (
    <header className="relative z-30 flex items-center justify-between gap-2 px-3 py-2.5 bg-[#ebe7df]/90 border-b border-[#d8d2c7] select-none text-[#2d3142]">
      {/* LEFT: Claymorphic Brand & Transport Selector */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-[#d97757] text-white flex items-center justify-center font-bold text-xs shadow-md shadow-[#af715c]/30 border border-white/40">
            3D
          </div>
          <span className="font-bold text-xs tracking-wide text-[#333842] hidden md:inline">
            ARM CONTROLLER
          </span>
        </div>

        {/* Claymorphic Transport Picker */}
        <div className="flex items-center clay-btn px-3 py-1 text-xs">
          <Cpu className="w-3.5 h-3.5 text-[#d97757] mr-1.5 shrink-0" />
          <select
            value={store.transportType}
            onChange={(e) => store.setTransportType(e.target.value as TransportType)}
            className="bg-transparent text-[#2d3142] font-semibold focus:outline-none text-[11px] cursor-pointer"
          >
            <option value="simulator" className="bg-[#f4f1ea] text-[#2d3142]">
              Simulator
            </option>
            <option value="webserial" className="bg-[#f4f1ea] text-[#2d3142]">
              Web Serial (USB/COM)
            </option>
            <option value="native_bt" className="bg-[#f4f1ea] text-[#2d3142]">
              Capacitor BT (SPP)
            </option>
          </select>
        </div>

        {/* Claymorphic Connect/Disconnect Pill Button */}
        <button
          onClick={handleConnectToggle}
          className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition ${
            store.connectionStatus === 'connected'
              ? 'clay-btn-danger text-white'
              : 'clay-btn-success text-white'
          }`}
        >
          {store.connectionStatus === 'connected' ? (
            <>
              <Unplug className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Disconnect</span>
            </>
          ) : (
            <>
              <Plug className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Connect</span>
            </>
          )}
        </button>

        {/* Claymorphic Status Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full clay-inset text-[11px] text-[#4a5568]">
          <span
            className={`w-2 h-2 rounded-full ${
              store.connectionStatus === 'connected'
                ? 'bg-[#4f8a6b]'
                : store.connectionStatus === 'connecting'
                ? 'bg-[#d97757]'
                : 'bg-[#94a3b8]'
            }`}
          />
          <span className="capitalize font-medium">{store.connectionStatus}</span>
        </div>

        {/* Telemetry Chips */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <div
            title="Measured Round-Trip Latency (PING -> PONG)"
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full clay-inset text-[#4a5568]"
          >
            <Radio className="w-3 h-3 text-[#d97757]" />
            <span>{store.latencyMs > 0 ? `${store.latencyMs}ms` : '--'}</span>
          </div>

          <div
            title="Telemetry Stream Rate (ST frames/sec)"
            className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 rounded-full clay-inset text-[#4f8a6b] font-semibold"
          >
            <span>{store.stRateHz} Hz</span>
          </div>
        </div>
      </div>

      {/* RIGHT: Claymorphic Segmented Toggle, Camera, Overlays, Stop Button */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Claymorphic Segmented Button for Control / Orbit */}
        <div className="flex items-center clay-inset p-1 rounded-full text-xs">
          <button
            onClick={() => store.setInteractionMode('control')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full font-semibold transition-all ${
              store.interactionMode === 'control'
                ? 'clay-pill-active text-white'
                : 'text-[#64748b] hover:text-[#2d3142]'
            }`}
            title="CONTROL mode: Drag arm directly"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Control</span>
          </button>
          <button
            onClick={() => store.setInteractionMode('orbit')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full font-semibold transition-all ${
              store.interactionMode === 'orbit'
                ? 'clay-pill-active text-white'
                : 'text-[#64748b] hover:text-[#2d3142]'
            }`}
            title="ORBIT mode: Rotate 3D scene"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Orbit</span>
          </button>
        </div>

        {/* Camera Views Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowCameraMenu(!showCameraMenu);
              setShowOverlaysMenu(false);
            }}
            title="Camera Presets"
            className="flex items-center gap-1 px-3 py-1.5 clay-btn text-xs font-semibold text-[#4a5568]"
          >
            <Camera className="w-3.5 h-3.5 text-[#d97757]" />
            <span className="hidden xl:inline">Views</span>
          </button>

          {showCameraMenu && (
            <div className="absolute right-0 mt-2 w-32 clay-card p-1.5 z-50 flex flex-col gap-1 text-xs font-mono">
              {(['iso', 'front', 'side', 'top', 'fit'] as CameraPreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    onCameraPreset(preset);
                    setShowCameraMenu(false);
                  }}
                  className="px-3 py-1.5 rounded-xl text-left hover:bg-[#ebe7de] text-[#2d3142] uppercase font-bold"
                >
                  {preset}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Overlays Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowOverlaysMenu(!showOverlaysMenu);
              setShowCameraMenu(false);
            }}
            title="3D Overlays"
            className="flex items-center gap-1 px-3 py-1.5 clay-btn text-xs font-semibold text-[#4a5568]"
          >
            <Layers className="w-3.5 h-3.5 text-[#d97757]" />
            <span className="hidden xl:inline">Overlays</span>
          </button>

          {showOverlaysMenu && (
            <div className="absolute right-0 mt-2 w-56 clay-card p-3 z-50 flex flex-col gap-2.5 text-xs font-sans text-[#333842]">
              <label className="flex items-center justify-between cursor-pointer hover:text-black">
                <span className="font-medium">Joint Axes</span>
                <input
                  type="checkbox"
                  checked={store.overlays.axes}
                  onChange={(e) => store.setOverlays({ axes: e.target.checked })}
                  className="rounded-md text-[#d97757] focus:ring-0"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer hover:text-black">
                <span className="font-medium">Degree Labels</span>
                <input
                  type="checkbox"
                  checked={store.overlays.labels}
                  onChange={(e) => store.setOverlays({ labels: e.target.checked })}
                  className="rounded-md text-[#d97757] focus:ring-0"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer hover:text-black">
                <span className="font-medium">Reach Dome</span>
                <input
                  type="checkbox"
                  checked={store.overlays.reachDome}
                  onChange={(e) => store.setOverlays({ reachDome: e.target.checked })}
                  className="rounded-md text-[#d97757] focus:ring-0"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer hover:text-black">
                <span className="font-medium">Ghost Reference</span>
                <input
                  type="checkbox"
                  checked={store.overlays.ghost}
                  onChange={(e) => store.setOverlays({ ghost: e.target.checked })}
                  className="rounded-md text-[#d97757] focus:ring-0"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer hover:text-black pt-2 border-t border-[#d8d2c7]">
                <span className="font-medium text-[#d97757]">Lock Vertical Plane</span>
                <input
                  type="checkbox"
                  checked={store.overlays.lockVerticalPlane}
                  onChange={(e) => store.setOverlays({ lockVerticalPlane: e.target.checked })}
                  className="rounded-md text-[#d97757] focus:ring-0"
                />
              </label>
            </div>
          )}
        </div>

        {/* Kinematics self check */}
        <button
          onClick={onOpenSelfCheck}
          title="Run Kinematics Self Check (FK/IK)"
          className="p-2 clay-btn text-[#4a5568]"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#4f8a6b]" />
        </button>

        <PWAInstallButton />

        {/* Claymorphic Emergency Stop Button */}
        <button
          onClick={() => store.sendStop()}
          title="EMERGENCY STOP (STOP)"
          className="flex items-center gap-1.5 px-4 py-1.5 clay-btn-danger text-white font-bold text-xs tracking-wider transition active:scale-95"
        >
          <OctagonAlert className="w-4 h-4" />
          <span>STOP</span>
        </button>
      </div>
    </header>
  );
};
