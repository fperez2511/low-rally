import { BufferAttribute, BufferGeometry, Mesh, MeshLambertMaterial, Sphere, type Scene } from 'three';
import { PALETTE, TERRAIN } from '../config';
import { clamp } from '../util/math';
import { hash2 } from '../util/random';
import type { Terrain } from './terrain';

const N = TERRAIN.cells;
const SIZE = TERRAIN.chunkSize;
const CELL = SIZE / N;
const R = TERRAIN.viewRadius;
const POOL = (2 * R + 1) * (2 * R + 1);
const TERRAIN_VERTS = N * N * 6;

const rgb = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const GRASS = rgb(PALETTE.grass);
const FOREST = rgb(PALETTE.forest);

const chunkKey = (cx: number, cz: number): number => (cx + 32768) * 65536 + (cz + 32768);


interface TriWriter {
  pos: Float32Array;
  nrm: Float32Array;
  col: Float32Array;
  p: number;
}

/** Append one flat-shaded triangle (positions, face normal, face colour) to the writer. */
function tri(
  w: TriWriter,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  r: number, g: number, b: number,
): void {
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const inv = 1 / (Math.hypot(nx, ny, nz) || 1);
  nx *= inv; ny *= inv; nz *= inv;
  let p = w.p;
  for (let k = 0; k < 3; k++) {
    w.pos[p] = k === 0 ? ax : k === 1 ? bx : cx;
    w.pos[p + 1] = k === 0 ? ay : k === 1 ? by : cy;
    w.pos[p + 2] = k === 0 ? az : k === 1 ? bz : cz;
    w.nrm[p] = nx; w.nrm[p + 1] = ny; w.nrm[p + 2] = nz;
    w.col[p] = r; w.col[p + 1] = g; w.col[p + 2] = b;
    p += 3;
  }
  w.p = p;
}

/** One pooled slot: geometry buffers are allocated once and rewritten in place. */
class Chunk {
  cx = 0;
  cz = 0;
  active = false;
  readonly terrain: Mesh;
  private readonly pos = new Float32Array(TERRAIN_VERTS * 3);
  private readonly nrm = new Float32Array(TERRAIN_VERTS * 3);
  private readonly col = new Float32Array(TERRAIN_VERTS * 3);
  private readonly out: TriWriter = { pos: this.pos, nrm: this.nrm, col: this.col, p: 0 };
  private readonly posAttr = new BufferAttribute(this.pos, 3);
  private readonly nrmAttr = new BufferAttribute(this.nrm, 3);
  private readonly colAttr = new BufferAttribute(this.col, 3);

  constructor(material: MeshLambertMaterial) {
    const geo = new BufferGeometry();
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('normal', this.nrmAttr);
    geo.setAttribute('color', this.colAttr);
    geo.boundingSphere = new Sphere();
    this.terrain = new Mesh(geo, material);
    this.terrain.visible = false;
  }

  /** Rebuild this slot for chunk (cx, cz) in place; `heights` is shared scratch. */
  build(cx: number, cz: number, terrain: Terrain, heights: Float32Array): void {
    this.cx = cx;
    this.cz = cz;
    this.active = true;
    const x0 = cx * SIZE;
    const z0 = cz * SIZE;
    const W = N + 1;

    let minH = Infinity;
    let maxH = -Infinity;
    for (let j = 0; j < W; j++) {
      for (let i = 0; i < W; i++) {
        const h = terrain.heightAt(x0 + i * CELL, z0 + j * CELL);
        heights[j * W + i] = h;
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
    }

    const out = this.out;
    out.p = 0;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const xa = x0 + i * CELL, xb = xa + CELL;
        const za = z0 + j * CELL, zb = za + CELL;
        const h00 = heights[j * W + i];
        const h10 = heights[j * W + i + 1];
        const h01 = heights[(j + 1) * W + i];
        const h11 = heights[(j + 1) * W + i + 1];

        // Cell tint: low-frequency noise picks grass vs forest, quantised into bands
        // for the faceted look, plus a little per-face jitter.
        const tint = terrain.tintAt(xa + CELL / 2, za + CELL / 2);
        const hAvg = (h00 + h10 + h01 + h11) * 0.25;
        const base = clamp(tint * 0.9 + (hAvg / TERRAIN.amplitude) * 0.25, 0, 1);
        const band = Math.floor(base * 3) / 3;
        const wi = Math.round(xa / CELL);
        const wj = Math.round(za / CELL);
        for (let t = 0; t < 2; t++) {
          const m = clamp(band + hash2(wi, wj, t + 7) * 0.2 - 0.05, 0, 1);
          const r = GRASS[0] + (FOREST[0] - GRASS[0]) * m;
          const g = GRASS[1] + (FOREST[1] - GRASS[1]) * m;
          const b = GRASS[2] + (FOREST[2] - GRASS[2]) * m;
          // Alternate the diagonal so the facets don't all lean the same way.
          if (((wi + wj) & 1) === 0) {
            if (t === 0) tri(out, xa, h00, za, xa, h01, zb, xb, h11, zb, r, g, b);
            else tri(out, xa, h00, za, xb, h11, zb, xb, h10, za, r, g, b);
          } else {
            if (t === 0) tri(out, xa, h00, za, xa, h01, zb, xb, h10, za, r, g, b);
            else tri(out, xb, h10, za, xa, h01, zb, xb, h11, zb, r, g, b);
          }
        }
      }
    }

    this.posAttr.needsUpdate = true;
    this.nrmAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    // Bounding sphere set by hand: cheaper than scanning the buffer, and keeps culling on.
    this.terrain.geometry.boundingSphere!.center.set(x0 + SIZE / 2, (minH + maxH) / 2, z0 + SIZE / 2);
    this.terrain.geometry.boundingSphere!.radius = SIZE * 0.72 + (maxH - minH) / 2;
    this.terrain.visible = true;
  }

  release(): void {
    this.active = false;
    this.terrain.visible = false;
  }
}

/**
 * Keeps a (2R+1)^2 square of chunks live around the car. Chunks that fall out of the
 * square are released back to a fixed pool and rebuilt in place for the new edge, so
 * driving never allocates or disposes geometry. Builds are spread over frames.
 */
export class ChunkManager {
  private readonly material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly pool: Chunk[] = [];
  private readonly live = new Map<number, Chunk>();
  private readonly queue: number[] = []; // flat [cx, cz, cx, cz, ...]
  private readonly scratch = new Float32Array((N + 1) * (N + 1));
  private centerKey = Number.NaN;
  private centerX = 0;
  private centerZ = 0;

  constructor(scene: Scene, private readonly terrain: Terrain) {
    for (let i = 0; i < POOL; i++) {
      const c = new Chunk(this.material);
      this.pool.push(c);
      scene.add(c.terrain);
    }
  }

  /** Reset around a new position and build everything immediately (start / restart). */
  prime(x: number, z: number): void {
    this.retarget(x, z);
    this.pump(Infinity);
  }

  update(x: number, z: number): void {
    const cx = Math.floor(x / SIZE);
    const cz = Math.floor(z / SIZE);
    if (chunkKey(cx, cz) !== this.centerKey) this.retarget(x, z);
    this.pump(TERRAIN.buildPerFrame);
  }

  private retarget(x: number, z: number): void {
    const cx = Math.floor(x / SIZE);
    const cz = Math.floor(z / SIZE);
    this.centerKey = chunkKey(cx, cz);
    this.centerX = cx;
    this.centerZ = cz;

    // Release chunks that left the square.
    for (const [key, chunk] of this.live) {
      if (Math.abs(chunk.cx - cx) > R || Math.abs(chunk.cz - cz) > R) {
        chunk.release();
        this.live.delete(key);
      }
    }
    // Queue the missing ones.
    this.queue.length = 0;
    for (let ring = R; ring >= 0; ring--) { // pump() pops from the end, so nearest ends up last
      for (let dz = -ring; dz <= ring; dz++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          if (!this.live.has(chunkKey(cx + dx, cz + dz))) this.queue.push(cx + dx, cz + dz);
        }
      }
    }
  }

  private pump(budget: number): void {
    let built = 0;
    while (this.queue.length > 0 && built < budget) {
      const cz = this.queue.pop()!;
      const cx = this.queue.pop()!;
      this.buildOne(cx, cz);
      built++;
    }
  }

  private buildOne(cx: number, cz: number): void {
    if (Math.abs(cx - this.centerX) > R || Math.abs(cz - this.centerZ) > R) return;
    let slot: Chunk | null = null;
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) { slot = this.pool[i]; break; }
    }
    if (!slot) return;
    slot.build(cx, cz, this.terrain, this.scratch);
    this.live.set(chunkKey(cx, cz), slot);
  }
}
