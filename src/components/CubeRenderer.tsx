import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { CubeModel, FaceKey, ColorCode } from '../types/cube';
import type { Theme } from '../themes/themes';
import type { AnimState } from '../animation/MoveAnimation';
import { FACE_NORMALS } from '../model/moves';
import { useSettings } from '../settings/SettingsContext';
import { resolveTheme } from '../settings/settings';

// --------------------------------------------------------------------------
// Face geometry helpers
// --------------------------------------------------------------------------

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
// Module-level geometry / material cache
// Shared across all rebuilds — avoids allocation pressure during animation.
// --------------------------------------------------------------------------

const BLACK_MAT = new THREE.MeshBasicMaterial({ color: '#111111' });
const CUBIE_GEOM = new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2);

// Scratch objects reused across frames to avoid per-frame heap allocations.
const _vec3 = new THREE.Vector3();
const _vec2 = new THREE.Vector2();
const _dragQX = new THREE.Quaternion();
const _dragQY = new THREE.Quaternion();
const _dragResult = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);

/** One material per color hex string — only 6 sticker colors exist in the game. */
const stickerMatCache = new Map<string, THREE.MeshBasicMaterial>();
function getStickerMat(color: string): THREE.MeshBasicMaterial {
  let mat = stickerMatCache.get(color);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color, side: THREE.FrontSide });
    stickerMatCache.set(color, mat);
  }
  return mat;
}

/** One sticker geometry per face direction, created on first use. */
const STICKER_GEOM: Partial<Record<FaceKey, THREE.BufferGeometry>> = {};
function getStickerGeom(face: FaceKey): THREE.BufferGeometry {
  const cached = STICKER_GEOM[face];
  if (cached) return cached;
  const stickerW = HALF * 2 - STICKER_INSET * 2;
  const geom = new THREE.PlaneGeometry(stickerW, stickerW);
  const normal = FACE_NORMALS[face];
  geom.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal),
  );
  const offset = normal.clone().multiplyScalar(HALF + STICKER_LIFT);
  geom.translate(offset.x, offset.y, offset.z);
  STICKER_GEOM[face] = geom;
  return geom;
}

// --------------------------------------------------------------------------
// Build scene objects from the model
// --------------------------------------------------------------------------

function buildCubeGroup(model: CubeModel, theme: Theme): THREE.Group {
  const group = new THREE.Group();

  for (const block of model.blocks) {
    const [gx, gy, gz] = block.position;
    const cubieGroup = new THREE.Group();
    cubieGroup.position.set(gx * SPACING, gy * SPACING, gz * SPACING);

    cubieGroup.add(new THREE.Mesh(CUBIE_GEOM, BLACK_MAT));

    for (const [faceKey, colorCode] of Object.entries(block.faceColors) as [FaceKey, ColorCode][]) {
      cubieGroup.add(new THREE.Mesh(getStickerGeom(faceKey), getStickerMat(theme[colorCode])));
    }

    group.add(cubieGroup);
  }

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
  rotationRef: React.MutableRefObject<THREE.Quaternion>;
  animStateRef: React.MutableRefObject<AnimState>;
}

export default function CubeRenderer({ model, rotationRef, animStateRef }: Props) {
  const { themeName } = useSettings();
  const theme = resolveTheme(themeName);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cubeGroupRef = useRef<THREE.Group | null>(null);
  /** Parallel array matching model.blocks — cubie groups for imperative animation. */
  const cubieGroupsRef = useRef<THREE.Group[]>([]);
  const animFrameRef = useRef<number>(0);
  const dragRef = useRef<DragState>({ active: false, lastX: 0, lastY: 0 });

  // Always mirrors model for use inside the RAF loop.
  const modelRef = useRef(model);
  modelRef.current = model;

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
      for (const mat of stickerMatCache.values()) mat.dispose();
      stickerMatCache.clear();
    };
  }, []);

  // ── Rebuild the cube group whenever the model changes ────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // A new model means a move has committed — clear stale animation state
    // so the render loop doesn't apply an orbital transform on top of the
    // already-committed cubie positions.
    animStateRef.current = null;

    if (cubeGroupRef.current) scene.remove(cubeGroupRef.current);

    // Flush stale materials so previous-theme hex values don't accumulate in the cache.
    for (const mat of stickerMatCache.values()) mat.dispose();
    stickerMatCache.clear();

    const group = buildCubeGroup(model, theme);
    scene.add(group);
    cubeGroupRef.current = group;
    cubieGroupsRef.current = group.children as THREE.Group[];
  }, [model, animStateRef, theme]);

  // ── Render loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const container = containerRef.current;
      if (!renderer || !scene || !camera || !container) return;

      // Apply whole-cube drag/reset rotation — pure ref, zero React overhead.
      if (cubeGroupRef.current) {
        cubeGroupRef.current.quaternion.copy(rotationRef.current);
      }

      // Apply move animation imperatively — no React state, no re-renders.
      const anim = animStateRef.current;
      if (anim) {
        const { indices, q } = anim;
        const blocks = modelRef.current.blocks;
        for (const i of indices) {
          const cubieGroup = cubieGroupsRef.current[i];
          if (!cubieGroup) continue;
          const [gx, gy, gz] = blocks[i].position;
          _vec3.set(gx * SPACING, gy * SPACING, gz * SPACING).applyQuaternion(q);
          cubieGroup.position.copy(_vec3);
          cubieGroup.quaternion.copy(q);
        }
      }

      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        const size = renderer.getSize(_vec2);
        if (size.x !== w || size.y !== h) {
          renderer.setSize(w, h);
        }

        const aspect = w / h;
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
  }, [animStateRef, rotationRef]);

  // ── Pointer drag handling (mouse + touch) ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.active) return;

      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;

      const sensitivity = 0.005;
      const angleX = dy * sensitivity;
      const angleY = dx * sensitivity;

      _dragQX.setFromAxisAngle(_axisX, angleX);
      _dragQY.setFromAxisAngle(_axisY, angleY).multiply(_dragQX);
      _dragResult.copy(rotationRef.current).premultiply(_dragQY);
      rotationRef.current = _dragResult;
    };

    const onPointerUp = () => {
      dragRef.current.active = false;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [rotationRef]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', cursor: 'grab', touchAction: 'none' }} />
    </div>
  );
}
