import type { Scene } from 'three';
import type { Ground } from '../car/controller';
import { ChunkManager } from './chunks';
import { Terrain } from './terrain';

/** Facade over terrain + chunk streaming. The car and camera only see `Ground`. */
export class World implements Ground {
  readonly terrain = new Terrain();
  private readonly chunks: ChunkManager;

  constructor(scene: Scene) {
    this.chunks = new ChunkManager(scene, this.terrain);
  }

  heightAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z);
  }

  offRoadAt(): boolean {
    return false;
  }

  /** Rebuild everything around (x, z) at once. */
  prime(x: number, z: number): void {
    this.chunks.prime(x, z);
  }

  /** Per rendered frame: stream chunks around the car. */
  update(x: number, z: number): void {
    this.chunks.update(x, z);
  }
}
