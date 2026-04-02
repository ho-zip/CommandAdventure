import { preloadAssets, ASSET_KEYS, getImage } from './assets.js';
import { Renderer } from './renderer.js';
import { playSteps } from './executor.js';
import { postChat, postReset } from './network.js';
import { createLocalInitialState } from './gameState.js';

const els = {
  map: document.getElementById('map'),
  player: document.getElementById('player'),
  bubble: document.getElementById('bubble'),
  chatLog: document.getElementById('chat-log'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input'),
  restart: document.getElementById('btn-restart'),
  help: document.getElementById('btn-help'),
  helpOverlay: document.getElementById('help-overlay'),
  helpClose: document.getElementById('btn-help-close'),
  loading: document.getElementById('loading'),
  overlay: document.getElementById('overlay'),
  overlayText: document.getElementById('overlay-text'),
  invWood: document.getElementById('inv-wood'),
  invIron: document.getElementById('inv-iron'),
  invEss: document.getElementById('inv-ess'),
  invIconWood: document.getElementById('inv-icon-wood'),
  invIconIron: document.getElementById('inv-icon-iron'),
  invIconEss: document.getElementById('inv-icon-ess'),
  eqSlot: document.getElementById('eq-weapon'),
  eqLabel: document.getElementById('eq-label'),
};

let gameState = createLocalInitialState();
let busy = false;
const renderer = new Renderer(els.map, els.player, els.bubble);

function logLine(role, text) {
  const p = document.createElement('p');
  p.className = `log-line ${role}`;
  p.textContent = text;
  els.chatLog.appendChild(p);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function weaponLabel(w) {
  if (w === 'sword2') return '2차 검';
  if (w === 'sword1') return '1차 검';
  return '맨손';
}

function applyInvSlotIcon(el, assetKey) {
  if (!el) return;
  const img = getImage(assetKey);
  if (img) {
    el.classList.add('inv-icon--asset');
    el.style.backgroundImage = `url(${ASSET_KEYS[assetKey]})`;
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'center';
  } else {
    el.classList.remove('inv-icon--asset');
    el.style.backgroundImage = '';
    el.style.backgroundSize = '';
    el.style.backgroundRepeat = '';
    el.style.backgroundPosition = '';
  }
}

function updateHud() {
  els.invWood.textContent = String(gameState.inventory.wood);
  els.invIron.textContent = String(gameState.inventory.iron);
  els.invEss.textContent = String(gameState.inventory.essence);
  applyInvSlotIcon(els.invIconWood, 'ITC_01');
  applyInvSlotIcon(els.invIconIron, 'ITC_02');
  applyInvSlotIcon(els.invIconEss, 'ITC_03');
  if (els.eqLabel) els.eqLabel.textContent = weaponLabel(gameState.weapon);
  const w = gameState.weapon;
  const key = w === 'sword2' ? 'ITC_06' : w === 'sword1' ? 'ITC_05' : 'ITC_04';
  const img = getImage(key);
  els.eqSlot.style.backgroundImage = img ? `url(${ASSET_KEYS[key]})` : '';
  els.eqSlot.style.backgroundSize = 'contain';
}

function showOverlay(text) {
  els.overlayText.textContent = text;
  els.overlay.hidden = false;
}

function hideOverlay() {
  els.overlay.hidden = true;
}

function showHelpOverlay() {
  if (!els.helpOverlay) return;
  els.helpOverlay.hidden = false;
  els.helpOverlay.setAttribute('aria-hidden', 'false');
}

function hideHelpOverlay() {
  if (!els.helpOverlay) return;
  els.helpOverlay.hidden = true;
  els.helpOverlay.setAttribute('aria-hidden', 'true');
}

function setBusy(on) {
  busy = on;
  els.chatInput.disabled = on;
  renderer.setThinking(on);
}

async function restart() {
  setBusy(true);
  try {
    const { gameState: s } = await postReset();
    gameState = s;
    hideOverlay();
    renderer.setBubbleText('');
    renderer.renderFull(gameState);
    updateHud();
    logLine('sys', '맵을 초기화했습니다.');
  } catch {
    gameState = createLocalInitialState();
    renderer.renderFull(gameState);
    updateHud();
    logLine('sys', '서버 없이 로컬 상태로 초기화했습니다.');
  }
  setBusy(false);
}

async function onSubmit(e) {
  e.preventDefault();
  if (busy) return;
  const text = els.chatInput.value.trim();
  if (!text) return;
  els.chatInput.value = '';
  logLine('user', text);
  setBusy(true);
  renderer.setBubbleText('');
  try {
    const res = await postChat(text, gameState);
    logLine('char', res.reply || '…');
    await playSteps(res.steps || [], renderer, { msPerTile: 105 });
    gameState = res.gameState;
    renderer.renderFull(gameState);
    renderer.setBubbleText(res.reply || '', { autoHideMs: 3000 });
    updateHud();
    if (gameState.victory) showOverlay('승리! 마왕을 쓰러뜨렸습니다.\n재시작으로 새 게임을 시작할 수 있습니다.');
    else if (gameState.gameOver) showOverlay('게임 오버\n재시작을 눌러 처음부터 다시 도전하세요.');
  } catch (err) {
    logLine('sys', `오류: ${err.message}`);
  }
  setBusy(false);
}

function setupPlayerSprite() {
  const img = getImage('CHR_01');
  if (img) els.player.style.backgroundImage = `url(${ASSET_KEYS.CHR_01})`;
  els.player.style.backgroundSize = 'contain';
  els.player.style.backgroundRepeat = 'no-repeat';
  els.player.style.backgroundPosition = 'center';
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function boot() {
  els.loading.hidden = false;
  await preloadAssets();
  setupPlayerSprite();
  try {
    const { gameState: s } = await postReset();
    gameState = s;
  } catch {
    gameState = createLocalInitialState();
  }
  renderer.renderFull(gameState);
  updateHud();
  els.loading.hidden = true;
  els.chatForm.addEventListener('submit', onSubmit);
  els.restart.addEventListener('click', () => restart());
  if (els.help) els.help.addEventListener('click', () => showHelpOverlay());
  if (els.helpClose) els.helpClose.addEventListener('click', () => hideHelpOverlay());
  window.addEventListener(
    'resize',
    debounce(() => {
      renderer.renderFull(gameState);
    }, 120)
  );
}

boot();
