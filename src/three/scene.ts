/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ArmCalibration,
  ArmDimensions,
  InteractionMode,
  JointAngles,
  JointConfig,
  SceneOverlays,
} from '../types/arm.ts';
import { ArmInstance, createArmModel } from './armModel.ts';
import { HandleManager } from './handles.ts';
import { createDesk, DeskAssembly } from './desk.ts';

export interface SceneCallbacks {
  onTargetChange: (angles: JointAngles, isLimit: boolean) => void;
  onDragEnd: (finalAngles: JointAngles) => void;
  onDragStart: (handle: string) => void;
}

export type CameraPreset = 'iso' | 'front' | 'side' | 'top' | 'fit';

export class RobotArmScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  private deskAssembly: DeskAssembly;
  private solidArm: ArmInstance;
  private ghostArm: ArmInstance;
  private handleManager: HandleManager;

  private isSoftwareGl: boolean;
  private frameId: number = 0;
  private isDestroyed = false;
  private clock = new THREE.Clock();

  // Camera transition state
  private isTransitioningCamera = false;
  private camStartPos = new THREE.Vector3();
  private camEndPos = new THREE.Vector3();
  private camStartTarget = new THREE.Vector3();
  private camEndTarget = new THREE.Vector3();
  private camTransitionStartTime = 0;
  private readonly camTransitionDuration = 400; // ms

  // Current states
  private targetAngles: JointAngles = { base: 90, shoulder: 90, elbow: 90 };
  private actualAngles: JointAngles = { base: 90, shoulder: 90, elbow: 90 };
  // Smoothly interpolated angles for 60fps rendering (silky movement)
  private renderedSolidAngles: JointAngles = { base: 90, shoulder: 90, elbow: 90 };
  private renderedGhostAngles: JointAngles = { base: 90, shoulder: 90, elbow: 90 };

  private dims: ArmDimensions;
  private calib: ArmCalibration;
  private configs: JointConfig[];
  private interactionMode: InteractionMode = 'control';
  private overlays: SceneOverlays;

  constructor(
    container: HTMLElement,
    dims: ArmDimensions,
    calib: ArmCalibration,
    configs: JointConfig[],
    overlays: SceneOverlays,
    callbacks: SceneCallbacks
  ) {
    this.container = container;
    this.dims = dims;
    this.calib = calib;
    this.configs = configs;
    this.overlays = overlays;

    // 1. Detect Software WebGL
    this.isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. WebGL Renderer (No shadows per user request: "no need of shadow")
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    // Natural warm workshop studio wall color (#dfdcd5)
    this.renderer.setClearColor(0xdfdcd5, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);

    // No shadows
    this.renderer.shadowMap.enabled = false;

    container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xdfdcd5, 0.008);

    this.camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      250
    );
    this.camera.position.set(24, 22, 28);

    // 4. Studio Environment & Natural Daylight Lighting (Zero neon/cyberpunk)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    this.scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    pmremGenerator.dispose();

    // Warm natural key daylight
    const keyLight = new THREE.DirectionalLight(0xfff7ea, 1.6);
    keyLight.position.set(20, 35, 22);
    keyLight.castShadow = false;
    this.scene.add(keyLight);

    // Natural room hemisphere fill (soft sky / warm floor)
    const hemiLight = new THREE.HemisphereLight(0xf1f5f9, 0xdcd6cd, 0.9);
    this.scene.add(hemiLight);

    // Warm soft desk lamp fill
    const deskLamp = new THREE.DirectionalLight(0xffedd5, 0.5);
    deskLamp.position.set(-20, 25, -15);
    deskLamp.castShadow = false;
    this.scene.add(deskLamp);

    // 5. Procedural Workshop Desk (Wooden tabletop, legs, and cutting mat)
    this.deskAssembly = createDesk();
    this.scene.add(this.deskAssembly.group);

    // 6. Arm Models (Solid Real Arm + Translucent Ghost)
    this.solidArm = createArmModel(dims, false);
    this.scene.add(this.solidArm.root);

    this.ghostArm = createArmModel(dims, true);
    this.scene.add(this.ghostArm.root);

    // 7. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, 9, 2);
    this.controls.minDistance = 8;
    this.controls.maxDistance = 85;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep camera above tabletop
    this.controls.update();

    this.controls.addEventListener('start', () => {
      this.isTransitioningCamera = false;
    });

    // 8. Handles Manager (passing solidArm.root so clicking the real arm triggers drag)
    this.handleManager = new HandleManager(
      this.camera,
      this.renderer.domElement,
      dims,
      calib,
      configs,
      {
        onTargetChange: (angles, isLimit) => {
          this.targetAngles = { ...angles };
          // "move the riyal one": update the real solid arm immediately on drag!
          this.actualAngles = { ...angles };

          this.handleManager.updatePositions(angles, this.dims, this.calib);
          callbacks.onTargetChange(angles, isLimit);
        },
        onDragEnd: (finalAngles) => {
          this.targetAngles = { ...finalAngles };
          this.actualAngles = { ...finalAngles };
          this.controls.enabled = true;
          callbacks.onDragEnd(finalAngles);
        },
        onDragStart: (handle) => {
          // Immediately disable OrbitControls so the camera NEVER turns when dragging the arm!
          this.controls.enabled = false;
          callbacks.onDragStart(handle);
        },
      },
      this.solidArm.root
    );
    this.scene.add(this.handleManager.group);

    // Initial pose setup
    this.applyAngles();
    this.updateDimensions(dims);

    window.addEventListener('resize', this.onResize);
    this.animate();
  }

  private onResize = () => {
    if (!this.container || this.isDestroyed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public setInteractionMode(mode: InteractionMode) {
    this.interactionMode = mode;
    this.handleManager.group.visible = mode === 'control';
    this.controls.enabled = true;
  }

  public setOverlays(overlays: SceneOverlays) {
    this.overlays = overlays;
    this.ghostArm.root.visible = overlays.ghost;
    this.handleManager.setLockVerticalPlane(overlays.lockVerticalPlane);
    this.solidArm.updateOverlays(overlays, this.actualAngles, this.dims);
  }

  public setTargetAngles(angles: JointAngles) {
    this.targetAngles = { ...angles };
    this.handleManager.setCurrentAngles(angles);
    this.handleManager.updatePositions(angles, this.dims, this.calib);
  }

  public setActualAngles(angles: JointAngles) {
    this.actualAngles = { ...angles };
    this.solidArm.updateOverlays(this.overlays, angles, this.dims);
  }

  public setCalibration(calib: ArmCalibration) {
    this.calib = { ...calib };
    this.applyAngles();
  }

  public setConfigs(configs: JointConfig[]) {
    this.configs = configs;
    this.handleManager.setConfigs(configs);
  }

  public updateDimensions(dims: ArmDimensions) {
    this.dims = { ...dims };

    this.scene.remove(this.solidArm.root);
    this.solidArm.dispose();
    this.solidArm = createArmModel(dims, false);
    this.scene.add(this.solidArm.root);

    this.scene.remove(this.ghostArm.root);
    this.ghostArm.dispose();
    this.ghostArm = createArmModel(dims, true);
    this.scene.add(this.ghostArm.root);

    this.handleManager.setSolidArmRoot(this.solidArm.root);
    this.applyAngles();
  }

  private applyAngles() {
    this.renderedSolidAngles = { ...this.actualAngles };
    this.renderedGhostAngles = { ...this.targetAngles };
    this.solidArm.setAngles(this.renderedSolidAngles, this.dims, this.calib);
    this.ghostArm.setAngles(this.renderedGhostAngles, this.dims, this.calib);
    this.ghostArm.root.visible = this.overlays.ghost;
    this.handleManager.setCurrentAngles(this.targetAngles);
    this.handleManager.updatePositions(this.targetAngles, this.dims, this.calib);
    this.solidArm.updateOverlays(this.overlays, this.actualAngles, this.dims);
  }

  public setCameraPreset(preset: CameraPreset) {
    this.camStartPos.copy(this.camera.position);
    this.camStartTarget.copy(this.controls.target);

    const targetH = 9;
    this.camEndTarget.set(0, targetH, 2);

    switch (preset) {
      case 'iso':
        this.camEndPos.set(24, 22, 28);
        break;
      case 'front':
        this.camEndPos.set(0, targetH + 4, 38);
        break;
      case 'side':
        this.camEndPos.set(38, targetH + 4, 2);
        break;
      case 'top':
        this.camEndPos.set(0.01, 46, 2.01);
        break;
      case 'fit':
        this.camEndPos.set(20, 18, 24);
        this.camEndTarget.set(0, 8, 2);
        break;
    }

    this.camTransitionStartTime = performance.now();
    this.isTransitioningCamera = true;
  }

  private animate = () => {
    if (this.isDestroyed) return;

    const delta = Math.min(this.clock.getDelta(), 0.08);

    // Smooth exponential damping on arm movements for silky motion
    const dampSolid = this.handleManager.getIsDragging() ? 32 : 24;
    this.renderedSolidAngles.base = THREE.MathUtils.damp(
      this.renderedSolidAngles.base,
      this.actualAngles.base,
      dampSolid,
      delta
    );
    this.renderedSolidAngles.shoulder = THREE.MathUtils.damp(
      this.renderedSolidAngles.shoulder,
      this.actualAngles.shoulder,
      dampSolid,
      delta
    );
    this.renderedSolidAngles.elbow = THREE.MathUtils.damp(
      this.renderedSolidAngles.elbow,
      this.actualAngles.elbow,
      dampSolid,
      delta
    );

    this.solidArm.setAngles(this.renderedSolidAngles, this.dims, this.calib);

    if (this.overlays.ghost) {
      this.renderedGhostAngles.base = THREE.MathUtils.damp(
        this.renderedGhostAngles.base,
        this.targetAngles.base,
        36,
        delta
      );
      this.renderedGhostAngles.shoulder = THREE.MathUtils.damp(
        this.renderedGhostAngles.shoulder,
        this.targetAngles.shoulder,
        36,
        delta
      );
      this.renderedGhostAngles.elbow = THREE.MathUtils.damp(
        this.renderedGhostAngles.elbow,
        this.targetAngles.elbow,
        36,
        delta
      );
      this.ghostArm.setAngles(this.renderedGhostAngles, this.dims, this.calib);
    }

    // Camera preset transition
    if (this.isTransitioningCamera) {
      const elapsed = performance.now() - this.camTransitionStartTime;
      const progress = Math.min(1, elapsed / this.camTransitionDuration);
      const t = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(this.camStartPos, this.camEndPos, t);
      this.controls.target.lerpVectors(this.camStartTarget, this.camEndTarget, t);

      if (progress >= 1) {
        this.isTransitioningCamera = false;
      }
    }

    // Controls update (only updates camera if not dragging)
    if (!this.handleManager.getIsDragging()) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.animate);
  };

  public dispose() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onResize);

    this.handleManager.dispose();
    this.solidArm.dispose();
    this.ghostArm.dispose();
    this.deskAssembly.dispose();
    this.controls.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
