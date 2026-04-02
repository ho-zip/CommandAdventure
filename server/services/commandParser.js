import { DIRECTIONS } from '../game/domain.js';

/**
 * LLM 또는 수동 입력에서 커맨드 객체 배열로 정제
 * 허용: MOVE_DIR(UP,3) MOVE_OBJ(anvil) INTERACT(tree_1) ATTACK(dragon) MOVE_MAP(2) IDLE()
 */

const DIR_SET = new Set(DIRECTIONS);

function stripNoise(s) {
  return s
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\r/g, '')
    .trim();
}

/**
 * @param {string} raw
 * @returns {unknown[]}
 */
export function parseCommandString(raw) {
  const text = stripNoise(raw);
  const out = [];
  const re =
    /\b(MOVE_DIR)\(\s*([A-Z]+)\s*,\s*(\d+)\s*\)|\b(MOVE_OBJ|INTERACT|ATTACK)\(\s*([a-zA-Z0-9_]+)\s*\)|\b(MOVE_MAP)\(\s*(\d+)\s*\)|\b(IDLE)\(\s*\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1] === 'MOVE_DIR') {
      const dir = m[2];
      const dist = parseInt(m[3], 10);
      if (DIR_SET.has(dir)) out.push({ type: 'MOVE_DIR', direction: dir, distance: dist });
    } else if (m[4] && m[5]) {
      const kind = m[4];
      const id = m[5];
      if (kind === 'MOVE_OBJ') out.push({ type: 'MOVE_OBJ', objectId: id });
      else if (kind === 'INTERACT') out.push({ type: 'INTERACT', objectId: id });
      else if (kind === 'ATTACK') out.push({ type: 'ATTACK', objectId: id });
    } else if (m[6] === 'MOVE_MAP') {
      out.push({ type: 'MOVE_MAP', mapId: parseInt(m[7], 10) });
    } else if (m[8] === 'IDLE') {
      out.push({ type: 'IDLE' });
    }
  }
  return out;
}

/**
 * JSON 배열 문자열이면 파싱 시도
 * @param {string} content
 */
export function parseLlmCommandPayload(content) {
  const trimmed = content.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        return arr.flatMap((x) => {
          if (typeof x === 'string') return parseCommandString(x);
          if (x && typeof x === 'object' && x.type) return [x];
          return [];
        });
      }
    } catch {
      /* fall through */
    }
  }
  return parseCommandString(trimmed);
}
