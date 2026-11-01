/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ArmCalibration, ArmDimensions, JointAngles, JointConfig } from '../types/arm.ts';
import { forwardKinematics, inverseKinematics } from './kinematics.ts';

export type HandleType = 'base' | 'shoulder' | 'elbow' | 'tip';

export interface HandleEvents {
  onTargetChange: (angles: JointAngles, isLimit: boolean) => void;
  onDragEnd: (finalAngles: JointAngles) => void;
  onDragStart: (handle: HandleType) => void;
}

export class HandleManager {
  public group = new THREE.Group();
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private events: HandleEvents;
  private solidArmRoot: THREE.Group | null = null;

  // Geometry / Material references
  private handleMeshes: Map<
    HandleType,
    {
      visual: THREE.Mesh;
      hitBox: THREE.Mesh;
      normalMat: THREE.Material;
      hoverMat: THREE.Material;
      activeMat: THREE.Material;
      limitMat: THREE.Material;
    }
  > = new Map();

  // Active drag state
  private activeHandle: HandleType | null = null;
  private isHovered: HandleType | null = null;
  private dragPlane = new THREE.Plane();
  private raycaster = new THREE.Raycaster();
  private mouseVec = new THREE.Vector2();

  // Scratch vectors for zero-allocation 60fps loop
  private _intersectPoint = new THREE.Vector3();

  // Cached arm parameters
  private dims: ArmDimensions;
  private calib: ArmCalibration;
  private configs: JointConfig[];
  private lockVerticalPlane = false;

  // Current and smoothed angles
  private currentAngles: JointAngles = { base: 90, shoulder: 90, elbow: 90 };
  private smoothedAngles: JointAngles = { base: 90, shoulder: 90, elbow: 90 };

  constructor(
    camera: THREE.Camera,
    domElement: HTMLElement,
    dims: ArmDimensions,
    calib: ArmCalibration,
    configs: JointConfig[],
    events: HandleEvents,
    solidArmRoot?: THREE.Group
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.dims = dims;
    this.calib = calib;
    this.configs = configs;
    this.events = events;
    this.solidArmRoot = solidArmRoot || null;

    this.createHandles();
    this.attachEventListeners();
  }

  public setSolidArmRoot(root: THREE.Group) {
    this.solidArmRoot = root;
  }

  private createHandles() {
    // 1. BASE RING HANDLE (Torus at turntable perimeter)
    this.setupHandle(
      'base',
      new THREE.TorusGeometry(this.dims.turntableDiameter / 2 + 0.35, 0.16, 16, 48),
      new THREE.TorusGeometry(this.dims.turntableDiameter / 2 + 0.35, 1.4, 8, 24),
      new THREE.Euler(Math.PI / 2, 0, 0)
    );

    // 2. SHOULDER HANDLE (Ring around shoulder axle)
    this.setupHandle(
      'shoulder',
      new THREE.TorusGeometry(1.6, 0.15, 16, 32),
      new THREE.SphereGeometry(2.6, 16, 16),
      new THREE.Euler(0, Math.PI / 2, 0)
    );

    // 3. ELBOW HANDLE (Ring around elbow axle)
    this.setupHandle(
      'elbow',
      new THREE.TorusGeometry(1.5, 0.15, 16, 32),
      new THREE.SphereGeometry(2.4, 16, 16),
      new THREE.Euler(0, Math.PI / 2, 0)
    );

    // 4. TIP IK HANDLE (Diamond marker at tool tip)
    this.setupHandle(
      'tip',
      new THREE.OctahedronGeometry(1.1, 0),
      new THREE.SphereGeometry(2.5, 16, 16),
      new THREE.Euler(0, 0, 0)
    );
  }

  private setupHandle(
    type: HandleType,
    visualGeo: THREE.BufferGeometry,
    hitGeo: THREE.BufferGeometry,
    defaultRot: THREE.Euler
  ) {
    // Tactile workshop brass / warm clay accents (zero neon glow)
    const normalMat = new THREE.MeshBasicMaterial({
      color: 0xb45309, // warm brass/amber
      transparent: true,
      opacity: 0.75,
      depthTest: false,
    });
    const hoverMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // bright amber
      transparent: true,
      opacity: 1.0,
      depthTest: false,
    });
    const activeMat = new THREE.MeshBasicMaterial({
      color: 0xfef3c7, // ivory/cream
      transparent: true,
      opacity: 1.0,
      depthTest: false,
    });
    const limitMat = new THREE.MeshBasicMaterial({
      color: 0xdc2626, // terracotta/red limit warning
      transparent: true,
      opacity: 1.0,
      depthTest: false,
    });

    const visual = new THREE.Mesh(visualGeo, normalMat);
    visual.rotation.copy(defaultRot);
    visual.renderOrder = 999;

    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitGeo, hitMat);
    hitBox.name = `hit_${type}`;
    hitBox.userData = { handleType: type };

    const handleNode = new THREE.Group();
    handleNode.add(visual);
    handleNode.add(hitBox);
    this.group.add(handleNode);

    this.handleMeshes.set(type, {
      visual,
      hitBox,
      normalMat,
      hoverMat,
      activeMat,
      limitMat,
    });
  }

  public updatePositions(angles: JointAngles, dims: ArmDimensions, calib: ArmCalibration) {
    this.dims = dims;
    this.calib = calib;
    const pivots = forwardKinematics(angles, dims, calib);

    const baseH = this.handleMeshes.get('base');
    if (baseH) {
      baseH.visual.parent!.position.set(0, dims.basePlateHeight + dims.turntableHeight, 0);
    }

    const shoulderH = this.handleMeshes.get('shoulder');
    if (shoulderH) {
      shoulderH.visual.parent!.position.copy(pivots.shoulder);
      const yawRad = calib.baseSign * (angles.base - calib.baseOffset) * (Math.PI / 180);
      shoulderH.visual.rotation.set(0, yawRad, 0);
    }

    const elbowH = this.handleMeshes.get('elbow');
    if (elbowH) {
      elbowH.visual.parent!.position.copy(pivots.elbow);
      const yawRad = calib.baseSign * (angles.base - calib.baseOffset) * (Math.PI / 180);
      elbowH.visual.rotation.set(0, yawRad, 0);
    }

    const tipH = this.handleMeshes.get('tip');
    if (tipH) {
      tipH.visual.parent!.position.copy(pivots.toolTip);
    }
  }

  public setLockVerticalPlane(lock: boolean) {
    this.lockVerticalPlane = lock;
  }

  public setConfigs(configs: JointConfig[]) {
    this.configs = configs;
  }

  public setCurrentAngles(angles: JointAngles) {
    this.currentAngles = { ...angles };
    this.smoothedAngles = { ...angles };
  }

  public getIsDragging(): boolean {
    return this.activeHandle !== null;
  }

  // Pointer event listeners
  private onPointerDownBound = (e: PointerEvent) => this.onPointerDown(e);
  private onPointerMoveBound = (e: PointerEvent) => this.onPointerMove(e);
  private onPointerUpBound = (e: PointerEvent) => this.onPointerUp(e);

  private attachEventListeners() {
    // CRITICAL: capture: true so we intercept pointerdown before OrbitControls can turn the camera!
    this.domElement.addEventListener('pointerdown', this.onPointerDownBound, { capture: true });
    window.addEventListener('pointermove', this.onPointerMoveBound, { passive: false });
    window.addEventListener('pointerup', this.onPointerUpBound);
    window.addEventListener('pointercancel', this.onPointerUpBound);
  }

  private updatePointerCoord(e: PointerEvent) {
    const rect = this.domElement.getBoundingClientRect();
    this.mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private intersectTarget(): HandleType | null {
    this.raycaster.setFromCamera(this.mouseVec, this.camera);

    // 1. Check direct handle hitboxes first
    const hitBoxes = Array.from(this.handleMeshes.values()).map((h) => h.hitBox);
    const intersects = this.raycaster.intersectObjects(hitBoxes, false);
    if (intersects.length > 0) {
      return intersects[0].object.userData.handleType as HandleType;
    }

    // 2. Also check direct clicks on physical solid arm parts!
    if (this.solidArmRoot) {
      const armIntersects = this.raycaster.intersectObjects(this.solidArmRoot.children, true);
      for (const hit of armIntersects) {
        let cur: THREE.Object3D | null = hit.object;
        while (cur && cur !== this.solidArmRoot) {
          if (cur.userData?.armPart) {
            return cur.userData.armPart as HandleType;
          }
          cur = cur.parent;
        }
      }
    }

    return null;
  }

  private onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return; // Only primary button
    this.updatePointerCoord(e);

    const hitType = this.intersectTarget();
    if (!hitType) return; // Let empty space pass through to OrbitControls

    // STOP OrbitControls from receiving this event!
    // The scene will NOT turn while dragging the arm!
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    this.activeHandle = hitType;
    this.events.onDragStart(hitType);

    const h = this.handleMeshes.get(hitType)!;
    h.visual.material = h.activeMat;

    const handlePos = h.visual.parent!.position;

    if (hitType === 'base') {
      this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), handlePos);
    } else if (hitType === 'tip') {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir).negate();
      this.dragPlane.setFromNormalAndCoplanarPoint(camDir, handlePos);
    } else {
      const yawRad = this.calib.baseSign * (this.currentAngles.base - this.calib.baseOffset) * (Math.PI / 180);
      const planeNormal = new THREE.Vector3(-Math.cos(yawRad), 0, Math.sin(yawRad));
      this.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, handlePos);
    }

    try {
      this.domElement.setPointerCapture(e.pointerId);
    } catch {
      // Fallback
    }
  }

  private onPointerMove(e: PointerEvent) {
    this.updatePointerCoord(e);

    if (!this.activeHandle) {
      const hovered = this.intersectTarget();
      if (hovered !== this.isHovered) {
        if (this.isHovered) {
          const prev = this.handleMeshes.get(this.isHovered);
          if (prev) prev.visual.material = prev.normalMat;
        }
        if (hovered) {
          const cur = this.handleMeshes.get(hovered);
          if (cur) cur.visual.material = cur.hoverMat;
        }
        this.isHovered = hovered;
        this.domElement.style.cursor = hovered ? 'grab' : 'default';
      }
      return;
    }

    // Active dragging in progress
    e.preventDefault();
    this.domElement.style.cursor = 'grabbing';
    this.raycaster.setFromCamera(this.mouseVec, this.camera);

    const hit = this.raycaster.ray.intersectPlane(this.dragPlane, this._intersectPoint);
    if (!hit) return;

    let isLimit = false;
    const rawAngles: JointAngles = { ...this.currentAngles };

    const baseCfg = this.configs[0] || { minLimit: 0, maxLimit: 180 };
    const shoulderCfg = this.configs[1] || { minLimit: 0, maxLimit: 180 };
    const elbowCfg = this.configs[2] || { minLimit: 0, maxLimit: 180 };

    if (this.activeHandle === 'base') {
      const angleRad = Math.atan2(this._intersectPoint.x, this._intersectPoint.z);
      const rawYawDeg = angleRad * (180 / Math.PI);
      const rawAngle = (rawYawDeg / this.calib.baseSign) + this.calib.baseOffset;

      const clamped = Math.max(baseCfg.minLimit, Math.min(baseCfg.maxLimit, rawAngle));
      if (Math.abs(clamped - rawAngle) > 0.5) isLimit = true;
      rawAngles.base = clamped;
    } else if (this.activeHandle === 'shoulder') {
      const yShoulder = this.dims.basePlateHeight + this.dims.turntableHeight + this.dims.shoulderPivotHeight;
      const r = Math.sqrt(this._intersectPoint.x * this._intersectPoint.x + this._intersectPoint.z * this._intersectPoint.z);
      const dx = r;
      const dy = this._intersectPoint.y - yShoulder;

      const beta1Rad = Math.atan2(dx, dy);
      const beta1Deg = beta1Rad * (180 / Math.PI);
      const rawAngle = this.calib.shoulderOffset - (beta1Deg / this.calib.shoulderSign);

      const clamped = Math.max(shoulderCfg.minLimit, Math.min(shoulderCfg.maxLimit, rawAngle));
      if (Math.abs(clamped - rawAngle) > 0.5) isLimit = true;
      rawAngles.shoulder = clamped;
    } else if (this.activeHandle === 'elbow') {
      const pivots = forwardKinematics(this.currentAngles, this.dims, this.calib);
      const elbowR = Math.sqrt(pivots.elbow.x * pivots.elbow.x + pivots.elbow.z * pivots.elbow.z);
      const curR = Math.sqrt(this._intersectPoint.x * this._intersectPoint.x + this._intersectPoint.z * this._intersectPoint.z);

      const dx = curR - elbowR;
      const dy = this._intersectPoint.y - pivots.elbow.y;

      const beta2Rad = Math.atan2(dx, dy);
      const beta1Deg = this.calib.shoulderSign * (this.calib.shoulderOffset - this.currentAngles.shoulder);
      const armDeg = beta2Rad * (180 / Math.PI) - beta1Deg;

      const rawAngle = (armDeg / this.calib.elbowSign) + this.calib.elbowOffset;
      const clamped = Math.max(elbowCfg.minLimit, Math.min(elbowCfg.maxLimit, rawAngle));
      if (Math.abs(clamped - rawAngle) > 0.5) isLimit = true;
      rawAngles.elbow = clamped;
    } else if (this.activeHandle === 'tip') {
      const currentYaw = this.calib.baseSign * (this.currentAngles.base - this.calib.baseOffset);
      const ik = inverseKinematics(
        this._intersectPoint,
        this.dims,
        this.calib,
        this.configs,
        'elbow_up',
        this.lockVerticalPlane,
        currentYaw
      );

      rawAngles.base = ik.angles.base;
      rawAngles.shoulder = ik.angles.shoulder;
      rawAngles.elbow = ik.angles.elbow;

      if (!ik.reachable) {
        isLimit = true;
      }
    }

    // Exponential smoothing for fluid 60fps drag feel (no harsh stepped jumps)
    const smoothFactor = 0.82;
    this.smoothedAngles.base += (rawAngles.base - this.smoothedAngles.base) * smoothFactor;
    this.smoothedAngles.shoulder += (rawAngles.shoulder - this.smoothedAngles.shoulder) * smoothFactor;
    this.smoothedAngles.elbow += (rawAngles.elbow - this.smoothedAngles.elbow) * smoothFactor;

    this.currentAngles = {
      base: Number(this.smoothedAngles.base.toFixed(2)),
      shoulder: Number(this.smoothedAngles.shoulder.toFixed(2)),
      elbow: Number(this.smoothedAngles.elbow.toFixed(2)),
    };

    const activeMesh = this.handleMeshes.get(this.activeHandle);
    if (activeMesh) {
      activeMesh.visual.material = isLimit ? activeMesh.limitMat : activeMesh.activeMat;
    }

    if (isLimit && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // Safe vibration fallback
      }
    }

    this.events.onTargetChange(this.currentAngles, isLimit);
  }

  private onPointerUp(e: PointerEvent) {
    if (!this.activeHandle) return;

    const handle = this.activeHandle;
    const mesh = this.handleMeshes.get(handle);
    if (mesh) {
      mesh.visual.material = mesh.normalMat;
    }

    try {
      this.domElement.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    this.activeHandle = null;
    this.domElement.style.cursor = 'default';
    this.events.onDragEnd(this.currentAngles);
  }

  public dispose() {
    this.domElement.removeEventListener('pointerdown', this.onPointerDownBound, { capture: true });
    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
    window.removeEventListener('pointercancel', this.onPointerUpBound);

    this.handleMeshes.forEach((h) => {
      h.visual.geometry.dispose();
      h.hitBox.geometry.dispose();
      (h.normalMat as THREE.Material).dispose();
      (h.hoverMat as THREE.Material).dispose();
      (h.activeMat as THREE.Material).dispose();
      (h.limitMat as THREE.Material).dispose();
    });
  }
}
