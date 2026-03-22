import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { CubeModel, FaceKey } from '../types/cube';

// --------------------------------------------------------------------------
// Face geometry helpers
// --------------------------------------------------------------------------

/**
 * Map from FaceKey to the normal direction of that face on a unit cube.
 * The sticker quad is placed just above the cube surface on that face.
 */
const FACE_NORMAL: Record<FaceKey, THREE.Vector3> = {
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
};

/** Vertical field of view (degrees) used when the viewport is square or landscape. */
const BASE_FOV = 45;

/** Half-size of a cubie in world units. */
const HALF = 0.48;

/** Gap between adjacent cubies (world units). */
const SPACING = 1.05;

/** Sticker inset from the cubie edge (world units). */
const STICKER_INSET = 0.08;

/** Sticker lift above cubie surface (world units). */
const STICKER_LIFT = 0.001;

// --------------------------------------------------------------------------
// Build scene objects from the model
// --------------------------------------------------------------------------

function buildCubeGroup(model: CubeModel): THREE.Group {
  const group = new THREE.Group();

  // Shared black material for cubie bodies
  const blackMat = new THREE.MeshBasicMaterial({ color: '#111111' });

  const cubieGeom = new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2);

  for (const block of model.blocks) {
    const [gx, gy, gz] = block.position;

    const cubieGroup = new THREE.Group();

    if (block.rotation) {
      // Orbital rotation: apply the face-move quaternion to both position and
      // orientation so the cubie sweeps around the cube centre correctly.
      const worldPos = new THREE.Vector3(gx * SPACING, gy * SPACING, gz * SPACING);
      worldPos.applyQuaternion(block.rotation);
      cubieGroup.position.copy(worldPos);
      cubieGroup.quaternion.copy(block.rotation);
    } else {
      cubieGroup.position.set(gx * SPACING, gy * SPACING, gz * SPACING);
    }

    // Black cubie body
    cubieGroup.add(new THREE.Mesh(cubieGeom, blackMat));

    // Sticker quads for each colored face
    for (const [faceKey, color] of Object.entries(block.faceColors) as [FaceKey, string][]) {
      const normal = FACE_NORMAL[faceKey];

      // Build an axis-aligned quad for this face
      const stickerW = HALF * 2 - STICKER_INSET * 2;
      const stickerGeom = new THREE.PlaneGeometry(stickerW, stickerW);

      // Rotate plane to face the correct direction
      // PlaneGeometry faces +Z by default
      const rotation = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        normal,
      );
      stickerGeom.applyQuaternion(rotation);

      // Lift slightly off the surface
      const offset = normal.clone().multiplyScalar(HALF + STICKER_LIFT);
      stickerGeom.translate(offset.x, offset.y, offset.z);

      const stickerMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.FrontSide,
      });

      cubieGroup.add(new THREE.Mesh(stickerGeom, stickerMat));
    }

    group.add(cubieGroup);
  }

  // Apply cube-level rotation
  group.quaternion.copy(model.rotation);

  return group;
}

// --------------------------------------------------------------------------
// Mouse drag → quaternion delta
// --------------------------------------------------------------------------

interface DragState {
  active: boolean;
  lastX: number;
  lastY: number;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

interface Props {
  model: CubeModel;
  onRotate: (q: THREE.Quaternion) => void;
}

export default function CubeRenderer({ model, onRotate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Hold references to Three.js objects that must survive re-renders
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cubeGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number>(0);
  const dragRef = useRef<DragState>({ active: false, lastX: 0, lastY: 0 });

  // ── Initialize renderer, scene, camera once ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor('#1a1a2e');
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 8);
    cameraRef.current = camera;

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
    };
  }, []);

  // ── Rebuild the cube group whenever the model changes ────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old group
    if (cubeGroupRef.current) scene.remove(cubeGroupRef.current);

    const group = buildCubeGroup(model);
    scene.add(group);
    cubeGroupRef.current = group;
  }, [model]);

  // ── Render loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const container = containerRef.current;
      if (!renderer || !scene || !camera || !container) return;

      // Read size from the wrapper div, not the canvas. The canvas is a
      // replaced element whose intrinsic size (canvas.width attribute) would
      // prevent the grid cell from shrinking (min-width: auto). The wrapper
      // div has min-width: 0 so it tracks available space correctly.
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        const size = renderer.getSize(new THREE.Vector2());
        if (size.x !== w || size.y !== h) {
          // updateStyle=true: Three.js sets canvas.style.width/height in px,
          // keeping the canvas sized to the container.
          renderer.setSize(w, h);
        }

        const aspect = w / h;
        // When portrait (aspect < 1), widen the vertical FOV so the cube
        // always fits within min(width, height) rather than just the height.
        const fov =
          aspect >= 1
            ? BASE_FOV
            : THREE.MathUtils.radToDeg(
                2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(BASE_FOV) / 2) / aspect),
              );
        if (camera.aspect !== aspect || camera.fov !== fov) {
          camera.aspect = aspect;
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
      }

      renderer.render(scene, camera);
    };
    animate();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // ── Mouse drag handling ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag.active) return;

      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;

      // Convert pixel delta to rotation angle (radians)
      const sensitivity = 0.005;
      const angleX = dy * sensitivity; // drag up/down → rotate around X
      const angleY = dx * sensitivity; // drag left/right → rotate around Y

      // Build delta quaternion in world space
      const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angleX);
      const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY);
      const delta = qY.multiply(qX);

      // Compose: new = delta * current  (world-space rotation)
      const next = delta.multiply(model.rotation.clone());
      onRotate(next);
    };

    const onMouseUp = () => {
      dragRef.current.active = false;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [model.rotation, onRotate]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', cursor: 'grab' }} />
    </div>
  );
}
