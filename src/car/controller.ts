import { CAR } from '../config';
import { approach, clamp, smoothstep } from '../util/math';
import type { InputState } from '../input/types';

/** What the car needs to know about the world. */
export interface Ground {
  heightAt(x: number, z: number): number;
  offRoadAt(x: number, z: number): boolean;
}

/**
 * Arcade car: a kinematic bicycle model for steering plus a saturating tyre model
 * for grip. There is no rigid-body physics; velocity is a plain 2D vector that the
 * tyres drag toward the heading.
 *
 * Conventions: forward = (sin yaw, cos yaw), right = (-cos yaw, sin yaw) in (x, z).
 * Positive steer = turn right = *decreasing* yaw.
 */
export class CarController {
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  pitch = 0;
  roll = 0;

  vx = 0;
  vz = 0;
  /** Signed speed along the heading (m/s). */
  speed = 0;
  yawRate = 0;
  /** Smoothed steering position -1..1 (also drives the front wheels visually). */
  steer = 0;
  /** Slip angle (rad): angle between heading and travel direction. */
  slip = 0;
  /** Lateral acceleration the tyres are producing along `right` (m/s^2). */
  latAccel = 0;
  /** 0 = on road, 1 = fully off road (smoothed). */
  offRoad = 0;

  // Previous-step copies so the renderer can interpolate between fixed steps.
  px = 0;
  py = 0;
  pz = 0;
  pyaw = 0;
  ppitch = 0;
  proll = 0;

  reset(x: number, z: number, yaw: number, ground: Ground): void {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.vx = this.vz = this.speed = this.yawRate = this.steer = this.slip = this.latAccel = 0;
    this.offRoad = ground.offRoadAt(x, z) ? 1 : 0;
    this.pitch = this.roll = 0;
    this.sampleGround(ground, 1);
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
    this.pyaw = this.yaw;
    this.ppitch = this.pitch;
    this.proll = this.roll;
  }

  step(dt: number, input: InputState, ground: Ground): void {
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
    this.pyaw = this.yaw;
    this.ppitch = this.pitch;
    this.proll = this.roll;

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const fx = sinY;
    const fz = cosY;
    const rx = -cosY;
    const rz = sinY;

    // Split world velocity into forward / lateral components of the car.
    let vf = this.vx * fx + this.vz * fz;
    let vl = this.vx * rx + this.vz * rz;

    // Surface: blend rather than snap so crossing the road edge isn't a jolt.
    const offTarget = ground.offRoadAt(this.x, this.z) ? 1 : 0;
    this.offRoad += (offTarget - this.offRoad) * Math.min(1, dt * CAR.surfaceBlendRate);
    const off = this.offRoad;

    // ---- steering input smoothing (a wheel takes time to turn) ----
    const rate = input.steer === 0 || input.steer * this.steer < 0 ? CAR.steerReturn : CAR.steerRate;
    this.steer = approach(this.steer, input.steer, rate * dt);

    // ---- longitudinal ----
    let accel = 0;
    if (input.brake > 0.01) {
      // Brake while rolling forward; once (nearly) stopped, the same input reverses.
      accel = vf > 0.3 ? -CAR.brakeDecel * input.brake : vf > -CAR.maxReverse ? -CAR.reverseAccel : 0;
    } else if (vf < -0.3) {
      accel = CAR.brakeDecel; // throttle while reversing: brake to a stop first
    } else {
      // Engine pull fades linearly to zero at maxSpeed.
      accel = CAR.engineAccel * Math.max(0, 1 - vf / CAR.maxSpeed) * (1 - (1 - CAR.offRoadEngine) * off) * input.throttle;
    }
    // Resistances always oppose motion and can never flip its sign.
    const drag = CAR.rolling + CAR.airDrag * vf * vf + CAR.offRoadDrag * off;
    const dragStep = Math.min(Math.abs(vf), drag * dt);
    vf += accel * dt - (vf > 0 ? dragStep : -dragStep);

    // ---- lateral grip ----
    // Grip curve: full grip at small slip angles, fading to `slideGrip` as the car
    // turns sideways. Because less grip -> more slip -> even less grip, the car stays
    // in a drift until the driver unwinds the wheel and the slip angle comes back down.
    const slip = Math.atan2(Math.abs(vl), Math.abs(vf) + 1);
    this.slip = slip;
    let grip = 1 - (1 - CAR.slideGrip) * smoothstep(CAR.slipStart, CAR.slipEnd, slip);
    grip *= 1 - (1 - CAR.offRoadGrip) * off;
    // Braking while turning at speed unloads the rear tyres -> drift entry.
    const brakeTurn = input.brake * Math.min(1, Math.abs(this.steer) * 1.5) * smoothstep(6, 14, vf);
    grip *= 1 - (1 - CAR.brakeSteerGripMul) * brakeTurn;

    const maxLat = CAR.gripAccel * grip;
    const aLat = clamp(-vl * CAR.latStiffness, -maxLat, maxLat);
    let dvl = aLat * dt;
    if (Math.abs(dvl) > Math.abs(vl)) dvl = -vl; // never overshoot zero
    vl += dvl;
    this.latAccel = aLat;

    // Rebuild the world velocity and move.
    this.vx = fx * vf + rx * vl;
    this.vz = fz * vf + rz * vl;
    this.speed = vf;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // ---- yaw (bicycle model) ----
    // Front wheel angle shrinks with speed so the car stays drivable at 130 km/h.
    const ratio = vf / CAR.steerRefSpeed;
    const delta = (this.steer * CAR.maxSteer) / (1 + ratio * ratio);
    // Kinematic bicycle: yaw rate = v / wheelbase * tan(delta). Negative because
    // positive steer is a right turn (yaw decreasing).
    let target = -(vf / CAR.wheelBase) * Math.tan(delta);
    target *= 1 + CAR.driftYawBoost * (1 - grip / Math.max(0.001, 1 - (1 - CAR.offRoadGrip) * off));
    this.yawRate += (target - this.yawRate) * Math.min(1, dt * CAR.yawResponse);
    this.yawRate = clamp(this.yawRate, -CAR.maxYawRate, CAR.maxYawRate);
    this.yaw += this.yawRate * dt;

    this.sampleGround(ground, Math.min(1, dt * CAR.attitudeResponse));
  }

  /** Put the car on the ground and tilt it to match the slope under its wheels. */
  private sampleGround(ground: Ground, follow: number): void {
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const rx = -fz;
    const rz = fx;
    const hl = CAR.wheelBase * 0.5;
    const ht = CAR.trackWidth * 0.5;

    const hF = ground.heightAt(this.x + fx * hl, this.z + fz * hl);
    const hB = ground.heightAt(this.x - fx * hl, this.z - fz * hl);
    const hR = ground.heightAt(this.x + rx * ht, this.z + rz * ht);
    const hL = ground.heightAt(this.x - rx * ht, this.z - rz * ht);

    this.y = (hF + hB + hL + hR) * 0.25;
    // three.js: +pitch noses down, +roll lifts the local +X (left) side.
    const targetPitch = -Math.atan2(hF - hB, CAR.wheelBase);
    const targetRoll = Math.atan2(hL - hR, CAR.trackWidth);
    this.pitch += (targetPitch - this.pitch) * follow;
    this.roll += (targetRoll - this.roll) * follow;
  }
}
