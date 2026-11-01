/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useArmStore } from './useArmStore.ts';
import { Send, Trash2, ArrowDown } from 'lucide-react';

export const ConsoleTab: React.FC = () => {
  const store = useArmStore();
  const [filter, setFilter] = useState<'all' | 'tx' | 'rx'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [inputCmd, setInputCmd] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [store.consoleLogs.length, autoScroll]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputCmd.trim();
    if (!trimmed) return;

    store.writeRaw(trimmed);
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInputCmd('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInputCmd(history[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= history.length) {
        setHistoryIndex(-1);
        setInputCmd('');
      } else {
        setHistoryIndex(nextIdx);
        setInputCmd(history[nextIdx]);
      }
    }
  };

  const filteredLogs = store.consoleLogs.filter((log) => {
    if (filter === 'all') return true;
    return log.direction === filter;
  });

  const quickCommands = ['PING', 'VER', 'GET', 'CFG', 'STREAM 30', 'TAU 50'];

  return (
    <div className="flex flex-col gap-2.5 h-full font-sans text-xs">
      {/* Console Toolbar */}
      <div className="flex items-center justify-between gap-2 p-1.5 clay-inset rounded-full text-[11px]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full font-bold transition ${
              filter === 'all'
                ? 'clay-pill-active text-white'
                : 'text-[#64748b] hover:text-[#2d3142]'
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => setFilter('tx')}
            className={`px-3 py-1 rounded-full font-bold transition ${
              filter === 'tx'
                ? 'clay-pill-active text-white'
                : 'text-[#64748b] hover:text-[#2d3142]'
            }`}
          >
            TX
          </button>
          <button
            onClick={() => setFilter('rx')}
            className={`px-3 py-1 rounded-full font-bold transition ${
              filter === 'rx'
                ? 'clay-pill-active text-white'
                : 'text-[#64748b] hover:text-[#2d3142]'
            }`}
          >
            RX
          </button>
        </div>

        <div className="flex items-center gap-2 pr-2">
          <label className="flex items-center gap-1 cursor-pointer text-[#64748b] hover:text-[#2d3142] font-semibold">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded text-[#d97757] focus:ring-0 w-3 h-3"
            />
            <ArrowDown className="w-3 h-3 text-[#d97757]" />
            <span>Scroll</span>
          </label>

          <button
            onClick={() => store.clearLogs()}
            title="Clear Console"
            className="p-1.5 clay-btn text-[#78716c] hover:text-[#dc2626]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Command Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        {quickCommands.map((cmd) => (
          <button
            key={cmd}
            onClick={() => store.writeRaw(cmd)}
            className="px-3 py-1 clay-btn font-mono text-[#d97757] text-[10px] whitespace-nowrap font-bold"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Log Feed */}
      <div className="flex-1 clay-inset rounded-2xl p-3 overflow-y-auto max-h-56 min-h-[140px] flex flex-col gap-1.5 text-[11px] font-mono">
        {filteredLogs.length === 0 ? (
          <div className="text-[#89929a] text-center py-8 font-sans">No log entries</div>
        ) : (
          filteredLogs.map((log) => {
            let badgeBg = 'bg-[#d8d2c7] text-[#4a5568]';
            let badgeLabel = 'SYS';
            let textColor = 'text-[#333842]';

            if (log.direction === 'tx') {
              badgeBg = 'bg-[#d97757] text-white';
              badgeLabel = 'TX';
              textColor = 'text-[#c2410c]';
            } else if (log.direction === 'rx') {
              badgeBg = 'bg-[#4f8a6b] text-white';
              badgeLabel = 'RX';
              textColor = 'text-[#15803d]';
            }

            return (
              <div key={log.id} className="flex items-baseline gap-2 leading-tight">
                <span className="text-[10px] text-[#78716c] shrink-0 font-sans">{log.time}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${badgeBg}`}>
                  {badgeLabel}
                </span>
                <span className={`break-all font-semibold ${textColor}`}>{log.text}</span>
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>

      {/* Command Input Form */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          placeholder="Command (e.g. S 0 90, LIM 1 20 160, CFG)"
          value={inputCmd}
          onChange={(e) => setInputCmd(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 clay-inset rounded-full px-4 py-2 text-[#2d3142] font-mono text-xs placeholder:text-[#89929a] font-semibold focus:outline-none"
        />
        <button
          type="submit"
          disabled={!inputCmd.trim()}
          className="px-4 py-2 clay-btn-primary font-bold disabled:opacity-40 flex items-center gap-1.5 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
