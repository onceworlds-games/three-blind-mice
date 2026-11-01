// Every screen on top of the 3D view: the title, the lobby (night strip, the party, the night card), the intro, the HUD
// painted onto the night (the dawn clock, the tally, hints, arrows to the goal and to friends, names), the results, and the
// band for pause and a closed room. Plain DOM, laid out around the platform's own buttons.

import { NIGHTS } from './core/levels.js';
import { SEAT_CSS, SEAT_SHAPES, seatSvg } from './render/echo.js';
import { HINTS } from './hints.js';
import { GLASSES } from './render/actors.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (tag, cls, parent, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
};
const CHECK = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// What each night teaches, as the lobby card says it.
const TEACH = { ...HINTS, creak: 'Mind the creaky boards', trap: 'Traps go snap', wheel: 'Roll a whole wheel', roam: 'The cat walks about', torch: "Dodge the farmer's torch", two: 'Two of them tonight', all: 'Everything at once' };
const STAR_PATH = 'M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z';
export const starSvg = (on, size = 26, color = '#FFD23F') =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="${STAR_PATH}" fill="${on ? color : 'none'}" stroke="${on ? color : 'rgba(255,241,214,0.55)'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const wedgeSvg = (on) => `<svg viewBox="0 0 34 26"><path d="M3 22 L31 22 L3 5 Z" fill="${on ? '#FFD23F' : 'rgba(12,13,24,0.5)'}" stroke="#FFD23F" stroke-width="2.4" stroke-linejoin="round"/>${on ? '<circle cx="10" cy="17" r="2.2" fill="#C28F0A"/><circle cx="16" cy="19" r="1.4" fill="#C28F0A"/>' : ''}</svg>`;
const wheelSvg = (on) => `<svg viewBox="0 0 34 26"><circle cx="17" cy="13" r="10.5" fill="${on ? '#FFD23F' : 'rgba(12,13,24,0.5)'}" stroke="#FFD23F" stroke-width="2.4"/><circle cx="17" cy="13" r="4" fill="none" stroke="${on ? '#C28F0A' : '#FFD23F'}" stroke-width="1.6"/></svg>`;
const lockSvg = '<svg viewBox="0 0 20 20"><rect x="4" y="9" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const archSvg = '<path d="M-7 6 L-7 -1 A7 7 0 0 1 7 -1 L7 6 Z" fill="#FF9A3C" stroke="#0C0D18" stroke-width="1.5"/>';
const cheeseIcon = '<path d="M-8 5 L8 5 L-8 -5 Z" fill="#FFD23F" stroke="#0C0D18" stroke-width="1.5" stroke-linejoin="round"/>';

export const fmtTime = (s) => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

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

  // ------------------------------------------------------------ title
  const tName = el('div', 'name slab lit', screens.title);
  tName.innerHTML = '<span>Three </span><span>Blind </span><span>Mice</span>';
  const tRow = el('div', 'row', screens.title);
  const playBtn = press(el('button', 'btn big pulse', tRow, 'Play'), () => h.onPlay());
  const tStars = el('div', 'stars', tRow);
  ui.title = ({ stars }) => {
    tStars.innerHTML = stars > 0 ? `${starSvg(true, 28)} <span style="vertical-align:5px">${stars}</span>` : '';
  };
  ui.lightTitle = (x, r) => {
    tName.style.setProperty('--rx', `${x}%`);
    tName.style.setProperty('--rr', `${r}%`);
  };
  ui.playButton = playBtn;

  // ------------------------------------------------------------ lobby
  const strip = el('div', 'strip tap', screens.lobby);
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
  const cAct = el('div', 'wait', card);
  const startBtn = press(el('button', 'btn big'), () => h.onStart());
  const readyBtn = press(el('button', 'btn big'), () => h.onReady());
  const waitTxt = el('span', 'solid');
  let lobbyKey = '';
  ui.lobby = (s) => {
    const key = JSON.stringify(s);
    if (key === lobbyKey) return;
    lobbyKey = key;
    tiles.forEach((b, i) => {
      const n = i + 1;
      const locked = n > s.unlocked;
      b.classList.toggle('sel', n === s.pick);
      b.classList.toggle('locked', locked);
      b.disabled = !s.isHost || locked;
      b.style.pointerEvents = s.isHost && !locked ? 'auto' : 'none';
      const st = s.stars[i] ?? 0;
      b.innerHTML = locked ? `${lockSvg}` : `${n}<small>${starSvg(true, 12).repeat(st)}</small>`;
      b.setAttribute('aria-label', `Night ${n}${locked ? ', locked' : ''}`);
    });
    const night = NIGHTS[s.pick - 1];
    cN.textContent = `Night ${s.pick}`;
    cTitle.textContent = night.name;
    cTeach.textContent = TEACH[night.teach] ?? '';
    const st = s.stars[s.pick - 1] ?? 0;
    cMeta.innerHTML = `<span class="starrow">${starSvg(st >= 1)}${starSvg(st >= 2)}${starSvg(st >= 3)}</span>${s.best[s.pick - 1] ? `<span>Best ${fmtTime(s.best[s.pick - 1])}</span>` : ''}`;
    cAct.textContent = '';
    if (s.isHost) {
      startBtn.innerHTML = `Start<span class="key">Enter</span>`;
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
        el('b', '', who, p.me ? `${p.name} (you)` : p.name);
        const tag = el('i', '', who);
        tag.innerHTML = seatSvg(i, 14);
        tag.append(` ${p.host ? 'Host' : GLASSES[p.g]?.name ?? ''}`);
        if (p.ready || p.host) el('div', 'ok', seat).innerHTML = CHECK;
        if (p.me) {
          seat.title = 'Change glasses';
          press(seat, () => h.onGlasses());
          tag.lastChild.textContent = ` ${GLASSES[p.g]?.name ?? ''} glasses`;
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

  // ------------------------------------------------------------ intro and morning
  const iBox = el('div', 'banner', screens.intro);
  const iSmall = el('div', 'small', iBox);
  const iBig = el('div', 'big slab lit', iBox);
  ui.intro = (night) => {
    iSmall.textContent = `Night ${night.id}`;
    iBig.textContent = night.name;
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

  function pooled(pool, make, n) {
    while (pool.length < n) pool.push(make());
    for (let i = 0; i < pool.length; i++) pool[i].style.display = i < n ? '' : 'none';
    return pool;
  }

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
    const tk = s.items.map((i) => `${i.k}${i.home ? 1 : 0}`).join('');
    if (tk !== lastTally) {
      lastTally = tk;
      tallyEl.innerHTML = s.items.map((i) => (i.k === 'W' ? wheelSvg(i.home) : wedgeSvg(i.home))).join('');
    }
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

  // ------------------------------------------------------------ results
  const res = screens.results;
  const rHead = el('div', 'head', res);
  const rBig = el('div', 'big slab lit', rHead);
  rBig.style.setProperty('--rr', '170%');
  const rSub = el('div', 'sub solid', rHead);
  const rStars = el('div', 'stars3', rHead);
  const rRows = el('div', 'rows solid', res);
  const rBtns = el('div', 'btns', res);
  const starEls = ['Cheese home', 'All the cheese', 'Every tail'].map((label) => {
    const d = el('div', 'st solid', rStars);
    d.innerHTML = `${starSvg(true, 52)}<span>${label}</span>`;
    return d;
  });
  ui.results = (r) => {
    rBig.textContent = r.home > 0 ? 'Morning' : 'Dawn';
    const parts = [];
    if (r.home === 0) parts.push('No cheese');
    else parts.push(`${r.home} of ${r.total} home`);
    if (r.all) parts.push(`${fmtTime(r.time)}${r.best ? `  ·  Best ${fmtTime(r.best)}` : ''}`);
    rSub.textContent = parts.join('  ·  ');
    starEls.forEach((s, i) => s.classList.remove('got'));
    rRows.textContent = '';
    if (r.rows.length > 1) {
      for (const row of r.rows) {
        const d = el('div', '', rRows);
        d.innerHTML = `<span>${seatSvg(row.seat, 16)}</span>`;
        el('span', '', d, row.name + (row.me ? ' (you)' : ''));
        el('span', '', d, `${row.home} home`);
        el('span', '', d, row.tail ? 'tail' : 'bandaged');
      }
    }
    rBtns.textContent = '';
    if (r.isHost) {
      const nextOk = r.next && r.home > 0;
      const again = press(el('button', `btn ${nextOk ? 'quiet' : 'big'}`, null), () => h.onAgain());
      again.innerHTML = 'Again<span class="key">R</span>';
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
