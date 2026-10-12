import { BufferAttribute, Mesh, MeshLambertMaterial, PlaneGeometry } from 'three';
import { PALETTE } from '../config';
import { hash2 } from '../util/random';
import type { Ground } from '../car/controller';

/** Step-1 ground: a flat low-poly plane that follows the car in whole-cell snaps. */
const SIZE = 600;
const DIVS = 30;
const CELL = SIZE / DIVS;

const GRASS_R = ((PALETTE.grass >> 16) & 255) / 255;
const GRASS_G = ((PALETTE.grass >> 8) & 255) / 255;
const GRASS_B = (PALETTE.grass & 255) / 255;
const FOREST_R = ((PALETTE.forest >> 16) & 255) / 255;
const FOREST_G = ((PALETTE.forest >> 8) & 255) / 255;
const FOREST_B = (PALETTE.forest & 255) / 255;

export class FlatGround implements Ground {
  readonly mesh: Mesh;
  private readonly colors: BufferAttribute;
  private snapX = Number.NaN;
  private snapZ = Number.NaN;

  constructor() {
    const plane = new PlaneGeometry(SIZE, SIZE, DIVS, DIVS);
    plane.rotateX(-Math.PI / 2);
    const geo = plane.toNonIndexed(); // non-indexed => flat shading and per-face colour
    plane.dispose();
    this.colors = new BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3);
    geo.setAttribute('color', this.colors);
    this.mesh = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.mesh.frustumCulled = false;
  }

  heightAt(): number {
    return 0;
  }

  offRoadAt(): boolean {
    return false;
  }

  /** Re-centre under the car; recolours only when we cross a cell boundary. */
  follow(x: number, z: number): void {
    const sx = Math.round(x / CELL) * CELL;
    const sz = Math.round(z / CELL) * CELL;
    if (sx === this.snapX && sz === this.snapZ) return;
    this.snapX = sx;
    this.snapZ = sz;
    this.mesh.position.set(sx, 0, sz);

    const arr = this.colors.array as Float32Array;
    const half = DIVS / 2;
    let o = 0;
    // PlaneGeometry (rotated) emits 2 triangles per cell, row by row; recolour in that order.
    for (let row = 0; row < DIVS; row++) {
      for (let col = 0; col < DIVS; col++) {
        const wx = Math.round(sx / CELL) + col - half;
        const wz = Math.round(sz / CELL) + row - half;
        for (let tri = 0; tri < 2; tri++) {
          const t = hash2(wx, wz, tri + 1) * 0.7;
          for (let v = 0; v < 3; v++) {
            arr[o++] = GRASS_R + (FOREST_R - GRASS_R) * t;
            arr[o++] = GRASS_G + (FOREST_G - GRASS_G) * t;
            arr[o++] = GRASS_B + (FOREST_B - GRASS_B) * t;
          }
        }
      }
    }
    this.colors.needsUpdate = true;
  }
}
