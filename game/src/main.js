// main.js — SOLMARA, an open-world crime game in the browser.
// Kai Mercer owes fixer Vera Solano $8,000. Three jobs pay it off.
// Walk, steal and drive cars, dodge or fight the police, and watch the
// wanted stars. The camera's yaw belongs to the camera, never to the
// player; a key press fires once per frame, never once per sub-step;
// and when driving, the car is where the player is — police, missions,
// HUD and minimap all read the car's position, not the last place Kai
// stood on foot.
import * as THREE from 'three';
import { buildCity, districtAt, nearestNode, nodePos, collideCircle } from './city.js';
import {
  CAR_MODELS,
  buildCarMesh,
  createCar,
  spawnTraffic,
  updateTraffic,
  updatePolice,
  ensurePolice,
} from './vehicles.js';
import { createPlayer, updatePlayerOnFoot, syncPerson, spawnPedestrians, updatePedestrians } from './people.js';
import { MissionManager } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';

const VERA = { x: -26, z: 26 };
const STEP = 1 / 60;

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.input = new Input(this.canvas);
    this.audio = new AudioEngine();
    this.hud = new Hud();
    this.state = 'title'; // title | playing | paused | busted | over | win
    this.money = 250;
    this.debt = 8000;
    this.health = 100;
    this.wanted = 0;
    this.wantedCooldown = 0;
    this.wantedDecay = 0;
    this.bustTimer = 0;
    this.damageTimer = 0;
    this.missionsDone = 0;
    this.driving = null; // the car Kai is driving, or null
    this.lastCar = null;
    this.time = 0;
    this.camPos = new THREE.Vector3(0, 12, 14);
    this.muted = false;

    const city = buildCity(this.scene);
    this.colliders = city.colliders;

    this.player = createPlayer(-30, 30);
    this.scene.add(this.player.mesh);

    this.traffic = spawnTraffic(this.scene, 14);
    this.pedestrians = spawnPedestrians(this.scene, 24);
    this.police = [];
    this.parked = this.spawnParked();
    this.missions = new MissionManager(this.scene, this.colliders);

    // Vera's gold marker in Neon Mile while no mission is running.
    this.veraBeam = this.missions.beam;
    this.showVeraBeam();

    this.bindButtons();
    window.addEventListener('resize', () => this.onResize());
    this.hud.showTitle(hasSave());
    this.hud.update(this.hudState());

    // Debug hooks for the screenshot script: stage scenes on demand.
    window.SOLMARA = {
      game: this,
      start: () => this.startPlaying(false),
      teleport: (x, z) => this.teleport(x, z),
      giveCar: (kind) => this.giveCar(kind),
      setWanted: (n) => this.setWanted(n),
      startMission: (i) => this.debugStartMission(i),
      setCam: (yaw, pitch) => {
        this.input.camYaw = yaw;
        this.input.camPitch = pitch;
      },
      state: () => this.hudState(),
    };
  }

  spawnParked() {
    const spots = [
      ['comet', -182, 26],
      ['veloce', 52, -182],
      ['bison', -104, 104],
      ['taxi', 26, 156],
      ['sedan', 104, -52],
      ['van', 156, 156],
    ];
    const cars = [];
    for (const [kind, x, z] of spots) {
      const car = createCar(kind, x, z, Math.PI / 2);
      car.parked = true;
      this.scene.add(car.mesh);
      car.mesh.position.set(x, 0, z);
      car.mesh.rotation.y = -car.heading;
      cars.push(car);
    }
    return cars;
  }

  showVeraBeam() {
    this.missions.moveBeam(VERA.x, VERA.z);
  }

  bindButtons() {
    document.getElementById('start-btn').addEventListener('click', () => {
      this.audio.start();
      this.startPlaying(false);
    });
    document.getElementById('continue-btn').addEventListener('click', () => {
      this.audio.start();
      this.startPlaying(true);
    });
    document.getElementById('resume-btn').addEventListener('click', () => {
      this.state = 'playing';
      this.hud.showPause(false);
    });
    document.getElementById('restart-btn').addEventListener('click', () => {
      window.location.reload();
    });
    document.getElementById('quit-btn').addEventListener('click', () => {
      this.state = 'title';
      this.hud.showPause(false);
      this.hud.showTitle(hasSave());
    });
  }

  startPlaying(fromSave) {
    if (fromSave) {
      const data = loadGame();
      if (data) {
        this.money = data.money;
        this.debt = data.debt;
        this.missionsDone = data.missionsDone;
        this.missions.index = data.missionsDone;
        this.player.x = data.playerX;
        this.player.z = data.playerZ;
        this.health = data.health;
        syncPerson(this.player);
      }
    }
    this.state = 'playing';
    this.hud.hideTitle();
    this.hud.hideEnd();
    this.hud.toast('Welcome to Solmara, Kai. Find Vera in Neon Mile.');
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Where the player effectively is: the car while driving, Kai on foot.
  // Always carries a y: the camera's lookAt needs a number, and a
  // missing y turns into NaN and a blank sky.
  focusPos() {
    if (this.driving) return { x: this.driving.x, y: 0, z: this.driving.z };
    return { x: this.player.x, y: this.player.y, z: this.player.z };
  }

  focusHeading() {
    if (this.driving) return this.driving.heading;
    return this.player.heading;
  }

  teleport(x, z) {
    if (this.driving) {
      this.driving.x = x;
      this.driving.z = z;
    } else {
      this.player.x = x;
      this.player.z = z;
    }
  }

  giveCar(kind) {
    const focus = this.focusPos();
    const car = createCar(kind, focus.x + 4, focus.z, 0);
    this.scene.add(car.mesh);
    this.enterCar(car, true);
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
  }

  debugStartMission(i) {
    this.missions.index = i;
    this.missions.state = 'idle';
    this.missions.start();
  }

  addWanted(n) {
    if (this.wantedCooldown > 0) return;
    this.wanted = Math.max(0, Math.min(5, this.wanted + n));
    this.wantedCooldown = 3;
    this.wantedDecay = 0;
  }

  enterCar(car, free) {
    if (this.driving) return;
    if (!free && !car.stolen) {
      car.stolen = true;
      this.addWanted(1);
      this.hud.toast('You stole the ' + CAR_MODELS[car.kind].name + '! The cops noticed.');
    }
    this.driving = car;
    car.isPlayer = true;
    car.parked = false;
    this.player.mesh.visible = false;
    this.audio.blip(520);
  }

  exitCar() {
    const car = this.driving;
    if (!car) return;
    // Step out to the car's left side. If that spot is inside a wall,
    // the collider push-out below puts Kai back on the street.
    const sideX = car.x + Math.cos(car.heading + Math.PI / 2) * 2.4;
    const sideZ = car.z - Math.sin(car.heading + Math.PI / 2) * 2.4;
    const fixed = collideCircle(sideX, sideZ, 0.6, this.colliders);
    this.player.x = fixed.x;
    this.player.z = fixed.z;
    this.player.y = 0;
    this.player.vy = 0;
    this.player.heading = car.heading;
    this.player.mesh.visible = true;
    syncPerson(this.player);
    this.lastCar = car;
    this.driving = null;
    car.isPlayer = false;
    car.speed = 0;
  }

  nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    const focus = this.focusPos();
    for (const car of [...this.traffic, ...this.parked, ...this.police]) {
      if (car.isPolice) continue;
      const d = Math.hypot(car.x - focus.x, car.z - focus.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  update(dt) {
    this.time += dt;
    if (this.wantedCooldown > 0) this.wantedCooldown -= dt;
    if (this.damageTimer > 0) this.damageTimer -= dt;

    // Pause and mute.
    if (this.input.takePressed('p')) {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.hud.showPause(true);
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this.hud.showPause(false);
      }
    }
    if (this.input.takePressed('m')) {
      this.muted = !this.muted;
      if (this.audio.master) this.audio.master.gain.value = this.muted ? 0 : 0.5;
    }
    if (this.state !== 'playing') return;

    // Save with L.
    if (this.input.takePressed('l')) {
      const ok = saveGame({
        money: this.money,
        debt: this.debt,
        missionsDone: this.missionsDone,
        playerX: this.player.x,
        playerZ: this.player.z,
        health: this.health,
      });
      this.hud.toast(ok ? 'Progress saved.' : 'Could not save.');
    }

    const focus = this.focusPos();

    // Enter / exit cars, talk to Vera.
    if (this.input.takePressed('e')) {
      if (this.driving) {
        this.exitCar();
      } else {
        const nearVera = Math.hypot(focus.x - VERA.x, focus.z - VERA.z) < 6;
        if (nearVera && this.missions.state === 'idle' && this.missions.current()) {
          const def = this.missions.offer();
          this.hud.toast(def.brief, 5000);
          this.audio.blip(760);
        } else if (nearVera && this.missions.state === 'briefing') {
          this.missions.start();
          this.hud.toast('Job started: ' + this.missions.current().name);
          this.audio.blip(880);
        } else {
          const car = this.nearestCar(4.5);
          if (car) this.enterCar(car, false);
        }
      }
    }

    // Driving or walking.
    if (this.driving) {
      this.updateDriving(dt);
    } else {
      updatePlayerOnFoot(this.player, this.input, this.input.camYaw, dt, this.colliders);
      if (this.input.takePressed('f')) this.punch();
    }

    // Traffic, pedestrians, police.
    updateTraffic(this.traffic, dt, this.colliders);
    const threats = [this.focusPos(), ...this.police.map((p) => ({ x: p.x, z: p.z }))];
    updatePedestrians(this.pedestrians, dt, this.colliders, threats);
    ensurePolice(this.scene, this.police, this.wanted, focus);
    const ramming = updatePolice(this.police, focus, dt, this.colliders);

    // Ramming hurts: 8 health a second of contact, never a burst.
    if (ramming.length > 0 && this.damageTimer <= 0) {
      this.health -= 8 * dt * 10;
      this.damageTimer = 0.1;
      this.audio.thud();
    }
    if (this.health > 0 && this.wanted === 0) {
      this.health = Math.min(100, this.health + 2 * dt);
    }

    // Car hits a pedestrian: they are knocked aside, the law notices.
    if (this.driving && Math.abs(this.driving.speed) > 6) {
      for (const ped of this.pedestrians) {
        const d = Math.hypot(ped.x - this.driving.x, ped.z - this.driving.z);
        if (d < 2.2) {
          ped.flee = 3;
          ped.fleeX = ped.x + (ped.x - this.driving.x) * 4;
          ped.fleeZ = ped.z + (ped.z - this.driving.z) * 4;
          this.addWanted(1);
          this.audio.thud();
        }
      }
    }

    // Busted: a cop stands next to Kai on foot for a moment.
    if (!this.driving && this.police.length > 0) {
      let close = false;
      for (const p of this.police) {
        if (Math.hypot(p.x - this.player.x, p.z - this.player.z) < 3.5) close = true;
      }
      if (close) {
        this.bustTimer += dt;
        if (this.bustTimer > 1.5) this.getBusted();
      } else {
        this.bustTimer = 0;
      }
    }

    // Wanted fades when the heat is off.
    if (this.wanted > 0) {
      let near = false;
      for (const p of this.police) {
        if (Math.hypot(p.x - focus.x, p.z - focus.z) < 45) near = true;
      }
      if (!near) {
        this.wantedDecay += dt;
        if (this.wantedDecay > 25) {
          this.wanted--;
          this.wantedDecay = 0;
        }
      } else {
        this.wantedDecay = 0;
      }
    }

    // Missions.
    const event = this.missions.update(focus, dt);
    if (event === 'picked') {
      this.hud.toast('Got it. Now deliver it.');
      this.audio.blip(760);
    } else if (event === 'delivered') {
      const done = this.missions.index - 1;
      const paid = [500, 900, 1500][done] || 0;
      this.money += paid;
      this.debt = Math.max(0, this.debt - paid);
      this.missionsDone = this.missions.index;
      this.hud.toast('Job done! +$' + paid + ' — debt $' + this.debt.toLocaleString('en-US'));
      this.audio.blip(990);
      saveGame({
        money: this.money,
        debt: this.debt,
        missionsDone: this.missionsDone,
        playerX: this.player.x,
        playerZ: this.player.z,
        health: this.health,
      });
      this.showVeraBeam();
      if (this.debt <= 0) this.winGame();
    } else if (event === 'failed') {
      this.hud.toast('Too slow — Vera is not happy.');
      this.showVeraBeam();
    }
    if (this.missions.state === 'idle' && this.missions.current()) {
      this.missions.moveBeam(VERA.x, VERA.z);
    }

    // The sea shimmers.
    const sea = this.scene.getObjectByName('sea');
    if (sea) sea.position.y = 0.4 + Math.sin(this.time * 0.7) * 0.08;

    if (this.health <= 0) this.gameOver();

    // Camera: orbit around the focus point, yaw and pitch owned by the
    // camera alone. The player turns where he walks; the camera does not
    // follow his heading.
    const focusPoint = this.focusPos();
    const dist = this.driving ? 12 : 9;
    const yaw = this.input.camYaw;
    const pitch = this.input.camPitch;
    const cx = focusPoint.x + Math.sin(yaw) * Math.cos(pitch) * dist;
    const cz = focusPoint.z + Math.cos(yaw) * Math.cos(pitch) * dist;
    const cy = 2.4 + Math.sin(pitch) * dist;
    this.camPos.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 8));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(focusPoint.x, focusPoint.y + 2.2, focusPoint.z);

    this.audio.update(this.driving ? Math.abs(this.driving.speed) : 0, this.wanted, !!this.driving);
    this.hud.update(this.hudState());
    const target = this.missions.targetPos();
    this.hud.drawMinimap(focusPoint, this.focusHeading(), this.police, target);
  }

  updateDriving(dt) {
    const car = this.driving;
    const model = CAR_MODELS[car.kind];
    const accel = this.input.isDown('w') || this.input.isDown('arrowup');
    const brake = this.input.isDown('s') || this.input.isDown('arrowdown');
    const left = this.input.isDown('a') || this.input.isDown('arrowleft');
    const right = this.input.isDown('d') || this.input.isDown('arrowright');
    const boost = this.input.isDown('shift');
    const top = model.top * (boost ? 1.25 : 1);
    if (accel) car.speed += 22 * dt;
    if (brake) car.speed -= car.speed > 0.5 ? 30 * dt : 12 * dt;
    if (!accel && !brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    car.speed = Math.max(-10, Math.min(top, car.speed));
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    if (Math.abs(car.speed) > 0.5) {
      car.heading += steer * 1.9 * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 10);
    }
    const prevX = car.x;
    const prevZ = car.z;
    car.x += Math.cos(car.heading) * car.speed * dt;
    car.z -= Math.sin(car.heading) * car.speed * dt;
    const fixed = collideCircle(car.x, car.z, 2.0, this.colliders);
    const hitWall = fixed.x !== car.x || fixed.z !== car.z;
    car.x = fixed.x;
    car.z = fixed.z;
    car.x = Math.max(-245, Math.min(258, car.x));
    car.z = Math.max(-245, Math.min(245, car.z));
    if (hitWall && Math.abs(car.speed) > 14) {
      this.health -= (Math.abs(car.speed) - 14) * 0.6;
      this.audio.thud();
    }
    if (hitWall) car.speed *= 0.55;
    // Bump into traffic cars.
    for (const other of this.traffic) {
      const d = Math.hypot(other.x - car.x, other.z - car.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        const nx = (car.x - other.x) / d;
        const nz = (car.z - other.z) / d;
        car.x += nx * push;
        car.z += nz * push;
        other.x -= nx * push;
        other.z -= nz * push;
        if (Math.abs(car.speed) > 12) {
          this.health -= 3;
          this.audio.thud();
        }
        car.speed *= 0.8;
      }
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = -car.heading;
  }

  punch() {
    if (this.player.punchCooldown > 0) return;
    this.player.punchCooldown = 0.4;
    this.audio.thud();
    const px = this.player.x;
    const pz = this.player.z;
    const fx = Math.cos(this.player.heading);
    const fz = -Math.sin(this.player.heading);
    let hitSomeone = false;
    for (const ped of this.pedestrians) {
      const dx = ped.x - px;
      const dz = ped.z - pz;
      const d = Math.hypot(dx, dz);
      if (d < 2.6 && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.2) {
        ped.flee = 2.5;
        ped.fleeX = ped.x + dx * 3;
        ped.fleeZ = ped.z + dz * 3;
        hitSomeone = true;
      }
    }
    for (let i = this.missions.guards.length - 1; i >= 0; i--) {
      const g = this.missions.guards[i];
      const dx = g.x - px;
      const dz = g.z - pz;
      const d = Math.hypot(dx, dz);
      if (d < 2.6 && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.2) {
        g.health -= 1;
        g.x += (dx / Math.max(d, 0.01)) * 2;
        g.z += (dz / Math.max(d, 0.01)) * 2;
        if (g.health <= 0) {
          this.scene.remove(g.mesh);
          this.missions.guards.splice(i, 1);
          this.hud.toast('Guard down.');
        }
        hitSomeone = true;
      }
    }
    if (hitSomeone) this.addWanted(1);
  }

  getBusted() {
    this.bustTimer = 0;
    const fine = Math.min(200, this.money);
    this.money -= fine;
    this.wanted = 0;
    this.health = 60;
    this.player.x = -30;
    this.player.z = 30;
    syncPerson(this.player);
    this.state = 'busted';
    this.hud.showEnd('BUSTED', 'The Solmara PD caught you. Fine: $' + fine + '. Vera is waiting.');
    this.hud.update(this.hudState());
  }

  gameOver() {
    this.state = 'over';
    this.hud.showEnd('WASTED', 'Kai went down in Solmara. The debt is still $' + this.debt.toLocaleString('en-US') + '.');
  }

  winGame() {
    this.state = 'win';
    this.hud.showEnd('DEBT PAID', 'Kai paid Vera Solano in full. Solmara is yours — $' + this.money.toLocaleString('en-US') + ' in your pocket.');
  }

  hudState() {
    const focus = this.focusPos();
    return {
      money: this.money,
      debt: this.debt,
      health: Math.round(this.health),
      wanted: this.wanted,
      district: districtAt(focus.x, focus.z),
      speed: this.driving ? Math.abs(this.driving.speed) : 0,
      driving: !!this.driving,
      objective: this.missions.objectiveText(),
      timeLeft: this.missions.state === 'active' ? this.missions.timeLeft : 0,
    };
  }

  run() {
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;
      if (this.state === 'playing' || this.state === 'paused') {
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 4) {
          this.update(STEP);
          acc -= STEP;
          steps++;
        }
        if (steps === 4) acc = 0;
      } else if (this.state === 'title') {
        // Title screen: slow orbit over the city.
        this.time += dt;
        const a = this.time * 0.05;
        this.camera.position.set(Math.sin(a) * 180, 90, Math.cos(a) * 180);
        this.camera.lookAt(0, 0, 0);
        const sea = this.scene.getObjectByName('sea');
        if (sea) sea.position.y = 0.4 + Math.sin(this.time * 0.7) * 0.08;
      }
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
    };
    requestAnimationFrame(frame);
  }
}

const game = new Game();
game.run();
