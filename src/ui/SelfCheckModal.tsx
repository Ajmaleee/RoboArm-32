/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useArmStore } from './useArmStore.ts';
import { runKinematicsSelfCheck } from '../three/kinematics.ts';
import { CheckCircle2, XCircle, RefreshCw, X, ShieldCheck } from 'lucide-react';

interface SelfCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SelfCheckModal: React.FC<SelfCheckModalProps> = ({ isOpen, onClose }) => {
  const store = useArmStore();
  const [result, setResult] = useState<ReturnType<typeof runKinematicsSelfCheck> | null>(null);

  if (!isOpen) return null;

  const handleRunTest = () => {
    const res = runKinematicsSelfCheck(store.dims, store.calib, store.configs);
    setResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-sans">
      <div className="max-w-md w-full clay-card rounded-3xl p-6 text-[#2c3338] flex flex-col gap-4 border border-[#ffffff]/60 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#d8d3c8] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-[#faedd9] border border-[#d4b08c]/40 text-[#c25e2e]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-[#2c3338]">Kinematics Self-Check</h2>
              <span className="text-[10px] font-mono text-[#78858f]">FK(IK(p)) ≈ p Verification</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#78858f] hover:text-[#2c3338] p-1.5 rounded-full hover:bg-[#d8d3c8]/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#5a6872] leading-relaxed">
          Verifies mathematical consistency of the Forward Kinematics (FK) and Inverse Kinematics (IK) algorithms across the 3-link robotic workspace.
        </p>

        {result ? (
          <div
            className={`p-4 rounded-2xl border text-xs font-mono flex flex-col gap-2 ${
              result.passed
                ? 'bg-[#eef6f0] border-[#9fcfad] text-[#2b633d]'
                : 'bg-[#fbeeed] border-[#e8a39e] text-[#932a24]'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {result.passed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#2b633d] shrink-0" />
                  <span>ALL TESTS PASSED</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-[#932a24] shrink-0" />
                  <span>DEVIATION EXCEEDED</span>
                </>
              )}
            </div>
            <div className="text-xs mt-1 text-[#4a5860]">{result.summary}</div>
            <div className="text-[11px] text-[#6c7b85]">
              Max Position Error: <span className="font-bold text-[#2c3338]">{result.maxErrorCm} cm</span> (Tolerance: 0.05 cm)
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl clay-inset text-xs text-[#6c7b85] text-center">
            Click Run Test to evaluate 27 spatial test poses against the analytical 2-link + yaw planar solver.
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            onClick={handleRunTest}
            className="clay-btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Run Test
          </button>
          <button
            onClick={onClose}
            className="clay-btn px-4 py-2 text-xs font-semibold text-[#5a6872]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
