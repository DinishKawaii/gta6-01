// hud.js — the HUD, the minimap and the menus.
// All of it is plain DOM over the canvas: money, debt, health, wanted
// stars, district, speed, objective, and a round live minimap drawn on
// a small canvas each frame.
export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.moneyEl = document.getElementById('money');
    this.debtEl = document.getElementById('debt');
    this.healthEl = document.getElementById('health-fill');
    this.starsEl = document.getElementById('stars');
    this.districtEl = document.getElementById('district');
    this.speedEl = document.getElementById('speed');
    this.objectiveEl = document.getElementById('objective');
    this.timerEl = document.getElementById('timer');
    this.toastEl = document.getElementById('toast');
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.titleEl = document.getElementById('title-screen');
    this.pauseEl = document.getElementById('pause-screen');
    this.endEl = document.getElementById('end-screen');
    this.endTitle = document.getElementById('end-title');
    this.endText = document.getElementById('end-text');
    this.toastTimer = null;
  }

  showTitle(hasSave) {
    this.titleEl.classList.remove('hidden');
    document.getElementById('continue-btn').classList.toggle('hidden', !hasSave);
  }

  hideTitle() {
    this.titleEl.classList.add('hidden');
  }

  showPause(show) {
    this.pauseEl.classList.toggle('hidden', !show);
  }

  showEnd(title, text) {
    this.endTitle.textContent = title;
    this.endText.textContent = text;
    this.endEl.classList.remove('hidden');
  }

  hideEnd() {
    this.endEl.classList.add('hidden');
  }

  toast(text, ms = 2600) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  // Money, debt, health, stars, district, speed, objective, timer.
  update(state) {
    this.moneyEl.textContent = '$' + state.money.toLocaleString('en-US');
    this.debtEl.textContent = 'Debt: $' + state.debt.toLocaleString('en-US');
    this.healthEl.style.width = Math.max(0, state.health) + '%';
    this.healthEl.style.background = state.health > 50 ? '#58c96b' : state.health > 25 ? '#e8b23a' : '#e84a4a';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
    this.starsEl.textContent = stars;
    this.starsEl.style.color = state.wanted > 0 ? '#ffd24a' : '#ffffff';
    this.districtEl.textContent = state.district;
    this.speedEl.textContent = state.driving ? Math.round(state.speed * 2.2) + ' mph' : 'On foot';
    this.objectiveEl.textContent = state.objective;
    this.timerEl.textContent = state.timeLeft > 0 ? '⏱ ' + Math.ceil(state.timeLeft) + 's' : '';
  }

  // The round minimap: roads as lines, the player as a white arrow,
  // police as red dots, the mission target as a gold diamond.
  drawMinimap(focus, heading, police, target) {
    const ctx = this.mapCtx;
    const S = 200;
    const HALF = 270;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(0, 0, S, S);
    const toMap = (x, z) => [((x + HALF) / (2 * HALF)) * S, ((z + HALF) / (2 * HALF)) * S];
    // Sea on the east edge.
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(toMap(240, -HALF)[0], 0, S, S);
    // Roads.
    ctx.strokeStyle = '#5a636e';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 9; i++) {
      const v = -240 + i * 52 + 6;
      const [x0] = toMap(v, 0);
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0, S);
      ctx.stroke();
      const [, z0] = toMap(0, v);
      ctx.beginPath();
      ctx.moveTo(0, z0);
      ctx.lineTo(S, z0);
      ctx.stroke();
    }
    // Mission target.
    if (target) {
      const [tx, ty] = toMap(target.x, target.z);
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.moveTo(tx, ty - 7);
      ctx.lineTo(tx + 6, ty);
      ctx.lineTo(tx, ty + 7);
      ctx.lineTo(tx - 6, ty);
      ctx.closePath();
      ctx.fill();
    }
    // Police.
    ctx.fillStyle = '#ff3b30';
    for (const p of police) {
      const [px, py] = toMap(p.x, p.z);
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow, pointing along the heading.
    const [fx, fy] = toMap(focus.x, focus.z);
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(-heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
