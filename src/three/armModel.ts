/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ArmCalibration, ArmDimensions, JointAngles, SceneOverlays } from '../types/arm.ts';
import { forwardKinematics } from './kinematics.ts';

const DEG2RAD = Math.PI / 180;

export interface ArmInstance {
  root: THREE.Group;
  baseYaw: THREE.Group;
  shoulderPivot: THREE.Group;
  upperArm: THREE.Group;
  elbowPivot: THREE.Group;
  forearm: THREE.Group;
  tool: THREE.Group;
  overlaysGroup: THREE.Group;
  setAngles: (angles: JointAngles, dims: ArmDimensions, calib: ArmCalibration) => void;
  updateOverlays: (overlays: SceneOverlays, angles: JointAngles, dims: ArmDimensions) => void;
  dispose: () => void;
}

/**
 * Creates a procedural servo motor assembly:
 * - Standard hobby servo body in vibrant servo blue
 * - Mounting ears with brass eyelets and screws
 * - Cable strain relief exit with tri-color ribbon wire
 * - Spline shaft and round servo horn disc with holes
 */
function createServoMesh(isGhost: boolean, armPart: string): THREE.Group {
  const group = new THREE.Group();
  group.userData = { armPart };

  const servoMat = isGhost
    ? new THREE.MeshStandardMaterial({
        color: 0x94a3b8, // frosted smoked acrylic
        transparent: true,
        opacity: 0.28,
        roughness: 0.6,
        metalness: 0.1,
      })
    : new THREE.MeshStandardMaterial({
        color: 0x2563eb, // industrial hobby servo blue
        roughness: 0.45,
        metalness: 0.1,
      });

  const hornMat = isGhost
    ? servoMat
    : new THREE.MeshStandardMaterial({
        color: 0xf1f5f9, // nylon white horn
        roughness: 0.5,
        metalness: 0.05,
      });

  const screwMat = isGhost
    ? servoMat
    : new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.3,
        metalness: 0.85,
      });

  const wireMat = isGhost
    ? servoMat
    : new THREE.MeshBasicMaterial({ color: 0x1e293b });

  // Main servo body (4 x 2 x 3.6 cm)
  const bodyGeo = new THREE.BoxGeometry(2.0, 3.6, 4.0);
  const body = new THREE.Mesh(bodyGeo, servoMat);
  body.userData = { armPart };
  group.add(body);

  // Mounting flange ears (2.0 x 0.25 x 5.4 cm)
  const flangeGeo = new THREE.BoxGeometry(2.0, 0.25, 5.4);
  const flange = new THREE.Mesh(flangeGeo, servoMat);
  flange.position.y = 0.9;
  flange.userData = { armPart };
  group.add(flange);

  // Horn output cylinder / spline
  const splineGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 24);
  const spline = new THREE.Mesh(splineGeo, hornMat);
  spline.position.set(0, 1.9, 1.0);
  spline.userData = { armPart };
  group.add(spline);

  // Round horn disc (diameter 2.2 cm, thickness 0.2 cm)
  const hornDiscGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.2, 32);
  const hornDisc = new THREE.Mesh(hornDiscGeo, hornMat);
  hornDisc.position.set(0, 2.2, 1.0);
  hornDisc.userData = { armPart };
  group.add(hornDisc);

  // Horn center screw
  const screwGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
  const screw = new THREE.Mesh(screwGeo, screwMat);
  screw.position.set(0, 2.32, 1.0);
  group.add(screw);

  // Cable exit boss
  const wireGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12);
  const wire = new THREE.Mesh(wireGeo, wireMat);
  wire.rotation.x = Math.PI / 2;
  wire.position.set(0, -1.2, -2.1);
  group.add(wire);

  return group;
}

/**
 * Creates an aluminum plate with lightening cutouts.
 */
function createSlottedArmPlate(
  length: number,
  width: number,
  thickness: number,
  material: THREE.Material,
  armPart: string
): THREE.Group {
  const plateGroup = new THREE.Group();
  plateGroup.userData = { armPart };

  const shape = new THREE.Shape();
  const hw = width / 2;
  const radius = hw * 0.8;

  shape.moveTo(-hw + radius, 0);
  shape.lineTo(hw - radius, 0);
  shape.quadraticCurveTo(hw, 0, hw, radius);
  shape.lineTo(hw, length - radius);
  shape.quadraticCurveTo(hw, length, hw - radius, length);
  shape.lineTo(-hw + radius, length);
  shape.quadraticCurveTo(-hw, length, -hw, length - radius);
  shape.lineTo(-hw, radius);
  shape.quadraticCurveTo(-hw, 0, -hw + radius, 0);

  // Lightening cutout holes
  const holeRadius = Math.min(0.65, hw * 0.55);
  const numHoles = Math.max(1, Math.floor((length - 3) / 2.2));
  for (let i = 0; i < numHoles; i++) {
    const holeY = 2.0 + i * ((length - 4) / Math.max(1, numHoles - 1));
    const holePath = new THREE.Path();
    holePath.absarc(0, holeY, holeRadius, 0, Math.PI * 2, true);
    shape.holes.push(holePath);
  }

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(0, 0, -thickness / 2);

  const mesh = new THREE.Mesh(geo, material);
  mesh.userData = { armPart };
  plateGroup.add(mesh);

  return plateGroup;
}

function createTextSprite(text: string, color = '#292524', fontSize = 38): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 128);
  // Matte cream drafting card background
  ctx.fillStyle = '#fbf9f5';
  ctx.beginPath();
  ctx.roundRect(10, 24, 236, 80, 12);
  ctx.fill();

  // Subtle drafting card border
  ctx.strokeStyle = '#a8a29e';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(4.5, 2.25, 1);
  return sprite;
}

export function createArmModel(
  dims: ArmDimensions,
  isGhost = false
): ArmInstance {
  const root = new THREE.Group();
  root.name = isGhost ? 'ghostRoot' : 'solidRoot';

  // Materials
  const aluminumMat = isGhost
    ? new THREE.MeshStandardMaterial({
        color: 0x94a3b8, // frosted acrylic
        transparent: true,
        opacity: 0.28,
        roughness: 0.5,
        metalness: 0.1,
        depthWrite: false,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xd6d3d1, // real brushed aluminum
        roughness: 0.35,
        metalness: 0.88,
      });

  const blackAnodizedMat = isGhost
    ? aluminumMat
    : new THREE.MeshStandardMaterial({
        color: 0x292524, // dark anodized bracket
        roughness: 0.5,
        metalness: 0.6,
      });

  const rubberFootMat = isGhost
    ? aluminumMat
    : new THREE.MeshStandardMaterial({
        color: 0x1c1917,
        roughness: 0.9,
        metalness: 0.05,
      });

  const tipMarkerMat = isGhost
    ? new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.4 })
    : new THREE.MeshStandardMaterial({
        color: 0xdc2626, // terracotta/red tool tip
        roughness: 0.35,
        metalness: 0.2,
      });

  const disposables: (THREE.BufferGeometry | THREE.Material)[] = [
    aluminumMat,
    blackAnodizedMat,
    rubberFootMat,
    tipMarkerMat,
  ];

  // 1. BASE PLATE
  const baseGroup = new THREE.Group();
  baseGroup.userData = { armPart: 'base' };
  root.add(baseGroup);

  const basePlateGeo = new THREE.CylinderGeometry(
    dims.basePlateDiameter / 2,
    dims.basePlateDiameter / 2,
    dims.basePlateHeight,
    48
  );
  disposables.push(basePlateGeo);
  const basePlateMesh = new THREE.Mesh(basePlateGeo, blackAnodizedMat);
  basePlateMesh.position.y = dims.basePlateHeight / 2;
  basePlateMesh.userData = { armPart: 'base' };
  baseGroup.add(basePlateMesh);

  // 4 Rubber feet under base plate
  const footGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.3, 16);
  disposables.push(footGeo);
  const boltHoleGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 16);
  disposables.push(boltHoleGeo);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const r = (dims.basePlateDiameter / 2) * 0.78;
    const x = r * Math.cos(angle);
    const z = r * Math.sin(angle);

    const foot = new THREE.Mesh(footGeo, rubberFootMat);
    foot.position.set(x, 0.15, z);
    baseGroup.add(foot);

    const bolt = new THREE.Mesh(boltHoleGeo, aluminumMat);
    bolt.position.set(x, dims.basePlateHeight + 0.05, z);
    baseGroup.add(bolt);
  }

  // Turntable bearing outer ring
  const bearingRingGeo = new THREE.TorusGeometry((dims.turntableDiameter / 2) * 1.05, 0.2, 16, 48);
  disposables.push(bearingRingGeo);
  const bearingRing = new THREE.Mesh(bearingRingGeo, aluminumMat);
  bearingRing.rotation.x = Math.PI / 2;
  bearingRing.position.y = dims.basePlateHeight + 0.1;
  bearingRing.userData = { armPart: 'base' };
  baseGroup.add(bearingRing);

  // 2. BASE YAW GROUP
  const baseYaw = new THREE.Group();
  baseYaw.position.y = dims.basePlateHeight;
  baseYaw.userData = { armPart: 'base' };
  root.add(baseYaw);

  const turntableGeo = new THREE.CylinderGeometry(
    dims.turntableDiameter / 2,
    dims.turntableDiameter / 2,
    dims.turntableHeight,
    48
  );
  disposables.push(turntableGeo);
  const turntableMesh = new THREE.Mesh(turntableGeo, aluminumMat);
  turntableMesh.position.y = dims.turntableHeight / 2;
  turntableMesh.userData = { armPart: 'base' };
  baseYaw.add(turntableMesh);

  // Base Servo
  const baseServo = createServoMesh(isGhost, 'base');
  baseServo.position.set(0, dims.turntableHeight / 2, 0);
  baseServo.rotation.y = Math.PI / 2;
  baseYaw.add(baseServo);

  // Shoulder U-Bracket
  const bracketGroup = new THREE.Group();
  bracketGroup.position.y = dims.turntableHeight;
  bracketGroup.userData = { armPart: 'shoulder' };
  baseYaw.add(bracketGroup);

  const bracketWidth = 4.2;
  const bracketPlateThick = 0.35;
  const bracketHeight = dims.shoulderPivotHeight;

  const bracketBottomGeo = new THREE.BoxGeometry(bracketWidth, bracketPlateThick, 4.4);
  disposables.push(bracketBottomGeo);
  const bracketBottom = new THREE.Mesh(bracketBottomGeo, blackAnodizedMat);
  bracketBottom.position.y = bracketPlateThick / 2;
  bracketBottom.userData = { armPart: 'shoulder' };
  bracketGroup.add(bracketBottom);

  const uprightGeo = new THREE.BoxGeometry(bracketPlateThick, bracketHeight, 3.8);
  disposables.push(uprightGeo);
  const uprightLeft = new THREE.Mesh(uprightGeo, blackAnodizedMat);
  uprightLeft.position.set(-bracketWidth / 2 + bracketPlateThick / 2, bracketHeight / 2, 0);
  uprightLeft.userData = { armPart: 'shoulder' };
  bracketGroup.add(uprightLeft);

  const uprightRight = new THREE.Mesh(uprightGeo, blackAnodizedMat);
  uprightRight.position.set(bracketWidth / 2 - bracketPlateThick / 2, bracketHeight / 2, 0);
  uprightRight.userData = { armPart: 'shoulder' };
  bracketGroup.add(uprightRight);

  const shoulderServo = createServoMesh(isGhost, 'shoulder');
  shoulderServo.position.set(0, bracketHeight - 1.0, 0);
  shoulderServo.rotation.z = Math.PI / 2;
  bracketGroup.add(shoulderServo);

  // 3. SHOULDER PIVOT GROUP
  const shoulderPivot = new THREE.Group();
  shoulderPivot.position.set(0, dims.shoulderPivotHeight, 0);
  shoulderPivot.userData = { armPart: 'shoulder' };
  bracketGroup.add(shoulderPivot);

  const shoulderAxleGeo = new THREE.CylinderGeometry(0.4, 0.4, bracketWidth + 0.6, 24);
  disposables.push(shoulderAxleGeo);
  const shoulderAxle = new THREE.Mesh(shoulderAxleGeo, aluminumMat);
  shoulderAxle.rotation.z = Math.PI / 2;
  shoulderAxle.userData = { armPart: 'shoulder' };
  shoulderPivot.add(shoulderAxle);

  // 4. UPPER ARM
  const upperArm = new THREE.Group();
  upperArm.userData = { armPart: 'shoulder' };
  shoulderPivot.add(upperArm);

  const armPlateWidth = 2.4;
  const armPlateThick = 0.25;
  const plateSpacing = 3.2;

  const leftUpperPlate = createSlottedArmPlate(
    dims.upperArmLength,
    armPlateWidth,
    armPlateThick,
    aluminumMat,
    'shoulder'
  );
  leftUpperPlate.position.set(-plateSpacing / 2, 0, 0);
  upperArm.add(leftUpperPlate);

  const rightUpperPlate = createSlottedArmPlate(
    dims.upperArmLength,
    armPlateWidth,
    armPlateThick,
    aluminumMat,
    'shoulder'
  );
  rightUpperPlate.position.set(plateSpacing / 2, 0, 0);
  upperArm.add(rightUpperPlate);

  const standoffGeo = new THREE.CylinderGeometry(0.3, 0.3, plateSpacing - armPlateThick, 16);
  disposables.push(standoffGeo);
  const numStandoffs = 3;
  for (let i = 1; i <= numStandoffs; i++) {
    const yPos = (dims.upperArmLength / (numStandoffs + 1)) * i;
    const standoff = new THREE.Mesh(standoffGeo, blackAnodizedMat);
    standoff.rotation.z = Math.PI / 2;
    standoff.position.set(0, yPos, 0);
    standoff.userData = { armPart: 'shoulder' };
    upperArm.add(standoff);
  }

  const elbowServo = createServoMesh(isGhost, 'elbow');
  elbowServo.position.set(0, dims.upperArmLength - 1.2, 0);
  elbowServo.rotation.z = Math.PI / 2;
  upperArm.add(elbowServo);

  // 5. ELBOW PIVOT GROUP
  const elbowPivot = new THREE.Group();
  elbowPivot.position.set(0, dims.upperArmLength, 0);
  elbowPivot.userData = { armPart: 'elbow' };
  upperArm.add(elbowPivot);

  const elbowAxleGeo = new THREE.CylinderGeometry(0.35, 0.35, plateSpacing + 0.6, 24);
  disposables.push(elbowAxleGeo);
  const elbowAxle = new THREE.Mesh(elbowAxleGeo, aluminumMat);
  elbowAxle.rotation.z = Math.PI / 2;
  elbowAxle.userData = { armPart: 'elbow' };
  elbowPivot.add(elbowAxle);

  // 6. FOREARM
  const forearm = new THREE.Group();
  forearm.userData = { armPart: 'elbow' };
  elbowPivot.add(forearm);

  const forearmPlateWidth = 2.0;
  const leftForearmPlate = createSlottedArmPlate(
    dims.forearmLength,
    forearmPlateWidth,
    armPlateThick,
    aluminumMat,
    'elbow'
  );
  leftForearmPlate.position.set(-plateSpacing / 2 + 0.3, 0, 0);
  forearm.add(leftForearmPlate);

  const rightForearmPlate = createSlottedArmPlate(
    dims.forearmLength,
    forearmPlateWidth,
    armPlateThick,
    aluminumMat,
    'elbow'
  );
  rightForearmPlate.position.set(plateSpacing / 2 - 0.3, 0, 0);
  forearm.add(rightForearmPlate);

  for (let i = 1; i <= 2; i++) {
    const yPos = (dims.forearmLength / 3) * i;
    const standoff = new THREE.Mesh(standoffGeo, blackAnodizedMat);
    standoff.rotation.z = Math.PI / 2;
    standoff.position.set(0, yPos, 0);
    standoff.userData = { armPart: 'elbow' };
    forearm.add(standoff);
  }

  // 7. TOOL END STUB & TIP MARKER
  const tool = new THREE.Group();
  tool.position.set(0, dims.forearmLength, 0);
  tool.userData = { armPart: 'tip' };
  forearm.add(tool);

  const stubGeo = new THREE.CylinderGeometry(0.4, 0.5, dims.endStubLength, 24);
  disposables.push(stubGeo);
  const stubMesh = new THREE.Mesh(stubGeo, aluminumMat);
  stubMesh.position.y = dims.endStubLength / 2;
  stubMesh.userData = { armPart: 'tip' };
  tool.add(stubMesh);

  const tipSphereGeo = new THREE.SphereGeometry(0.45, 24, 24);
  disposables.push(tipSphereGeo);
  const tipSphere = new THREE.Mesh(tipSphereGeo, tipMarkerMat);
  tipSphere.position.y = dims.endStubLength;
  tipSphere.userData = { armPart: 'tip' };
  tool.add(tipSphere);

  const tipConeGeo = new THREE.ConeGeometry(0.35, 0.8, 16);
  disposables.push(tipConeGeo);
  const tipCone = new THREE.Mesh(tipConeGeo, tipMarkerMat);
  tipCone.position.y = dims.endStubLength + 0.45;
  tipCone.userData = { armPart: 'tip' };
  tool.add(tipCone);

  // 8. OVERLAYS GROUP
  const overlaysGroup = new THREE.Group();
  root.add(overlaysGroup);

  let axisHelperGroup: THREE.Group | null = null;
  let domeMesh: THREE.Mesh | null = null;
  let baseSprite: THREE.Sprite | null = null;
  let shoulderSprite: THREE.Sprite | null = null;
  let elbowSprite: THREE.Sprite | null = null;
  let tipSprite: THREE.Sprite | null = null;

  if (!isGhost) {
    const maxReach = dims.upperArmLength + dims.forearmLength + dims.endStubLength;
    const domeGeo = new THREE.SphereGeometry(
      maxReach,
      32,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.55
    );
    disposables.push(domeGeo);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x78716c,
      wireframe: true,
      transparent: true,
      opacity: 0.1,
    });
    disposables.push(domeMat);
    domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.y = dims.basePlateHeight + dims.turntableHeight + dims.shoulderPivotHeight;
    overlaysGroup.add(domeMesh);

    axisHelperGroup = new THREE.Group();
    const baseArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, dims.basePlateHeight + dims.turntableHeight, 0),
      4,
      0x2563eb, // blue
      0.8,
      0.5
    );
    const shoulderArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      3.5,
      0x16a34a, // green
      0.7,
      0.4
    );
    const elbowArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      3.5,
      0xd97706, // amber
      0.7,
      0.4
    );
    axisHelperGroup.add(baseArrow);
    shoulderPivot.add(shoulderArrow);
    elbowPivot.add(elbowArrow);
    overlaysGroup.add(axisHelperGroup);

    baseSprite = createTextSprite('BASE: 90°', '#2563eb', 34);
    baseSprite.position.set(0, dims.basePlateHeight + dims.turntableHeight + 2, 4.5);
    overlaysGroup.add(baseSprite);

    shoulderSprite = createTextSprite('SHOULDER: 90°', '#16a34a', 34);
    overlaysGroup.add(shoulderSprite);

    elbowSprite = createTextSprite('ELBOW: 90°', '#d97706', 34);
    overlaysGroup.add(elbowSprite);

    tipSprite = createTextSprite('TOOL TIP', '#dc2626', 34);
    overlaysGroup.add(tipSprite);
  }

  const setAngles = (angles: JointAngles, currentDims: ArmDimensions, calib: ArmCalibration) => {
    const yawDeg = calib.baseSign * (angles.base - calib.baseOffset);
    baseYaw.rotation.y = yawDeg * DEG2RAD;

    const beta1Deg = calib.shoulderSign * (calib.shoulderOffset - angles.shoulder);
    shoulderPivot.rotation.x = beta1Deg * DEG2RAD;

    const armDeg = calib.elbowSign * (angles.elbow - calib.elbowOffset);
    elbowPivot.rotation.x = armDeg * DEG2RAD;
  };

  const updateOverlays = (overlays: SceneOverlays, angles: JointAngles, currentDims: ArmDimensions) => {
    overlaysGroup.visible = true;

    if (domeMesh) domeMesh.visible = overlays.reachDome;
    if (axisHelperGroup) axisHelperGroup.visible = overlays.axes;

    const showLabels = overlays.labels || overlays.angleArcs;
    if (baseSprite) baseSprite.visible = showLabels;

    if (shoulderSprite && elbowSprite && tipSprite) {
      shoulderSprite.visible = showLabels;
      elbowSprite.visible = showLabels;
      tipSprite.visible = showLabels;

      if (showLabels) {
        const pivots = forwardKinematics(
          angles,
          currentDims,
          { baseOffset: 90, baseSign: 1, shoulderOffset: 90, shoulderSign: 1, elbowOffset: 0, elbowSign: 1 }
        );
        shoulderSprite.position.set(pivots.shoulder.x, pivots.shoulder.y + 1.8, pivots.shoulder.z + 2);
        elbowSprite.position.set(pivots.elbow.x, pivots.elbow.y + 1.8, pivots.elbow.z + 2);
        tipSprite.position.set(pivots.toolTip.x, pivots.toolTip.y + 2.0, pivots.toolTip.z);
      }
    }
  };

  const dispose = () => {
    disposables.forEach((item) => {
      if (item && typeof item.dispose === 'function') {
        item.dispose();
      }
    });
  };

  return {
    root,
    baseYaw,
    shoulderPivot,
    upperArm,
    elbowPivot,
    forearm,
    tool,
    overlaysGroup,
    setAngles,
    updateOverlays,
    dispose,
  };
}
