import { WEAPON, OBJECT_TYPES, TILE, MAP_IDS } from './domain.js';
import { getMap } from './maps.js';
import { DX, DY, pathToAdjacent, findPath } from './pathfinding.js';

/** @typedef {import('./domain.js').WeaponTier} WeaponTier */

/**
 * @typedef {Object} GameObject
 * @property {string} id
 * @property {string} type
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} GameState
 * @property {number} mapId
 * @property {{x:number,y:number}} player
 * @property {string} facing
 * @property {WeaponTier} weapon
 * @property {{wood:number, iron:number, essence:number}} inventory
 * @property {GameObject[]} objects
 * @property {boolean} gameOver
 * @property {boolean} victory
 * @property {string[]} log
 */

const DRAGON_LINES = [
  '드래곤: …누가 감히 내 영역에 발을 들이는가.',
  '드래곤: 더 가까이 오면 불길로 태워주지.',
];
const DEMON_LINES = [
  '마왕: 인간 주제에 감히 알현실을 밟다니.',
  '마왕: 준비는 됐느냐. 네 절망을 보여주마.',
];

function cloneState(s) {
  return JSON.parse(JSON.stringify(s));
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** 맵 타일 + 오브젝트 점유로 막힌 셀 계산 */
function blockingCellsFor(state, map) {
  const blocked = new Set();
  for (const o of state.objects) {
    if (o.type === OBJECT_TYPES.PORTAL) continue;
    if (o.type === OBJECT_TYPES.DRAGON_DEFEATED) continue;
    if (o.type === OBJECT_TYPES.DEMON_DEFEATED) continue;
    blocked.add(`${o.x},${o.y}`);
  }
  return blocked;
}

function objectAt(state, id) {
  return state.objects.find((o) => o.id === id);
}

function findObjByAlias(state, rawId) {
  const id = String(rawId).trim();
  const upper = id.toUpperCase();
  const byId = objectAt(state, id);
  if (byId) return byId;
  const lower = id.toLowerCase();
  const byLower = objectAt(state, lower);
  if (byLower) return byLower;
  // 타입 별칭: TREE -> 첫 나무 등
  const typeMap = {
    TREE: 'tree',
    ORE: 'ore',
    ANVIL: 'anvil',
    DRAGON: 'dragon',
    PORTAL: 'portal',
    DEMON: 'demon',
    DEMON_KING: 'demon',
  };
  const t = typeMap[upper];
  if (t) {
    if (t === 'demon') return state.objects.find((o) => o.type === OBJECT_TYPES.DEMON) ?? null;
    return state.objects.find((o) => o.type === t) ?? null;
  }
  return null;
}

export function createInitialState() {
  const m1 = getMap(MAP_IDS.FOREST);
  return {
    mapId: MAP_IDS.FOREST,
    player: { ...m1.spawn },
    facing: 'DOWN',
    weapon: WEAPON.HAND,
    inventory: { wood: 0, iron: 0, essence: 0 },
    objects: m1.objects.map((o) => ({ ...o })),
    gameOver: false,
    victory: false,
    log: [],
  };
}

export function resetState() {
  return createInitialState();
}

/**
 * 맵 전환 시 오브젝트 목록 교체
 */
function loadMapState(state, mapId) {
  const m = getMap(mapId);
  state.mapId = mapId;
  state.player = { ...m.spawn };
  state.objects = m.objects.map((o) => ({ ...o }));
}

/**
 * @param {GameState} state
 * @param {{type:string, [key:string]: unknown}} cmd
 * @returns {{ ok: boolean, error?: string, events?: unknown[], path?: {x:number,y:number}[] }}
 */
export function applyCommand(state, cmd) {
  const map = getMap(state.mapId);
  const tiles = map.tiles;
  const blocked = blockingCellsFor(state, map);
  const events = [];

  if (state.gameOver || state.victory) {
    return { ok: false, error: 'game_ended' };
  }

  switch (cmd.type) {
    case 'IDLE':
      return { ok: true, events: [{ type: 'idle' }] };

    case 'MOVE_DIR': {
      const dir = cmd.direction;
      const dist = Math.min(15, Math.max(0, Number(cmd.distance) || 0));
      if (dist === 0) return { ok: true, events: [{ type: 'move_dir', direction: dir, distance: 0, path: [] }] };
      const path = [];
      let { x, y } = state.player;
      for (let i = 0; i < dist; i++) {
        const nx = x + DX[dir];
        const ny = y + DY[dir];
        const cell = `${nx},${ny}`;
        if (
          ny < 0 ||
          ny >= tiles.length ||
          nx < 0 ||
          nx >= tiles[0].length ||
          tiles[ny][nx] === TILE.WALL ||
          blocked.has(cell)
        ) {
          break;
        }
        x = nx;
        y = ny;
        path.push({ x, y });
      }
      if (path.length) {
        state.player = { x, y };
        state.facing = dir;
      }
      return { ok: true, events: [{ type: 'move_dir', direction: dir, distance: path.length, path }] };
    }

    case 'MOVE_OBJ': {
      const target = findObjByAlias(state, cmd.objectId);
      if (!target) return { ok: false, error: 'unknown_object' };
      if (manhattan(state.player, target) === 1) {
        const dx = target.x - state.player.x;
        const dy = target.y - state.player.y;
        if (dx > 0) state.facing = 'RIGHT';
        else if (dx < 0) state.facing = 'LEFT';
        else if (dy < 0) state.facing = 'UP';
        else state.facing = 'DOWN';
        return { ok: true, events: [{ type: 'move_path', path: [] }] };
      }
      const pathFull = pathToAdjacent(tiles, blocked, state.player, target.x, target.y);
      if (!pathFull || pathFull.length < 2) return { ok: false, error: 'unreachable' };
      const steps = pathFull.slice(1);
      state.player = { x: steps[steps.length - 1].x, y: steps[steps.length - 1].y };
      const lastDx = steps[steps.length - 1].x - (steps[steps.length - 2]?.x ?? state.player.x);
      const lastDy = steps[steps.length - 1].y - (steps[steps.length - 2]?.y ?? state.player.y);
      if (lastDx > 0) state.facing = 'RIGHT';
      else if (lastDx < 0) state.facing = 'LEFT';
      else if (lastDy < 0) state.facing = 'UP';
      else state.facing = 'DOWN';
      return { ok: true, events: [{ type: 'move_path', path: steps }], path: steps };
    }

    case 'INTERACT': {
      const target = findObjByAlias(state, cmd.objectId);
      if (!target) return { ok: false, error: 'unknown_object' };
      if (manhattan(state.player, target) !== 1) return { ok: false, error: 'not_adjacent' };

      if (target.type === OBJECT_TYPES.TREE) {
        state.inventory.wood += 1;
        target.type = OBJECT_TYPES.TREE_STUMP;
        events.push({ type: 'gather', resource: 'wood', objectId: target.id });
        return { ok: true, events };
      }
      if (target.type === OBJECT_TYPES.TREE_STUMP) {
        return { ok: false, error: 'already_stump' };
      }
      if (target.type === OBJECT_TYPES.ORE) {
        state.inventory.iron += 1;
        target.type = OBJECT_TYPES.ORE_DEPLETED;
        events.push({ type: 'gather', resource: 'iron', objectId: target.id });
        return { ok: true, events };
      }
      if (target.type === OBJECT_TYPES.ORE_DEPLETED) {
        return { ok: false, error: 'ore_empty' };
      }
      if (target.type === OBJECT_TYPES.ANVIL) {
        if (state.weapon === WEAPON.HAND) {
          if (state.inventory.wood >= 3 && state.inventory.iron >= 3) {
            state.inventory.wood -= 3;
            state.inventory.iron -= 3;
            state.weapon = WEAPON.SWORD1;
            events.push({ type: 'craft', tier: 1 });
            return { ok: true, events };
          }
          events.push({ type: 'craft_fail', reason: 'need_wood3_iron3' });
          return { ok: true, events };
        }
        if (state.weapon === WEAPON.SWORD1) {
          if (state.inventory.essence >= 1) {
            state.inventory.essence -= 1;
            state.weapon = WEAPON.SWORD2;
            events.push({ type: 'craft', tier: 2 });
            return { ok: true, events };
          }
          events.push({ type: 'craft_fail', reason: 'need_essence' });
          return { ok: true, events };
        }
        events.push({ type: 'craft_fail', reason: 'already_final' });
        return { ok: true, events };
      }
      if (target.type === OBJECT_TYPES.ANVIL_DESTROYED) {
        return { ok: false, error: 'anvil_gone' };
      }
      if (target.type === OBJECT_TYPES.DRAGON) {
        const line = DRAGON_LINES[Math.floor(Math.random() * DRAGON_LINES.length)];
        events.push({ type: 'npc_line', objectId: target.id, text: line });
        return { ok: true, events };
      }
      if (target.type === OBJECT_TYPES.DRAGON_DEFEATED) {
        events.push({ type: 'npc_line', objectId: target.id, text: '드래곤은 이미 쓰러졌다.' });
        return { ok: true, events };
      }
      if (target.type === OBJECT_TYPES.DEMON) {
        const line = DEMON_LINES[Math.floor(Math.random() * DEMON_LINES.length)];
        events.push({ type: 'npc_line', objectId: target.id, text: line });
        return { ok: true, events };
      }
      if (target.type === OBJECT_TYPES.DEMON_DEFEATED) {
        events.push({ type: 'npc_line', objectId: target.id, text: '마왕은 이미 쓰러졌다.' });
        return { ok: true, events };
      }
      if (target.type === OBJECT_TYPES.PORTAL) {
        if (state.mapId !== MAP_IDS.FOREST) return { ok: false, error: 'no_portal' };
        loadMapState(state, MAP_IDS.DEMON);
        events.push({ type: 'map_change', mapId: MAP_IDS.DEMON });
        return { ok: true, events };
      }
      return { ok: false, error: 'cannot_interact' };
    }

    case 'ATTACK': {
      const target = findObjByAlias(state, cmd.objectId);
      if (!target) return { ok: false, error: 'unknown_object' };
      if (manhattan(state.player, target) !== 1) return { ok: false, error: 'not_adjacent' };

      if (target.type === OBJECT_TYPES.TREE) {
        const id = target.id;
        state.objects = state.objects.filter((o) => o.id !== id);
        events.push({ type: 'destroy', objectId: id });
        return { ok: true, events };
      }
      if (target.type === OBJECT_TYPES.ORE) {
        const id = target.id;
        state.objects = state.objects.filter((o) => o.id !== id);
        events.push({ type: 'destroy', objectId: id });
        return { ok: true, events };
      }
      if (target.type === OBJECT_TYPES.ANVIL) {
        const id = target.id;
        state.objects = state.objects.filter((o) => o.id !== id);
        events.push({ type: 'destroy', objectId: id });
        return { ok: true, events };
      }
      if (target.type === OBJECT_TYPES.DRAGON) {
        if (state.weapon !== WEAPON.SWORD1) {
          state.gameOver = true;
          events.push({ type: 'combat', win: false, targetId: target.id });
          return { ok: true, events };
        }
        const dragonId = target.id;
        state.inventory.essence += 1;
        state.objects = state.objects.filter((o) => o.id !== dragonId);
        events.push({ type: 'combat', win: true, targetId: dragonId }, { type: 'loot', resource: 'essence' });
        return { ok: true, events };
      }
      if (target.type === OBJECT_TYPES.DEMON) {
        if (state.weapon !== WEAPON.SWORD2) {
          state.gameOver = true;
          events.push({ type: 'combat', win: false, targetId: target.id });
          return { ok: true, events };
        }
        target.type = OBJECT_TYPES.DEMON_DEFEATED;
        state.victory = true;
        events.push({ type: 'combat', win: true, targetId: target.id }, { type: 'victory' });
        return { ok: true, events };
      }
      return { ok: false, error: 'cannot_attack' };
    }

    case 'MOVE_MAP': {
      const mid = Number(cmd.mapId);
      if (mid === MAP_IDS.DEMON && state.mapId === MAP_IDS.FOREST) {
        loadMapState(state, MAP_IDS.DEMON);
        events.push({ type: 'map_change', mapId: MAP_IDS.DEMON });
        return { ok: true, events };
      }
      if (mid === MAP_IDS.FOREST && state.mapId === MAP_IDS.DEMON) {
        loadMapState(state, MAP_IDS.FOREST);
        events.push({ type: 'map_change', mapId: MAP_IDS.FOREST });
        return { ok: true, events };
      }
      return { ok: false, error: 'invalid_map' };
    }

    default:
      return { ok: false, error: 'unknown_command' };
  }
}

/**
 * 상태 스냅샷에 대해 커맨드 배열 적용 (검증 + 최종 상태)
 * @param {GameState} baseState
 * @param {unknown[]} parsedCommands
 */
export function simulateCommands(baseState, parsedCommands) {
  const state = cloneState(baseState);
  const executed = [];
  const allEvents = [];
  /** @type {{ command: unknown, ok: boolean, error?: string, events: unknown[] }[]} */
  const steps = [];

  for (const c of parsedCommands) {
    const r = applyCommand(state, c);
    if (!r.ok) {
      allEvents.push({ type: 'command_failed', command: c, error: r.error });
      steps.push({ command: c, ok: false, error: r.error, events: [] });
      break;
    }
    executed.push(c);
    const ev = r.events ?? [];
    allEvents.push(...ev);
    steps.push({ command: c, ok: true, events: ev });
    if (state.gameOver || state.victory) break;
  }

  return { state, executed, events: allEvents, steps };
}

function weaponLabelForPrompt(w) {
  if (w === WEAPON.SWORD2) return '2차 검(최종, 드래곤 정수로 강화 완료)';
  if (w === WEAPON.SWORD1) return '1차 검(드래곤 처치 후 정수 1개 이상이면 모루에서 2차 검으로 강화 가능)';
  return '맨손(나무3·철3 있으면 모루에서 1차 검 제작)';
}

export function summarizeStateForPrompt(state) {
  const map = getMap(state.mapId);
  const lines = [
    `현재맵: ${map.name} (id=${state.mapId})`,
    `플레이어위치: (${state.player.x},${state.player.y})`,
    `무기코드: ${state.weapon} (${weaponLabelForPrompt(state.weapon)})`,
    `인벤토리: 나무=${state.inventory.wood}, 철=${state.inventory.iron}, 드래곤의정수=${state.inventory.essence}`,
    `모루규칙: 맨손+나무≥3+철≥3 → INTERACT(anvil)로 1차 검. 1차검+정수≥1 → INTERACT(anvil)로 2차 검. 강화/2차/정수로 검 업그레이드 요청 시 반드시 모루에 붙어 INTERACT(anvil).`,
    `오브젝트:`,
  ];
  for (const o of state.objects) {
    lines.push(`- id=${o.id} type=${o.type} pos=(${o.x},${o.y})`);
  }
  return lines.join('\n');
}

export { findPath, pathToAdjacent, blockingCellsFor };
