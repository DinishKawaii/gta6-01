// textures.js — all textures are drawn on canvases at runtime.
// Nothing is loaded from a file: the city paints itself.
import * as THREE from 'three';

// A building facade: wall colour with a grid of lit and dark windows.
export function buildingTexture(base, lit, rng) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 14;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const on = rng() < 0.42;
      g.fillStyle = on ? lit : '#1c2430';
      g.fillRect(6 + x * 20, 8 + y * 17, 13, 11);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The ground map of Solmara, drawn once: roads, blocks, beach, sea.
// The city is 9 blocks of 40 with roads 12 wide: pitch 52, half-size 234.
// Canvas 1024 px covers -270..270 world units.
export function groundTexture() {
  const S = 1024;
  const HALF = 270;
  const px = (w) => ((w + HALF) / (2 * HALF)) * S;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  // Sea on the east, sand beach, then the city.
  g.fillStyle = '#1e7fa8';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#e8d29a';
  g.fillRect(0, 0, px(252), S);
  g.fillStyle = '#3f4a3a';
  g.fillRect(0, 0, px(234), S);
  // Sidewalk blocks.
  const pitch = 52;
  const road = 12;
  const half = 234;
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const x0 = -half + i * pitch + road / 2;
      const z0 = -half + j * pitch + road / 2;
      g.fillStyle = (i + j) % 2 === 0 ? '#8d8578' : '#847d70';
      g.fillRect(px(x0), px(z0), (40 / (2 * HALF)) * S, (40 / (2 * HALF)) * S);
    }
  }
  // Roads, full length across the canvas.
  g.fillStyle = '#2c2f36';
  for (let i = 0; i <= 9; i++) {
    const v = -half - road / 2 + i * pitch;
    g.fillRect(px(v), 0, (road / (2 * HALF)) * S, S);
    g.fillRect(0, px(v), S, (road / (2 * HALF)) * S);
  }
  // Lane dashes down the middle of each road.
  g.fillStyle = '#e8d24a';
  for (let i = 0; i <= 9; i++) {
    const v = -half - road / 2 + i * pitch + road / 2;
    for (let d = -half; d < half; d += 24) {
      g.fillRect(px(v) - 1, px(d), 2, 10);
      g.fillRect(px(d), px(v) - 1, 10, 2);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i <= 9; i++) {
    for (let j = 0; j <= 9; j++) {
      const x = -half - road / 2 + i * pitch;
      const z = -half - road / 2 + j * pitch;
      for (let k = 0; k < 4; k++) {
        g.fillRect(px(x + 1 + k * 3), px(z), 2, 12);
        g.fillRect(px(x), px(z + 1 + k * 3), 12, 2);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
