/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useArmStore } from './useArmStore.ts';
import { ArmCalibration, ArmDimensions, JointConfig } from '../types/arm.ts';
import { Sliders, Wrench, Box } from 'lucide-react';

interface TuneTabProps {
  onDimensionsChange?: (dims: ArmDimensions) => void;
  onCalibrationChange?: (calib: ArmCalibration) => void;
}

export const TuneTab: React.FC<TuneTabProps> = ({
  onDimensionsChange,
  onCalibrationChange,
}) => {
  const store = useArmStore();
  const [activeSection, setActiveSection] = useState<'servos' | 'calib' | 'dims'>('servos');

  const [localConfigs, setLocalConfigs] = useState<JointConfig[]>(store.configs);
  const [localDims, setLocalDims] = useState<ArmDimensions>(store.dims);
  const [localCalib, setLocalCalib] = useState<ArmCalibration>(store.calib);

  const handleConfigChange = (channel: number, field: keyof JointConfig, val: unknown) => {
    const updated = [...localConfigs];
    updated[channel] = { ...updated[channel], [field]: val };
    setLocalConfigs(updated);
  };

  const handleApplyJoint = (channel: number) => {
    store.applyJointConfig(channel, localConfigs[channel]);
  };

  const handleTauChange = (val: number) => {
    store.sendTau(val);
  };

  const handleDimChange = (field: keyof ArmDimensions, val: number) => {
    const updated = { ...localDims, [field]: val };
    setLocalDims(updated);
    store.updateDimensions(updated);
    onDimensionsChange?.(updated);
  };

  const handleCalibChange = (field: keyof ArmCalibration, val: number) => {
    const updated = { ...localCalib, [field]: val };
    setLocalCalib(updated);
    store.updateCalibration(updated);
    onCalibrationChange?.(updated);
  };

  return (
    <div className="flex flex-col gap-3 py-1 font-sans">
      {/* Claymorphic Segmented Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 clay-inset rounded-full text-xs font-bold">
        <button
          onClick={() => setActiveSection('servos')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full transition-all ${
            activeSection === 'servos'
              ? 'clay-pill-active text-white'
              : 'text-[#64748b] hover:text-[#2d3142]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Servos & Filter
        </button>
        <button
          onClick={() => setActiveSection('calib')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full transition-all ${
            activeSection === 'calib'
              ? 'clay-pill-active text-white'
              : 'text-[#64748b] hover:text-[#2d3142]'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          Calibration
        </button>
        <button
          onClick={() => setActiveSection('dims')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full transition-all ${
            activeSection === 'dims'
              ? 'clay-pill-active text-white'
              : 'text-[#64748b] hover:text-[#2d3142]'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          Dimensions
        </button>
      </div>

      {/* SECTION 1: Servos, Limits, Pulse Width, & TAU */}
      {activeSection === 'servos' && (
        <div className="flex flex-col gap-3">
          {/* Global TAU Follow Filter */}
          <div className="p-3.5 rounded-2xl clay-card flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2d3142]">Live Drag Filter (TAU)</span>
              <span className="text-xs font-mono font-bold text-[#d97757]">{store.tauMs} ms</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#78716c]">10ms (Snap)</span>
              <div className="flex-1 clay-inset p-1 rounded-full flex items-center">
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="5"
                  value={store.tauMs}
                  onChange={(e) => handleTauChange(parseInt(e.target.value, 10))}
                  className="w-full h-3 bg-transparent appearance-none cursor-pointer accent-[#d97757]"
                />
              </div>
              <span className="text-[10px] font-mono text-[#78716c]">300ms (Smooth)</span>
            </div>
            <div className="text-[10px] text-[#78716c]">
              Sends TAU &lt;ms&gt; to firmware. Controls first-order exponential lag on live dragging.
            </div>
          </div>

          {/* Per-Joint Servo Settings */}
          {localConfigs.map((cfg) => (
            <div
              key={cfg.channel}
              className="p-3.5 rounded-2xl clay-card flex flex-col gap-2.5 text-xs font-mono"
            >
              <div className="flex items-center justify-between border-b border-[#ded7cc] pb-2">
                <span className="font-bold text-[#2d3142]">
                  CH {cfg.channel} - {cfg.name}
                </span>
                <button
                  onClick={() => handleApplyJoint(cfg.channel)}
                  className="px-3 py-1 clay-btn-primary font-bold text-[11px] transition"
                >
                  Apply Settings
                </button>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-sans font-semibold text-[#78716c] block mb-0.5">Min Limit (°)</label>
                  <input
                    type="number"
                    min="0"
                    max={cfg.maxLimit}
                    value={cfg.minLimit}
                    onChange={(e) =>
                      handleConfigChange(cfg.channel, 'minLimit', parseFloat(e.target.value) || 0)
                    }
                    className="w-full clay-inset rounded-xl px-2.5 py-1 text-[#2d3142] font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-sans font-semibold text-[#78716c] block mb-0.5">Max Limit (°)</label>
                  <input
                    type="number"
                    min={cfg.minLimit}
                    max="180"
                    value={cfg.maxLimit}
                    onChange={(e) =>
                      handleConfigChange(cfg.channel, 'maxLimit', parseFloat(e.target.value) || 180)
                    }
                    className="w-full clay-inset rounded-xl px-2.5 py-1 text-[#2d3142] font-bold"
                  />
                </div>
              </div>

              {/* Pulse Width Min & Max µs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-sans font-semibold text-[#78716c] block mb-0.5">Pulse Min (µs)</label>
                  <input
                    type="number"
                    min="400"
                    max="2600"
                    step="10"
                    value={cfg.minUs}
                    onChange={(e) =>
                      handleConfigChange(cfg.channel, 'minUs', parseFloat(e.target.value) || 500)
                    }
                    className="w-full clay-inset rounded-xl px-2.5 py-1 text-[#2d3142] font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-sans font-semibold text-[#78716c] block mb-0.5">Pulse Max (µs)</label>
                  <input
                    type="number"
                    min="400"
                    max="2600"
                    step="10"
                    value={cfg.maxUs}
                    onChange={(e) =>
                      handleConfigChange(cfg.channel, 'maxUs', parseFloat(e.target.value) || 2500)
                    }
                    className="w-full clay-inset rounded-xl px-2.5 py-1 text-[#2d3142] font-bold"
                  />
                </div>
              </div>

              {/* Trim & Reverse */}
              <div className="grid grid-cols-2 gap-2 items-center">
                <div>
                  <label className="text-[10px] font-sans font-semibold text-[#78716c] block mb-0.5">Trim (±45°)</label>
                  <input
                    type="number"
                    min="-45"
                    max="45"
                    step="1"
                    value={cfg.trim}
                    onChange={(e) =>
                      handleConfigChange(cfg.channel, 'trim', parseFloat(e.target.value) || 0)
                    }
                    className="w-full clay-inset rounded-xl px-2.5 py-1 text-[#2d3142] font-bold"
                  />
                </div>
                <div className="pt-3">
                  <label className="flex items-center gap-2 cursor-pointer text-[#4a5568]">
                    <input
                      type="checkbox"
                      checked={cfg.reverse}
                      onChange={(e) => handleConfigChange(cfg.channel, 'reverse', e.target.checked)}
                      className="rounded text-[#d97757] focus:ring-0"
                    />
                    <span className="text-[11px] font-sans font-bold">Reverse Direction</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECTION 2: Calibration */}
      {activeSection === 'calib' && (
        <div className="p-3.5 rounded-2xl clay-card flex flex-col gap-3 text-xs font-mono">
          <p className="text-[11px] text-[#64748b] font-sans leading-relaxed">
            Configure offset and direction signs to align physical horn mounting orientation with the 3D visual kinematics.
          </p>

          <div className="flex flex-col gap-2.5">
            {/* Base */}
            <div className="p-3 clay-inset rounded-xl">
              <span className="font-bold text-[#2d3142] block mb-1.5 font-sans">Base Yaw Calibration</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#78716c] block mb-0.5 font-sans">Offset (°)</label>
                  <input
                    type="number"
                    value={localCalib.baseOffset}
                    onChange={(e) => handleCalibChange('baseOffset', parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#f4f1ea] border border-[#d8d2c7] rounded-lg px-2 py-1 text-[#2d3142] font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#78716c] block mb-0.5 font-sans">Sign (+1 / -1)</label>
                  <select
                    value={localCalib.baseSign}
                    onChange={(e) => handleCalibChange('baseSign', parseInt(e.target.value, 10))}
                    className="w-full bg-[#f4f1ea] border border-[#d8d2c7] rounded-lg px-2 py-1 text-[#2d3142] font-bold"
                  >
                    <option value={1}>+1 (Normal)</option>
                    <option value={-1}>-1 (Inverted)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Shoulder */}
            <div className="p-3 clay-inset rounded-xl">
              <span className="font-bold text-[#2d3142] block mb-1.5 font-sans">Shoulder Tilt Calibration</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#78716c] block mb-0.5 font-sans">Offset (°)</label>
                  <input
                    type="number"
                    value={localCalib.shoulderOffset}
                    onChange={(e) =>
                      handleCalibChange('shoulderOffset', parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-[#f4f1ea] border border-[#d8d2c7] rounded-lg px-2 py-1 text-[#2d3142] font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#78716c] block mb-0.5 font-sans">Sign (+1 / -1)</label>
                  <select
                    value={localCalib.shoulderSign}
                    onChange={(e) =>
                      handleCalibChange('shoulderSign', parseInt(e.target.value, 10))
                    }
                    className="w-full bg-[#f4f1ea] border border-[#d8d2c7] rounded-lg px-2 py-1 text-[#2d3142] font-bold"
                  >
                    <option value={1}>+1 (Normal)</option>
                    <option value={-1}>-1 (Inverted)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Elbow */}
            <div className="p-3 clay-inset rounded-xl">
              <span className="font-bold text-[#2d3142] block mb-1.5 font-sans">Elbow / Arm Calibration</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#78716c] block mb-0.5 font-sans">Offset (°)</label>
                  <input
                    type="number"
                    value={localCalib.elbowOffset}
                    onChange={(e) => handleCalibChange('elbowOffset', parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#f4f1ea] border border-[#d8d2c7] rounded-lg px-2 py-1 text-[#2d3142] font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#78716c] block mb-0.5 font-sans">Sign (+1 / -1)</label>
                  <select
                    value={localCalib.elbowSign}
                    onChange={(e) => handleCalibChange('elbowSign', parseInt(e.target.value, 10))}
                    className="w-full bg-[#f4f1ea] border border-[#d8d2c7] rounded-lg px-2 py-1 text-[#2d3142] font-bold"
                  >
                    <option value={1}>+1 (Normal)</option>
                    <option value={-1}>-1 (Inverted)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Dimensions */}
      {activeSection === 'dims' && (
        <div className="p-3.5 rounded-2xl clay-card flex flex-col gap-2.5 text-xs font-mono">
          <p className="text-[11px] text-[#64748b] font-sans leading-relaxed">
            Customize physical arm geometry dimensions (cm). The 3D model, reach envelope, and IK solver rebuild live.
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] text-[#78716c] font-sans font-semibold block mb-0.5">Upper Arm L1 (cm)</label>
              <input
                type="number"
                min="4"
                max="30"
                step="0.5"
                value={localDims.upperArmLength}
                onChange={(e) =>
                  handleDimChange('upperArmLength', parseFloat(e.target.value) || 10.5)
                }
                className="w-full clay-inset rounded-xl px-2.5 py-1 text-[#2d3142] font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#78716c] font-sans font-semibold block mb-0.5">Forearm L2 (cm)</label>
              <input
                type="number"
                min="4"
                max="30"
                step="0.5"
                value={localDims.forearmLength}
                onChange={(e) =>
                  handleDimChange('forearmLength', parseFloat(e.target.value) || 10)
                }
                className="w-full clay-inset rounded-xl px-2.5 py-1 text-[#2d3142] font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] text-[#78716c] font-sans font-semibold block mb-0.5">Tool End Stub (cm)</label>
              <input
                type="number"
                min="1"
                max="15"
                step="0.5"
                value={localDims.endStubLength}
                onChange={(e) =>
                  handleDimChange('endStubLength', parseFloat(e.target.value) || 4)
                }
                className="w-full clay-inset rounded-xl px-2.5 py-1 text-[#2d3142] font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#78716c] font-sans font-semibold block mb-0.5">Shoulder Height (cm)</label>
              <input
                type="number"
                min="2"
                max="20"
                step="0.5"
                value={localDims.shoulderPivotHeight}
                onChange={(e) =>
                  handleDimChange('shoulderPivotHeight', parseFloat(e.target.value) || 7)
                }
                className="w-full clay-inset rounded-xl px-2.5 py-1 text-[#2d3142] font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] text-[#78716c] font-sans font-semibold block mb-0.5">Base Plate Ø (cm)</label>
              <input
                type="number"
                min="6"
                max="30"
                step="0.5"
                value={localDims.basePlateDiameter}
                onChange={(e) =>
                  handleDimChange('basePlateDiameter', parseFloat(e.target.value) || 12)
                }
                className="w-full clay-inset rounded-xl px-2.5 py-1 text-[#2d3142] font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#78716c] font-sans font-semibold block mb-0.5">Turntable Ø (cm)</label>
              <input
                type="number"
                min="4"
                max="20"
                step="0.5"
                value={localDims.turntableDiameter}
                onChange={(e) =>
                  handleDimChange('turntableDiameter', parseFloat(e.target.value) || 9)
                }
                className="w-full clay-inset rounded-xl px-2.5 py-1 text-[#2d3142] font-bold"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
