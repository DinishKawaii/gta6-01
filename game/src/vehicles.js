// vehicles.js — the seven cars of Solmara, traffic and the police.
// Cars are boxes with wheels: a sports car is low and long, a van is a
// tall box, a pickup has an open bed. Traffic drives the road graph;
// police chase the player along it with a breadth-first path.
// Police count is exactly the wanted level, never more.
import * as THREE from 'three';
import { makeRng, pick, range } from './rng.js';
import { nearestNode, nodePos, neighbors, bfsPath, collideCircle } from './city.js';

export const CAR_MODELS = {
  comet: { name: 'Comet GT', color: 0xf5c518, len: 4.4, wid: 2.0, h: 0.85, top: 24, price: 0 },
  veloce: { name: 'Veloce S', color: 0xd42a2a, len: 4.5, wid: 2.0, h: 0.8, top: 26, price: 0 },
  bison: { name: 'Bison Pickup', color: 0x3f6b3a, len: 5.2, wid: 2.1, h: 1.1, top: 20, price: 0 },
  taxi: { name: 'Taxi', color: 0xf5d020, len: 4.3, wid: 1.9, h: 1.0, top: 21, price: 0 },
  sedan: { name: 'Marina Sedan', color: 0x2a6fd4, len: 4.4, wid: 1.9, h: 1.0, top: 22, price: 0 },
  van: { name: 'Docks Van', color: 0xe8e8e8, len: 5.0, wid: 2.2, h: 1.9, top: 18, price: 0 },
  interceptor: { name: 'Interceptor', color: 0x1a1d22, len: 4.6, wid: 2.0, h: 1.0, top: 30, price: 0 },
};

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x18242e });
const bedMat = new THREE.MeshLambertMaterial({ color: 0x22262b });
const lightRedMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const lightBlueMat = new THREE.MeshBasicMaterial({ color: 0x2a7bff });
const taxiSignMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  return m;
}

// Build one car's mesh. kind is a key of CAR_MODELS.
export function buildCarMesh(kind) {
  const model = CAR_MODELS[kind];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: model.color });
  const body = box(model.len, model.h, model.wid, bodyMat);
  body.position.y = 0.55 + model.h / 2 - 0.4;
  group.add(body);
  if (kind === 'van') {
    const cargo = box(model.len * 0.62, 1.1, model.wid * 0.94, bodyMat);
    cargo.position.set(-0.6, 1.6, 0);
    group.add(cargo);
  } else if (kind === 'bison') {
    const bed = box(2.0, 0.5, model.wid * 0.9, bedMat);
    bed.position.set(-1.5, 1.05, 0);
    group.add(bed);
    const cab = box(1.6, 0.75, model.wid * 0.92, glassMat);
    cab.position.set(0.9, 1.25, 0);
    group.add(cab);
  } else {
    const cab = box(model.len * 0.45, 0.55, model.wid * 0.86, glassMat);
    cab.position.set(-0.2, 0.95 + model.h / 2 - 0.4, 0);
    group.add(cab);
  }
  if (kind === 'veloce' || kind === 'comet') {
    const spoiler = box(0.25, 0.08, model.wid * 0.9, bedMat);
    spoiler.position.set(-model.len / 2 + 0.15, 1.15, 0);
    group.add(spoiler);
  }
  if (kind === 'taxi') {
    const sign = box(0.9, 0.22, 0.5, taxiSignMat);
    sign.position.set(-0.2, 1.5, 0);
    group.add(sign);
  }
  if (kind === 'interceptor') {
    const barR = box(0.5, 0.18, 0.5, lightRedMat);
    barR.position.set(-0.2, 1.45, -0.5);
    group.add(barR);
    const barB = box(0.5, 0.18, 0.5, lightBlueMat);
    barB.position.set(-0.2, 1.45, 0.5);
    group.add(barB);
    const stripe = box(model.len * 0.9, 0.1, model.wid * 0.4, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.set(0, 0.75, 0);
    group.add(stripe);
  }
  const wheelPos = [
    [model.len / 2 - 0.8, model.wid / 2],
    [model.len / 2 - 0.8, -model.wid / 2],
    [-model.len / 2 + 0.8, model.wid / 2],
    [-model.len / 2 + 0.8, -model.wid / 2],
  ];
  for (const [wx, wz] of wheelPos) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  group.traverse((o) => {
    o.castShadow = false;
  });
  return group;
}

export function createCar(kind, x, z, heading) {
  return {
    kind,
    mesh: buildCarMesh(kind),
    x,
    z,
    heading,
    speed: 0,
    targetNode: -1,
    path: [],
    pathIndex: 0,
    isPolice: kind === 'interceptor',
    isPlayer: false,
    cruise: 10,
    rng: null,
  };
}

function syncMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = -car.heading;
}

// Traffic: pick a random road node, drive to it, pick another.
export function spawnTraffic(scene, count) {
  const rng = makeRng(777);
  const kinds = ['sedan', 'taxi', 'van', 'bison', 'comet', 'sedan', 'taxi'];
  const cars = [];
  for (let i = 0; i < count; i++) {
    const node = Math.floor(rng() * 100);
    const p = nodePos(node);
    const car = createCar(kinds[i % kinds.length], p.x + range(rng, -4, 4), p.z + range(rng, -4, 4), rng() * Math.PI * 2);
    car.cruise = range(rng, 8, 13);
    car.rng = makeRng(9000 + i * 131);
    car.targetNode = pick(rng, neighbors(node));
    scene.add(car.mesh);
    syncMesh(car);
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(cars, dt, colliders) {
  for (const car of cars) {
    const target = nodePos(car.targetNode);
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3) {
      const options = neighbors(car.targetNode).filter((n) => n !== car.prevNode);
      car.prevNode = car.targetNode;
      car.targetNode = options.length > 0 ? pick(car.rng, options) : car.targetNode;
      continue;
    }
    const want = Math.atan2(-dz, dx);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    car.speed += (car.cruise - car.speed) * Math.min(1, dt * 0.8);
    car.x += Math.cos(car.heading) * car.speed * dt;
    car.z -= Math.sin(car.heading) * car.speed * dt;
    const fixed = collideCircle(car.x, car.z, 1.8, colliders);
    car.x = fixed.x;
    car.z = fixed.z;
    syncMesh(car);
  }
}

// Police: exactly `wanted` cars chase the player. Returns the cars that
// are currently ramming (close enough to damage).
export function updatePolice(police, focus, dt, colliders) {
  const ramming = [];
  for (const car of police) {
    const myNode = nearestNode(car.x, car.z);
    const goalNode = nearestNode(focus.x, focus.z);
    // Re-path regularly, not only when the goal node changes: a car
    // that was pushed, staged or cut off would otherwise follow a
    // stale route to a waypoint it already passed.
    car.repathTimer = (car.repathTimer ?? 0) - dt;
    if (car.path.length === 0 || car.pathIndex >= car.path.length || car.goalNode !== goalNode || car.repathTimer <= 0) {
      car.path = bfsPath(myNode, goalNode);
      car.pathIndex = 0;
      car.goalNode = goalNode;
      car.repathTimer = 1.5;
    }
    const wp = nodePos(car.path[Math.min(car.pathIndex, car.path.length - 1)]);
    const dx = wp.x - car.x;
    const dz = wp.z - car.z;
    const distWp = Math.hypot(dx, dz);
    if (distWp < 4 && car.pathIndex < car.path.length - 1) car.pathIndex++;
    const want = Math.atan2(-dz, dx);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const distPlayer = Math.hypot(focus.x - car.x, focus.z - car.z);
    // Interceptors are faster than anything the player can steal, so a
    // chase ends in a ram, not in the police falling behind.
    const targetSpeed = distPlayer < 30 ? 30 : 26;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt);
    car.x += Math.cos(car.heading) * car.speed * dt;
    car.z -= Math.sin(car.heading) * car.speed * dt;
    const fixed = collideCircle(car.x, car.z, 1.8, colliders);
    car.x = fixed.x;
    car.z = fixed.z;
    if (distPlayer < 5.5) ramming.push(car);
    syncMesh(car);
  }
  return ramming;
}

// Keep the police fleet at exactly `wanted` cars, spawning new ones on
// road nodes a little way from the player.
let policeSeed = 4242;
export function ensurePolice(scene, police, wanted, focus) {
  const rng = makeRng(policeSeed);
  policeSeed += 17;
  while (police.length < wanted) {
    let node = Math.floor(rng() * 100);
    const p = nodePos(node);
    if (Math.hypot(p.x - focus.x, p.z - focus.z) < 60) continue;
    const car = createCar('interceptor', p.x, p.z, rng() * Math.PI * 2);
    scene.add(car.mesh);
    syncMesh(car);
    police.push(car);
  }
  while (police.length > wanted) {
    const car = police.pop();
    scene.remove(car.mesh);
  }
}
