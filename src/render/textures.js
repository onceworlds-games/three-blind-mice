// Textures drawn in code: floorboards, flagstones, tiles, rugs, a quilt, the patches that creak, the knife's shadow.

import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function seeded(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tex = (c, repeat = true, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

// A floor tile covering 8 x 8 u. style: planks, stone, tiles, barn.
export function floorTextures(style = 'planks', tone = 0) {
  const S = 512;
  const [c, g] = canvas(S, S);
  const [sc, sg] = canvas(S, S);
  const rnd = seeded(91 + tone * 7);
  sg.fillStyle = '#000';
  sg.fillRect(0, 0, S, S);
  sg.strokeStyle = '#fff';
  const u = S / 8;
  if (style === 'stone') {
    g.fillStyle = '#4a4744';
    g.fillRect(0, 0, S, S);
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const h = S / rows;
      let x = -rnd() * u * 2;
      while (x < S) {
        const w = u * (1.2 + rnd() * 1.4);
        const l = 30 + rnd() * 16;
        g.fillStyle = `hsl(${30 + rnd() * 20}, ${6 + rnd() * 8}%, ${l}%)`;
        g.fillRect(x + 3, r * h + 3, w - 6, h - 6);
        sg.lineWidth = 3;
        sg.strokeRect(x + 1.5, r * h + 1.5, w - 3, h - 3);
        x += w;
      }
    }
  } else if (style === 'tiles') {
    const n = 8;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      g.fillStyle = (i + j) % 2 ? '#2f3a3a' : '#c9bfa8';
      g.fillRect(i * u, j * u, u, u);
      sg.lineWidth = 2;
      sg.strokeRect(i * u + 1, j * u + 1, u - 2, u - 2);
    }
    g.globalAlpha = 0.25;
    for (let k = 0; k < 400; k++) {
      g.fillStyle = rnd() < 0.5 ? '#000' : '#fff';
      g.fillRect(rnd() * S, rnd() * S, 2, 2);
    }
    g.globalAlpha = 1;
  } else {
    // Planks along x, 0.8 u wide, joints staggered.
    const base = style === 'barn' ? [32, 30, 30] : [[26, 38, 34], [22, 34, 30], [30, 30, 28]][tone % 3];
    const rows = 10;
    const h = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * u * 3;
      while (x < S) {
        const w = u * (2.5 + rnd() * 3);
        const l = base[1] + (rnd() - 0.5) * 10;
        g.fillStyle = `hsl(${base[0] + (rnd() - 0.5) * 6}, ${base[2]}%, ${l}%)`;
        g.fillRect(x, r * h, w, h);
        // Grain.
        g.globalAlpha = 0.18;
        for (let k = 0; k < 7; k++) {
          g.strokeStyle = rnd() < 0.5 ? '#000' : '#fff';
          g.lineWidth = 1;
          g.beginPath();
          const y = r * h + rnd() * h;
          g.moveTo(x, y);
          g.bezierCurveTo(x + w * 0.3, y + (rnd() - 0.5) * 6, x + w * 0.6, y + (rnd() - 0.5) * 6, x + w, y + (rnd() - 0.5) * 4);
          g.stroke();
        }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(x, r * h, 2, h);
        sg.fillStyle = '#fff';
        sg.fillRect(x - 1, r * h, 3, h);
        x += w;
      }
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(0, r * h, S, 2);
      sg.fillStyle = '#fff';
      sg.fillRect(0, r * h - 1, S, 3);
    }
    if (style === 'barn') {
      g.globalAlpha = 0.5;
      for (let k = 0; k < 500; k++) {
        g.strokeStyle = `hsl(45, 60%, ${45 + rnd() * 25}%)`;
        g.lineWidth = 1.5;
        g.beginPath();
        const x = rnd() * S;
        const y = rnd() * S;
        const a = rnd() * Math.PI;
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  }
  const map = tex(c);
  const seams = tex(sc, true, false);
  map.repeat.set(1 / 8, 1 / 8);
  seams.repeat.set(1 / 8, 1 / 8);
  return { map, seams };
}

export function rugTexture(seed = 1) {
  const [c, g] = canvas(256, 256);
  const rnd = seeded(seed * 13);
  const hues = [[8, 55, 34], [30, 60, 40], [200, 30, 30], [350, 40, 30]];
  const [h, s, l] = hues[seed % hues.length];
  g.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = `hsl(${(h + 30) % 360}, ${s}%, ${l + 22}%)`;
  g.lineWidth = 10;
  g.strokeRect(14, 14, 228, 228);
  g.lineWidth = 3;
  g.strokeRect(30, 30, 196, 196);
  g.fillStyle = `hsl(${(h + 180) % 360}, 25%, ${l + 15}%)`;
  for (let i = 0; i < 6; i++) {
    g.save();
    g.translate(128, 128);
    g.rotate((i * Math.PI) / 3);
    g.fillRect(-6, -70, 12, 46);
    g.restore();
  }
  g.globalAlpha = 0.15;
  for (let y = 0; y < 256; y += 3) {
    g.fillStyle = rnd() < 0.5 ? '#000' : '#fff';
    g.fillRect(0, y, 256, 1);
  }
  return tex(c, false);
}

export function quiltTexture() {
  const [c, g] = canvas(256, 256);
  const cols = ['#5a6fa8', '#c9b27a', '#8c3b36', '#e6dcc4', '#4f7a5a'];
  const rnd = seeded(5);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    g.fillStyle = cols[Math.floor(rnd() * cols.length)];
    g.fillRect(i * 32, j * 32, 32, 32);
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.setLineDash([4, 3]);
    g.strokeRect(i * 32 + 2, j * 32 + 2, 28, 28);
  }
  return tex(c);
}

// Creaky boards, crumbs: drawn so a reveal shows them as a marked patch.
export function patchTexture(kind) {
  const [c, g] = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  const rnd = seeded(kind.length * 17);
  if (kind === 'creak') {
    g.strokeStyle = 'rgba(255,190,140,0.95)';
    g.lineWidth = 6;
    for (let i = -128; i < 256; i += 26) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 128, 128);
      g.stroke();
    }
  } else {
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255, ${190 + rnd() * 50}, 120, 0.95)`;
      g.beginPath();
      g.arc(rnd() * 128, rnd() * 128, 2 + rnd() * 4, 0, Math.PI * 2);
      g.fill();
    }
  }
  return tex(c);
}

// The knife's shadow on the floor (and its outline, drawn in red).
export function knifeTexture(outline = false) {
  const [c, g] = canvas(128, 512);
  g.clearRect(0, 0, 128, 512);
  g.beginPath();
  g.moveTo(64, 20);
  g.quadraticCurveTo(108, 120, 98, 330);
  g.lineTo(30, 330);
  g.quadraticCurveTo(26, 150, 64, 20);
  g.closePath();
  g.moveTo(44, 345);
  g.lineTo(84, 345);
  g.lineTo(80, 490);
  g.quadraticCurveTo(64, 505, 48, 490);
  g.closePath();
  if (outline) {
    g.strokeStyle = '#fff';
    g.lineWidth = 12;
    g.stroke();
  } else {
    g.fillStyle = '#000';
    g.filter = 'blur(6px)';
    g.fill();
  }
  return tex(c, false, false);
}

export function bootTexture(outline = false) {
  const [c, g] = canvas(256, 256);
  g.beginPath();
  g.ellipse(128, 150, 70, 96, 0, 0, Math.PI * 2);
  g.moveTo(60, 70);
  g.ellipse(128, 70, 60, 40, 0, 0, Math.PI * 2);
  if (outline) {
    g.strokeStyle = '#fff';
    g.lineWidth = 12;
    g.stroke();
  } else {
    g.fillStyle = '#000';
    g.filter = 'blur(8px)';
    g.fill();
  }
  return tex(c, false, false);
}

export function pawTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(128, 160, 56, 46, 0, 0, Math.PI * 2);
  g.fill();
  for (const [x, y] of [[62, 92], [104, 62], [152, 62], [194, 92]]) {
    g.beginPath();
    g.ellipse(x, y, 22, 28, 0, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c, false, false);
}

export function stockingTexture() {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#3c4a3f';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#cfc4a8';
  for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 6);
  return tex(c);
}

export function apronTexture() {
  // Her skirt: plum with pleats, and a cream hem that reads as a ring from above.
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#6a3042';
  g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 8) {
    g.fillStyle = 'rgba(0, 0, 0, 0.28)';
    g.fillRect(x, 0, 3, 128);
    g.fillStyle = 'rgba(255, 200, 210, 0.08)';
    g.fillRect(x + 4, 0, 2, 128);
  }
  g.fillStyle = '#efe4cc';
  g.fillRect(0, 112, 128, 16);
  for (let x = 0; x < 128; x += 8) {
    g.beginPath();
    g.arc(x + 4, 112, 4, Math.PI, 0);
    g.fill();
  }
  return tex(c);
}

export function cheeseTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#ffd34a';
  g.fillRect(0, 0, 128, 128);
  const rnd = seeded(77);
  for (let i = 0; i < 14; i++) {
    const r = 4 + rnd() * 9;
    const x = rnd() * 128;
    const y = rnd() * 128;
    g.fillStyle = '#d9a514';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c28f0a';
    g.beginPath();
    g.arc(x + r * 0.2, y + r * 0.25, r * 0.7, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c);
}

// The doormat by the mousehole: coir weave with a dark border.
export function doormatTexture() {
  const [c, g] = canvas(128, 72);
  const rnd = seeded(7);
  g.fillStyle = '#4a3020';
  g.fillRect(0, 0, 128, 72);
  g.fillStyle = '#8a6438';
  g.fillRect(8, 8, 112, 56);
  for (let y = 8; y < 64; y += 4)
    for (let x = 8; x < 120; x += 4) {
      g.fillStyle = (x + y) % 8 ? '#9a7444' : '#7a5630';
      g.globalAlpha = 0.5 + rnd() * 0.5;
      g.fillRect(x, y, 3, 3);
    }
  g.globalAlpha = 1;
  return tex(c, false);
}

// ---------------------------------------------------------------- the rebuilt rooms

// A window's view: deep night blue, a few stars, sometimes the moon.
export function skyTexture(moon = true, seed = 3) {
  const [c, g] = canvas(256, 256);
  const rnd = seeded(seed);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0a1440');
  grad.addColorStop(0.7, '#1d3270');
  grad.addColorStop(1, '#3a4f8a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`;
    const s = rnd() < 0.15 ? 2 : 1;
    g.fillRect(rnd() * 256, rnd() * 170, s, s);
  }
  if (moon) {
    const mg = g.createRadialGradient(170, 80, 4, 170, 80, 70);
    mg.addColorStop(0, 'rgba(220,230,255,0.9)');
    mg.addColorStop(0.3, 'rgba(150,170,255,0.25)');
    mg.addColorStop(1, 'rgba(120,140,255,0)');
    g.fillStyle = mg;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#f4f2e8';
    g.beginPath();
    g.arc(170, 80, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(180,180,200,0.35)';
    for (const [x, y, r] of [[163, 74, 5], [178, 88, 4], [172, 70, 3]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Rolling hills along the bottom.
  g.fillStyle = '#060a1c';
  g.beginPath();
  g.moveTo(0, 256);
  for (let x = 0; x <= 256; x += 16) g.lineTo(x, 212 + Math.sin(x * 0.03 + seed) * 12 + Math.sin(x * 0.011) * 10);
  g.lineTo(256, 256);
  g.fill();
  return tex(c, false);
}

// The moonlight's cookie: four panes with soft edges, the cross bars dark.
export function cookieTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.filter = 'blur(5px)';
  g.fillStyle = '#fff';
  const m = 42;
  const bar = 12;
  const w = (256 - m * 2 - bar) / 2;
  for (const [x, y] of [[m, m], [m + w + bar, m], [m, m + w + bar], [m + w + bar, m + w + bar]]) g.fillRect(x, y, w, w);
  g.filter = 'none';
  const t = tex(c, false, false);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// A shaft of light: bright at the top, fading down and to the sides.
export function beamTexture() {
  const [c, g] = canvas(64, 128);
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0.0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 128);
  g.globalCompositeOperation = 'destination-in';
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,0)');
  side.addColorStop(0.25, 'rgba(0,0,0,1)');
  side.addColorStop(0.75, 'rgba(0,0,0,1)');
  side.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = side;
  g.fillRect(0, 0, 64, 128);
  return tex(c, false, false);
}

// Creaky boards: a patch of loose, lighter boards with cracks and proud nails (overlaid on the floor; 1 tile per 2 u).
export function creakTexture() {
  const [c, g] = canvas(256, 256);
  const rnd = seeded(41);
  g.clearRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) {
    const y = r * 64;
    const tilt = (rnd() - 0.5) * 0.05;
    g.save();
    g.translate(128, y + 32);
    g.rotate(tilt);
    g.fillStyle = `hsl(${30 + rnd() * 8}, ${32 + rnd() * 10}%, ${50 + rnd() * 10}%)`;
    g.globalAlpha = 0.55;
    g.fillRect(-132, -29, 264, 58);
    g.globalAlpha = 0.5;
    g.strokeStyle = '#2a1408';
    g.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      let x = -120 + rnd() * 60;
      let yy = (rnd() - 0.5) * 30;
      g.moveTo(x, yy);
      for (let s = 0; s < 6; s++) {
        x += 12 + rnd() * 20;
        yy += (rnd() - 0.5) * 8;
        g.lineTo(x, yy);
      }
      g.stroke();
    }
    g.globalAlpha = 0.9;
    for (const nx of [-110, 110]) {
      g.fillStyle = '#d8d0c0';
      g.beginPath();
      g.arc(nx, -14, 4, 0, Math.PI * 2);
      g.arc(nx, 14, 4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    g.globalAlpha = 0.7;
    g.fillStyle = '#120804';
    g.fillRect(0, y, 256, 3);
  }
  g.globalAlpha = 1;
  return tex(c, true, true);
}

// Spilt grain: oats and dried peas on the floor (a crunchy, noisy patch).
export function grainTexture() {
  const [c, g] = canvas(256, 256);
  const rnd = seeded(23);
  g.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 520; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const a = rnd() * Math.PI;
    g.save();
    g.translate(x, y);
    g.rotate(a);
    if (rnd() < 0.3) {
      g.fillStyle = `hsl(${80 + rnd() * 20}, 40%, ${45 + rnd() * 15}%)`;
      g.beginPath();
      g.arc(0, 0, 3.5, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = `hsl(${38 + rnd() * 10}, ${45 + rnd() * 20}%, ${62 + rnd() * 18}%)`;
      g.beginPath();
      g.ellipse(0, 0, 5, 2.2, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  return tex(c, true, true);
}

// Hay: straw strands every which way.
export function strawTexture() {
  const [c, g] = canvas(256, 256);
  const rnd = seeded(5);
  g.fillStyle = '#b8902e';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    g.strokeStyle = `hsl(${40 + rnd() * 12}, ${55 + rnd() * 25}%, ${40 + rnd() * 35}%)`;
    g.lineWidth = 1 + rnd() * 1.5;
    const x = rnd() * 256;
    const y = rnd() * 256;
    const a = (rnd() - 0.5) * 0.9;
    const l = 10 + rnd() * 30;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return tex(c);
}

// Knitting: rows of V stitches (white, tinted by the material).
export function knitTexture() {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#d8d8d8';
  g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8)
    for (let x = 0; x < 64; x += 8) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(x + 1, y + 1);
      g.lineTo(x + 4, y + 7);
      g.lineTo(x + 7, y + 1);
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 4, y + 7);
      g.lineTo(x + 4, y + 8);
      g.stroke();
    }
  return tex(c);
}

// Soft fur: fine strokes for the mice (white, tinted by the material).
export function furTexture() {
  const [c, g] = canvas(128, 128);
  const rnd = seeded(17);
  g.fillStyle = '#c8c8c8';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1400; i++) {
    const v = 150 + rnd() * 105;
    g.strokeStyle = `rgba(${v},${v},${v},0.55)`;
    g.lineWidth = 1;
    const x = rnd() * 128;
    const y = rnd() * 128;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 4 + rnd() * 4, y + (rnd() - 0.5) * 3);
    g.stroke();
  }
  return tex(c);
}

// A stencilled word on a sack or a crate.
export function stencilTexture(word, color = '#3a2414') {
  const [c, g] = canvas(256, 128);
  g.clearRect(0, 0, 256, 128);
  g.fillStyle = color;
  g.globalAlpha = 0.82;
  g.font = 'bold 54px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(word, 128, 64);
  g.globalCompositeOperation = 'destination-out';
  const rnd = seeded(word.length * 31);
  for (let i = 0; i < 160; i++) {
    g.globalAlpha = rnd() * 0.6;
    g.fillRect(rnd() * 256, rnd() * 128, 2 + rnd() * 4, 2 + rnd() * 4);
  }
  return tex(c, false);
}

// A small painting for the walls: hills, a cow, a cheese, or a portrait of a very serious cat.
export function paintingTexture(kind = 0) {
  const [c, g] = canvas(192, 144);
  const rnd = seeded(kind * 19 + 3);
  const sky = ['#9cb8d8', '#d8b88c', '#a8c0a0', '#c8a8b8'][kind % 4];
  g.fillStyle = sky;
  g.fillRect(0, 0, 192, 144);
  g.fillStyle = '#5f7f4a';
  g.beginPath();
  g.moveTo(0, 100);
  g.quadraticCurveTo(60, 70, 110, 95);
  g.quadraticCurveTo(160, 115, 192, 90);
  g.lineTo(192, 144);
  g.lineTo(0, 144);
  g.fill();
  if (kind % 3 === 0) {
    g.fillStyle = '#f2f0e8';
    g.fillRect(70, 88, 34, 16);
    g.fillStyle = '#2a2420';
    g.fillRect(78, 90, 10, 8);
    g.fillRect(74, 104, 4, 10);
    g.fillRect(98, 104, 4, 10);
  } else if (kind % 3 === 1) {
    g.fillStyle = '#f2c14e';
    g.beginPath();
    g.moveTo(60, 110);
    g.lineTo(130, 110);
    g.lineTo(60, 76);
    g.fill();
  } else {
    g.fillStyle = '#c8742a';
    g.beginPath();
    g.ellipse(96, 86, 30, 36, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a1410';
    g.fillRect(84, 80, 6, 3);
    g.fillRect(102, 80, 6, 3);
  }
  g.globalAlpha = 0.12;
  for (let i = 0; i < 300; i++) {
    g.fillStyle = rnd() < 0.5 ? '#000' : '#fff';
    g.fillRect(rnd() * 192, rnd() * 144, 3, 1);
  }
  return tex(c, false);
}
