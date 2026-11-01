/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useArmStore } from './useArmStore.ts';
import { JointAngles } from '../types/arm.ts';

interface JointsTabProps {
  onTargetChange?: (angles: JointAngles) => void;
}

export const JointsTab: React.FC<JointsTabProps> = ({ onTargetChange }) => {
  const store = useArmStore();

  const joints: {
    key: keyof JointAngles;
    channel: number;
    label: string;
    actual: number;
    target: number;
    badgeColor: string;
  }[] = [
    {
      key: 'base',
      channel: 0,
      label: 'Base Turntable',
      actual: store.actualAngles.base,
      target: store.targetAngles.base,
      badgeColor: 'bg-[#d97757] text-white',
    },
    {
      key: 'shoulder',
      channel: 1,
      label: 'Shoulder Pitch',
      actual: store.actualAngles.shoulder,
      target: store.targetAngles.shoulder,
      badgeColor: 'bg-[#4f8a6b] text-white',
    },
    {
      key: 'elbow',
      channel: 2,
      label: 'Elbow / Forearm',
      actual: store.actualAngles.elbow,
      target: store.targetAngles.elbow,
      badgeColor: 'bg-[#b45309] text-white',
    },
  ];

  const handleSliderChange = (key: keyof JointAngles, val: number) => {
    const updated = { ...store.targetAngles, [key]: val };
    store.updateTarget({ [key]: val });
    onTargetChange?.(updated);
  };

  const handleStep = (key: keyof JointAngles, step: number) => {
    const cfg = store.configs[key === 'base' ? 0 : key === 'shoulder' ? 1 : 2];
    const cur = store.targetAngles[key];
    const next = Math.max(cfg.minLimit, Math.min(cfg.maxLimit, cur + step));
    handleSliderChange(key, next);
  };

  const handleSpeedChange = (channel: number, speed: number) => {
    const updated = [...store.configs];
    updated[channel].speedDps = speed;
    store.applyJointConfig(channel, updated[channel]);
  };

  return (
    <div className="flex flex-col gap-3 py-1 font-sans">
      {joints.map(({ key, channel, label, actual, target, badgeColor }) => {
        const cfg = store.configs[channel] || { minLimit: 0, maxLimit: 180, speedDps: 120 };
        const diff = Math.abs(actual - target);

        return (
          <div
            key={key}
            className="p-3.5 rounded-2xl clay-card flex flex-col gap-2.5"
          >
            {/* Header: Joint Name, Target & Actual badges */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#2d3142] tracking-wide">{label}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold shadow-sm ${badgeColor}`}>
                  CH {channel}
                </span>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-[11px] text-[#64748b]">
                  Act: <strong className="text-[#3b7a57]">{actual.toFixed(1)}°</strong>
                </span>
                <div className="flex items-center clay-inset rounded-full px-2.5 py-0.5">
                  <span className="text-[11px] text-[#d97757] font-bold mr-1">Tgt:</span>
                  <input
                    type="number"
                    min={cfg.minLimit}
                    max={cfg.maxLimit}
                    step="0.5"
                    value={Number(target.toFixed(1))}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) handleSliderChange(key, v);
                    }}
                    className="w-12 bg-transparent text-right font-mono text-xs font-bold text-[#2d3142] focus:outline-none"
                  />
                  <span className="text-[#64748b] text-[11px]">°</span>
                </div>
              </div>
            </div>

            {/* Claymorphic Sunken Slider */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#78716c] w-6 text-left">{cfg.minLimit}°</span>
              <div className="flex-1 clay-inset p-1 rounded-full flex items-center">
                <input
                  type="range"
                  min={cfg.minLimit}
                  max={cfg.maxLimit}
                  step="0.2"
                  value={target}
                  onChange={(e) => handleSliderChange(key, parseFloat(e.target.value))}
                  className="w-full h-3 bg-transparent appearance-none cursor-pointer accent-[#d97757]"
                />
              </div>
              <span className="text-[10px] font-mono text-[#78716c] w-6 text-right">{cfg.maxLimit}°</span>
            </div>

            {/* Tactile Actual vs Target Bar */}
            <div className="relative w-full h-2 clay-inset rounded-full overflow-hidden">
              <div
                className="absolute top-0 bottom-0 bg-[#4f8a6b] rounded-full transition-all duration-75"
                style={{ width: `${(actual / 180) * 100}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-2 bg-[#d97757] rounded-full shadow-sm"
                style={{ left: `calc(${(target / 180) * 100}% - 4px)` }}
              />
            </div>

            {/* Steppers & Speed */}
            <div className="flex items-center justify-between gap-1 pt-0.5 text-[11px]">
              <div className="flex items-center gap-1.5 font-mono">
                <button
                  onClick={() => handleStep(key, -5)}
                  className="px-3 py-1 clay-btn font-bold text-[#333842]"
                >
                  -5°
                </button>
                <button
                  onClick={() => handleStep(key, -1)}
                  className="px-3 py-1 clay-btn font-bold text-[#333842]"
                >
                  -1°
                </button>
                <button
                  onClick={() => handleStep(key, 1)}
                  className="px-3 py-1 clay-btn font-bold text-[#333842]"
                >
                  +1°
                </button>
                <button
                  onClick={() => handleStep(key, 5)}
                  className="px-3 py-1 clay-btn font-bold text-[#333842]"
                >
                  +5°
                </button>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#64748b]">
                <span className="font-semibold">Speed:</span>
                <input
                  type="number"
                  min="0"
                  max="360"
                  step="10"
                  value={cfg.speedDps}
                  onChange={(e) => handleSpeedChange(channel, parseFloat(e.target.value) || 0)}
                  className="w-11 clay-inset rounded-lg px-1.5 py-0.5 text-right font-bold text-[#2d3142]"
                />
                <span>dps</span>
              </div>
            </div>

            {diff > 2 && (
              <div className="text-[10px] font-mono text-[#d97757] font-semibold text-right">
                Lag: {diff.toFixed(1)}°
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
