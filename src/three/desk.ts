/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export interface DeskAssembly {
  group: THREE.Group;
  dispose: () => void;
}

/**
 * Creates a procedural self-healing cutting mat texture.
 * Features grid lines, centimeter markings, millimeter ticks, and 30/45/60 degree guides.
 */
function createCuttingMatTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;

  // Dark matte workshop cutting mat green
  ctx.fillStyle = '#1e382b';
  ctx.fillRect(0, 0, 1024, 768);

  // Border trim
  ctx.strokeStyle = '#3e6b52';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 1012, 756);

  ctx.strokeStyle = '#2d5440';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, 976, 720);

  // 10mm grid lines
  const gridStep = 32;
  ctx.strokeStyle = '#2f5943';
  ctx.lineWidth = 1;
  for (let x = 32; x < 1024 - 32; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 32);
    ctx.lineTo(x, 768 - 32);
    ctx.stroke();
  }
  for (let y = 32; y < 768 - 32; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(32, y);
    ctx.lineTo(1024 - 32, y);
    ctx.stroke();
  }

  // Major 50mm grid lines
  ctx.strokeStyle = '#43785b';
  ctx.lineWidth = 1.5;
  for (let x = 32; x < 1024 - 32; x += gridStep * 4) {
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x, 768 - 24);
    ctx.stroke();
  }
  for (let y = 32; y < 768 - 32; y += gridStep * 4) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(1024 - 24, y);
    ctx.stroke();
  }

  // Angle guideline lines (30°, 45°, 60°)
  ctx.strokeStyle = '#3a664e';
  ctx.lineWidth = 1;
  const cx = 512;
  const cy = 384;
  [30, 45, 60, 120, 135, 150].forEach((deg) => {
    const rad = (deg * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(rad) * 450, cy + Math.sin(rad) * 450);
    ctx.stroke();
  });

  // Concentric circle radius guides in center
  [64, 128, 192, 256].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Numbers & measurement markings
  ctx.fillStyle = '#649c7b';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let count = 0;
  for (let x = 32; x < 1024 - 32; x += gridStep * 2) {
    ctx.fillText(`${count * 2}`, x, 16);
    ctx.fillText(`${count * 2}`, x, 752);
    count++;
  }

  // Workshop branding logo stamp
  ctx.fillStyle = '#4c8063';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('A3 HOBBY ROBOTICS WORKBENCH MAT', 512, 735);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Creates a procedural warm birch / oak wood tabletop texture.
 */
function createWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm birch/oak base
  ctx.fillStyle = '#c8a882';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle natural wood grain lines
  for (let y = 0; y < 512; y += 2) {
    const noise = Math.sin(y * 0.05) * 6 + Math.cos(y * 0.12) * 3;
    const alpha = 0.04 + Math.sin(y * 0.08) * 0.03;
    ctx.fillStyle = `rgba(138, 98, 64, ${alpha})`;
    ctx.fillRect(0, y + noise, 512, 1.5);
  }

  // Soft wood plank border
  ctx.strokeStyle = '#b2906c';
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

/**
 * Builds the physical workbench desk:
 * - Solid wooden tabletop (95 x 4 x 70 cm) with soft chamfered edges
 * - Self-healing green vinyl cutting grid mat (50 x 38 cm) placed right under the robot arm
 * - Table apron & brushed metal table leg stubs
 * - Warm room studio floor plane
 */
export function createDesk(): DeskAssembly {
  const group = new THREE.Group();
  group.name = 'workbenchDesk';

  const woodTex = createWoodTexture();
  const matTex = createCuttingMatTexture();

  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [
    woodTex,
    matTex,
  ];

  // Wood tabletop material
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.55,
    metalness: 0.05,
    color: 0xdeb887,
  });
  disposables.push(woodMat);

  // 1. Tabletop slab (95 x 3.5 x 70 cm), top surface flush at Y = 0
  const tableThickness = 3.5;
  const tableTopGeo = new THREE.BoxGeometry(95, tableThickness, 70);
  disposables.push(tableTopGeo);
  const tableTop = new THREE.Mesh(tableTopGeo, woodMat);
  tableTop.position.set(0, -tableThickness / 2, 0);
  group.add(tableTop);

  // Table edge trim / bevel border
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xb5895a,
    roughness: 0.6,
    metalness: 0.05,
  });
  disposables.push(trimMat);

  const trimGeo = new THREE.BoxGeometry(95.6, 1.2, 70.6);
  disposables.push(trimGeo);
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.set(0, -tableThickness / 2, 0);
  group.add(trim);

  // 2. Self-healing green vinyl Cutting Mat (52 x 38 cm) on tabletop
  const matGeo = new THREE.PlaneGeometry(54, 38);
  disposables.push(matGeo);
  const matMaterial = new THREE.MeshStandardMaterial({
    map: matTex,
    roughness: 0.65,
    metalness: 0.05,
  });
  disposables.push(matMaterial);
  const cuttingMat = new THREE.Mesh(matGeo, matMaterial);
  cuttingMat.rotation.x = -Math.PI / 2;
  cuttingMat.position.set(0, 0.02, 3); // Arm sits right on the mat
  group.add(cuttingMat);

  // Mat thickness rim
  const matRimGeo = new THREE.BoxGeometry(54.2, 0.12, 38.2);
  disposables.push(matRimGeo);
  const matRimMat = new THREE.MeshBasicMaterial({ color: 0x162c22 });
  disposables.push(matRimMat);
  const matRim = new THREE.Mesh(matRimGeo, matRimMat);
  matRim.position.set(0, 0.04, 3);
  group.add(matRim);

  // 3. Desk legs (sturdy steel legs under the desk)
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x475569, // steel grey
    roughness: 0.45,
    metalness: 0.7,
  });
  disposables.push(legMat);

  const legGeo = new THREE.CylinderGeometry(2.2, 2.2, 35, 24);
  disposables.push(legGeo);

  const legOffsets = [
    { x: -42, z: -30 },
    { x: 42, z: -30 },
    { x: -42, z: 30 },
    { x: 42, z: 30 },
  ];

  legOffsets.forEach(({ x, z }) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, -tableThickness - 17.5, z);
    group.add(leg);
  });

  // 4. Warm workshop background floor / room surface
  const floorGeo = new THREE.PlaneGeometry(240, 240);
  disposables.push(floorGeo);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xd6cebe, // warm workshop floor
    roughness: 0.9,
    metalness: 0.05,
  });
  disposables.push(floorMat);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -tableThickness - 35, 0);
  group.add(floor);

  const dispose = () => {
    disposables.forEach((item) => {
      if ('dispose' in item && typeof item.dispose === 'function') {
        item.dispose();
      }
    });
  };

  return { group, dispose };
}
