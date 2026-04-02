import { getMap, TILE } from './mapsData.js';
import { getObjectAssetKey, getImage, ASSET_KEYS } from './assets.js';

/** 타일 한 변에 대해 플레이어 스프라이트 비율 (타일보다 약간 크게 보이도록) */
/** 타일 대비 플레이어 박스 크기 (기존 대비 2배에 가깝게 보이도록) */
const PLAYER_TILE_RATIO = 2.36;
/** 드래곤/마왕 시각적 배율 (타일 격자는 동일, 스프라이트만 확대) */
const BOSS_TILE_SCALE = 1.95;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isBossObjectType(type) {
  return type === 'dragon' || type === 'dragon_defeated' || type === 'demon' || type === 'demon_defeated';
}

export class Renderer {
  /**
   * @param {HTMLElement} mapEl
   * @param {HTMLElement} playerEl
   * @param {HTMLElement} bubbleEl
   */
  constructor(mapEl, playerEl, bubbleEl) {
    this.mapEl = mapEl;
    this.playerEl = playerEl;
    this.bubbleEl = bubbleEl;
    this.tilePx = 40;
    this.objectEls = new Map();
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._bubbleHideTimer = null;
  }

  clearBubbleAutoHide() {
    if (this._bubbleHideTimer != null) {
      clearTimeout(this._bubbleHideTimer);
      this._bubbleHideTimer = null;
    }
  }

  /** CSS `:root { --tile }` 기준으로 픽셀 크기 갱신 */
  _refreshTilePx() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--tile').trim();
    const m = raw.match(/^([\d.]+)px$/i);
    this.tilePx = m ? parseFloat(m[1], 10) : 40;
  }

  setThinking(on) {
    if (on) this.clearBubbleAutoHide();
    this.bubbleEl.classList.toggle('thinking', on);
    if (on) {
      this.bubbleEl.textContent = '생각 중...';
      this.bubbleEl.hidden = false;
    } else {
      this.bubbleEl.classList.remove('thinking');
      if (!this.bubbleEl.dataset.pinned) {
        this.bubbleEl.textContent = '';
        this.bubbleEl.hidden = true;
      }
    }
    this._positionBubble();
  }

  /**
   * @param {string} text
   * @param {{ autoHideMs?: number }} [opts]
   */
  setBubbleText(text, opts = {}) {
    this.clearBubbleAutoHide();
    if (text) {
      this.bubbleEl.dataset.pinned = '1';
      this.bubbleEl.hidden = false;
      this.bubbleEl.classList.remove('thinking');
      this.bubbleEl.textContent = text;
      const ms = opts.autoHideMs;
      if (typeof ms === 'number' && ms > 0) {
        this._bubbleHideTimer = setTimeout(() => {
          this._bubbleHideTimer = null;
          if (this.bubbleEl.classList.contains('thinking')) return;
          delete this.bubbleEl.dataset.pinned;
          this.bubbleEl.textContent = '';
          this.bubbleEl.hidden = true;
          this._positionBubble();
        }, ms);
      }
    } else {
      delete this.bubbleEl.dataset.pinned;
      this.bubbleEl.textContent = '';
      this.bubbleEl.hidden = true;
    }
    this._positionBubble();
  }

  _positionBubble() {
    const p = this.playerEl.getBoundingClientRect();
    const root = this.mapEl.getBoundingClientRect();
    const bubble = this.bubbleEl;
    bubble.style.left = `${p.left - root.left + p.width / 2}px`;
    bubble.style.top = `${p.top - root.top - 8}px`;
  }

  _bgTile(cell, key, kind) {
    const img = getImage(key);
    if (!img) return;
    cell.style.backgroundImage = `url(${ASSET_KEYS[key]})`;
    if (kind === 'floor') {
      cell.style.backgroundRepeat = 'repeat';
      cell.style.backgroundSize = `${this.tilePx}px ${this.tilePx}px`;
      cell.style.backgroundPosition = '0 0';
    } else {
      cell.style.backgroundRepeat = 'no-repeat';
      cell.style.backgroundSize = 'cover';
      cell.style.backgroundPosition = 'center';
    }
  }

  /**
   * @param {HTMLElement} el
   * @param {{ x:number, y:number, type:string }} o
   */
  _layoutObjectEl(el, o) {
    const t = this.tilePx;
    el.classList.toggle('entity-boss', isBossObjectType(o.type));
    if (isBossObjectType(o.type)) {
      const w = t * BOSS_TILE_SCALE;
      const h = t * BOSS_TILE_SCALE;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.left = `${(o.x + 0.5) * t - w / 2}px`;
      el.style.top = `${(o.y + 1) * t - h}px`;
    } else {
      el.style.width = `${t}px`;
      el.style.height = `${t}px`;
      el.style.left = `${o.x * t}px`;
      el.style.top = `${o.y * t}px`;
    }
  }

  _applyObjectSprite(el, o) {
    if (o.type === 'portal') {
      el.style.backgroundImage = '';
      el.style.backgroundSize = '';
      el.style.backgroundRepeat = '';
      el.style.backgroundPosition = '';
      return;
    }
    const key = getObjectAssetKey(o.type);
    const img = getImage(key);
    if (img) {
      el.style.backgroundImage = `url(${ASSET_KEYS[key]})`;
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'center bottom';
    } else {
      el.style.backgroundImage = '';
    }
  }

  /** @param {Record<string, unknown>} state */
  renderFull(state) {
    this._refreshTilePx();
    this.mapEl.innerHTML = '';
    this.objectEls.clear();
    const map = getMap(state.mapId);
    const t = this.tilePx;
    this.mapEl.style.gridTemplateColumns = `repeat(${map.size}, ${t}px)`;
    this.mapEl.style.gridTemplateRows = `repeat(${map.size}, ${t}px)`;
    this.mapEl.style.width = `${map.size * t}px`;
    this.mapEl.style.height = `${map.size * t}px`;

    for (let y = 0; y < map.size; y++) {
      for (let x = 0; x < map.size; x++) {
        const cell = document.createElement('div');
        cell.className = 'tile';
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        if (map.tiles[y][x] === TILE.WALL) {
          cell.classList.add('tile-wall');
          this._bgTile(cell, 'TLS_02', 'wall');
        } else {
          cell.classList.add('tile-floor');
          this._bgTile(cell, 'TLS_01', 'floor');
        }
        this.mapEl.appendChild(cell);
      }
    }

    for (const o of state.objects) {
      const el = document.createElement('div');
      el.className = `entity obj ${o.type}`;
      el.dataset.id = o.id;
      this._layoutObjectEl(el, o);
      this._applyObjectSprite(el, o);
      if (o.type === 'portal') {
        const label = document.createElement('span');
        label.className = 'portal-label';
        label.textContent = '마왕 무찌르러가기';
        el.appendChild(label);
      }
      this.mapEl.appendChild(el);
      this.objectEls.set(o.id, el);
    }

    this._placePlayer(state.player);
    this.setFacing(state.facing || 'DOWN');
    this._positionBubble();
  }

  _placePlayer(pos) {
    const t = this.tilePx;
    const w = t * PLAYER_TILE_RATIO;
    const h = t * PLAYER_TILE_RATIO;
    const insetX = (t - w) / 2;
    const insetY = (t - h) / 2;
    this.playerEl.style.width = `${w}px`;
    this.playerEl.style.height = `${h}px`;
    this.playerEl.style.left = `${pos.x * t + insetX}px`;
    this.playerEl.style.top = `${pos.y * t + insetY}px`;
  }

  setFacing(dir) {
    this.playerEl.classList.remove('face-left');
    if (dir === 'LEFT') this.playerEl.classList.add('face-left');
  }

  async animatePath(path, msPerTile = 110) {
    if (!path?.length) return;
    this.playerEl.classList.add('bobbing');
    for (const step of path) {
      this._placePlayer(step);
      this._positionBubble();
      await sleep(msPerTile);
    }
    this.playerEl.classList.remove('bobbing');
  }

  async pulseObject(objectId) {
    const el = this.objectEls.get(objectId);
    if (!el) return;
    el.classList.add('pulse');
    await sleep(280);
    el.classList.remove('pulse');
  }

  async shakeObject(objectId) {
    const el = this.objectEls.get(objectId);
    if (!el) return;
    el.classList.add('shake');
    await sleep(420);
    el.classList.remove('shake');
  }

  setAttackPose(on) {
    this.playerEl.classList.toggle('attack-pose', on);
    const img = getImage('CHR_02');
    if (img) {
      this.playerEl.style.backgroundImage = on ? `url(${ASSET_KEYS.CHR_02})` : `url(${ASSET_KEYS.CHR_01})`;
    }
  }

  async lungeToward(objectId, ms = 200) {
    const el = this.objectEls.get(objectId);
    if (!el) return;
    const ox = parseFloat(el.style.left);
    const oy = parseFloat(el.style.top);
    const ow = parseFloat(el.style.width) || this.tilePx;
    const oh = parseFloat(el.style.height) || this.tilePx;
    const px = parseFloat(this.playerEl.style.left);
    const py = parseFloat(this.playerEl.style.top);
    const pw = parseFloat(this.playerEl.style.width) || this.tilePx;
    const ph = parseFloat(this.playerEl.style.height) || this.tilePx;
    const tcx = ox + ow / 2;
    const tcy = oy + oh / 2;
    const pcx = px + pw / 2;
    const pcy = py + ph / 2;
    const mx = px + (tcx - pcx) * 0.35;
    const my = py + (tcy - pcy) * 0.35;
    const prev = { left: this.playerEl.style.left, top: this.playerEl.style.top };
    this.playerEl.style.transition = `left ${ms}ms ease-out, top ${ms}ms ease-out`;
    this.playerEl.style.left = `${mx}px`;
    this.playerEl.style.top = `${my}px`;
    await sleep(ms);
    this.playerEl.style.left = prev.left;
    this.playerEl.style.top = prev.top;
    await sleep(ms);
    this.playerEl.style.transition = '';
  }

  syncObjectsFromState(state) {
    for (const o of state.objects) {
      const el = this.objectEls.get(o.id);
      if (!el) continue;
      el.className = `entity obj ${o.type}`;
      this._layoutObjectEl(el, o);
      this._applyObjectSprite(el, o);
    }
  }

  updatePlayerFromState(player, facing) {
    this._placePlayer(player);
    if (facing) this.setFacing(facing);
    this._positionBubble();
  }
}

/** @deprecated CSS --tile 사용 */
export const TILE_PX = 40;
