import './style.css';
import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { EngineAudio } from './audio';
import { CameraRig } from './car/camera';
import { CarController } from './car/controller';
import { CarModel } from './car/model';
import { CAR, FOG, PALETTE, RENDER, SIM } from './config';
import { KeyboardInput } from './input/keyboard';
import { isTouchDevice, TouchInput } from './input/touch';
import { createInputState, mergeInputs, type InputSource } from './input/types';
import { Hud, formatTime } from './ui/hud';
import { showStartScreen } from './ui/startScreen';
import { applyPaletteCssVars } from './ui/theme';
import { World } from './world/world';

applyPaletteCssVars();

// ---------- renderer / scene ----------
const dpr = Math.min(window.devicePixelRatio, RENDER.maxPixelRatio);
const renderer = new WebGLRenderer({
  antialias: dpr < 2, // hi-dpi phones are sharp enough; MSAA is expensive on them
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(dpr);
document.getElementById('app')!.appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color(PALETTE.sky);
scene.fog = new Fog(PALETTE.sky, FOG.near, FOG.far);
scene.add(new HemisphereLight(PALETTE.cream, PALETTE.forest, 1.6));
const sun = new DirectionalLight(PALETTE.cream, 1.8);
sun.position.set(-0.6, 1, 0.4); // no shadows: the car gets a blob instead
scene.add(sun);

const camera = new PerspectiveCamera(60, 1, RENDER.near, RENDER.far);

// ---------- game objects ----------
const ground = new World(scene);

const car = new CarController();
const carModel = new CarModel();
scene.add(carModel.root);
const rig = new CameraRig(camera, ground);

const hud = new Hud(() => restart());
const audio = new EngineAudio();

// ---------- input ----------
const sources: InputSource[] = [new KeyboardInput(() => restart())];
if (isTouchDevice()) sources.push(new TouchInput(document.getElementById('touch')!));
const input = createInputState();

// ---------- state ----------
let started = false;
let stageTime = 0;

function restart(): void {
  ground.prime(0, 0);
  car.reset(0, 0, 0, ground);
  rig.reset(car);
  stageTime = 0;
}

function onResize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  rig.setAspect(w / h);
}
window.addEventListener('resize', onResize);
onResize();
restart();

showStartScreen(() => {
  started = true;
  audio.unlock();
  hud.show();
});

// ---------- loop: fixed 60 Hz simulation, render every animation frame ----------
let last = performance.now();
let acc = 0;
let hudTimer = 0;

function frame(now: number): void {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > SIM.maxFrame) dt = SIM.maxFrame;

  if (started) {
    acc += dt;
    let steps = 0;
    while (acc >= SIM.dt && steps < SIM.maxSteps) {
      mergeInputs(input, sources);
      car.step(SIM.dt, input, ground);
      stageTime += SIM.dt;
      acc -= SIM.dt;
      steps++;
    }
    if (steps === SIM.maxSteps) acc = 0; // fell behind: drop the backlog instead of spiralling
  }

  // Interpolate between the last two sim states so motion stays smooth on any refresh rate.
  const alpha = started ? acc / SIM.dt : 0;
  carModel.update(car, alpha, dt);
  const p = carModel.root.position;
  rig.update(car, p.x, p.y, p.z, dt);
  ground.update(p.x, p.z);
  audio.update(Math.abs(car.speed) / CAR.maxSpeed, input.throttle);

  hudTimer += dt;
  if (hudTimer >= 0.1) {
    hudTimer = 0;
    hud.setSpeed(Math.abs(car.speed) * 3.6);
    hud.setTime(formatTime(stageTime));
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
