import { BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, NearestFilter, PlaneGeometry, RepeatWrapping } from 'three';
import { PALETTE, TRACK, shade } from '../config';
import type { Track } from './track';

function checkerTexture(cols: number, rows: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = cols * 8;
  c.height = rows * 8;
  const g = c.getContext('2d')!;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? '#' + PALETTE.cream.toString(16) : '#' + shade(PALETTE.road, 0.35).toString(16).padStart(6, '0');
      g.fillRect(x * 8, y * 8, 8, 8);
    }
  }
  const t = new CanvasTexture(c);
  t.magFilter = NearestFilter;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/**
 * Start/finish gantry and chequered line at sample 0 of the track. The loop is a
 * single-lap stage, so one line is both the start and the finish.
 */
export function buildStartLine(track: Track): Group {
  const group = new Group();
  const hw = TRACK.halfWidth;
  const post = new MeshLambertMaterial({ color: PALETTE.car, flatShading: true });
  const banner = new MeshBasicMaterial({ map: checkerTexture(24, 2) });

  const postGeo = new BoxGeometry(0.6, 6, 0.6);
  for (const side of [-1, 1]) {
    const p = new Mesh(postGeo, post);
    p.position.set(side * (hw + 1), 3, 0);
    group.add(p);
  }
  const beam = new Mesh(new BoxGeometry(hw * 2 + 2.6, 1.1, 0.5), banner);
  beam.position.set(0, 5.6, 0);
  group.add(beam);

  const line = new Mesh(
    new PlaneGeometry(hw * 2, 1.4).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ map: checkerTexture(18, 2), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  );
  line.position.set(0, 0.14, 0);
  group.add(line);

  // Orient the group so local +Z is the direction of travel.
  group.position.set(track.x[0], track.y[0], track.z[0]);
  group.rotation.y = Math.atan2(track.tx[0], track.tz[0]);
  return group;
}
