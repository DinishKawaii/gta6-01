// missions.js — Vera Solano's three jobs for Kai Mercer.
// Each mission has a briefing, a glowing marker beam at its target, and
// guards who fight back. Finish a mission to cut the $8,000 debt.
// State: idle -> briefing -> active -> done / failed.
import * as THREE from 'three';
import { makeRng, range } from './rng.js';
import { buildPersonMesh, syncPerson } from './people.js';
import { collideCircle } from './city.js';

const guardMat = new THREE.MeshLambertMaterial({ color: 0x1f2a1f });
const beamMat = new THREE.MeshBasicMaterial({
  color: 0xffd24a,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const beamGeo = new THREE.CylinderGeometry(1.6, 1.6, 40, 12, 1, true);

export const MISSION_DEFS = [
  {
    id: 0,
    name: 'First Job',
    pay: 500,
    brief: 'Vera: Pick up the package at The Docks and bring it to Palm Row. No questions.',
    target: { x: 182, z: 182, label: 'The Docks — pick up the package' },
    deliver: { x: -182, z: -182, label: 'Palm Row — deliver the package' },
    guards: 1,
    timer: 0,
  },
  {
    id: 1,
    name: 'The Pickup',
    pay: 900,
    brief: 'Vera: Cash is waiting at Marina Bay. Rico and his boys are guarding it. Take it.',
    target: { x: 182, z: -182, label: 'Marina Bay — take the cash' },
    deliver: { x: -26, z: 26, label: 'Neon Mile — bring the cash to Vera' },
    guards: 3,
    timer: 0,
  },
  {
    id: 2,
    name: 'The Getaway',
    pay: 1500,
    brief: 'Vera: Grab the Comet GT at Sunset Strip and lose the cops. Reach the Old Harbor in time.',
    target: { x: -182, z: 26, label: 'Sunset Strip — steal the Comet GT' },
    deliver: { x: -182, z: 182, label: 'Old Harbor — escape point' },
    guards: 2,
    timer: 90,
  },
];

export class MissionManager {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.index = 0; // next mission to offer
    this.state = 'idle'; // idle | briefing | active | done
    this.stage = 0; // 0 = go to target, 1 = deliver
    this.timeLeft = 0;
    this.beam = new THREE.Mesh(beamGeo, beamMat);
    this.beam.position.y = 20;
    this.beam.visible = false;
    scene.add(this.beam);
    this.guards = [];
    this.guardRng = makeRng(60606);
  }

  current() {
    return MISSION_DEFS[this.index] || null;
  }

  // The player walks into Vera's marker to hear the briefing.
  offer() {
    const def = this.current();
    if (!def) return null;
    this.state = 'briefing';
    return def;
  }

  start() {
    const def = this.current();
    if (!def) return;
    this.state = 'active';
    this.stage = 0;
    this.timeLeft = def.timer;
    this.spawnGuards(def.target.x, def.target.z, def.guards);
    this.moveBeam(def.target.x, def.target.z);
  }

  spawnGuards(x, z, count) {
    this.clearGuards();
    for (let i = 0; i < count; i++) {
      const g = {
        mesh: buildPersonMesh(guardMat),
        x: x + range(this.guardRng, -6, 6),
        z: z + range(this.guardRng, -6, 6),
        y: 0,
        heading: 0,
        walkPhase: 0,
        health: 3,
        punchCooldown: 0,
      };
      this.scene.add(g.mesh);
      syncPerson(g);
      this.guards.push(g);
    }
  }

  clearGuards() {
    for (const g of this.guards) this.scene.remove(g.mesh);
    this.guards = [];
  }

  moveBeam(x, z) {
    this.beam.position.set(x, 20, z);
    this.beam.visible = true;
  }

  hideBeam() {
    this.beam.visible = false;
  }

  // Where the player must go right now, or null.
  targetPos() {
    const def = this.current();
    if (!def || this.state !== 'active') return null;
    return this.stage === 0 ? def.target : def.deliver;
  }

  objectiveText() {
    const def = this.current();
    if (!def) return 'Debt paid. Solmara is yours, Kai.';
    if (this.state === 'idle') return 'Find Vera Solano in Neon Mile (gold marker).';
    if (this.state === 'briefing') return 'Press E to take the job.';
    if (this.state === 'active') {
      const t = this.stage === 0 ? def.target : def.deliver;
      return t.label;
    }
    return '';
  }

  // Advance the mission. focus is the player's effective position
  // (the car when driving). Returns 'picked' | 'delivered' | 'failed' | null.
  update(focus, dt) {
    if (this.state !== 'active') return null;
    const def = this.current();
    if (def.timer > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.fail();
        return 'failed';
      }
    }
    const t = this.targetPos();
    if (!t) return null;
    const d = Math.hypot(t.x - focus.x, t.z - focus.z);
    if (d < 6) {
      if (this.stage === 0) {
        this.stage = 1;
        this.clearGuards();
        this.moveBeam(def.deliver.x, def.deliver.z);
        return 'picked';
      }
      this.state = 'done';
      this.hideBeam();
      this.index++;
      this.state = 'idle';
      return 'delivered';
    }
    // Guards walk at the player and punch when close.
    for (const g of this.guards) {
      const dx = focus.x - g.x;
      const dz = focus.z - g.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.01 && dist < 40) {
        g.heading = Math.atan2(-dz, dx);
        const speed = dist < 3 ? 0 : 3.4;
        g.x += Math.cos(g.heading) * speed * dt;
        g.z -= Math.sin(g.heading) * speed * dt;
        g.walkPhase += dt * 8;
      }
      if (g.punchCooldown > 0) g.punchCooldown -= dt;
      const fixed = collideCircle(g.x, g.z, 0.6, this.colliders);
      g.x = fixed.x;
      g.z = fixed.z;
      syncPerson(g);
    }
    return null;
  }

  fail() {
    this.state = 'idle';
    this.hideBeam();
    this.clearGuards();
  }
}
