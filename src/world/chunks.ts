import { BufferAttribute, BufferGeometry, Mesh, MeshLambertMaterial, Sphere, type Scene } from 'three';
import { PALETTE, TERRAIN, TRACK, shade } from '../config';
import { clamp } from '../util/math';
import { hash2 } from '../util/random';
import type { Terrain } from './terrain';
import { PropData, PropField, scatterProps } from './props';
import type { Track } from './track';

const N = TERRAIN.cells;
const SIZE = TERRAIN.chunkSize;
const CELL = SIZE / N;
const R = TERRAIN.viewRadius;
const POOL = (2 * R + 1) * (2 * R + 1);
const TERRAIN_VERTS = N * N * 6;
const MAX_ROAD_SEGMENTS = 160; // per chunk; each segment = road quad + two edge-line quads
const ROAD_VERTS = MAX_ROAD_SEGMENTS * 18;
const ROAD_LIFT = 0.05; // road sits just above the terrain skin (plus polygonOffset)
const LINE_LIFT = 0.09;
const LINE_WIDTH = 0.35;
const CELLS_PER_CHUNK = TERRAIN.chunkSize / TRACK.gridCell;

const rgb = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const GRASS = rgb(PALETTE.grass);
const FOREST = rgb(PALETTE.forest);
const ROAD_A = rgb(PALETTE.road);
const ROAD_B = rgb(shade(PALETTE.road, 0.93)); // faint banding so speed reads on a flat-colour road
const LINE = rgb(PALETTE.cream);

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

/** Like tri() but guarantees an upward-facing triangle regardless of input winding. */
function triUp(
  w: TriWriter,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  c: readonly [number, number, number],
): void {
  // Y component of (b - a) x (c - a); negative means the face points down, so swap b and c.
  const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
  if (ny >= 0) tri(w, ax, ay, az, bx, by, bz, cx, cy, cz, c[0], c[1], c[2]);
  else tri(w, ax, ay, az, cx, cy, cz, bx, by, bz, c[0], c[1], c[2]);
}

/** One pooled slot: geometry buffers are allocated once and rewritten in place. */
class Chunk {
  cx = 0;
  cz = 0;
  active = false;
  readonly props = new PropData();
  readonly terrain: Mesh;
  readonly road: Mesh;
  private readonly pos = new Float32Array(TERRAIN_VERTS * 3);
  private readonly nrm = new Float32Array(TERRAIN_VERTS * 3);
  private readonly col = new Float32Array(TERRAIN_VERTS * 3);
  private readonly out: TriWriter = { pos: this.pos, nrm: this.nrm, col: this.col, p: 0 };
  private readonly rPos = new Float32Array(ROAD_VERTS * 3);
  private readonly rNrm = new Float32Array(ROAD_VERTS * 3);
  private readonly rCol = new Float32Array(ROAD_VERTS * 3);
  private readonly roadOut: TriWriter = { pos: this.rPos, nrm: this.rNrm, col: this.rCol, p: 0 };
  private readonly rPosAttr = new BufferAttribute(this.rPos, 3);
  private readonly rNrmAttr = new BufferAttribute(this.rNrm, 3);
  private readonly rColAttr = new BufferAttribute(this.rCol, 3);
  private readonly range = new Int32Array(2);
  private readonly posAttr = new BufferAttribute(this.pos, 3);
  private readonly nrmAttr = new BufferAttribute(this.nrm, 3);
  private readonly colAttr = new BufferAttribute(this.col, 3);

  constructor(material: MeshLambertMaterial, roadMaterial: MeshLambertMaterial) {
    const geo = new BufferGeometry();
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('normal', this.nrmAttr);
    geo.setAttribute('color', this.colAttr);
    geo.boundingSphere = new Sphere();
    this.terrain = new Mesh(geo, material);
    this.terrain.visible = false;

    const rgeo = new BufferGeometry();
    rgeo.setAttribute('position', this.rPosAttr);
    rgeo.setAttribute('normal', this.rNrmAttr);
    rgeo.setAttribute('color', this.rColAttr);
    rgeo.boundingSphere = new Sphere();
    this.road = new Mesh(rgeo, roadMaterial);
    this.road.visible = false;
  }

  /** Rebuild this slot for chunk (cx, cz) in place; `heights` is shared scratch. */
  build(cx: number, cz: number, terrain: Terrain, heights: Float32Array): void {
    const track = terrain.track;
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

    this.buildRoad(track);
    scatterProps(track, terrain, cx, cz, this.props);
  }

  /**
   * Road geometry for the centreline samples that fall inside this chunk: per segment a
   * road quad, plus (on alternate bands) a cream edge line along each side.
   */
  private buildRoad(track: Track): void {
    const out = this.roadOut;
    out.p = 0;
    const hw = TRACK.halfWidth;
    const lw = LINE_WIDTH;
    let segments = 0;

    for (let gz = 0; gz < CELLS_PER_CHUNK; gz++) {
      for (let gx = 0; gx < CELLS_PER_CHUNK; gx++) {
        track.cellRange(this.cx * CELLS_PER_CHUNK + gx, this.cz * CELLS_PER_CHUNK + gz, this.range);
        for (let k = this.range[0]; k < this.range[1] && segments < MAX_ROAD_SEGMENTS; k++, segments++) {
          const i = track.itemAt(k);
          const j = i + 1 === track.count ? 0 : i + 1;
          // Right-hand normal of the direction of travel, in (x, z).
          const rxi = -track.tz[i], rzi = track.tx[i];
          const rxj = -track.tz[j], rzj = track.tx[j];
          const xi = track.x[i], zi = track.z[i], yi = track.y[i] + ROAD_LIFT;
          const xj = track.x[j], zj = track.z[j], yj = track.y[j] + ROAD_LIFT;
          const band = (i >> 2) & 1;
          const colour = band ? ROAD_B : ROAD_A;

          // road quad: L_i, R_i, R_j, L_j
          const lix = xi - rxi * hw, liz = zi - rzi * hw;
          const rix = xi + rxi * hw, riz = zi + rzi * hw;
          const ljx = xj - rxj * hw, ljz = zj - rzj * hw;
          const rjx = xj + rxj * hw, rjz = zj + rzj * hw;
          triUp(out, lix, yi, liz, rix, yi, riz, rjx, yj, rjz, colour);
          triUp(out, lix, yi, liz, rjx, yj, rjz, ljx, yj, ljz, colour);

          if (band === 0) {
            const yli = yi + (LINE_LIFT - ROAD_LIFT), ylj = yj + (LINE_LIFT - ROAD_LIFT);
            const inner = hw - lw;
            // left line (outer edge -> slightly inside)
            const l2ix = xi - rxi * inner, l2iz = zi - rzi * inner;
            const l2jx = xj - rxj * inner, l2jz = zj - rzj * inner;
            triUp(out, lix, yli, liz, l2ix, yli, l2iz, l2jx, ylj, l2jz, LINE);
            triUp(out, lix, yli, liz, l2jx, ylj, l2jz, ljx, ylj, ljz, LINE);
            // right line
            const r2ix = xi + rxi * inner, r2iz = zi + rzi * inner;
            const r2jx = xj + rxj * inner, r2jz = zj + rzj * inner;
            triUp(out, r2ix, yli, r2iz, rix, yli, riz, rjx, ylj, rjz, LINE);
            triUp(out, r2ix, yli, r2iz, rjx, ylj, rjz, r2jx, ylj, r2jz, LINE);
          }
        }
      }
    }

    const geo = this.road.geometry;
    geo.setDrawRange(0, out.p / 3);
    this.rPosAttr.needsUpdate = true;
    this.rNrmAttr.needsUpdate = true;
    this.rColAttr.needsUpdate = true;
    const sphere = this.terrain.geometry.boundingSphere!;
    geo.boundingSphere!.copy(sphere);
    this.road.visible = segments > 0;
  }

  release(): void {
    this.active = false;
    this.terrain.visible = false;
    this.road.visible = false;
    this.props.treeCount = this.props.rockCount = 0;
  }
}

/**
 * Keeps a (2R+1)^2 square of chunks live around the car. Chunks that fall out of the
 * square are released back to a fixed pool and rebuilt in place for the new edge, so
 * driving never allocates or disposes geometry. Builds are spread over frames.
 */
export class ChunkManager {
  private readonly material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  // Polygon offset pulls the road toward the camera so it never z-fights the terrain skin.
  private readonly roadMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  private readonly pool: Chunk[] = [];
  private readonly live = new Map<number, Chunk>();
  private readonly queue: number[] = []; // flat [cx, cz, cx, cz, ...]
  private readonly scratch = new Float32Array((N + 1) * (N + 1));
  private readonly props: PropField;
  private propsDirty = false;
  private centerKey = Number.NaN;
  private centerX = 0;
  private centerZ = 0;

  constructor(scene: Scene, private readonly terrain: Terrain) {
    for (let i = 0; i < POOL; i++) {
      const c = new Chunk(this.material, this.roadMaterial);
      this.pool.push(c);
      scene.add(c.terrain, c.road);
    }
    this.props = new PropField(scene, POOL);
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
        this.propsDirty = true;
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
    if (this.propsDirty) {
      this.props.rebuild(this.pool);
      this.propsDirty = false;
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
    this.propsDirty = true;
  }
}
