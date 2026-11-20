// save.js — progress lives in localStorage under one key.
// The game saves money, debt, finished missions and where the player
// stood, and loads it back on the title screen.
const KEY = 'solmara-save-v1';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      debt: state.debt,
      missionsDone: state.missionsDone,
      playerX: state.playerX,
      playerZ: state.playerZ,
      health: state.health,
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}
