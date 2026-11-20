// people.js — Kai Mercer on foot, and the pedestrians of Solmara.
// The player walks relative to the camera, runs with Shift, jumps with
// Space and punches with F. Pedestrians stroll the sidewalks and run
// away from trouble.
import * as THREE from 'three';
import { makeRng, pick, range } from './rng.js';
import { nearestNode, nodePos, neighbors, collideCircle } from './city.js';

const SHIRTS = [0xe86a6a, 0x6aa8e8, 0x7ac74f, 0xe8c86a, 0xb06ae8, 0xe8e8e8, 0x5a6a7a];
const shirtMats = SHIRTS.map((c) => new THREE.MeshLambertMaterial({ color: c }));
const skinMat = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
const hairMat = new THREE.MeshLambertMaterial({ color: 0x201510 });
const kaiMat = new THREE.MeshLambertMaterial({ color: 0xc22e2e });
const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2a3440 });

const torsoGeo = new THREE.BoxGeometry(0.7, 0.85, 0.4);
const headGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
const legGeo = new THREE.BoxGeometry(0.26, 0.7, 0.3);
const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.24);

export function buildPersonMesh(shirt) {
  const group = new THREE.Group();
  const torso = new THREE.Mesh(torsoGeo, shirt);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.85;
  group.add(head);
  const hair = new THREE.Mesh(headGeo, hairMat);
  hair.scale.set(1.05, 0.45, 1.05);
  hair.position.y = 2.02;
  group.add(hair);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.18, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.18, 0.35, 0);
  group.add(legR);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.48, 1.15, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.48, 1.15, 0);
  group.add(armR);
  group.userData = { legL, legR, armL, armR };
  return group;
}

export function createPlayer(x, z) {
  const mesh = buildPersonMesh(kaiMat);
  return {
    mesh,
    x,
    z,
    y: 0,
    vy: 0,
    heading: 0,
    walkPhase: 0,
    onGround: true,
    punchCooldown: 0,
  };
}

// On-foot update. Returns nothing; moves player, handles jump and punch
// cooldown. Movement is relative to the camera yaw, which the camera
// owns — the player's heading only follows where he walks.
export function updatePlayerOnFoot(player, input, camYaw, dt, colliders) {
  let mx = 0;
  let mz = 0;
  if (input.isDown('w') || input.isDown('arrowup')) mz -= 1;
  if (input.isDown('s') || input.isDown('arrowdown')) mz += 1;
  if (input.isDown('a') || input.isDown('arrowleft')) mx -= 1;
  if (input.isDown('d') || input.isDown('arrowright')) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  const run = input.isDown('shift');
  const speed = run ? 9 : 5;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    // Camera-relative: forward is where the camera looks.
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    const wx = mx * cos - mz * sin;
    const wz = mx * sin + mz * cos;
    player.x += wx * speed * dt;
    player.z += wz * speed * dt;
    player.heading = Math.atan2(-wz, wx);
    player.walkPhase += dt * (run ? 13 : 9);
  }
  if (input.takePressed(' ') && player.onGround) {
    player.vy = 7;
    player.onGround = false;
  }
  player.vy -= 22 * dt;
  player.y += player.vy * dt;
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    player.onGround = true;
  }
  const fixed = collideCircle(player.x, player.z, 0.6, colliders);
  player.x = fixed.x;
  player.z = fixed.z;
  player.x = Math.max(-245, Math.min(260, player.x));
  player.z = Math.max(-245, Math.min(245, player.z));
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  syncPerson(player);
}

export function syncPerson(p) {
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = -p.heading;
  const swing = Math.sin(p.walkPhase) * 0.55;
  p.mesh.userData.legL.rotation.x = swing;
  p.mesh.userData.legR.rotation.x = -swing;
  p.mesh.userData.armL.rotation.x = -swing * 0.8;
  p.mesh.userData.armR.rotation.x = swing * 0.8;
}

// --- Pedestrians ---
export function spawnPedestrians(scene, count) {
  const rng = makeRng(31337);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const node = Math.floor(rng() * 100);
    const p = nodePos(node);
    const ped = {
      mesh: buildPersonMesh(shirtMats[i % shirtMats.length]),
      x: p.x + range(rng, -6, 6),
      z: p.z + range(rng, -6, 6),
      y: 0,
      heading: rng() * Math.PI * 2,
      walkPhase: rng() * 6,
      targetNode: pick(rng, neighbors(node)),
      speed: range(rng, 1.2, 2.2),
      flee: 0,
      fleeX: 0,
      fleeZ: 0,
      rng: makeRng(5000 + i * 97),
    };
    scene.add(ped.mesh);
    syncPerson(ped);
    peds.push(ped);
  }
  return peds;
}

export function updatePedestrians(peds, dt, colliders, threats) {
  for (const ped of peds) {
    let tx;
    let tz;
    let speed = ped.speed;
    if (ped.flee > 0) {
      ped.flee -= dt;
      tx = ped.fleeX;
      tz = ped.fleeZ;
      speed = 5.5;
    } else {
      const t = nodePos(ped.targetNode);
      tx = t.x;
      tz = t.z;
      // Flee from a nearby threat (a punch, a chase, a ram).
      for (const th of threats) {
        const d = Math.hypot(th.x - ped.x, th.z - ped.z);
        if (d < 9) {
          ped.flee = 1.6;
          ped.fleeX = ped.x + (ped.x - th.x) * 3;
          ped.fleeZ = ped.z + (ped.z - th.z) * 3;
          tx = ped.fleeX;
          tz = ped.fleeZ;
          speed = 5.5;
          break;
        }
      }
    }
    const dx = tx - ped.x;
    const dz = tz - ped.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2.5 && ped.flee <= 0) {
      ped.targetNode = pick(ped.rng, neighbors(ped.targetNode));
      continue;
    }
    if (dist > 0.01) {
      const want = Math.atan2(-dz, dx);
      let diff = want - ped.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
      ped.x += Math.cos(ped.heading) * speed * dt;
      ped.z -= Math.sin(ped.heading) * speed * dt;
      ped.walkPhase += dt * 7;
    }
    const fixed = collideCircle(ped.x, ped.z, 0.6, colliders);
    ped.x = fixed.x;
    ped.z = fixed.z;
    syncPerson(ped);
  }
}
