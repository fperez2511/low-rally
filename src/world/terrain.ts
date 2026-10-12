import { TERRAIN } from '../config';
import { makeNoise2D } from '../util/random';

/**
 * The analytic heightfield. Everything that needs ground height (terrain meshes,
 * the car's wheels, the camera, prop placement) calls the same function, so what
 * you see is what you drive on.
 */
export class Terrain {
  private readonly n1 = makeNoise2D(TERRAIN.seed);
  private readonly n2 = makeNoise2D(TERRAIN.seed + 101);
  private readonly n3 = makeNoise2D(TERRAIN.seed + 202);
  private readonly nColor = makeNoise2D(TERRAIN.seed + 303);

  /** Pure noise hills, before any road flattening. Gentle: ~200 m rolling swells. */
  baseHeight(x: number, z: number): number {
    const h = this.n1(x / 220, z / 220) * 0.7 + this.n2(x / 90, z / 90) * 0.25 + this.n3(x / 35, z / 35) * 0.05;
    return h * TERRAIN.amplitude;
  }

  heightAt(x: number, z: number): number {
    return this.baseHeight(x, z);
  }

  /** Low-frequency 0..1 value used to pick between the two greens. */
  tintAt(x: number, z: number): number {
    return this.nColor(x / 60, z / 60) * 0.5 + 0.5;
  }
}
