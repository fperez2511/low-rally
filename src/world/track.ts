import { CatmullRomCurve3, Vector3 } from 'three';
import { TRACK } from '../config';
import { mulberry32 } from '../util/random';

/** Result of a nearest-road query. Reused by callers; the query never allocates. */
export interface TrackHit {
  /** Segment index i (segment runs sample i -> i+1, wrapping). */
  index: number;
  /** 0..1 position along that segment. */
  t: number;
  /** Distance from the centreline (m). */
  dist: number;
  /** Road surface height at the projected point. */
  y: number;
}

export function createTrackHit(): TrackHit {
  return { index: 0, t: 0, dist: Infinity, y: 0 };
}

/**
 * A closed loop road: a Catmull-Rom spline through seeded control points on a
 * wobbly ring, resampled at even spacing. The centreline is stored as flat typed
 * arrays plus a spatial hash so "how far am I from the road?" is a cheap lookup.
 * Sample 0 is the start/finish line.
 */
export class Track {
  readonly count: number;
  readonly length: number;
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly y: Float32Array;
  /** Unit tangent (direction of travel) per sample. */
  readonly tx: Float32Array;
  readonly tz: Float32Array;

  // Spatial hash in CSR layout: cell -> sample indices.
  private readonly cell = TRACK.gridCell;
  private gx0 = 0;
  private gz0 = 0;
  private gw = 0;
  private gh = 0;
  private cellStart!: Int32Array;
  private cellItems!: Int32Array;

  constructor(seed = TRACK.seed) {
    const rand = mulberry32(seed);

    // Control points: ring with random radius, angles jittered. Keeping the angle
    // monotonic makes the polygon star-shaped, so the loop can't cross itself.
    const n = TRACK.controlPoints;
    const pts: Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const a = ((i + (rand() - 0.5) * 0.5) / n) * Math.PI * 2;
      const r = TRACK.radius * (0.55 + 0.75 * rand());
      pts.push(new Vector3(Math.sin(a) * r, 0, Math.cos(a) * r));
    }
    const curve = new CatmullRomCurve3(pts, true, 'centripetal');
    curve.arcLengthDivisions = 4000;
    const total = curve.getLength();
    const count = Math.round(total / TRACK.sampleSpacing);
    const samples = curve.getSpacedPoints(count); // count + 1 points; last == first

    this.count = count;
    this.length = total;
    this.x = new Float32Array(count);
    this.z = new Float32Array(count);
    this.y = new Float32Array(count);
    this.tx = new Float32Array(count);
    this.tz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.x[i] = samples[i].x;
      this.z[i] = samples[i].z;
    }

    // Tangents by central difference across the (wrapping) neighbours.
    for (let i = 0; i < count; i++) {
      const a = (i + count - 1) % count;
      const b = (i + 1) % count;
      const dx = this.x[b] - this.x[a];
      const dz = this.z[b] - this.z[a];
      const inv = 1 / Math.hypot(dx, dz);
      this.tx[i] = dx * inv;
      this.tz[i] = dz * inv;
    }

    // Elevation profile built from whole harmonics of the loop so it joins up seamlessly.
    const phases = TRACK.elevation.map(() => rand() * Math.PI * 2);
    for (let i = 0; i < count; i++) {
      const u = (i / count) * Math.PI * 2;
      let h = 0;
      TRACK.elevation.forEach((e, k) => (h += e.amp * Math.sin(e.harmonic * u + phases[k])));
      this.y[i] = h;
    }

    this.buildGrid();
  }

  /** Spawn pose: a few samples behind the start line, facing along the road. */
  spawn(): { x: number; z: number; yaw: number } {
    const i = (this.count - TRACK.startBehind + this.count) % this.count;
    return { x: this.x[i], z: this.z[i], yaw: Math.atan2(this.tx[i], this.tz[i]) };
  }

  private buildGrid(): void {
    const c = this.cell;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < this.count; i++) {
      minX = Math.min(minX, this.x[i]); maxX = Math.max(maxX, this.x[i]);
      minZ = Math.min(minZ, this.z[i]); maxZ = Math.max(maxZ, this.z[i]);
    }
    this.gx0 = Math.floor(minX / c);
    this.gz0 = Math.floor(minZ / c);
    this.gw = Math.floor(maxX / c) - this.gx0 + 1;
    this.gh = Math.floor(maxZ / c) - this.gz0 + 1;

    const counts = new Int32Array(this.gw * this.gh + 1);
    const cellOf = new Int32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const cx = Math.floor(this.x[i] / c) - this.gx0;
      const cz = Math.floor(this.z[i] / c) - this.gz0;
      cellOf[i] = cz * this.gw + cx;
      counts[cellOf[i] + 1]++;
    }
    for (let k = 0; k < this.gw * this.gh; k++) counts[k + 1] += counts[k];
    this.cellStart = counts;
    const fill = counts.slice(0, this.gw * this.gh);
    this.cellItems = new Int32Array(this.count);
    for (let i = 0; i < this.count; i++) this.cellItems[fill[cellOf[i]]++] = i;
  }

  /**
   * Nearest point on the centreline within ~gridCell metres, via the spatial hash.
   * Returns false when no road is that close (hit is left untouched).
   */
  query(px: number, pz: number, hit: TrackHit): boolean {
    const c = this.cell;
    const cx = Math.floor(px / c) - this.gx0;
    const cz = Math.floor(pz / c) - this.gz0;
    let best = Infinity;
    let bi = -1;
    let bt = 0;
    for (let dz = -1; dz <= 1; dz++) {
      const zz = cz + dz;
      if (zz < 0 || zz >= this.gh) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = cx + dx;
        if (xx < 0 || xx >= this.gw) continue;
        const cell = zz * this.gw + xx;
        for (let k = this.cellStart[cell]; k < this.cellStart[cell + 1]; k++) {
          const i = this.cellItems[k];
          const j = i + 1 === this.count ? 0 : i + 1;
          const ax = this.x[i], az = this.z[i];
          const sx = this.x[j] - ax, sz = this.z[j] - az;
          let t = ((px - ax) * sx + (pz - az) * sz) / (sx * sx + sz * sz);
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = px - (ax + sx * t), ez = pz - (az + sz * t);
          const d2 = ex * ex + ez * ez;
          if (d2 < best) { best = d2; bi = i; bt = t; }
        }
      }
    }
    if (bi < 0) return false;
    const j = bi + 1 === this.count ? 0 : bi + 1;
    hit.index = bi;
    hit.t = bt;
    hit.dist = Math.sqrt(best);
    hit.y = this.y[bi] + (this.y[j] - this.y[bi]) * bt;
    return true;
  }

  /** Samples live in grid cell (cellX, cellZ) (absolute cell coords): returns [start, end) into items(). */
  cellRange(cellX: number, cellZ: number, out: Int32Array): void {
    const xx = cellX - this.gx0;
    const zz = cellZ - this.gz0;
    if (xx < 0 || zz < 0 || xx >= this.gw || zz >= this.gh) {
      out[0] = out[1] = 0;
      return;
    }
    const cell = zz * this.gw + xx;
    out[0] = this.cellStart[cell];
    out[1] = this.cellStart[cell + 1];
  }

  /** Sample index stored at position k of the cell lists. */
  itemAt(k: number): number {
    return this.cellItems[k];
  }

  /**
   * Cheap progress tracking: the sample nearest to (px, pz) searching only a window
   * around `hint`. Wrap-aware. Used by the stage timer, which moves a few cm per step.
   */
  nearestIndexNear(px: number, pz: number, hint: number, window = 30): number {
    let best = Infinity;
    let bi = hint;
    for (let o = -window; o <= window; o++) {
      const i = (hint + o + this.count) % this.count;
      const dx = px - this.x[i];
      const dz = pz - this.z[i];
      const d2 = dx * dx + dz * dz;
      if (d2 < best) { best = d2; bi = i; }
    }
    return bi;
  }
}
