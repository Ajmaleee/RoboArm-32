/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useArmStore } from './useArmStore.ts';
import { Home, Bookmark, Power, OctagonAlert, HardDrive, RefreshCcw } from 'lucide-react';

export const ActionsTab: React.FC = () => {
  const store = useArmStore();

  return (
    <div className="flex flex-col gap-3.5 py-1 font-sans text-xs">
      {/* Primary Robotic Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => store.sendHome()}
          className="flex items-center justify-center gap-2 py-3 px-3 clay-btn text-[#2d3142] font-bold transition shadow-sm active:scale-[0.98]"
        >
          <Home className="w-4 h-4 text-[#d97757]" />
          <span>GO HOME</span>
        </button>

        <button
          onClick={() => store.sendSetHome()}
          className="flex items-center justify-center gap-2 py-3 px-3 clay-btn text-[#2d3142] font-bold transition shadow-sm active:scale-[0.98]"
        >
          <Bookmark className="w-4 h-4 text-[#4f8a6b]" />
          <span>SET HOME</span>
        </button>
      </div>

      {/* Emergency STOP & Servo Enable */}
      <div className="flex flex-col gap-2.5 p-4 rounded-2xl clay-card">
        <span className="text-[10px] text-[#78716c] uppercase tracking-wider font-bold">
          Emergency & Power Control
        </span>

        <button
          onClick={() => store.sendStop()}
          className="flex items-center justify-center gap-2 py-3.5 px-4 clay-btn-danger text-white font-bold text-sm tracking-wider transition active:scale-[0.98]"
        >
          <OctagonAlert className="w-5 h-5 text-white" />
          <span>EMERGENCY STOP (STOP)</span>
        </button>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[#4a5568] font-medium">Servos PWM Driver:</span>
          <button
            onClick={() => store.toggleServos()}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-bold transition ${
              store.servosEnabled
                ? 'clay-btn-success text-white'
                : 'clay-btn-danger text-white'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{store.servosEnabled ? 'SERVOS ON (E 1)' : 'SERVOS OFF (E 0)'}</span>
          </button>
        </div>
      </div>

      {/* Flash Memory Operations */}
      <div className="flex flex-col gap-2 p-4 rounded-2xl clay-card">
        <span className="text-[10px] text-[#78716c] uppercase tracking-wider font-bold">
          ESP32 EEPROM / Flash Memory
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => store.sendFlashCommand('SAVE')}
            className="flex items-center justify-center gap-1.5 py-2 px-2 clay-btn font-bold transition"
          >
            <HardDrive className="w-3.5 h-3.5 text-[#d97757]" />
            <span>SAVE</span>
          </button>
          <button
            onClick={() => store.sendFlashCommand('LOAD')}
            className="flex items-center justify-center gap-1.5 py-2 px-2 clay-btn font-bold transition"
          >
            <RefreshCcw className="w-3.5 h-3.5 text-[#b45309]" />
            <span>LOAD</span>
          </button>
          <button
            onClick={() => store.sendFlashCommand('DEFAULTS')}
            className="flex items-center justify-center gap-1.5 py-2 px-2 clay-btn text-[#dc2626] font-bold transition"
          >
            <span>DEFAULTS</span>
          </button>
        </div>
        <p className="text-[10px] text-[#78716c] leading-tight mt-1">
          Saves or restores calibration, limits, and trim to non-volatile ESP32 storage.
        </p>
      </div>
    </div>
  );
};
