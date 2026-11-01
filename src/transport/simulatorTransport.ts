/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transport } from './transport.ts';
import { JointAngles, JointConfig } from '../types/arm.ts';

export class SimulatorTransport implements Transport {
  private lineCallback: ((line: string) => void) | null = null;
  private statusCallback: ((s: 'connected' | 'disconnected' | 'connecting' | 'error') => void) | null = null;
  private isConnected = false;

  // Actual simulated physical angles
  private actual: JointAngles = { base: 90, shoulder: 90, elbow: 90 };
  // Commanded target angles
  private target: JointAngles = { base: 90, shoulder: 90, elbow: 90 };
  // Servo enabled
  private servosEnabled = true;

  // Filter parameters: TAU (time constant in ms, default 50ms)
  private tauMs = 50;
  // Slew rate cap: 360 deg/sec
  private readonly maxSlewDps = 360;

  // Stream telemetry interval
  private streamIntervalMs = 30;
  private streamTimer: ReturnType<typeof setInterval> | null = null;
  private simTimer: ReturnType<typeof setInterval> | null = null;
  private lastSimTime = performance.now();

  // Config per channel
  private configs: JointConfig[] = [
    {
      channel: 0,
      name: 'BASE',
      minUs: 500,
      maxUs: 2500,
      minLimit: 0,
      maxLimit: 180,
      trim: 0,
      reverse: false,
      home: 90,
      speedDps: 120,
    },
    {
      channel: 1,
      name: 'SHOULDER',
      minUs: 500,
      maxUs: 2500,
      minLimit: 0,
      maxLimit: 180,
      trim: 0,
      reverse: false,
      home: 90,
      speedDps: 120,
    },
    {
      channel: 2,
      name: 'ARM',
      minUs: 500,
      maxUs: 2500,
      minLimit: 0,
      maxLimit: 180,
      trim: 0,
      reverse: false,
      home: 90,
      speedDps: 120,
    },
  ];

  async connect(): Promise<void> {
    this.statusCallback?.('connecting');
    await new Promise((res) => setTimeout(res, 80));
    this.isConnected = true;
    this.startSimulation();
    this.startStreaming();
    this.statusCallback?.('connected');
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.stopStreaming();
    this.stopSimulation();
    this.statusCallback?.('disconnected');
  }

  onLine(cb: (line: string) => void): void {
    this.lineCallback = cb;
  }

  onStatus(cb: (s: 'connected' | 'disconnected' | 'connecting' | 'error') => void): void {
    this.statusCallback = cb;
  }

  private reply(line: string) {
    if (!this.isConnected || !this.lineCallback) return;
    // Deliver async to mimic UART
    setTimeout(() => {
      this.lineCallback?.(line);
    }, 2);
  }

  async write(line: string): Promise<void> {
    if (!this.isConnected) return;
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed === 'PING') {
      this.reply('PONG');
      return;
    }

    if (trimmed === 'VER') {
      this.reply('ESP32-Arm-v1.4.2 (Simulator)');
      return;
    }

    if (trimmed === 'GET') {
      this.reply(
        `ST ${this.actual.base.toFixed(1)} ${this.actual.shoulder.toFixed(1)} ${this.actual.elbow.toFixed(1)}`
      );
      return;
    }

    if (trimmed === 'CFG') {
      for (const c of this.configs) {
        this.reply(
          `CFG ${c.channel} ${c.name} us=${c.minUs}-${c.maxUs} lim=${c.minLimit}-${c.maxLimit} trim=${c.trim} rev=${c.reverse ? 1 : 0} home=${c.home} v=${c.speedDps}`
        );
      }
      return;
    }

    // Live drag: L <b> <s> <a> (silent, no reply)
    if (trimmed.startsWith('L ')) {
      const parts = trimmed.split(/\s+/).slice(1);
      if (parts.length >= 3) {
        const b = parseFloat(parts[0]);
        const s = parseFloat(parts[1]);
        const a = parseFloat(parts[2]);
        if (!isNaN(b)) this.target.base = Math.max(this.configs[0].minLimit, Math.min(this.configs[0].maxLimit, b));
        if (!isNaN(s)) this.target.shoulder = Math.max(this.configs[1].minLimit, Math.min(this.configs[1].maxLimit, s));
        if (!isNaN(a)) this.target.elbow = Math.max(this.configs[2].minLimit, Math.min(this.configs[2].maxLimit, a));
      }
      return;
    }

    // Smooth move: S <ch> <deg>
    if (trimmed.startsWith('S ')) {
      const parts = trimmed.split(/\s+/).slice(1);
      if (parts.length >= 2) {
        const ch = parseInt(parts[0], 10);
        const deg = parseFloat(parts[1]);
        if (ch === 0) this.target.base = Math.max(this.configs[0].minLimit, Math.min(this.configs[0].maxLimit, deg));
        else if (ch === 1) this.target.shoulder = Math.max(this.configs[1].minLimit, Math.min(this.configs[1].maxLimit, deg));
        else if (ch === 2) this.target.elbow = Math.max(this.configs[2].minLimit, Math.min(this.configs[2].maxLimit, deg));
      }
      this.reply('OK');
      return;
    }

    // Smooth move all: A <b> <s> <a>
    if (trimmed.startsWith('A ')) {
      const parts = trimmed.split(/\s+/).slice(1);
      if (parts.length >= 3) {
        const b = parseFloat(parts[0]);
        const s = parseFloat(parts[1]);
        const a = parseFloat(parts[2]);
        if (!isNaN(b)) this.target.base = Math.max(this.configs[0].minLimit, Math.min(this.configs[0].maxLimit, b));
        if (!isNaN(s)) this.target.shoulder = Math.max(this.configs[1].minLimit, Math.min(this.configs[1].maxLimit, s));
        if (!isNaN(a)) this.target.elbow = Math.max(this.configs[2].minLimit, Math.min(this.configs[2].maxLimit, a));
      }
      this.reply('OK');
      return;
    }

    // V <dps> or V <ch> <dps>
    if (trimmed.startsWith('V ') || trimmed === 'V') {
      const parts = trimmed.split(/\s+/).slice(1);
      if (parts.length === 1) {
        const v = parseFloat(parts[0]);
        for (const c of this.configs) c.speedDps = v;
      } else if (parts.length >= 2) {
        const ch = parseInt(parts[0], 10);
        const v = parseFloat(parts[1]);
        if (ch >= 0 && ch < 3) this.configs[ch].speedDps = v;
      }
      this.reply('OK');
      return;
    }

    // TAU <ms>
    if (trimmed.startsWith('TAU ')) {
      const ms = parseFloat(trimmed.split(/\s+/)[1]);
      if (!isNaN(ms) && ms >= 10 && ms <= 300) {
        this.tauMs = ms;
        this.reply('OK');
      } else {
        this.reply('ERR range');
      }
      return;
    }

    // STOP
    if (trimmed === 'STOP') {
      this.target.base = this.actual.base;
      this.target.shoulder = this.actual.shoulder;
      this.target.elbow = this.actual.elbow;
      this.reply('OK');
      return;
    }

    // HOME
    if (trimmed === 'HOME') {
      this.target.base = this.configs[0].home;
      this.target.shoulder = this.configs[1].home;
      this.target.elbow = this.configs[2].home;
      this.reply('OK');
      return;
    }

    // SETHOME
    if (trimmed === 'SETHOME') {
      this.configs[0].home = Math.round(this.actual.base);
      this.configs[1].home = Math.round(this.actual.shoulder);
      this.configs[2].home = Math.round(this.actual.elbow);
      this.reply('OK');
      return;
    }

    // E 0|1
    if (trimmed.startsWith('E ')) {
      const state = trimmed.split(/\s+/)[1];
      this.servosEnabled = state === '1';
      this.reply('OK');
      return;
    }

    // LIM <ch> <min> <max>
    if (trimmed.startsWith('LIM ')) {
      const parts = trimmed.split(/\s+/).slice(1);
      if (parts.length >= 3) {
        const ch = parseInt(parts[0], 10);
        const min = parseFloat(parts[1]);
        const max = parseFloat(parts[2]);
        if (ch >= 0 && ch < 3 && min >= 0 && max <= 180 && min <= max) {
          this.configs[ch].minLimit = min;
          this.configs[ch].maxLimit = max;
          this.reply('OK');
          return;
        }
      }
      this.reply('ERR range');
      return;
    }

    // PW <ch> <minUs> <maxUs>
    if (trimmed.startsWith('PW ')) {
      const parts = trimmed.split(/\s+/).slice(1);
      if (parts.length >= 3) {
        const ch = parseInt(parts[0], 10);
        const minUs = parseFloat(parts[1]);
        const maxUs = parseFloat(parts[2]);
        if (ch >= 0 && ch < 3 && minUs >= 400 && maxUs <= 2600 && minUs < maxUs) {
          this.configs[ch].minUs = minUs;
          this.configs[ch].maxUs = maxUs;
          this.reply('OK');
          return;
        }
      }
      this.reply('ERR range');
      return;
    }

    // TRIM <ch> <deg>
    if (trimmed.startsWith('TRIM ')) {
      const parts = trimmed.split(/\s+/).slice(1);
      if (parts.length >= 2) {
        const ch = parseInt(parts[0], 10);
        const deg = parseFloat(parts[1]);
        if (ch >= 0 && ch < 3 && deg >= -45 && deg <= 45) {
          this.configs[ch].trim = deg;
          this.reply('OK');
          return;
        }
      }
      this.reply('ERR range');
      return;
    }

    // REV <ch> <0|1>
    if (trimmed.startsWith('REV ')) {
      const parts = trimmed.split(/\s+/).slice(1);
      if (parts.length >= 2) {
        const ch = parseInt(parts[0], 10);
        const rev = parseInt(parts[1], 10);
        if (ch >= 0 && ch < 3 && (rev === 0 || rev === 1)) {
          this.configs[ch].reverse = rev === 1;
          this.reply('OK');
          return;
        }
      }
      this.reply('ERR range');
      return;
    }

    // STREAM <ms>
    if (trimmed.startsWith('STREAM ')) {
      const ms = parseInt(trimmed.split(/\s+/)[1], 10);
      if (!isNaN(ms)) {
        this.streamIntervalMs = ms;
        this.startStreaming();
        this.reply('OK');
      } else {
        this.reply('ERR range');
      }
      return;
    }

    // SAVE / LOAD / DEFAULTS
    if (trimmed === 'SAVE' || trimmed === 'LOAD' || trimmed === 'DEFAULTS') {
      if (trimmed === 'DEFAULTS') {
        this.tauMs = 50;
        this.configs[0].home = 90;
        this.configs[1].home = 90;
        this.configs[2].home = 90;
      }
      this.reply('OK');
      return;
    }

    // Unknown command
    this.reply('ERR unknown');
  }

  private startSimulation() {
    this.stopSimulation();
    this.lastSimTime = performance.now();
    this.simTimer = setInterval(() => {
      this.stepSimulation();
    }, 10);
  }

  private stopSimulation() {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
  }

  private stepSimulation() {
    const now = performance.now();
    const dt = Math.max(0.001, (now - this.lastSimTime) / 1000);
    this.lastSimTime = now;

    if (!this.servosEnabled) return;

    // Filter time constant
    const tauSec = Math.max(0.01, this.tauMs / 1000);
    const alpha = 1 - Math.exp(-dt / tauSec);
    const maxStep = this.maxSlewDps * dt;

    const filterJoint = (cur: number, tgt: number) => {
      const rawDelta = (tgt - cur) * alpha;
      const clampedDelta = Math.max(-maxStep, Math.min(maxStep, rawDelta));
      return cur + clampedDelta;
    };

    this.actual.base = filterJoint(this.actual.base, this.target.base);
    this.actual.shoulder = filterJoint(this.actual.shoulder, this.target.shoulder);
    this.actual.elbow = filterJoint(this.actual.elbow, this.target.elbow);
  }

  private startStreaming() {
    this.stopStreaming();
    if (this.streamIntervalMs <= 0) return;
    this.streamTimer = setInterval(() => {
      if (!this.isConnected || !this.lineCallback) return;
      this.lineCallback(
        `ST ${this.actual.base.toFixed(1)} ${this.actual.shoulder.toFixed(1)} ${this.actual.elbow.toFixed(1)}`
      );
    }, this.streamIntervalMs);
  }

  private stopStreaming() {
    if (this.streamTimer) {
      clearInterval(this.streamTimer);
      this.streamTimer = null;
    }
  }
}
