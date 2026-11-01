/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useArmStore } from './useArmStore.ts';
import {
  Play,
  Square,
  Repeat,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Navigation,
  Download,
  Upload,
} from 'lucide-react';

export const PosesTab: React.FC = () => {
  const store = useArmStore();
  const [newPoseName, setNewPoseName] = useState('');
  const [loopSequence, setLoopSequence] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSavePose = (e: React.FormEvent) => {
    e.preventDefault();
    store.savePreset(newPoseName);
    setNewPoseName('');
  };

  const handleExport = () => {
    const json = store.exportPresetsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robotic_arm_poses_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) store.importPresetsJSON(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-3.5 py-1 font-sans text-xs">
      {/* Save current pose form */}
      <form onSubmit={handleSavePose} className="flex gap-2">
        <input
          type="text"
          placeholder="New pose name (e.g. Peg Pickup)"
          value={newPoseName}
          onChange={(e) => setNewPoseName(e.target.value)}
          className="flex-1 clay-inset rounded-full px-4 py-2 text-[#2d3142] placeholder:text-[#89929a] font-semibold focus:outline-none"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 px-4 py-2 clay-btn-primary font-bold shrink-0 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Save Pose</span>
        </button>
      </form>

      {/* Sequence Playback Controls */}
      <div className="p-3.5 rounded-2xl clay-card flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {store.isRunningSequence ? (
            <button
              onClick={() => store.stopSequence()}
              className="flex items-center gap-1.5 px-4 py-2 clay-btn-danger text-white font-bold shadow-sm"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Sequence</span>
            </button>
          ) : (
            <button
              onClick={() => store.playSequence(loopSequence)}
              disabled={store.presets.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 clay-btn-success text-white font-bold shadow-sm disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play Sequence</span>
            </button>
          )}

          <label className="flex items-center gap-1.5 cursor-pointer text-[#4a5568] text-[11px] font-bold">
            <input
              type="checkbox"
              checked={loopSequence}
              onChange={(e) => setLoopSequence(e.target.checked)}
              className="rounded text-[#d97757] focus:ring-0"
            />
            <Repeat className="w-3.5 h-3.5 text-[#d97757]" />
            <span>Loop</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            title="Export JSON"
            className="p-2 clay-btn text-[#4a5568]"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import JSON"
            className="p-2 clay-btn text-[#4a5568]"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />
        </div>
      </div>

      {/* Preset Poses List */}
      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
        {store.presets.length === 0 ? (
          <div className="text-center py-6 text-[#89929a] text-xs">
            No saved poses yet. Pose the arm and click Save Pose.
          </div>
        ) : (
          store.presets.map((preset, index) => (
            <div
              key={preset.id}
              className="p-3 rounded-2xl clay-card flex items-center justify-between gap-2"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-[#2d3142] truncate">{preset.name}</span>
                <span className="text-[10px] text-[#78716c] font-mono">
                  B: {preset.angles.base.toFixed(0)}° | S: {preset.angles.shoulder.toFixed(0)}° | E:{' '}
                  {preset.angles.elbow.toFixed(0)}°
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => store.sendSmoothMove(preset.angles, preset.speedDps || 90)}
                  className="flex items-center gap-1 px-3 py-1 clay-btn-primary font-bold text-xs"
                >
                  <Navigation className="w-3 h-3" />
                  <span>GO</span>
                </button>

                <div className="flex flex-col">
                  <button
                    disabled={index === 0}
                    onClick={() => store.reorderPresets(index, index - 1)}
                    className="p-0.5 text-[#78716c] hover:text-black disabled:opacity-20"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    disabled={index === store.presets.length - 1}
                    onClick={() => store.reorderPresets(index, index + 1)}
                    className="p-0.5 text-[#78716c] hover:text-black disabled:opacity-20"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={() => store.deletePreset(preset.id)}
                  className="p-1.5 text-[#78716c] hover:text-[#dc2626] rounded-full hover:bg-[#ebe7de] transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
