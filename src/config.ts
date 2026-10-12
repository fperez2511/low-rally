/**
 * Every tunable lives here: the palette first, then simulation / car / camera constants.
 * Units: metres, seconds, radians. Heading 0 faces +Z; positive yaw turns toward +X.
 */

/** The entire game uses these six colours (other tones are shaded variants of them). */
export const PALETTE = {
  sky: 0xf4c9a0, // background + fog: warm haze
  grass: 0x8cae5b,
  forest: 0x4f7a4a, // dark green: trees, hill shading
  road: 0x6e6a78, // warm grey road
  cream: 0xf6ecd6, // lines, lights, gantry
  car: 0xe4533a, // car body + accents
} as const;

/** Darken (k < 1) or lighten (k > 1) a palette colour. Used for tyres, rocks, glass. */
export function shade(hex: number, k: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * k));
  const b = Math.min(255, Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}

export const FOG = { near: 40, far: 190 };

export const SIM = {
  dt: 1 / 60, // fixed simulation step
  maxFrame: 0.1, // clamp huge frame gaps (tab switch) so we don't spiral
  maxSteps: 5,
};

export const RENDER = {
  maxPixelRatio: 2,
  near: 0.5,
  far: 400,
};

export const CAR = {
  wheelBase: 2.6,
  trackWidth: 1.6,
  wheelRadius: 0.36,

  // --- longitudinal ---
  engineAccel: 14, // m/s^2 at standstill, tapers linearly to 0 at maxSpeed
  maxSpeed: 50,
  brakeDecel: 28,
  reverseAccel: 8,
  maxReverse: 9,
  rolling: 0.3, // constant rolling resistance (m/s^2)
  airDrag: 0.0025, // quadratic drag: decel = airDrag * v^2

  // --- steering (bicycle model) ---
  maxSteer: 0.55, // front wheel angle at standstill (rad)
  steerRefSpeed: 10, // steer angle = maxSteer / (1 + (v / ref)^2): less lock at speed
  steerRate: 6, // how fast the wheel moves toward the input (1/s)
  steerReturn: 9, // how fast it centres
  yawResponse: 10, // yaw rate low-pass (1/s): gives the car some rotational inertia
  maxYawRate: 2.4,

  // --- tyre grip ---
  gripAccel: 16, // peak lateral acceleration the tyres can give (m/s^2)
  latStiffness: 14, // lateral velocity is killed at this rate until it hits the grip cap (1/s)
  slipStart: 0.14, // slip angle (rad) where grip starts to fade
  slipEnd: 0.6, // slip angle where it bottoms out
  slideGrip: 0.5, // fraction of gripAccel left once fully sliding
  brakeSteerGripMul: 0.55, // braking while turning unloads the rear -> drift entry
  driftYawBoost: 0.5, // extra rotation while sliding so a drift can be held with the wheel

  // --- surfaces ---
  offRoadEngine: 0.55,
  offRoadDrag: 2.2, // extra decel (m/s^2) on grass
  offRoadGrip: 0.7,
  surfaceBlendRate: 8,

  // --- body visuals ---
  leanPerLatAccel: 0.006, // body roll (rad) per m/s^2 of lateral acceleration
  attitudeResponse: 10, // pitch/roll follow-the-terrain smoothing (1/s)
};

export const CAMERA = {
  distance: 7.5,
  height: 3.1,
  lookAhead: 6,
  lookHeight: 1.1,
  yawFollow: 4.5, // how quickly the camera swings behind the heading (1/s)
  posFollow: 9,
  fovBase: 60,
  fovMax: 84,
  fovFollow: 3,
  portraitBoost: 26, // extra FOV in portrait so the road stays visible
  minClearance: 1.4, // keep the camera above the ground
};
