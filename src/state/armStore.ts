/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ArmCalibration,
  ArmDimensions,
  ConnectionStatus,
  InteractionMode,
  JointAngles,
  JointConfig,
  PosePreset,
  SceneOverlays,
  TransportType,
} from '../types/arm.ts';
import { Transport } from '../transport/transport.ts';
import { SimulatorTransport } from '../transport/simulatorTransport.ts';
import { WebSerialTransport } from '../transport/webSerialTransport.ts';
import { NativeBluetoothTransport } from '../transport/nativeBluetoothTransport.ts';
import {
  formatLiveDrag,
  formatMoveAll,
  formatMoveSingle,
  formatSpeed,
  formatTau,
  formatStream,
  formatLimits,
  formatPulseWidth,
  formatTrim,
  formatReverse,
  formatServoEnable,
  parseProtocolLine,
} from '../protocol/protocol.ts';

export interface ConsoleEntry {
  id: string;
  time: string;
  direction: 'tx' | 'rx' | 'sys';
  text: string;
}

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

// Default storage keys
const STORAGE_POSES_KEY = 'arm3d_poses_v1';
const STORAGE_CONFIGS_KEY = 'arm3d_configs_v1';
const STORAGE_DIMS_KEY = 'arm3d_dims_v1';
const STORAGE_CALIB_KEY = 'arm3d_calib_v1';
const STORAGE_TAU_KEY = 'arm3d_tau_v1';

const defaultDims: ArmDimensions = {
  basePlateDiameter: 12,
  basePlateHeight: 1.2,
  turntableDiameter: 9,
  turntableHeight: 3,
  shoulderPivotHeight: 7,
  upperArmLength: 10.5,
  forearmLength: 10,
  endStubLength: 4,
};

const defaultCalib: ArmCalibration = {
  baseOffset: 90,
  baseSign: 1,
  shoulderOffset: 90,
  shoulderSign: 1,
  elbowOffset: 0,
  elbowSign: 1,
};

const defaultConfigs: JointConfig[] = [
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

const defaultPresets: PosePreset[] = [
  {
    id: 'p-home',
    name: 'Home Stand',
    angles: { base: 90, shoulder: 90, elbow: 90 },
    speedDps: 100,
    delayMs: 800,
  },
  {
    id: 'p-reach-fwd',
    name: 'Forward Reach',
    angles: { base: 90, shoulder: 60, elbow: 90 },
    speedDps: 90,
    delayMs: 1000,
  },
  {
    id: 'p-low-pickup',
    name: 'Low Pickup',
    angles: { base: 90, shoulder: 45, elbow: 135 },
    speedDps: 80,
    delayMs: 1200,
  },
  {
    id: 'p-sweep-left',
    name: 'Sweep Left',
    angles: { base: 45, shoulder: 70, elbow: 80 },
    speedDps: 120,
    delayMs: 800,
  },
  {
    id: 'p-sweep-right',
    name: 'Sweep Right',
    angles: { base: 135, shoulder: 70, elbow: 80 },
    speedDps: 120,
    delayMs: 800,
  },
  {
    id: 'p-compact-park',
    name: 'Compact Park',
    angles: { base: 90, shoulder: 110, elbow: 160 },
    speedDps: 70,
    delayMs: 1000,
  },
];

function loadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * ArmController manages the hot-path 50Hz sender loop, telemetry tracking,
 * and high-performance transport I/O.
 */
export class ArmController {
  // Transports
  public transportType: TransportType = 'simulator';
  public transport: Transport;
  public connectionStatus: ConnectionStatus = 'disconnected';

  // Hot path angles (direct refs, no React re-render)
  public targetAngles: JointAngles = { base: 90, shoulder: 90, elbow: 90 };
  public actualAngles: JointAngles = { base: 90, shoulder: 90, elbow: 90 };
  private lastSentAngles: JointAngles = { base: -999, shoulder: -999, elbow: -999 };

  // Sender loop (50 Hz = 20ms)
  private senderInterval: ReturnType<typeof setInterval> | null = null;
  private isWritePending = false;

  // Latency & ST Rate tracking
  public latencyMs = 0;
  private lastPingTime = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  public stRateHz = 0;
  private stCountWindow = 0;
  private stRateInterval: ReturnType<typeof setInterval> | null = null;

  // UI state & configuration
  public configs: JointConfig[] = loadStorage(STORAGE_CONFIGS_KEY, defaultConfigs);
  public dims: ArmDimensions = loadStorage(STORAGE_DIMS_KEY, defaultDims);
  public calib: ArmCalibration = loadStorage(STORAGE_CALIB_KEY, defaultCalib);
  public tauMs: number = loadStorage(STORAGE_TAU_KEY, 50);
  public presets: PosePreset[] = loadStorage(STORAGE_POSES_KEY, defaultPresets);
  public servosEnabled = true;

  public interactionMode: InteractionMode = 'control';
  public overlays: SceneOverlays = {
    axes: true,
    angleArcs: true,
    reachDome: false,
    labels: true,
    ghost: true,
    lockVerticalPlane: false,
  };

  // Console log entries (capped at 200)
  public consoleLogs: ConsoleEntry[] = [];
  public toasts: ToastMessage[] = [];

  // Listeners for UI state reactivity
  private subscribers: Set<() => void> = new Set();

  constructor() {
    this.transport = new SimulatorTransport();
    this.setupTransportListeners();
    this.startSenderLoop();
    this.startTelemetryWatchers();

    // Auto-connect simulator on initial load so the user can test immediately
    this.connect();
  }

  public subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private notify() {
    this.subscribers.forEach((cb) => cb());
  }

  public setTransportType(type: TransportType) {
    if (this.transportType === type) return;
    this.disconnect().finally(() => {
      this.transportType = type;
      if (type === 'simulator') {
        this.transport = new SimulatorTransport();
      } else if (type === 'webserial') {
        this.transport = new WebSerialTransport();
      } else {
        this.transport = new NativeBluetoothTransport();
      }
      this.setupTransportListeners();
      this.notify();
    });
  }

  private setupTransportListeners() {
    this.transport.onStatus((status) => {
      this.connectionStatus = status;
      this.log('sys', `Transport status: ${status}`);
      if (status === 'connected') {
        this.onConnectedSequence();
      } else if (status === 'disconnected' || status === 'error') {
        this.latencyMs = 0;
      }
      this.notify();
    });

    this.transport.onLine((line) => {
      this.handleIncomingLine(line);
    });
  }

  public async connect(): Promise<void> {
    try {
      this.log('sys', `Connecting using ${this.transportType}...`);
      await this.transport.connect();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addToast('error', msg);
      this.log('sys', `Connection error: ${msg}`);
      this.notify();
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.transport.disconnect();
    } catch (e) {
      console.warn('Disconnect error:', e);
    }
  }

  /**
   * On connect sequence:
   * Send in this order: PING, VER, CFG, STREAM 30, TAU 50
   */
  private async onConnectedSequence() {
    this.addToast('success', 'Connected to robotic arm');
    try {
      await this.writeRaw('PING\n');
      await this.writeRaw('VER\n');
      await this.writeRaw('CFG\n');
      await this.writeRaw(formatStream(30));
      await this.writeRaw(formatTau(this.tauMs));
    } catch (e) {
      console.warn('Error in connect handshake sequence:', e);
    }
  }

  /**
   * High-priority sender loop at 50 Hz (20ms)
   * Sends ONE line L <base> <shoulder> <arm>\n (angles with 1 decimal)
   * ONLY if pose changed by more than 0.2° since last sent.
   * Latest-wins: never queue. If previous write is pending, skip frame.
   */
  private startSenderLoop() {
    if (this.senderInterval) clearInterval(this.senderInterval);

    this.senderInterval = setInterval(() => {
      if (this.connectionStatus !== 'connected') return;
      if (this.isWritePending) return; // Skip if previous write is still pending

      const db = Math.abs(this.targetAngles.base - this.lastSentAngles.base);
      const ds = Math.abs(this.targetAngles.shoulder - this.lastSentAngles.shoulder);
      const de = Math.abs(this.targetAngles.elbow - this.lastSentAngles.elbow);

      // 0.2° threshold
      if (db > 0.2 || ds > 0.2 || de > 0.2) {
        this.sendLivePose(this.targetAngles);
      }
    }, 20); // 50 Hz
  }

  public sendLivePose(angles: JointAngles) {
    if (this.connectionStatus !== 'connected' || this.isWritePending) return;

    this.isWritePending = true;
    const line = formatLiveDrag(angles);
    this.lastSentAngles = { ...angles };

    this.transport
      .write(line)
      .catch((e) => {
        console.warn('Live drag write failed:', e);
      })
      .finally(() => {
        this.isWritePending = false;
      });

    this.log('tx', line.trim());
  }

  /**
   * On pointer release: send the exact final pose once more.
   */
  public onPointerRelease(finalAngles: JointAngles) {
    this.targetAngles = { ...finalAngles };
    if (this.transportType === 'simulator') {
      this.actualAngles = { ...finalAngles };
    }
    if (this.connectionStatus === 'connected') {
      const line = formatLiveDrag(finalAngles);
      this.lastSentAngles = { ...finalAngles };
      this.isWritePending = true;
      this.transport
        .write(line)
        .catch((e) => console.warn(e))
        .finally(() => {
          this.isWritePending = false;
        });
      this.log('tx', line.trim());
    }
    this.notify();
  }

  /**
   * Target angle update from handles, sliders, or IK
   */
  public updateTarget(newAngles: Partial<JointAngles>) {
    if (newAngles.base !== undefined) this.targetAngles.base = Number(newAngles.base);
    if (newAngles.shoulder !== undefined) this.targetAngles.shoulder = Number(newAngles.shoulder);
    if (newAngles.elbow !== undefined) this.targetAngles.elbow = Number(newAngles.elbow);
    if (this.transportType === 'simulator') {
      this.actualAngles = { ...this.targetAngles };
    }
    this.notify();
  }

  /**
   * Telemetry watchers:
   * 1. ST rate calculation every 1 sec
   * 2. Round-trip ping latency every 2 sec
   */
  private startTelemetryWatchers() {
    this.stRateInterval = setInterval(() => {
      this.stRateHz = this.stCountWindow;
      this.stCountWindow = 0;
      this.notify();
    }, 1000);

    this.pingInterval = setInterval(() => {
      if (this.connectionStatus === 'connected') {
        this.lastPingTime = performance.now();
        this.writeRaw('PING\n').catch(() => {});
      }
    }, 2000);
  }

  private handleIncomingLine(line: string) {
    this.log('rx', line);
    const msg = parseProtocolLine(line);

    if (msg.type === 'status' && msg.angles) {
      this.actualAngles = msg.angles;
      this.stCountWindow++;
      // No heavy notify on every ST to preserve 60fps render loop; scene reads actualAngles directly
    } else if (msg.type === 'pong') {
      if (this.lastPingTime > 0) {
        this.latencyMs = Math.max(1, Math.round(performance.now() - this.lastPingTime));
        this.lastPingTime = 0;
        this.notify();
      }
    } else if (msg.type === 'config' && msg.config) {
      const ch = msg.config.channel;
      if (ch >= 0 && ch < 3) {
        this.configs[ch] = msg.config;
        saveStorage(STORAGE_CONFIGS_KEY, this.configs);
        this.notify();
      }
    } else if (msg.type === 'error') {
      this.addToast('error', `Firmware: ${msg.error || 'Command error'}`);
      this.notify();
    }
  }

  public async writeRaw(cmd: string): Promise<void> {
    const line = cmd.endsWith('\n') ? cmd : cmd + '\n';
    this.log('tx', line.trim());
    await this.transport.write(line);
  }

  // --- ACTIONS & TUNE COMMANDS ---

  public async sendSmoothMove(angles: JointAngles, speedDps?: number) {
    this.targetAngles = { ...angles };
    if (speedDps !== undefined && speedDps > 0) {
      await this.writeRaw(formatSpeed(null, speedDps));
    }
    await this.writeRaw(formatMoveAll(angles));
    this.notify();
  }

  public async sendSingleJoint(channel: number, angle: number) {
    if (channel === 0) this.targetAngles.base = angle;
    if (channel === 1) this.targetAngles.shoulder = angle;
    if (channel === 2) this.targetAngles.elbow = angle;
    await this.writeRaw(formatMoveSingle(channel, angle));
    this.notify();
  }

  public async sendStop() {
    await this.writeRaw('STOP\n');
    this.targetAngles = { ...this.actualAngles };
    this.addToast('warning', 'Emergency STOP issued');
    this.notify();
  }

  public async sendHome() {
    await this.writeRaw('HOME\n');
    this.targetAngles = {
      base: this.configs[0].home,
      shoulder: this.configs[1].home,
      elbow: this.configs[2].home,
    };
    this.notify();
  }

  public async sendSetHome() {
    await this.writeRaw('SETHOME\n');
    this.configs[0].home = Math.round(this.actualAngles.base);
    this.configs[1].home = Math.round(this.actualAngles.shoulder);
    this.configs[2].home = Math.round(this.actualAngles.elbow);
    saveStorage(STORAGE_CONFIGS_KEY, this.configs);
    this.addToast('success', `Current pose saved as HOME: (${this.configs[0].home}°, ${this.configs[1].home}°, ${this.configs[2].home}°)`);
    this.notify();
  }

  public async toggleServos() {
    this.servosEnabled = !this.servosEnabled;
    await this.writeRaw(formatServoEnable(this.servosEnabled));
    this.addToast('info', `Servos ${this.servosEnabled ? 'ENABLED' : 'DISABLED'}`);
    this.notify();
  }

  public async sendTau(tau: number) {
    this.tauMs = tau;
    saveStorage(STORAGE_TAU_KEY, tau);
    await this.writeRaw(formatTau(tau));
    this.notify();
  }

  public async applyJointConfig(channel: number, config: JointConfig) {
    this.configs[channel] = { ...config };
    saveStorage(STORAGE_CONFIGS_KEY, this.configs);

    await this.writeRaw(formatLimits(channel, config.minLimit, config.maxLimit));
    await this.writeRaw(formatPulseWidth(channel, config.minUs, config.maxUs));
    await this.writeRaw(formatTrim(channel, config.trim));
    await this.writeRaw(formatReverse(channel, config.reverse));
    await this.writeRaw(formatSpeed(channel, config.speedDps));

    this.addToast('success', `Config sent for Channel ${channel} (${config.name})`);
    this.notify();
  }

  public async sendFlashCommand(cmd: 'SAVE' | 'LOAD' | 'DEFAULTS') {
    await this.writeRaw(`${cmd}\n`);
    if (cmd === 'DEFAULTS') {
      this.configs = defaultConfigs;
      this.tauMs = 50;
      saveStorage(STORAGE_CONFIGS_KEY, this.configs);
      saveStorage(STORAGE_TAU_KEY, 50);
    }
    this.addToast('info', `Flash: ${cmd} executed`);
    this.notify();
  }

  public updateCalibration(calib: ArmCalibration) {
    this.calib = { ...calib };
    saveStorage(STORAGE_CALIB_KEY, this.calib);
    this.notify();
  }

  public updateDimensions(dims: ArmDimensions) {
    this.dims = { ...dims };
    saveStorage(STORAGE_DIMS_KEY, this.dims);
    this.notify();
  }

  // --- PRESETS & SEQUENCE RUNNER ---

  public savePreset(name: string) {
    const newPreset: PosePreset = {
      id: `pose-${Date.now()}`,
      name: name.trim() || `Pose ${this.presets.length + 1}`,
      angles: { ...this.targetAngles },
      speedDps: 90,
      delayMs: 1000,
    };
    this.presets = [...this.presets, newPreset];
    saveStorage(STORAGE_POSES_KEY, this.presets);
    this.addToast('success', `Saved preset: ${newPreset.name}`);
    this.notify();
  }

  public deletePreset(id: string) {
    this.presets = this.presets.filter((p) => p.id !== id);
    saveStorage(STORAGE_POSES_KEY, this.presets);
    this.notify();
  }

  public reorderPresets(fromIndex: number, toIndex: number) {
    const list = [...this.presets];
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    this.presets = list;
    saveStorage(STORAGE_POSES_KEY, this.presets);
    this.notify();
  }

  public exportPresetsJSON(): string {
    return JSON.stringify(this.presets, null, 2);
  }

  public importPresetsJSON(jsonStr: string) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        this.presets = parsed;
        saveStorage(STORAGE_POSES_KEY, this.presets);
        this.addToast('success', `Imported ${parsed.length} presets`);
        this.notify();
      }
    } catch {
      this.addToast('error', 'Invalid JSON preset file');
    }
  }

  // Preset Sequence Execution
  public isRunningSequence = false;
  private cancelSequenceFlag = false;

  public async playSequence(loop: boolean) {
    if (this.presets.length === 0 || this.isRunningSequence) return;
    this.isRunningSequence = true;
    this.cancelSequenceFlag = false;
    this.notify();

    try {
      do {
        for (const preset of this.presets) {
          if (this.cancelSequenceFlag) break;
          await this.sendSmoothMove(preset.angles, preset.speedDps || 90);
          await new Promise((res) => setTimeout(res, preset.delayMs || 1000));
        }
      } while (loop && !this.cancelSequenceFlag);
    } finally {
      this.isRunningSequence = false;
      this.cancelSequenceFlag = false;
      this.notify();
    }
  }

  public stopSequence() {
    this.cancelSequenceFlag = true;
    this.isRunningSequence = false;
    this.notify();
  }

  // --- LOGGING & TOASTS ---

  public log(direction: 'tx' | 'rx' | 'sys', text: string) {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    this.consoleLogs.push({
      id: `${Date.now()}-${Math.random()}`,
      time,
      direction,
      text,
    });
    if (this.consoleLogs.length > 250) {
      this.consoleLogs.splice(0, this.consoleLogs.length - 250);
    }
    // Batch notifications for logs to keep UI fluid
  }

  public clearLogs() {
    this.consoleLogs = [];
    this.notify();
  }

  public addToast(type: 'info' | 'success' | 'warning' | 'error', text: string) {
    const id = `toast-${Date.now()}-${Math.random()}`;
    this.toasts = [...this.toasts, { id, type, text }];
    this.notify();
    setTimeout(() => {
      this.removeToast(id);
    }, 4000);
  }

  public removeToast(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  public setInteractionMode(mode: InteractionMode) {
    this.interactionMode = mode;
    this.notify();
  }

  public setOverlays(overlays: Partial<SceneOverlays>) {
    this.overlays = { ...this.overlays, ...overlays };
    this.notify();
  }

  public dispose() {
    if (this.senderInterval) clearInterval(this.senderInterval);
    if (this.stRateInterval) clearInterval(this.stRateInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.disconnect();
  }
}

// Global controller singleton instance
export const armStore = new ArmController();
