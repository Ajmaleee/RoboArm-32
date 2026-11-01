/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useArmStore } from './useArmStore.ts';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const store = useArmStore();

  if (store.toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none font-sans">
      {store.toasts.map((toast) => {
        let cardStyle = 'bg-[#eeebe5] border-[#d4cfc4] text-[#2c3338]';
        let Icon = Info;
        let iconColor = 'text-[#4a5860]';

        if (toast.type === 'error') {
          cardStyle = 'bg-[#fbeeed] border-[#e8a39e] text-[#932a24]';
          Icon = AlertCircle;
          iconColor = 'text-[#932a24]';
        } else if (toast.type === 'success') {
          cardStyle = 'bg-[#eef6f0] border-[#9fcfad] text-[#2b633d]';
          Icon = CheckCircle2;
          iconColor = 'text-[#2b633d]';
        } else if (toast.type === 'warning') {
          cardStyle = 'bg-[#faedd9] border-[#d4b08c] text-[#8c5825]';
          Icon = AlertTriangle;
          iconColor = 'text-[#8c5825]';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl border shadow-lg shadow-black/10 text-xs font-mono transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${cardStyle}`}
            style={{
              boxShadow: '4px 4px 10px rgba(0, 0, 0, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.9)',
            }}
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
              <span className="truncate font-medium">{toast.text}</span>
            </div>
            <button
              onClick={() => store.removeToast(toast.id)}
              className="text-[#78858f] hover:text-[#2c3338] p-1 rounded-full hover:bg-black/5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
