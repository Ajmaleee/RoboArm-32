/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { JointAngles, JointConfig } from '../types/arm.ts';

export interface ProtocolMessage {
  type: 'pong' | 'status' | 'config' | 'ok' | 'error' | 'text';
  raw: string;
  angles?: JointAngles;
  config?: JointConfig;
  error?: string;
  text?: string;
}

export function parseProtocolLine(line: string): ProtocolMessage {
  const trimmed = line.trim();
  if (!trimmed) {
    return { type: 'text', raw: line, text: '' };
  }

  if (trimmed === 'PONG') {
    return { type: 'pong', raw: trimmed };
  }

  if (trimmed === 'OK') {
    return { type: 'ok', raw: trimmed };
  }

  if (trimmed.startsWith('ERR')) {
    const errorMsg = trimmed.replace(/^ERR\s*/, '') || 'Unknown error';
    return { type: 'error', raw: trimmed, error: errorMsg };
  }

  // ST <b> <s> <a>
  if (trimmed.startsWith('ST ')) {
    const parts = trimmed.split(/\s+/).slice(1);
    if (parts.length >= 3) {
      const b = parseFloat(parts[0]);
      const s = parseFloat(parts[1]);
      const a = parseFloat(parts[2]);
      if (!isNaN(b) && !isNaN(s) && !isNaN(a)) {
        return {
          type: 'status',
          raw: trimmed,
          angles: { base: b, shoulder: s, elbow: a },
        };
      }
    }
  }

  // CFG <i> <NAME> us=<min>-<max> lim=<min>-<max> trim=<t> rev=<0/1> home=<h> v=<dps>
  if (trimmed.startsWith('CFG ')) {
    const parsed = parseConfigLine(trimmed);
    if (parsed) {
      return { type: 'config', raw: trimmed, config: parsed };
    }
  }

  return { type: 'text', raw: trimmed, text: trimmed };
}

function parseConfigLine(line: string): JointConfig | null {
  const parts = line.split(/\s+/);
  if (parts.length < 3) return null;
  const channel = parseInt(parts[1], 10);
  const name = parts[2];
  if (isNaN(channel)) return null;

  let minUs = 500;
  let maxUs = 2500;
  let minLimit = 0;
  let maxLimit = 180;
  let trim = 0;
  let reverse = false;
  let home = 90;
  let speedDps = 120;

  for (let i = 3; i < parts.length; i++) {
    const token = parts[i];
    if (token.startsWith('us=')) {
      const [min, max] = token.substring(3).split('-').map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        minUs = min;
        maxUs = max;
      }
    } else if (token.startsWith('lim=')) {
      const [min, max] = token.substring(4).split('-').map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        minLimit = min;
        maxLimit = max;
      }
    } else if (token.startsWith('trim=')) {
      const val = parseFloat(token.substring(5));
      if (!isNaN(val)) trim = val;
    } else if (token.startsWith('rev=')) {
      const val = parseInt(token.substring(4), 10);
      reverse = val === 1;
    } else if (token.startsWith('home=')) {
      const val = parseFloat(token.substring(5));
      if (!isNaN(val)) home = val;
    } else if (token.startsWith('v=')) {
      const val = parseFloat(token.substring(2));
      if (!isNaN(val)) speedDps = val;
    }
  }

  return {
    channel,
    name,
    minUs,
    maxUs,
    minLimit,
    maxLimit,
    trim,
    reverse,
    home,
    speedDps,
  };
}

export function formatLiveDrag(angles: JointAngles): string {
  return `L ${angles.base.toFixed(1)} ${angles.shoulder.toFixed(1)} ${angles.elbow.toFixed(1)}\n`;
}

export function formatMoveAll(angles: JointAngles): string {
  return `A ${angles.base.toFixed(1)} ${angles.shoulder.toFixed(1)} ${angles.elbow.toFixed(1)}\n`;
}

export function formatMoveSingle(channel: number, angle: number): string {
  return `S ${channel} ${angle.toFixed(1)}\n`;
}

export function formatSpeed(channelOrAll: number | null, dps: number): string {
  if (channelOrAll === null) {
    return `V ${Math.round(dps)}\n`;
  }
  return `V ${channelOrAll} ${Math.round(dps)}\n`;
}

export function formatTau(ms: number): string {
  return `TAU ${Math.round(ms)}\n`;
}

export function formatStream(ms: number): string {
  return `STREAM ${Math.round(ms)}\n`;
}

export function formatLimits(channel: number, min: number, max: number): string {
  return `LIM ${channel} ${Math.round(min)} ${Math.round(max)}\n`;
}

export function formatPulseWidth(channel: number, minUs: number, maxUs: number): string {
  return `PW ${channel} ${Math.round(minUs)} ${Math.round(maxUs)}\n`;
}

export function formatTrim(channel: number, trimDeg: number): string {
  return `TRIM ${channel} ${Math.round(trimDeg)}\n`;
}

export function formatReverse(channel: number, rev: boolean): string {
  return `REV ${channel} ${rev ? 1 : 0}\n`;
}

export function formatServoEnable(enabled: boolean): string {
  return `E ${enabled ? 1 : 0}\n`;
}
