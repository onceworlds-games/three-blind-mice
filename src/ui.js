// Every screen on top of the 3D view: the title (level, streak, today's goals and the Daily Raid), the lobby (the nights
// with their medals, the party, the night card, the wardrobe), the intro, the HUD painted onto the night (the dawn clock,
// the cheese tally, the score and its chain, crumb pops, bonus calls, hints, arrows, names), the results (the score
// counted up, the medal, XP and unlocks, goals) and the band for pause and a closed room. Plain DOM, laid out around the
// platform's own buttons.

import { NIGHTS } from './core/levels.js';
import { SEAT_CSS, SEAT_SHAPES, seatSvg } from './render/echo.js';
import { HINTS } from './hints.js';
import { KINDS, unlockedAt, UNLOCKS } from './looks.js';
import { MEDALS } from './core/score.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (tag, cls, parent, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const num = (v) => Math.round(v).toLocaleString('en-US');
const CHECK = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// What each night teaches, as the lobby card says it.
const TEACH = { ...HINTS, creak: 'Mind the creaky boards', trap: 'Traps go snap', wheel: 'Roll a whole wheel', roam: 'The cat walks about', torch: "Dodge the farmer's torch", two: 'Two of them tonight', all: 'Everything at once' };
const STAR_PATH = 'M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z';
export const starSvg = (on, size = 26, color = '#FFD23F') =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="${STAR_PATH}" fill="${on ? color : 'none'}" stroke="${on ? color : 'rgba(255,241,214,0.55)'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
export const MEDAL_CSS = ['rgba(255,241,214,0.35)', '#D98C4E', '#D8E2F0', '#FFD23F'];
const MEDAL_DARK = ['#333', '#7a3f15', '#56637a', '#9a6a00'];
export const medalSvg = (m, size = 26) =>
  `<svg viewBox="-13 -16 26 30" width="${size}" height="${size * 1.15}"><path d="M-6 -16 L-2 -4 M6 -16 L2 -4" stroke="${m ? '#E23D2E' : 'rgba(255,241,214,0.3)'}" stroke-width="4"/><circle r="10" cy="3" fill="${m ? MEDAL_CSS[m] : 'none'}" stroke="${m ? MEDAL_DARK[m] : MEDAL_CSS[0]}" stroke-width="2"/>${m ? `<path d="M0 -2.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8L0 6.2l-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z" fill="${MEDAL_DARK[m]}"/>` : ''}</svg>`;
const wedgeSvg = (on, gold) => `<svg viewBox="0 0 34 26"><path d="M3 22 L31 22 L3 5 Z" fill="${on ? (gold ? '#FFE07A' : '#FFD23F') : 'rgba(12,13,24,0.5)'}" stroke="${gold ? '#FFE9A8' : '#FFD23F'}" stroke-width="2.4" stroke-linejoin="round"/>${on ? '<circle cx="10" cy="17" r="2.2" fill="#C28F0A"/><circle cx="16" cy="19" r="1.4" fill="#C28F0A"/>' : ''}</svg>`;
const wheelSvg = (on) => `<svg viewBox="0 0 34 26"><circle cx="17" cy="13" r="10.5" fill="${on ? '#FFD23F' : 'rgba(12,13,24,0.5)'}" stroke="#FFD23F" stroke-width="2.4"/><circle cx="17" cy="13" r="4" fill="none" stroke="${on ? '#C28F0A' : '#FFD23F'}" stroke-width="1.6"/></svg>`;
const lockSvg = '<svg viewBox="0 0 20 20"><rect x="4" y="9" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const archSvg = '<path d="M-7 6 L-7 -1 A7 7 0 0 1 7 -1 L7 6 Z" fill="#FF9A3C" stroke="#0C0D18" stroke-width="1.5"/>';
const cheeseIcon = '<path d="M-8 5 L8 5 L-8 -5 Z" fill="#FFD23F" stroke="#0C0D18" stroke-width="1.5" stroke-linejoin="round"/>';
// A mouse's head (the level chip), a candle flame (the streak), a sun over a wedge (the Daily Raid), a paw print (tiptoe).
const headSvg = (size = 30) => `<svg viewBox="-16 -14 32 28" width="${size}" height="${size * 0.875}"><circle cx="-9" cy="-6" r="6.5" fill="#E8A0B4" stroke="#0C0D18" stroke-width="1.6"/><circle cx="9" cy="-6" r="6.5" fill="#E8A0B4" stroke="#0C0D18" stroke-width="1.6"/><ellipse cy="3" rx="11" ry="9.5" fill="#9A90A0" stroke="#0C0D18" stroke-width="1.6"/><circle cx="-4.5" cy="1" r="3.4" fill="#0C0D18"/><circle cx="4.5" cy="1" r="3.4" fill="#0C0D18"/><path d="M-1.4 1H1.4" stroke="#0C0D18" stroke-width="1.4"/><circle cy="7.5" r="1.6" fill="#FF7FA8"/></svg>`;
const flameSvg = (lit, size = 26) => `<svg viewBox="-10 -14 20 26" width="${size * 0.77}" height="${size}"><path d="M0 -13 C5 -6 8 -2 8 3 A8 8 0 0 1 -8 3 C-8 -1 -5 -4 -3 -8 C-2 -4 0 -3 1 -2 C2 -6 1 -9 0 -13Z" fill="${lit ? '#FF9A3C' : 'none'}" stroke="${lit ? '#FFD23F' : 'rgba(255,241,214,0.5)'}" stroke-width="1.6" stroke-linejoin="round"/>${lit ? '<path d="M0 -3 C3 1 4 3 3 6 A3 3 0 0 1 -3 6 C-4 3 -2 1 0 -3Z" fill="#FFF1D6"/>' : ''}</svg>`;
const raidSvg = (size = 30) => `<svg viewBox="-16 -16 32 32" width="${size}" height="${size}"><circle r="13" fill="#14131F" stroke="#FFD23F" stroke-width="2.4"/><path d="M-8 6 L8 6 L-8 -4 Z" fill="#FFD23F" stroke="#0C0D18" stroke-width="1.2" stroke-linejoin="round"/><path d="M0 -13 V-9 M13 0 H9 M-13 0 H-9" stroke="#FFD23F" stroke-width="2" stroke-linecap="round"/></svg>`;
const footSvg = '<svg viewBox="0 0 24 24" width="22" height="22"><ellipse cx="8" cy="15" rx="3" ry="4.2" fill="currentColor"/><circle cx="5" cy="8.6" r="1.4" fill="currentColor"/><circle cx="8.2" cy="7.4" r="1.4" fill="currentColor"/><circle cx="11.2" cy="8.8" r="1.4" fill="currentColor"/><ellipse cx="16.5" cy="11" rx="3" ry="4.2" fill="currentColor"/><circle cx="13.6" cy="4.6" r="1.4" fill="currentColor"/><circle cx="16.8" cy="3.4" r="1.4" fill="currentColor"/><circle cx="19.8" cy="4.8" r="1.4" fill="currentColor"/></svg>';

export const fmtTime = (s) => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

// A look item's little picture: a fur swatch, or a drawing of that very item.
const STAR5 = (cx, cy, r) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }
  return `${d}Z`;
};
const HEART = (cx, cy, r) => `M${cx} ${cy + r * 0.9} C${cx - r * 1.6} ${cy - r * 0.2} ${cx - r * 0.7} ${cy - r * 1.3} ${cx} ${cy - r * 0.4} C${cx + r * 0.7} ${cy - r * 1.3} ${cx + r * 1.6} ${cy - r * 0.2} ${cx} ${cy + r * 0.9}Z`;
const ICONS = {
  hat: [
    '<circle cx="16" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" opacity=".5"/><path d="M10 18 L22 6" stroke="currentColor" stroke-width="2" opacity=".5"/>',
    '<path d="M6 18 C6 6 26 6 26 18Z" fill="#4C7FD0"/><rect x="5" y="16" width="22" height="4" rx="2" fill="#E8EEF8"/><circle cx="16" cy="5" r="3" fill="#E8EEF8"/>',
    '<g fill="#FFF6E0">' + [0, 1, 2, 3, 4, 5].map((i) => `<ellipse cx="${(16 + Math.cos((i * Math.PI) / 3) * 6).toFixed(1)}" cy="${(12 + Math.sin((i * Math.PI) / 3) * 6).toFixed(1)}" rx="4" ry="3" transform="rotate(${i * 60} ${(16 + Math.cos((i * Math.PI) / 3) * 6).toFixed(1)} ${(12 + Math.sin((i * Math.PI) / 3) * 6).toFixed(1)})"/>`).join('') + '</g><circle cx="16" cy="12" r="3.4" fill="#FFC23A"/>',
    '<path d="M5 15 C5 5 27 5 27 15Z" fill="#8A5A2E"/><path d="M5 15 H27" stroke="#5C3A1A" stroke-width="2"/><path d="M8 11 L10 8 M13 10 L15 7 M18 10 L20 7 M23 11 L24 8" stroke="#B88250" stroke-width="1.4"/><path d="M16 5 L17 1" stroke="#5C3A1A" stroke-width="2.4" stroke-linecap="round"/>',
    '<rect x="9" y="2" width="14" height="15" rx="1.5" fill="#22202C" stroke="#55506A" stroke-width="1"/><rect x="9" y="12" width="14" height="3" fill="#C23B3B"/><rect x="3" y="17" width="26" height="3.4" rx="1.7" fill="#22202C" stroke="#55506A" stroke-width="1"/>',
    '<path d="M9 19 V12 C4 12 4 4 10 5 C11 1 21 1 22 5 C28 4 28 12 23 12 V19Z" fill="#FAFAF4" stroke="#C8C4B8" stroke-width="1"/><path d="M9 16 H23" stroke="#C8C4B8" stroke-width="1"/>',
    '<path d="M8 20 L16 2 L24 20Z" fill="#E85A9C"/><path d="M10.5 14 L21.5 14 M13 8.5 L19 8.5" stroke="#FFD23F" stroke-width="2.4"/><circle cx="16" cy="2.6" r="2.6" fill="#7AD6F0"/>',
    '<path d="M2 16 C6 19 26 19 30 16 C26 14 24 15 23 15 L22 7 C20 5 18 7 16 7 C14 7 12 5 10 7 L9 15 C8 15 6 14 2 16Z" fill="#B07A44" stroke="#6A4420" stroke-width="1"/><path d="M9.5 13 H22.5" stroke="#6A4420" stroke-width="2"/>',
    '<path d="M2 12 C8 8 24 8 30 12 L24 19 C18 16 14 16 8 19Z" fill="#2A2638" stroke="#C9A24A" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="11" r="1.8" fill="#C9A24A"/>',
    '<path d="M6 20 L17 1 L26 20Z" fill="#4A3A9A"/><path d="M4 20 H28" stroke="#4A3A9A" stroke-width="3" stroke-linecap="round"/><path d="' + STAR5(16, 12, 3.6) + '" fill="#FFD23F"/>',
    '<path d="M5 19 L4 6 L10 11 L16 3 L22 11 L28 6 L27 19Z" fill="#FFD23F" stroke="#B88A10" stroke-width="1.2" stroke-linejoin="round"/><circle cx="16" cy="14" r="2" fill="#E23D2E"/><circle cx="10" cy="15" r="1.4" fill="#4C7FD0"/><circle cx="22" cy="15" r="1.4" fill="#4C7FD0"/>',
  ],
  glasses: [
    '<circle cx="9" cy="8" r="6" fill="#0C0D18" stroke="currentColor" stroke-width="2"/><circle cx="23" cy="8" r="6" fill="#0C0D18" stroke="currentColor" stroke-width="2"/><path d="M15 7 Q16 5 17 7" fill="none" stroke="currentColor" stroke-width="2"/>',
    '<path d="M3 5 L14 6 L13 11 C10 14 5 13 4 10Z M29 5 L18 6 L19 11 C22 14 27 13 28 10Z" fill="#0C0D18" stroke="#E85A9C" stroke-width="2" stroke-linejoin="round"/><path d="M14 7 H18" stroke="#E85A9C" stroke-width="2"/>',
    '<path d="M3 4 H14 C14 10 12 14 8 14 C4 14 3 9 3 4Z M29 4 H18 C18 10 20 14 24 14 C28 14 29 9 29 4Z" fill="#2E5E7A" stroke="#C9A24A" stroke-width="1.6"/><path d="M14 5 H18" stroke="#C9A24A" stroke-width="1.6"/>',
    `<path d="${STAR5(9, 8.5, 7)}" fill="#FFD23F" stroke="#B88A10" stroke-width="1"/><path d="${STAR5(23, 8.5, 7)}" fill="#FFD23F" stroke="#B88A10" stroke-width="1"/>`,
    '<circle cx="21" cy="8" r="6" fill="rgba(160,200,230,.35)" stroke="#C9A24A" stroke-width="2"/><path d="M15 9 C11 12 8 14 5 16" fill="none" stroke="#C9A24A" stroke-width="1.2" stroke-dasharray="1.5 1.5"/>',
    `<path d="${HEART(9, 8, 5.5)}" fill="#E23D5E" stroke="#8A1A30" stroke-width="1"/><path d="${HEART(23, 8, 5.5)}" fill="#E23D5E" stroke="#8A1A30" stroke-width="1"/>`,
    '<circle cx="9" cy="8" r="6" fill="#0C0D18" stroke="#FFD23F" stroke-width="2.6"/><circle cx="23" cy="8" r="6" fill="#0C0D18" stroke="#FFD23F" stroke-width="2.6"/><path d="M15 7 Q16 5 17 7" fill="none" stroke="#FFD23F" stroke-width="2.4"/>',
  ],
  trail: [
    '<path d="M2 14 C10 4 18 18 30 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-dasharray="2 4" stroke-linecap="round" opacity=".6"/>',
    '<path d="M4 15 L8 11 L6 10 L11 5 M14 16 L18 12 L16 11 L21 6 M24 14 L27 10 L25 9 L29 4" fill="none" stroke="#FFC23A" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
    `<path d="${STAR5(6, 13, 4)}" fill="#FFD23F"/><path d="${STAR5(16, 8, 5)}" fill="#FFF1D6"/><path d="${STAR5(26, 12, 3.4)}" fill="#FFD23F"/>`,
    `<path d="${HEART(7, 12, 3.6)}" fill="#FF7FA8"/><path d="${HEART(17, 8, 4.4)}" fill="#E23D5E"/><path d="${HEART(26, 12, 3.2)}" fill="#FF7FA8"/>`,
    '<g fill="#9FD8FF" stroke="#9FD8FF" stroke-width="1.6"><ellipse cx="7" cy="15" rx="3" ry="2.2"/><path d="M9.6 15 V4 L14 6" fill="none"/><ellipse cx="20" cy="13" rx="3" ry="2.2"/><ellipse cx="27" cy="11" rx="3" ry="2.2"/><path d="M22.6 13 V3 L29.6 1 V11" fill="none"/></g>',
    '<g fill="#F4A6C0"><ellipse cx="6" cy="13" rx="4" ry="2.2" transform="rotate(-30 6 13)"/><ellipse cx="16" cy="8" rx="4" ry="2.2" transform="rotate(20 16 8)"/><ellipse cx="26" cy="13" rx="4" ry="2.2" transform="rotate(-50 26 13)"/></g>',
  ],
};
function itemSwatch(kind, id) {
  const it = KINDS[kind][id];
  if (kind === 'fur') return `<i class="sw" style="background:#${it.color.toString(16).padStart(6, '0')};box-shadow:inset -6px -6px 0 #${it.belly.toString(16).padStart(6, '0')}"></i>`;
  const box = kind === 'glasses' ? '0 0 32 17' : '0 0 32 22';
  return `<i class="sw ic"><svg viewBox="${box}" width="38" height="${kind === 'glasses' ? 20 : 26}">${ICONS[kind][id] ?? ''}</svg></i>`;
}
const KIND_LABEL = { glasses: 'Glasses', hat: 'Hats', fur: 'Fur', trail: 'Sparkle' };
const KIND_KEY = { glasses: 'g', hat: 'h', fur: 'f', trail: 't' };

export function createUI(h) {
  const root = document.getElementById('ui');
  const screens = {};
  for (const id of ['title', 'lobby', 'intro', 'hud', 'morning', 'results', 'band']) screens[id] = el('div', 'screen', root);
  for (const [id, s] of Object.entries(screens)) s.id = id;
  const wipe = el('div', '', document.body);
  wipe.id = 'wipe';
  const ui = { screens, cur: '' };

  const press = (btn, fn) => {
    btn.addEventListener('click', (e) => {
      ripple(e.clientX, e.clientY);
      h.sfx?.('tap');
      fn(e);
    });
    return btn;
  };
  function ripple(x, y) {
    if (h.reduced?.()) return;
    const r = el('div', 'ripple', document.body);
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    setTimeout(() => r.remove(), 650);
  }
  ui.ripple = ripple;

  // A level chip: the mouse head, the level, a bar to the next.
  function levelChip(parent, tag = 'div') {
    const c = el(tag, 'lvchip', parent);
    c.innerHTML = `${headSvg(34)}<span class="lv slab"></span><span class="bar"><i></i></span>`;
    return {
      el: c,
      set(level, into, need) {
        c.querySelector('.lv').textContent = `Lv ${level}`;
        c.querySelector('.bar i').style.width = `${Math.round((into / Math.max(1, need)) * 100)}%`;
      },
    };
  }
  const boardRows = (top) => top.map((e, i) => `<div class="${e.me ? 'me' : ''}"><i>${i + 1}</i><span>${esc(e.name)}</span><b>${num(e.score)}</b></div>`).join('');
  const goalRow = (g) => `<div class="goal${g.done ? ' done' : ''}${g.now ? ' now' : ''}${g.week ? ' wk' : ''}"><span class="gl">${esc(g.label)}</span><span class="gp">${g.done ? CHECK : `${num(g.have)}/${num(g.need)}`}</span><span class="gb"><i style="width:${Math.round((g.have / g.need) * 100)}%"></i></span></div>`;

  // ------------------------------------------------------------ title
  const tName = el('div', 'name slab lit', screens.title);
  tName.innerHTML = '<span>Three </span><span>Blind </span><span>Mice</span>';
  const tRow = el('div', 'row', screens.title);
  const playBtn = press(el('button', 'btn big pulse', tRow, 'Play'), () => h.onPlay());
  const tMeta = el('div', 'tmeta', tRow);
  const tLevel = levelChip(tMeta);
  const tStreak = el('div', 'streak', tMeta);
  const tSide = el('div', 'tside', screens.title);
  const tDaily = el('div', 'daily', tSide);
  tDaily.innerHTML = `<div class="dh">${raidSvg(30)}<b class="slab">Daily Raid</b></div><div class="dn slab"></div><div class="dt"></div><div class="dtop"></div>`;
  const raidBtn = press(el('button', 'btn', tDaily), () => h.onRaid());
  raidBtn.innerHTML = 'Raid<span class="key">D</span>';
  const tGoals = el('div', 'goals', tSide);
  ui.title = (s) => {
    tLevel.set(s.level, s.into, s.need);
    tStreak.innerHTML = `${flameSvg(s.streak > 0, 26)}<span class="slab">${s.streak}</span>`;
    tStreak.title = s.streak ? `${s.streak} day${s.streak === 1 ? '' : 's'} in a row` : 'Play today to start a streak';
    tStreak.classList.toggle('cold', !s.streak);
    const d = s.daily;
    tDaily.style.display = d ? '' : 'none';
    if (d) {
      tDaily.querySelector('.dn').textContent = d.name;
      tDaily.querySelector('.dt').innerHTML = `<span class="tw">${esc(d.twist)}</span>${d.best ? `<span>Yours <b>${num(d.best)}</b></span>` : ''}`;
      tDaily.querySelector('.dtop').innerHTML = d.top.length ? boardRows(d.top.slice(0, 3)) : `<div class="none">${d.raiders ? `${num(d.raiders)} raided today` : 'Nobody yet today'}</div>`;
    }
    tGoals.innerHTML = s.goals.length ? `<div class="gh"><b class="slab">Today</b>${s.allDone ? `<span>${CHECK}</span>` : ''}</div>${s.goals.map((g) => goalRow(g)).join('')}${s.week ? `<div class="gh wkh"><b class="slab">This week</b><span class="xpv">+600 XP</span></div>${goalRow(s.week)}` : ''}` : '';
    tGoals.style.display = s.goals.length ? '' : 'none';
  };
  ui.lightTitle = (x, r) => {
    tName.style.setProperty('--rx', `${x}%`);
    tName.style.setProperty('--rr', `${r}%`);
  };
  ui.playButton = playBtn;
  ui.raidButton = raidBtn;

  // ------------------------------------------------------------ lobby
  const strip = el('div', 'strip tap', screens.lobby);
  const raidTile = press(el('button', 'nt raid', strip), () => h.onPick(0, true));
  raidTile.innerHTML = `${raidSvg(26)}<small>Daily</small>`;
  const tiles = NIGHTS.map((n, i) => {
    const b = press(el('button', 'nt', strip), () => h.onPick(i + 1));
    b.innerHTML = `${i + 1}<small></small>`;
    return b;
  });
  const party = el('div', 'party', screens.lobby);
  const card = el('div', 'card', screens.lobby);
  const cN = el('div', 'n', card);
  const cTitle = el('div', 'title slab lit', card);
  cTitle.style.setProperty('--rr', '160%');
  const cTeach = el('div', 'teach', card);
  const cMeta = el('div', 'meta', card);
  const cMedals = el('div', 'medals', card);
  const cBoard = el('div', 'board', card);
  const cAct = el('div', 'wait', card);
  const startBtn = press(el('button', 'btn big'), () => h.onStart());
  const readyBtn = press(el('button', 'btn big'), () => h.onReady());
  const waitTxt = el('span', 'solid');
  const lLevel = levelChip(screens.lobby, 'button');
  lLevel.el.classList.add('lobbylv');
  press(lLevel.el, () => h.onWardrobe(true));
  let lobbyKey = '';
  ui.lobby = (s) => {
    const key = JSON.stringify(s);
    if (key === lobbyKey) return;
    lobbyKey = key;
    const raid = s.raid;
    raidTile.classList.toggle('sel', !!raid);
    raidTile.disabled = !s.isHost;
    raidTile.style.pointerEvents = s.isHost ? 'auto' : 'none';
    raidTile.style.display = s.raidOk ? '' : 'none';
    tiles.forEach((b, i) => {
      const n = i + 1;
      const locked = n > s.unlocked;
      b.classList.toggle('sel', !raid && n === s.pick);
      b.classList.toggle('locked', locked);
      b.disabled = !s.isHost || locked;
      b.style.pointerEvents = s.isHost && !locked ? 'auto' : 'none';
      const st = s.stars[i] ?? 0;
      const md = s.medals[i] ?? 0;
      b.innerHTML = locked ? `${lockSvg}` : `${n}<small>${md ? `<i class="md" style="background:${MEDAL_CSS[md]}"></i>` : starSvg(true, 12).repeat(st)}</small>`;
      b.setAttribute('aria-label', `Night ${n}${locked ? ', locked' : ''}`);
    });
    lLevel.set(s.level, s.into, s.need);
    const night = NIGHTS[s.pick - 1];
    card.classList.toggle('raid', !!raid);
    if (raid) {
      cN.textContent = `Daily Raid · Night ${s.pick}`;
      cTitle.textContent = night.name;
      cTeach.textContent = raid.twist;
      cMeta.innerHTML = raid.best ? `<span>Yours today <b>${num(raid.best)}</b></span>` : '<span>The same night for everyone today</span>';
      cMedals.innerHTML = '';
      cBoard.innerHTML = boardRows(raid.top.slice(0, 5));
    } else {
      cN.textContent = `Night ${s.pick}`;
      cTitle.textContent = night.name;
      cTeach.textContent = TEACH[night.teach] ?? '';
      const st = s.stars[s.pick - 1] ?? 0;
      const best = s.scores[s.pick - 1] ?? 0;
      const md = s.medals[s.pick - 1] ?? 0;
      cMeta.innerHTML = `<span class="starrow">${starSvg(st >= 1)}${starSvg(st >= 2)}${starSvg(st >= 3)}</span>${best ? `<span class="bs">${medalSvg(md, 20)}<b>${num(best)}</b></span>` : ''}`;
      cMedals.innerHTML = s.thresholds ? s.thresholds.map((v, k) => `<span class="${md >= k + 1 ? 'got' : ''}">${medalSvg(k + 1, 15)}${num(v)}</span>`).join('') : '';
      cBoard.innerHTML = '';
    }
    cAct.textContent = '';
    if (s.isHost) {
      startBtn.innerHTML = `${raid ? 'Raid' : 'Start'}<span class="key">Enter</span>`;
      startBtn.disabled = !s.canStart;
      cAct.appendChild(startBtn);
      if (!s.canStart && s.waitingFor.length) {
        waitTxt.textContent = `Waiting for ${s.waitingFor.join(', ')}`;
        cAct.prepend(waitTxt);
        waitTxt.style.marginRight = '14px';
      }
    } else if (!s.ready) {
      readyBtn.innerHTML = `Ready<span class="key">Enter</span>`;
      cAct.appendChild(readyBtn);
    } else {
      waitTxt.textContent = `Ready. Waiting for ${s.hostName}`;
      waitTxt.style.marginRight = '0';
      const undo = press(el('button', 'btn quiet'), () => h.onReady());
      undo.textContent = 'Not ready';
      cAct.appendChild(waitTxt);
      cAct.appendChild(undo);
      undo.style.marginLeft = '12px';
    }
    party.textContent = '';
    for (let i = 0; i < 3; i++) {
      const p = s.seats[i];
      const seat = el('div', `seat${p ? '' : ' empty'}${p?.me ? ' me tap' : ''}`, party);
      seat.style.setProperty('--c', SEAT_CSS[i]);
      const av = el('div', 'av', seat);
      const who = el('div', 'who', seat);
      if (p) {
        if (p.avatar) {
          const img = el('img', '', av);
          img.crossOrigin = 'anonymous';
          img.alt = '';
          img.src = p.avatar;
        } else av.innerHTML = seatSvg(i, 26);
        el('b', '', who, p.me && p.name !== 'You' ? `${p.name} (you)` : p.name);
        const tag = el('i', '', who);
        tag.innerHTML = seatSvg(i, 14);
        tag.append(p.me ? ' Wardrobe' : p.host ? ' Host' : ' Mouse');
        if (p.ready || p.host) el('div', 'ok', seat).innerHTML = CHECK;
        if (p.me) {
          seat.title = 'Wardrobe';
          press(seat, () => h.onWardrobe(true));
        }
      } else {
        av.style.border = `2px dashed ${SEAT_CSS[i]}`;
        av.style.background = 'transparent';
        if (s.inviteable) {
          const b = press(el('button', 'btn quiet', who, 'Invite'), () => h.onInvite());
          b.style.minHeight = '44px';
        } else el('b', '', who, 'Empty');
      }
    }
  };

  // ------------------------------------------------------------ the wardrobe (over the lobby, the camera on your mouse)
  const wr = el('div', 'wardrobe', screens.lobby);
  const wHead = el('div', 'wh', wr);
  el('b', 'slab', wHead, 'Wardrobe');
  const wLv = el('span', 'wlv', wHead);
  const wClose = press(el('button', 'btn quiet', wHead), () => h.onWardrobe(false));
  wClose.innerHTML = 'Done<span class="key">Esc</span>';
  const wTabs = el('div', 'wtabs', wr);
  const wGrid = el('div', 'wgrid', wr);
  const wNext = el('div', 'wnext', wr);
  let wKind = 'hat';
  let wState = null;
  for (const kind of ['hat', 'glasses', 'fur', 'trail']) {
    const b = press(el('button', 'wtab', wTabs, KIND_LABEL[kind]), () => {
      wKind = kind;
      drawWardrobe();
    });
    b.dataset.kind = kind;
  }
  function drawWardrobe() {
    if (!wState) return;
    const { level, look, trying, tryLast } = wState;
    wLv.textContent = `Lv ${level}`;
    for (const b of wTabs.children) b.classList.toggle('sel', b.dataset.kind === wKind);
    wGrid.textContent = '';
    KINDS[wKind].forEach((it, id) => {
      const open = unlockedAt(wKind, id, level);
      const on = look[KIND_KEY[wKind]] === id;
      const tried = !open && trying?.[wKind] === id;
      const b = el('button', `wi${on ? ' on' : ''}${open ? '' : ' locked'}${tried ? ' trying' : ''}`, wGrid);
      const u = UNLOCKS.find((x) => x.kind === wKind && x.id === id);
      b.innerHTML = `${itemSwatch(wKind, id)}<span>${esc(it.name)}</span>${open ? (on ? `<em>${CHECK}</em>` : '') : `<em>${lockSvg}${u?.level ?? '?'}</em>`}`;
      // A locked one can be tried on: the mouse wears it until you pick another or close.
      press(b, () => (open ? h.onWear(wKind, id) : h.onTry(wKind, id)));
    });
    const u = tryLast && UNLOCKS.find((x) => x.kind === tryLast.kind && x.id === tryLast.id);
    const nx = UNLOCKS.find((x) => x.level > level);
    wNext.innerHTML = u ? `Trying on · unlocks at <b>Lv ${u.level}</b>` : nx ? `Next <b>Lv ${nx.level}</b> · ${esc(KINDS[nx.kind][nx.id].name)}` : 'Everything unlocked';
  }
  ui.wardrobe = (s) => {
    wr.classList.toggle('on', !!s);
    screens.lobby.classList.toggle('dressing', !!s);
    if (!s) {
      wState = null;
      return;
    }
    if (wState && JSON.stringify(wState) === JSON.stringify(s)) return;
    const switchTo = s.tryLast && s.tryLast.kind !== wState?.tryLast?.kind ? s.tryLast.kind : '';
    wState = { level: s.level, look: { ...s.look }, trying: { ...(s.trying ?? {}) }, tryLast: s.tryLast ?? null };
    if (switchTo) wKind = switchTo;
    drawWardrobe();
  };

  // ------------------------------------------------------------ intro and morning
  const iBox = el('div', 'banner', screens.intro);
  const iSmall = el('div', 'small', iBox);
  const iBig = el('div', 'big slab lit', iBox);
  const iTwist = el('div', 'twist solid', iBox);
  ui.intro = (night, twist = '') => {
    iSmall.textContent = night.daily ? 'Daily Raid' : `Night ${night.id}`;
    iBig.textContent = night.name;
    iTwist.textContent = twist;
    iBox.classList.remove('fadein');
    void iBox.offsetWidth;
    iBox.classList.add('fadein');
  };
  ui.lightIntro = (r) => iBig.style.setProperty('--rr', `${r}%`);
  const mBox = el('div', 'banner', screens.morning);
  const mBig = el('div', 'big slab lit', mBox);
  mBig.style.setProperty('--rr', '170%');
  ui.morning = (text) => {
    mBig.textContent = text;
    mBox.classList.remove('fadein');
    void mBox.offsetWidth;
    mBox.classList.add('fadein');
  };

  // ------------------------------------------------------------ the HUD
  const hud = screens.hud;
  const vignette = el('div', 'vignette', hud);
  const clock = el('div', 'clock', hud);
  clock.innerHTML = `<svg viewBox="0 0 170 64">
    <path d="M6 57 Q85 -15 164 57" fill="none" stroke="#F4A835" stroke-width="2.5" stroke-dasharray="2 5" stroke-linecap="round" opacity="0.8"/>
    <line x1="0" y1="58" x2="170" y2="58" stroke="#FF7B22" stroke-width="2.5" opacity="0.85"/>
    <g class="sun" transform="translate(164 58)"><path d="M-9 0 A9 9 0 0 1 9 0" fill="#FF7B22"/><path d="M0 -13 V-17 M9 -9 L12 -12 M-9 -9 L-12 -12 M13 -2 H17" stroke="#FF7B22" stroke-width="2" stroke-linecap="round"/></g>
    <g class="moon"><circle r="9" fill="#FFF1D6"/><circle r="8" cx="4.5" cy="-3" fill="#0C0D18"/></g>
  </svg><div class="time slab solid">3:00</div><div class="tally"></div>`;
  const moonG = clock.querySelector('.moon');
  const timeEl = clock.querySelector('.time');
  const tallyEl = clock.querySelector('.tally');
  // The score: the number, and the chain as a multiplier in a ring that drains while the chain can still go on.
  const scoreBox = el('div', 'score', hud);
  scoreBox.innerHTML = `<div class="chain"><svg viewBox="-20 -20 40 40"><circle r="16" fill="rgba(12,13,24,0.85)" stroke="rgba(255,210,63,0.25)" stroke-width="4"/><circle class="cr" r="16" fill="none" stroke="#FFD23F" stroke-width="4" stroke-linecap="round" transform="rotate(-90)" stroke-dasharray="0 999"/></svg><b class="slab">×1</b></div><div class="sv slab solid">0</div>`;
  const scoreV = scoreBox.querySelector('.sv');
  const chainEl = scoreBox.querySelector('.chain');
  const chainRing = scoreBox.querySelector('.cr');
  const chainTxt = scoreBox.querySelector('.chain b');
  const tipEl = el('div', 'tiptoe solid', hud);
  tipEl.innerHTML = `${footSvg}<span>Tiptoe</span>`;
  const callEl = el('div', 'call slab solid', hud);
  const popLayer = el('div', 'pops', hud);
  const hintEl = el('div', 'hint slab solid', hud);
  const tagPool = [];
  const arrowPool = [];
  const outEl = el('div', 'out slab solid', hud);
  const restEl = document.createElementNS(SVGNS, 'svg');
  restEl.setAttribute('viewBox', '-40 -40 80 80');
  restEl.classList.add('rest');
  restEl.innerHTML = '<circle r="32" fill="none" stroke="rgba(255,241,214,0.25)" stroke-width="5"/><circle class="p" r="32" fill="none" stroke="#FFF1D6" stroke-width="5" stroke-linecap="round" transform="rotate(-90)" stroke-dasharray="0 999"/>';
  hud.appendChild(restEl);
  const restP = restEl.querySelector('.p');
  const watchEl = el('div', 'watch slab solid', hud, 'Watching');
  const joinBtn = press(el('button', 'btn big joinin', hud, 'Join in'), () => h.onJoinIn());
  const noteEl = el('div', 'party-note solid', hud);
  let lastTally = '';
  let lastTime = '';
  let hintText = '';
  let shownScore = 0;
  let lastScoreTxt = '';
  let lastMult = 0;

  function pooled(pool, make, n) {
    while (pool.length < n) pool.push(make());
    for (let i = 0; i < pool.length; i++) pool[i].style.display = i < n ? '' : 'none';
    return pool;
  }

  // A number that floats up from a point on the screen: "+30".
  const popPool = [];
  ui.pop = (x, y, text, cls = '') => {
    let p = popPool.find((q) => !q.busy);
    if (!p) {
      if (popPool.length > 14) return;
      p = el('div', 'pop slab solid', popLayer);
      popPool.push(p);
    }
    p.busy = true;
    p.className = `pop slab solid ${cls}`;
    p.textContent = text;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    void p.offsetWidth;
    p.classList.add('go');
    clearTimeout(p.tm);
    p.tm = setTimeout(() => {
      p.busy = false;
      p.classList.remove('go');
    }, 950);
  };
  // A call across the top: "Close shave +100".
  let callT = 0;
  ui.call = (text, cls = '') => {
    callEl.textContent = text;
    callEl.className = `call slab solid ${cls}`;
    void callEl.offsetWidth;
    callEl.classList.add('on');
    clearTimeout(callT);
    callT = setTimeout(() => callEl.classList.remove('on'), 1500);
  };

  ui.hud = (s) => {
    // The dawn clock: the moon sinks along its arc toward the sunrise.
    const u = Math.max(0, Math.min(1, s.frac));
    const bx = (1 - u) * (1 - u) * 6 + 2 * (1 - u) * u * 85 + u * u * 164;
    const by = (1 - u) * (1 - u) * 57 + 2 * (1 - u) * u * -15 + u * u * 57;
    moonG.setAttribute('transform', `translate(${bx.toFixed(1)} ${by.toFixed(1)})`);
    const tt = fmtTime(s.timeLeft);
    if (tt !== lastTime) {
      lastTime = tt;
      timeEl.textContent = tt;
      timeEl.style.color = s.timeLeft <= 30 ? '#FF7B22' : '';
    }
    const tk = s.items.map((i) => `${i.k}${i.home ? 1 : 0}${i.gd ? 'g' : ''}`).join('');
    if (tk !== lastTally) {
      lastTally = tk;
      tallyEl.innerHTML = s.items.map((i) => (i.k === 'W' ? wheelSvg(i.home) : wedgeSvg(i.home, i.gd))).join('');
    }
    // The score rolls up to its value.
    shownScore += (s.score - shownScore) * 0.2;
    if (Math.abs(s.score - shownScore) < 1) shownScore = s.score;
    const st = num(shownScore);
    if (st !== lastScoreTxt) {
      lastScoreTxt = st;
      scoreV.textContent = st;
    }
    const live = s.chain.n > 1 && s.chain.left > 0;
    chainEl.classList.toggle('on', live);
    if (live) {
      chainRing.setAttribute('stroke-dasharray', `${(s.chain.left * 100.5).toFixed(1)} 999`);
      if (s.chain.mult !== lastMult) {
        lastMult = s.chain.mult;
        chainTxt.textContent = `×${s.chain.mult}`;
        chainEl.classList.toggle('max', s.chain.mult >= 5);
        chainEl.classList.remove('bump');
        void chainEl.offsetWidth;
        chainEl.classList.add('bump');
      }
    } else lastMult = 0;
    tipEl.classList.toggle('on', s.tiptoe > 0.5);
    vignette.style.opacity = String(s.chase);
    // Names over friends.
    pooled(tagPool, () => el('div', 'tag solid', hud), s.tags.length).forEach((t, i) => {
      const g = s.tags[i];
      if (!g) return;
      t.style.left = `${g.x}px`;
      t.style.top = `${g.y}px`;
      if (t.textContent !== g.text) t.textContent = g.text;
      t.style.color = g.color;
    });
    pooled(
      arrowPool,
      () => {
        const a = document.createElementNS(SVGNS, 'svg');
        a.setAttribute('viewBox', '-23 -23 46 46');
        a.classList.add('arrow');
        a.innerHTML = '<g class="r"><path d="M8 -9 L20 0 L8 9" fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></g><g class="i"></g>';
        hud.appendChild(a);
        return a;
      },
      s.arrows.length,
    ).forEach((a, i) => {
      const g = s.arrows[i];
      if (!g) return;
      a.style.left = `${g.x}px`;
      a.style.top = `${g.y}px`;
      const r = a.firstChild;
      r.setAttribute('transform', `rotate(${(g.ang * 180) / Math.PI})`);
      r.firstChild.setAttribute('stroke', g.color);
      const icon = g.kind === 'hole' ? archSvg : g.kind === 'cheese' ? cheeseIcon : `<path d="${SEAT_SHAPES[g.seat] ?? SEAT_SHAPES[0]}" transform="scale(7)" fill="${g.color}" stroke="#0C0D18" stroke-width="0.22"/>`;
      if (a.lastChild.dataset.k !== g.kind + g.seat) {
        a.lastChild.innerHTML = icon;
        a.lastChild.dataset.k = g.kind + g.seat;
      }
    });
    outEl.style.display = s.out ? '' : 'none';
    if (s.out) {
      outEl.style.left = `${s.out.x}px`;
      outEl.style.top = `${s.out.y}px`;
      const n = String(Math.ceil(s.out.n));
      if (outEl.textContent !== n) outEl.textContent = n;
    }
    restEl.style.display = s.rest ? '' : 'none';
    if (s.rest) {
      restEl.style.left = `${s.rest.x}px`;
      restEl.style.top = `${s.rest.y}px`;
      restP.setAttribute('stroke-dasharray', `${(s.rest.u * 201).toFixed(1)} 999`);
    }
    watchEl.style.display = s.watching ? '' : 'none';
    joinBtn.style.display = s.canJoin ? '' : 'none';
    noteEl.style.display = s.note && !s.watching ? '' : 'none';
    if (s.note && noteEl.textContent !== s.note) noteEl.textContent = s.note;
    if (s.hint !== hintText) {
      hintText = s.hint;
      if (s.hint) hintEl.textContent = s.hint;
      hintEl.classList.toggle('on', !!s.hint);
    }
  };
  ui.resetScore = () => {
    shownScore = 0;
    lastScoreTxt = '';
    scoreV.textContent = '0';
  };

  // ------------------------------------------------------------ results: the score counted up, the medal, XP, goals
  const res = screens.results;
  const rHead = el('div', 'head', res);
  const rBig = el('div', 'big slab lit', rHead);
  rBig.style.setProperty('--rr', '170%');
  const rSub = el('div', 'sub solid', rHead);
  const rStars = el('div', 'stars3', rHead);
  const starEls = ['Cheese home', 'All the cheese', 'Every tail'].map((label) => {
    const d = el('div', 'st solid', rStars);
    d.innerHTML = `${starSvg(true, 30)}<span>${label}</span>`;
    return d;
  });
  const sheet = el('div', 'sheet', res);
  const rLines = el('div', 'lines', sheet);
  const rTotal = el('div', 'total', sheet);
  rTotal.innerHTML = '<span class="tl">Score</span><b class="tv slab">0</b><span class="nb slab">New best</span>';
  const rMedal = el('div', 'medalrow', sheet);
  const rXp = el('div', 'xp', sheet);
  rXp.innerHTML = `${headSvg(30)}<span class="lv slab"></span><span class="bar"><i></i></span><span class="gain slab"></span>`;
  const rUnlock = el('div', 'unlock', sheet);
  const rGoals = el('div', 'rgoals', sheet);
  const rBoard = el('div', 'rboard', sheet);
  // Today's raid board under a raid's results (filled again when a fresh read arrives).
  ui.raidBoard = (top) => {
    rBoard.innerHTML = top?.length ? `<div class="gh"><b class="slab">Today's raid</b></div>${boardRows(top.slice(0, 5))}` : '';
  };
  const rRows = el('div', 'rows solid', sheet);
  const rBtns = el('div', 'btns', res);
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, h.reduced?.() ? Math.min(ms, 60) : ms));
  // A sheet taller than the screen follows what it is showing: each new part scrolls into view, never past the score.
  const reveal = (elm) => {
    const over = Math.min(elm.offsetTop + elm.offsetHeight - sheet.clientHeight + 14, rTotal.offsetTop - 6);
    if (over > sheet.scrollTop) sheet.scrollTo({ top: over, behavior: h.reduced?.() ? 'auto' : 'smooth' });
  };
  function countUp(elm, from, to, ms) {
    const t0 = performance.now();
    const step = () => {
      const u = Math.min(1, (performance.now() - t0) / ms);
      elm.textContent = num(from + (to - from) * (1 - Math.pow(1 - u, 3)));
      if (u < 1) requestAnimationFrame(step);
    };
    if (h.reduced?.()) elm.textContent = num(to);
    else step();
  }

  // r: the session's result plus nightName, rec (what the night did to the progress), level ({ from, to, into, need,
  // before }), unlocked ([{ kind, id }]), goals ([{ label, have, need, done, now }]), isHost, next, hostName.
  ui.results = (r) => {
    for (const t of timers.splice(0)) clearTimeout(t);
    const sc = r.score;
    rBig.textContent = r.home > 0 ? 'Morning' : 'Dawn';
    rSub.textContent = `${r.day ? 'Daily Raid' : `Night ${r.night}`} · ${r.nightName}  ·  ${fmtTime(r.time)}`;
    rStars.style.display = r.day ? 'none' : '';
    starEls.forEach((s) => s.classList.remove('got'));
    rLines.textContent = '';
    const tv = rTotal.querySelector('.tv');
    tv.textContent = '0';
    rTotal.classList.remove('best');
    for (const x of [rMedal, rXp, rUnlock, rGoals]) x.classList.remove('on');
    rMedal.innerHTML = '';
    rUnlock.innerHTML = '';
    rGoals.innerHTML = '';
    sheet.scrollTop = 0;
    ui.raidBoard(r.day ? r.board : null);
    // The lines, one by one.
    let at = 300;
    let running = 0;
    sc.lines.forEach((l) => {
      const row = el('div', `ln${l.bonus ? ' bonus' : ''}`, rLines);
      const detail = l.id === 'cheese' ? `${l.n}/${l.of}` : l.id === 'crumbs' ? `${l.n}/${l.of}${l.chain > 1 ? ` · chain ${l.chain}` : ''}` : '';
      row.innerHTML = `<span class="lt">${esc(l.label)}</span><span class="ld">${detail}</span><b>${l.pts ? `+${num(l.pts)}` : '0'}</b>`;
      later(at, () => {
        row.classList.add('on');
        h.sfx?.(l.bonus ? 'bonus' : 'tally');
        const from = running;
        running += l.pts;
        countUp(tv, from, running, 360);
      });
      at += l.bonus ? 380 : 480;
    });
    // The medal: the bar with its three marks and the score's needle.
    later(at + 100, () => {
      const [b, s, g] = sc.medals;
      const top = g * 1.12;
      const pos = (v) => `${Math.min(100, (v / top) * 100).toFixed(1)}%`;
      rMedal.innerHTML = `<div class="mbig">${medalSvg(sc.medal, 46)}<span class="slab">${sc.medal ? MEDALS[sc.medal] : 'No medal'}</span></div><div class="mbar"><i class="fill"></i>${[b, s, g].map((v, k) => `<span class="mk${sc.medal >= k + 1 ? ' got' : ''}" style="left:${pos(v)}">${medalSvg(k + 1, 14)}<em>${num(v)}</em></span>`).join('')}</div>`;
      rMedal.classList.add('on');
      reveal(rMedal);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const f = rMedal.querySelector('.fill');
          if (f) f.style.width = pos(sc.total);
        }),
      );
      if (r.rec?.newBest || r.rec?.raidBest) rTotal.classList.add('best');
      h.sfx?.(sc.medal ? 'medal' : 'tally', { n: sc.medal });
      if (!r.day)
        [r.stars.home, r.stars.all, r.stars.tails].forEach(
          (on, i) =>
            on &&
            later(260 + i * 300, () => {
              starEls[i].classList.add('got');
              h.sfx?.('star', { n: i });
            }),
        );
    });
    at += 1000;
    // XP: the bar fills, levels roll over, unlocks show.
    const lv = r.level;
    if (lv && r.rec) {
      later(at, () => {
        rXp.classList.add('on');
        reveal(rXp);
        rXp.querySelector('.gain').textContent = `+${num(r.rec.xp)} XP`;
        const lvEl = rXp.querySelector('.lv');
        const bar = rXp.querySelector('.bar i');
        lvEl.textContent = `Lv ${lv.from}`;
        bar.style.transition = 'none';
        bar.style.width = `${Math.round(lv.before * 100)}%`;
        void bar.offsetWidth;
        bar.style.transition = '';
        const ups = lv.to - lv.from;
        let k = 0;
        const fillTo = () => {
          if (k < ups) {
            bar.style.width = '100%';
            later(560, () => {
              k++;
              lvEl.textContent = `Lv ${lv.from + k}`;
              h.sfx?.('levelup');
              rXp.classList.remove('up');
              void rXp.offsetWidth;
              rXp.classList.add('up');
              bar.style.transition = 'none';
              bar.style.width = '0%';
              void bar.offsetWidth;
              bar.style.transition = '';
              fillTo();
            });
          } else bar.style.width = `${Math.round((lv.into / lv.need) * 100)}%`;
        };
        fillTo();
      });
      at += 650 + (lv.to - lv.from) * 600;
      if (r.unlocked?.length) {
        later(at, () => {
          rUnlock.innerHTML = `<b class="slab">New</b>${r.unlocked.map((u) => `<span>${itemSwatch(u.kind, u.id)}${esc(KINDS[u.kind][u.id].name)}</span>`).join('')}`;
          const wear = press(el('button', 'btn quiet wear', rUnlock, 'Wear'), () => {
            const last = r.unlocked[r.unlocked.length - 1];
            h.onWear(last.kind, last.id);
            wear.textContent = 'On';
            wear.disabled = true;
          });
          rUnlock.classList.add('on');
          reveal(rUnlock);
          h.sfx?.('unlock');
        });
        at += 500;
      }
    }
    if (r.goals?.length) {
      later(at, () => {
        rGoals.innerHTML = r.goals.map((g) => goalRow(g)).join('');
        rGoals.classList.add('on');
        reveal(rGoals);
        if (r.goals.some((g) => g.now)) h.sfx?.('goal');
      });
    }
    rRows.textContent = '';
    if (r.rows.length > 1) {
      // Who did what: a title each for the best carrier and the best crumb eater; a bandage for a lost tail.
      const most = (k) => {
        const top = Math.max(...r.rows.map((x) => x[k] ?? 0));
        return top > 0 && r.rows.filter((x) => (x[k] ?? 0) === top).length === 1 ? top : -1;
      };
      const homeTop = most('home');
      const crumbTop = most('crumbs');
      for (const row of r.rows) {
        const d = el('div', '', rRows);
        d.innerHTML = `<span>${seatSvg(row.seat, 16)}</span>`;
        el('span', '', d, row.name + (row.me && row.name !== 'You' ? ' (you)' : ''));
        el('span', '', d, `${row.home} home · ${row.crumbs} crumbs`);
        const tag = row.home === homeTop ? 'Cheese runner' : row.crumbs === crumbTop ? 'Crumb hoover' : row.tail ? '' : 'Bandaged';
        el('span', `tag${row.tail ? '' : ' hurt'}`, d, tag || '·');
      }
    }
    rBtns.textContent = '';
    if (r.isHost) {
      const nextOk = r.next && r.home > 0 && !r.day;
      const again = press(el('button', `btn ${nextOk ? 'quiet' : 'big'}`, null), () => h.onAgain());
      again.innerHTML = `${r.day ? 'Raid again' : 'Again'}<span class="key">R</span>`;
      const map = press(el('button', 'btn quiet'), () => h.onMap());
      map.innerHTML = 'Map<span class="key">M</span>';
      rBtns.append(map, again);
      if (nextOk) {
        const next = press(el('button', 'btn big'), () => h.onNext());
        next.innerHTML = 'Next night<span class="key">N</span>';
        rBtns.append(next);
        next.focus({ preventScroll: true });
      }
    } else el('div', 'w solid', rBtns, `Waiting for ${r.hostName}`);
  };
  ui.resultStar = (i, on) => starEls[i]?.classList.toggle('got', on);

  // ------------------------------------------------------------ the band
  const band = screens.band;
  ui.band = (kind, o = {}) => {
    band.textContent = '';
    if (!kind) {
      band.classList.remove('on');
      return;
    }
    band.classList.add('on');
    el('div', 'dim', band);
    const bar = el('div', 'bar', band);
    el('div', 'big slab lit', bar, o.title).style.setProperty('--rr', '170%');
    const btns = el('div', 'btns', bar);
    for (const b of o.buttons) {
      const btn = press(el('button', `btn ${b.big ? 'big' : 'quiet'}`, btns), b.fn);
      btn.innerHTML = b.key ? `${b.label}<span class="key">${b.key}</span>` : b.label;
    }
    btns.querySelector('.big')?.focus({ preventScroll: true });
  };

  // ------------------------------------------------------------ screens
  ui.show = (name) => {
    if (ui.cur === name) return;
    ui.cur = name;
    for (const [id, s] of Object.entries(screens)) if (id !== 'band') s.classList.toggle('on', id === name || (id === 'hud' && name === 'hud'));
  };
  ui.wipe = (x = 50, y = 50) => {
    if (h.reduced?.()) return;
    wipe.style.setProperty('--wx', `${x}%`);
    wipe.style.setProperty('--wy', `${y}%`);
    wipe.classList.remove('go');
    void wipe.offsetWidth;
    wipe.classList.add('go');
  };

  // Around the platform's own buttons (ui.insets keeps the numbers for the HUD's edge arrows).
  ui.insets = { top: 70, bot: 12 };
  ui.layout = (areas) => {
    const st = document.documentElement.style;
    if (!areas) {
      st.setProperty('--top-l', '70px');
      st.setProperty('--top-r', '12px');
      st.setProperty('--bot', '12px');
      st.setProperty('--stick', '0px');
      ui.insets = { top: 70, bot: 12 };
      return;
    }
    const W = window.innerWidth;
    const H = window.innerHeight;
    let topL = 0;
    let topR = 0;
    let bot = 0;
    let stick = 0;
    for (const a of areas) {
      if (a.y + a.h < H * 0.5) {
        if (a.x < W * 0.5) topL = Math.max(topL, a.y + a.h);
        else topR = Math.max(topR, a.y + a.h);
      } else if (a.kind !== 'stick') bot = Math.max(bot, H - a.y);
      else stick = Math.max(stick, H - a.y);
    }
    // The hint sits above the stick too (it spans the middle of a phone).
    st.setProperty('--stick', `${stick}px`);
    st.setProperty('--top-l', `${Math.max(12, topL)}px`);
    st.setProperty('--top-r', `${Math.max(12, topR)}px`);
    st.setProperty('--bot', `${Math.max(12, bot)}px`);
    ui.insets = { top: Math.max(12, topL), bot: Math.max(12, bot) };
  };
  return ui;
}
