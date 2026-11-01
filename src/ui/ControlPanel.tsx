/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArmCalibration, ArmDimensions, JointAngles } from '../types/arm.ts';
import { JointsTab } from './JointsTab.tsx';
import { TuneTab } from './TuneTab.tsx';
import { ActionsTab } from './ActionsTab.tsx';
import { PosesTab } from './PosesTab.tsx';
import { ConsoleTab } from './ConsoleTab.tsx';
import {
  SlidersHorizontal,
  Wrench,
  Zap,
  ListOrdered,
  Terminal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export type PanelTab = 'joints' | 'tune' | 'actions' | 'poses' | 'console';

interface ControlPanelProps {
  onTargetChange?: (angles: JointAngles) => void;
  onDimensionsChange?: (dims: ArmDimensions) => void;
  onCalibrationChange?: (calib: ArmCalibration) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  onTargetChange,
  onDimensionsChange,
  onCalibrationChange,
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('joints');
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const tabs: { id: PanelTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'joints', label: 'Joints', icon: SlidersHorizontal },
    { id: 'tune', label: 'Tune', icon: Wrench },
    { id: 'actions', label: 'Actions', icon: Zap },
    { id: 'poses', label: 'Poses', icon: ListOrdered },
    { id: 'console', label: 'Console', icon: Terminal },
  ];

  return (
    <div
      className={`fixed bottom-0 left-1/2 -translate-x-1/2 z-20 w-full max-w-2xl px-3 transition-transform duration-300 ease-out select-none ${
        isCollapsed ? 'translate-y-[calc(100%-44px)]' : 'translate-y-0'
      }`}
    >
      {/* Claymorphic Bottom Sheet Container */}
      <div className="clay-card rounded-b-none border-b-0 overflow-hidden flex flex-col">
        {/* Claymorphic Drag Handle & Navigation Pill Bar */}
        <div className="flex flex-col items-center pt-2.5 pb-2 px-3 border-b border-[#ded7cc]">
          {/* Tactile Drag Handle Pill */}
          <div
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-12 h-1.5 rounded-full clay-inset cursor-pointer mb-2.5 hover:bg-[#d8d2c7] transition"
            title="Toggle panel (H)"
          />

          <div className="w-full flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    setActiveTab(id);
                    if (isCollapsed) setIsCollapsed(false);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                    activeTab === id && !isCollapsed
                      ? 'clay-pill-active text-white'
                      : 'clay-btn text-[#4a5568]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-1 px-3 py-1.5 clay-btn text-xs font-semibold text-[#4a5568]"
              title="Toggle dock (H)"
            >
              {isCollapsed ? (
                <>
                  <ChevronUp className="w-4 h-4 text-[#d97757]" />
                  <span className="hidden sm:inline">Show</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 text-[#64748b]" />
                  <span className="hidden sm:inline">Hide (H)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sheet Content Drawer */}
        <div className="p-3.5 max-h-[46vh] sm:max-h-[42vh] overflow-y-auto bg-[#f4f1ea]">
          {activeTab === 'joints' && <JointsTab onTargetChange={onTargetChange} />}
          {activeTab === 'tune' && (
            <TuneTab
              onDimensionsChange={onDimensionsChange}
              onCalibrationChange={onCalibrationChange}
            />
          )}
          {activeTab === 'actions' && <ActionsTab />}
          {activeTab === 'poses' && <PosesTab />}
          {activeTab === 'console' && <ConsoleTab />}
        </div>
      </div>
    </div>
  );
};
