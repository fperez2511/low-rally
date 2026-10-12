import type { Scene } from 'three';
import type { Ground } from '../car/controller';
import { ChunkManager } from './chunks';
import { buildStartLine } from './startLine';
import { Terrain } from './terrain';
import { Track } from './track';

/** Facade over track + terrain + chunk streaming. The car and camera only see `Ground`. */
export class World implements Ground {
  readonly track = new Track();
  readonly terrain = new Terrain(this.track);
  private readonly chunks: ChunkManager;

  constructor(scene: Scene) {
    this.chunks = new ChunkManager(scene, this.terrain);
    scene.add(buildStartLine(this.track));
  }

  heightAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z);
  }

  offRoadAt(x: number, z: number): boolean {
    return this.terrain.offRoadAt(x, z);
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
