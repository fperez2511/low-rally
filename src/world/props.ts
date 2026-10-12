import {
  BoxGeometry,
  BufferAttribute,
  ConeGeometry,
  DodecahedronGeometry,
  DynamicDrawUsage,
  type BufferGeometry,
  InstancedMesh,
  MeshLambertMaterial,
  type Scene,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, PROPS, TERRAIN, TRACK, shade } from '../config';
import { hash2, mulberry32 } from '../util/random';
import type { Terrain } from './terrain';
import { createTrackHit, type Track } from './track';

const MAX_TREES = PROPS.maxTreesPerChunk;
const MAX_ROCKS = PROPS.maxRocksPerChunk;
const CELLS_PER_CHUNK = TERRAIN.chunkSize / TRACK.gridCell;

/** Per-chunk instance matrices (16 floats each), rewritten whenever the chunk is rebuilt. */
export class PropData {
  readonly trees = new Float32Array(MAX_TREES * 16);
  readonly rocks = new Float32Array(MAX_ROCKS * 16);
  treeCount = 0;
  rockCount = 0;
}

/** Yaw rotation + non-uniform scale + translation, written straight into a matrix buffer. */
function writeMatrix(a: Float32Array, n: number, x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number): void {
  const o = n * 16;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  a[o] = c * sx; a[o + 1] = 0; a[o + 2] = -s * sx; a[o + 3] = 0;
  a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0; a[o + 7] = 0;
  a[o + 8] = s * sz; a[o + 9] = 0; a[o + 10] = c * sz; a[o + 11] = 0;
  a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
}

const range = new Int32Array(2);
const hit = createTrackHit();

/**
 * Deterministically scatter trees and rocks along the road segment inside chunk
 * (cx, cz). Same chunk -> same props, so streaming in and out never shuffles the scenery.
 */
export function scatterProps(track: Track, terrain: Terrain, cx: number, cz: number, out: PropData): void {
  const rand = mulberry32(Math.floor(hash2(cx, cz, PROPS.seed) * 4294967295));
  out.treeCount = 0;
  out.rockCount = 0;
  const hw = TRACK.halfWidth;

  for (let gz = 0; gz < CELLS_PER_CHUNK; gz++) {
    for (let gx = 0; gx < CELLS_PER_CHUNK; gx++) {
      track.cellRange(cx * CELLS_PER_CHUNK + gx, cz * CELLS_PER_CHUNK + gz, range);
      for (let k = range[0]; k < range[1]; k++) {
        const i = track.itemAt(k);
        const rx = -track.tz[i];
        const rz = track.tx[i];
        for (let side = -1; side <= 1; side += 2) {
          // Trees: thicker in the dark-green "forest" bands of the terrain tint.
          const px = track.x[i] + rx * side * (hw + PROPS.treeClearance + Math.pow(rand(), 1.6) * PROPS.treeSpread);
          const pz = track.z[i] + rz * side * (hw + PROPS.treeClearance + Math.pow(rand(), 1.6) * PROPS.treeSpread);
          const forest = terrain.tintAt(px, pz);
          const chance = PROPS.treeChance + (PROPS.treeChanceForest - PROPS.treeChance) * forest * forest;
          if (out.treeCount < MAX_TREES && rand() < chance && clearOfRoad(track, px, pz, hw + PROPS.treeClearance)) {
            const s = 0.8 + rand() * 0.8;
            writeMatrix(out.trees, out.treeCount++, px, terrain.heightAt(px, pz), pz, rand() * 6.28, s, s * (0.9 + rand() * 0.4), s);
          }

          // Rocks: close to the verge so they read as roadside hazards.
          if (out.rockCount < MAX_ROCKS && rand() < PROPS.rockChance) {
            const d = hw + 1.5 + rand() * 12;
            const qx = track.x[i] + rx * side * d;
            const qz = track.z[i] + rz * side * d;
            if (clearOfRoad(track, qx, qz, hw + 1.2)) {
              const s = 0.5 + rand() * 1.3;
              writeMatrix(out.rocks, out.rockCount++, qx, terrain.heightAt(qx, qz) + s * 0.1, qz, rand() * 6.28, s * 1.2, s * 0.8, s);
            }
          }
        }
      }
    }
  }
}

/** True when (x, z) is at least `gap` metres from every part of the road (including other sections). */
function clearOfRoad(track: Track, x: number, z: number, gap: number): boolean {
  return !track.query(x, z, hit) || hit.dist >= gap;
}

function paint(geo: BufferGeometry, color: number): BufferGeometry {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  for (let i = 0; i < n; i++) {
    arr[i * 3] = r;
    arr[i * 3 + 1] = g;
    arr[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new BufferAttribute(arr, 3));
  return geo;
}

function makeTreeGeometry(): BufferGeometry {
  const trunk = paint(new BoxGeometry(0.4, 1.4, 0.4).translate(0, 0.7, 0), shade(PALETTE.car, 0.5));
  const lower = paint(new ConeGeometry(1.8, 3.2, 6, 1, true).translate(0, 2.7, 0), PALETTE.forest);
  const upper = paint(new ConeGeometry(1.3, 2.8, 6, 1, true).translate(0, 4.4, 0), shade(PALETTE.forest, 1.2));
  return mergeGeometries([trunk, lower, upper])!;
}

/**
 * Two InstancedMeshes (all trees, all rocks) = two draw calls for the whole scenery.
 * Their matrix buffers are refilled from the live chunks only when the chunk set changes.
 */
export class PropField {
  private readonly trees: InstancedMesh;
  private readonly rocks: InstancedMesh;

  constructor(scene: Scene, poolSize: number) {
    const mat = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.trees = new InstancedMesh(makeTreeGeometry(), mat, poolSize * MAX_TREES);
    this.rocks = new InstancedMesh(
      paint(new DodecahedronGeometry(1, 0), shade(PALETTE.road, 0.9)),
      mat,
      poolSize * MAX_ROCKS,
    );
    for (const m of [this.trees, this.rocks]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.frustumCulled = false; // instances span the whole live area; the draw is cheap
      m.count = 0;
      scene.add(m);
    }
  }

  /** Copy every active chunk's matrices into the shared instance buffers. */
  rebuild(chunks: readonly { active: boolean; props: PropData }[]): void {
    const tArr = this.trees.instanceMatrix.array as Float32Array;
    const rArr = this.rocks.instanceMatrix.array as Float32Array;
    let t = 0;
    let r = 0;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      if (!c.active) continue;
      tArr.set(c.props.trees.subarray(0, c.props.treeCount * 16), t * 16);
      rArr.set(c.props.rocks.subarray(0, c.props.rockCount * 16), r * 16);
      t += c.props.treeCount;
      r += c.props.rockCount;
    }
    this.trees.count = t;
    this.rocks.count = r;
    this.trees.instanceMatrix.needsUpdate = true;
    this.rocks.instanceMatrix.needsUpdate = true;
  }
}
