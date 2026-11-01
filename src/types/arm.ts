/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface JointAngles {
  base: number;     // 0..180 degrees
  shoulder: number; // 0..180 degrees
  elbow: number;    // 0..180 degrees
}

export interface JointConfig {
  channel: number; // 0: Base, 1: Shoulder, 2: Arm/Elbow
  name: string;
  minUs: number;   // default 500
  maxUs: number;   // default 2500
  minLimit: number; // 0..180
  maxLimit: number; // 0..180
  trim: number;    // -45..+45
  reverse: boolean;// 0 or 1
  home: number;    // default 90
  speedDps: number;// degrees per second, 0 = instant
}

export interface ArmDimensions {
  basePlateDiameter: number;   // cm, default 12
  basePlateHeight: number;     // cm, default 1.2
  turntableDiameter: number;   // cm, default 9
  turntableHeight: number;     // cm, default 3
  shoulderPivotHeight: number; // cm, default 7 (from turntable top)
  upperArmLength: number;      // cm, default 10.5
  forearmLength: number;       // cm, default 10
  endStubLength: number;       // cm, default 4
}

export interface ArmCalibration {
  // Calibration mapping for 3D view: servo angle = sign * visualAngle + offset
  baseOffset: number;     // default 90
  baseSign: number;       // default 1
  shoulderOffset: number; // default 90
  shoulderSign: number;   // default 1
  elbowOffset: number;    // default 0
  elbowSign: number;      // default 1
}

export interface PosePreset {
  id: string;
  name: string;
  angles: JointAngles;
  speedDps?: number;
  delayMs?: number;
}

export type TransportType = 'simulator' | 'webserial' | 'native_bt';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type InteractionMode = 'control' | 'orbit';
export type IKMode = 'elbow_up' | 'elbow_down';

export interface SceneOverlays {
  axes: boolean;
  angleArcs: boolean;
  reachDome: boolean;
  labels: boolean;
  ghost: boolean;
  lockVerticalPlane: boolean;
}
