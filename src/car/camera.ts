import { PerspectiveCamera } from 'three';
import { CAMERA, CAR } from '../config';
import { clamp, damp } from '../util/math';
import type { CarController } from './controller';
import type { Ground } from './controller';

/**
 * Angled chase camera. The camera's own heading lags behind the car's, so when the
 * car slides you see its flank; FOV widens with speed for a sense of velocity.
 */
export class CameraRig {
  private yaw = 0;
  private fov: number = CAMERA.fovBase;
  private aspect = 1;
  private cx = 0;
  private cy = 0;
  private cz = 0;

  constructor(readonly camera: PerspectiveCamera, private readonly ground: Ground) {}

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Snap behind the car (start / restart). */
  reset(car: CarController): void {
    this.yaw = car.yaw;
    this.cx = car.x - Math.sin(this.yaw) * CAMERA.distance;
    this.cz = car.z - Math.cos(this.yaw) * CAMERA.distance;
    this.cy = car.y + CAMERA.height;
    this.fov = this.baseFov();
  }

  private baseFov(): number {
    // Portrait screens are narrow: open the lens up so the road isn't a thin slit.
    const portrait = clamp((1.3 - this.aspect) / 0.6, 0, 1);
    return CAMERA.fovBase + portrait * CAMERA.portraitBoost;
  }

  /** Called every rendered frame with the interpolated car position. */
  update(car: CarController, px: number, py: number, pz: number, dt: number): void {
    this.yaw += (car.yaw - this.yaw) * damp(CAMERA.yawFollow, dt);

    const tx = px - Math.sin(this.yaw) * CAMERA.distance;
    const tz = pz - Math.cos(this.yaw) * CAMERA.distance;
    const k = damp(CAMERA.posFollow, dt);
    this.cx += (tx - this.cx) * k;
    this.cz += (tz - this.cz) * k;
    const ty = py + CAMERA.height;
    this.cy += (ty - this.cy) * k;
    // Never let a hill swallow the lens.
    const floor = this.ground.heightAt(this.cx, this.cz) + CAMERA.minClearance;
    if (this.cy < floor) this.cy = floor;

    const cam = this.camera;
    cam.position.set(this.cx, this.cy, this.cz);
    cam.lookAt(px + Math.sin(this.yaw) * CAMERA.lookAhead, py + CAMERA.lookHeight, pz + Math.cos(this.yaw) * CAMERA.lookAhead);

    const speedRatio = clamp(Math.abs(car.speed) / CAR.maxSpeed, 0, 1);
    const targetFov = this.baseFov() + (CAMERA.fovMax - CAMERA.fovBase) * speedRatio;
    this.fov += (targetFov - this.fov) * damp(CAMERA.fovFollow, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }
}
