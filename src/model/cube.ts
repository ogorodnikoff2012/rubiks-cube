import * as THREE from 'three';
import type { Block, CubeModel, FaceColors } from '../types/cube';

/**
 * Standard solved-state face colors.
 * Orientation: White on top, Green facing viewer.
 */
const FACE_COLORS: Record<string, string> = {
  U: '#ffffff', // top   – white
  D: '#ffd500', // bottom – yellow
  F: '#009b48', // front  – green
  B: '#0046ad', // back   – blue
  R: '#b71234', // right  – red
  L: '#ff5800', // left   – orange
};

/**
 * Build the initial solved-state CubeModel.
 *
 * Coordinate system:
 *   x: -1 (left)  → +1 (right)
 *   y: -1 (bottom)→ +1 (top)
 *   z: -1 (back)  → +1 (front)
 */
export function createSolvedCube(): CubeModel {
  const blocks: Block[] = [];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        // Skip the hidden core
        if (x === 0 && y === 0 && z === 0) continue;

        const faceColors: FaceColors = {};
        if (z === 1) faceColors.F = FACE_COLORS.F;
        if (z === -1) faceColors.B = FACE_COLORS.B;
        if (y === 1) faceColors.U = FACE_COLORS.U;
        if (y === -1) faceColors.D = FACE_COLORS.D;
        if (x === 1) faceColors.R = FACE_COLORS.R;
        if (x === -1) faceColors.L = FACE_COLORS.L;

        blocks.push({ position: [x, y, z], faceColors });
      }
    }
  }

  return {
    blocks,
    rotation: new THREE.Quaternion(),
  };
}
