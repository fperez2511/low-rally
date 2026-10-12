import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
} from 'three';
import { CAR, PALETTE, shade } from '../config';
import { lerp } from '../util/math';
import type { CarController } from './controller';

// Shared geometries/materials: built once, reused by every car instance and restart.
const mat = (color: number) => new MeshLambertMaterial({ color, flatShading: true });
const M = {
  body: mat(PALETTE.car),
  trim: mat(PALETTE.cream),
  glass: mat(shade(PALETTE.road, 0.45)),
  dark: mat(shade(PALETTE.road, 0.35)),
};
const G = {
  hull: new BoxGeometry(1.8, 0.5, 4.1),
  // 4-sided frustum = tapered cabin, rotated so its faces line up with the hull.
  cabin: new CylinderGeometry(0.62, 0.98, 0.5, 4).rotateY(Math.PI / 4),
  hood: new BoxGeometry(1.6, 0.14, 1.3),
  spoilerWing: new BoxGeometry(1.7, 0.08, 0.4),
  spoilerPost: new BoxGeometry(0.08, 0.3, 0.12),
  light: new BoxGeometry(0.4, 0.14, 0.06),
  tyre: new CylinderGeometry(CAR.wheelRadius, CAR.wheelRadius, 0.3, 8).rotateZ(Math.PI / 2),
  hub: new BoxGeometry(0.34, 0.1, 0.5),
};

function makeBlobTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

/** The car's meshes plus the per-frame pose update. Built only from primitives. */
export class CarModel {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly wheelPivots: Group[] = []; // front pivots steer
  private readonly wheelSpin: Group[] = [];
  private spin = 0;
  private lean = 0;

  constructor() {
    this.root.rotation.order = 'YXZ'; // yaw, then pitch, then roll

    const add = (geo: BoxGeometry | CylinderGeometry, m: MeshLambertMaterial, x: number, y: number, z: number, parent: Group = this.body): Mesh => {
      const mesh = new Mesh(geo, m);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };

    add(G.hull, M.body, 0, 0.62, 0);
    add(G.cabin, M.glass, 0, 1.1, -0.25).scale.z = 1.25;
    add(G.hood, M.body, 0, 0.9, 1.15);
    add(G.light, M.trim, -0.55, 0.7, 2.07);
    add(G.light, M.trim, 0.55, 0.7, 2.07);
    add(G.light, M.dark, -0.55, 0.7, -2.07);
    add(G.light, M.dark, 0.55, 0.7, -2.07);
    add(G.spoilerWing, M.trim, 0, 1.28, -1.85);
    add(G.spoilerPost, M.dark, -0.55, 1.05, -1.8);
    add(G.spoilerPost, M.dark, 0.55, 1.05, -1.8);
    this.root.add(this.body);

    const wx = CAR.trackWidth * 0.5 + 0.1;
    const wz = CAR.wheelBase * 0.5;
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
      const pivot = new Group(); // steers (front pair only)
      pivot.position.set(sx * wx, CAR.wheelRadius, sz * wz);
      const spin = new Group(); // spins about the axle
      add(G.tyre, M.dark, 0, 0, 0, spin);
      add(G.hub, M.trim, 0, 0, 0, spin); // spoke bar so the spin is visible
      pivot.add(spin);
      this.root.add(pivot);
      this.wheelPivots.push(pivot);
      this.wheelSpin.push(spin);
    }

    // Blob shadow: a soft dark disc just above the ground, riding with the car.
    const shadow = new Mesh(
      new CircleGeometry(2.7, 16).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ map: makeBlobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    shadow.position.y = 0.08;
    shadow.scale.set(0.9, 1, 1.25);
    this.root.add(shadow);
  }

  /** Pose from the interpolated car state; `alpha` is the leftover fraction of a sim step. */
  update(car: CarController, alpha: number, dt: number): void {
    const r = this.root;
    r.position.set(lerp(car.px, car.x, alpha), lerp(car.py, car.y, alpha), lerp(car.pz, car.z, alpha));
    r.rotation.set(lerp(car.ppitch, car.pitch, alpha), lerp(car.pyaw, car.yaw, alpha), lerp(car.proll, car.roll, alpha));

    // Body leans away from the corner.
    const leanTarget = -car.latAccel * CAR.leanPerLatAccel;
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 10);
    this.body.rotation.z = this.lean;

    // Wheels: spin from ground speed, front pair steers.
    this.spin += (car.speed / CAR.wheelRadius) * dt;
    const steerAngle = -car.steer * CAR.maxSteer * 0.7;
    for (let i = 0; i < 4; i++) {
      this.wheelSpin[i].rotation.x = this.spin;
      if (i < 2) this.wheelPivots[i].rotation.y = steerAngle;
    }
  }
}
