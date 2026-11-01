/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ArmCalibration, ArmDimensions, IKMode, JointAngles, JointConfig } from '../types/arm.ts';

export interface ArmPivots {
  base: THREE.Vector3;
  shoulder: THREE.Vector3;
  elbow: THREE.Vector3;
  toolTip: THREE.Vector3;
}

export interface IKSolution {
  angles: JointAngles;
  reachable: boolean;
  projectedTarget: THREE.Vector3;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Calculates Forward Kinematics (FK) for the 3-servo arm.
 * Returns 3D positions of the base origin, shoulder pivot, elbow pivot, and tool tip.
 */
export function forwardKinematics(
  angles: JointAngles,
  dims: ArmDimensions,
  calib: ArmCalibration
): ArmPivots {
  // Servo angles to physical kinematic angles (degrees)
  // Base: 90° = arm points toward +Z (yaw = 0)
  const yawDeg = calib.baseSign * (angles.base - calib.baseOffset);
  const yawRad = yawDeg * DEG2RAD;

  // Shoulder: 90° = vertical up, <90° leans forward (+Z), >90° leans back (-Z)
  // beta1 is tilt forward from vertical up
  const beta1Deg = calib.shoulderSign * (calib.shoulderOffset - angles.shoulder);
  const beta1Rad = beta1Deg * DEG2RAD;

  // Elbow: 0° = straight in line with upper arm, 90° = horizontal forward L-shape, 180° = folded down
  const armDeg = calib.elbowSign * (angles.elbow - calib.elbowOffset);
  const beta2Deg = beta1Deg + armDeg;
  const beta2Rad = beta2Deg * DEG2RAD;

  // Pivot heights
  const yShoulder = dims.basePlateHeight + dims.turntableHeight + dims.shoulderPivotHeight;
  const shoulderPos = new THREE.Vector3(0, yShoulder, 0);

  // Upper arm vector in 2D arm plane (forward, up)
  const uArmForward = dims.upperArmLength * Math.sin(beta1Rad);
  const uArmUp = dims.upperArmLength * Math.cos(beta1Rad);

  // Elbow position in arm plane
  const elbowForward = uArmForward;
  const elbowUp = yShoulder + uArmUp;

  // Forearm + tool stub vector
  const totalForearmLength = dims.forearmLength + dims.endStubLength;
  const fArmForward = totalForearmLength * Math.sin(beta2Rad);
  const fArmUp = totalForearmLength * Math.cos(beta2Rad);

  const tipForward = elbowForward + fArmForward;
  const tipUp = elbowUp + fArmUp;

  // Rotate arm plane by base yaw (points +Z at yaw = 0)
  // X = forward * sin(yaw), Z = forward * cos(yaw)
  const elbowPos = new THREE.Vector3(
    elbowForward * Math.sin(yawRad),
    elbowUp,
    elbowForward * Math.cos(yawRad)
  );

  const toolTipPos = new THREE.Vector3(
    tipForward * Math.sin(yawRad),
    tipUp,
    tipForward * Math.cos(yawRad)
  );

  return {
    base: new THREE.Vector3(0, 0, 0),
    shoulder: shoulderPos,
    elbow: elbowPos,
    toolTip: toolTipPos,
  };
}

/**
 * Analytic 2-Link Planar IK + Base Yaw
 *
 * Given a target position in 3D world space (cm), computes the required servo angles.
 * If target is out of reach or violates joint limits, clamps to closest reachable position
 * and returns reachable = false.
 */
export function inverseKinematics(
  targetPos: THREE.Vector3,
  dims: ArmDimensions,
  calib: ArmCalibration,
  configs: JointConfig[],
  ikMode: IKMode = 'elbow_up',
  lockVerticalPlane = false,
  lockedYawDeg = 0
): IKSolution {
  let reachable = true;
  const projected = targetPos.clone();

  // 1. Base Yaw calculation
  let yawRad = 0;
  if (lockVerticalPlane) {
    yawRad = lockedYawDeg * DEG2RAD;
    // Project target onto locked vertical plane
    const forwardVec = new THREE.Vector3(Math.sin(yawRad), 0, Math.cos(yawRad));
    const distOnPlane = targetPos.dot(forwardVec);
    projected.x = distOnPlane * Math.sin(yawRad);
    projected.z = distOnPlane * Math.cos(yawRad);
  } else {
    // Standard yaw from target coordinates
    if (Math.abs(targetPos.x) > 1e-4 || Math.abs(targetPos.z) > 1e-4) {
      yawRad = Math.atan2(targetPos.x, targetPos.z);
    } else {
      yawRad = 0;
    }
  }

  const yawDeg = yawRad * RAD2DEG;
  // Servo base angle
  let rawBaseAngle = (yawDeg / calib.baseSign) + calib.baseOffset;

  // 2. Target coordinates in vertical arm plane (forward axis = R, vertical axis = Y)
  const yShoulder = dims.basePlateHeight + dims.turntableHeight + dims.shoulderPivotHeight;
  const rTarget = Math.sqrt(projected.x * projected.x + projected.z * projected.z);
  let dx = rTarget;
  let dy = projected.y - yShoulder;

  const L1 = dims.upperArmLength;
  const L2 = dims.forearmLength + dims.endStubLength;

  let dist = Math.sqrt(dx * dx + dy * dy);
  const maxReach = L1 + L2 - 0.01;
  const minReach = Math.abs(L1 - L2) + 0.01;

  if (dist > maxReach) {
    reachable = false;
    const factor = maxReach / (dist || 1);
    dx *= factor;
    dy *= factor;
    dist = maxReach;
  } else if (dist < minReach) {
    reachable = false;
    const factor = minReach / (dist || 1e-4);
    dx *= factor;
    dy *= factor;
    dist = minReach;
  }

  // 3. Law of Cosines for 2-link planar arm
  // Triangle with sides L1, L2, dist
  const cosGamma1 = (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist);
  const cosGamma2 = (L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2);

  const clampedCosGamma1 = Math.max(-1, Math.min(1, cosGamma1));
  const clampedCosGamma2 = Math.max(-1, Math.min(1, cosGamma2));

  const gamma1 = Math.acos(clampedCosGamma1);
  const gamma2 = Math.acos(clampedCosGamma2);

  // Direction angle from shoulder to target (relative to vertical up)
  const angleToTarget = Math.atan2(dx, dy);

  let beta1Rad = 0;
  let armRad = 0;

  if (ikMode === 'elbow_up') {
    beta1Rad = angleToTarget - gamma1;
    // Relative elbow bend angle
    armRad = Math.PI - gamma2;
  } else {
    // Elbow down
    beta1Rad = angleToTarget + gamma1;
    armRad = -(Math.PI - gamma2);
  }

  // Convert kinematic angles to degrees
  const beta1Deg = beta1Rad * RAD2DEG;
  const armDeg = armRad * RAD2DEG;

  // Servo angle mapping
  let rawShoulderAngle = calib.shoulderOffset - (beta1Deg / calib.shoulderSign);
  let rawElbowAngle = (armDeg / calib.elbowSign) + calib.elbowOffset;

  // 4. Joint limit clamping
  const baseCfg = configs[0] || { minLimit: 0, maxLimit: 180 };
  const shoulderCfg = configs[1] || { minLimit: 0, maxLimit: 180 };
  const elbowCfg = configs[2] || { minLimit: 0, maxLimit: 180 };

  const clampedBase = Math.max(baseCfg.minLimit, Math.min(baseCfg.maxLimit, rawBaseAngle));
  const clampedShoulder = Math.max(shoulderCfg.minLimit, Math.min(shoulderCfg.maxLimit, rawShoulderAngle));
  const clampedElbow = Math.max(elbowCfg.minLimit, Math.min(elbowCfg.maxLimit, rawElbowAngle));

  if (
    Math.abs(clampedBase - rawBaseAngle) > 0.05 ||
    Math.abs(clampedShoulder - rawShoulderAngle) > 0.05 ||
    Math.abs(clampedElbow - rawElbowAngle) > 0.05
  ) {
    reachable = false;
  }

  // Update projected position to actual FK position from clamped angles
  const finalAngles: JointAngles = {
    base: clampedBase,
    shoulder: clampedShoulder,
    elbow: clampedElbow,
  };

  const actualFK = forwardKinematics(finalAngles, dims, calib);
  projected.copy(actualFK.toolTip);

  return {
    angles: finalAngles,
    reachable,
    projectedTarget: projected,
  };
}

/**
 * Self-check validation test: FK(IK(p)) ≈ p
 * Runs on multiple points in workspace to confirm numeric stability and error bounds.
 */
export function runKinematicsSelfCheck(
  dims: ArmDimensions,
  calib: ArmCalibration,
  configs: JointConfig[]
): { passed: boolean; maxErrorCm: number; samplesTested: number; summary: string } {
  let maxError = 0;
  let samples = 0;
  let passedCount = 0;

  // Test across reachable angles
  const baseTest = [30, 90, 150];
  const shoulderTest = [60, 90, 120];
  const elbowTest = [45, 90, 135];

  for (const b of baseTest) {
    for (const s of shoulderTest) {
      for (const e of elbowTest) {
        samples++;
        const testAngles: JointAngles = { base: b, shoulder: s, elbow: e };
        // 1. FK to get 3D tip position
        const fk = forwardKinematics(testAngles, dims, calib);

        // 2. IK on that tip position
        const ik = inverseKinematics(fk.toolTip, dims, calib, configs, 'elbow_up', false);

        // 3. FK on the solved angles
        const roundTripFK = forwardKinematics(ik.angles, dims, calib);

        const error = fk.toolTip.distanceTo(roundTripFK.toolTip);
        if (error > maxError) maxError = error;

        // Tolerating <= 0.05 cm numeric rounding
        if (error < 0.05 && ik.reachable) {
          passedCount++;
        }
      }
    }
  }

  const passed = maxError < 0.05;
  return {
    passed,
    maxErrorCm: Number(maxError.toFixed(4)),
    samplesTested: samples,
    summary: `${passedCount}/${samples} configurations passed (max positional roundtrip delta: ${maxError.toFixed(4)} cm)`,
  };
}
