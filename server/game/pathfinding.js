import { TILE } from './domain.js';

const DX = { UP: 0, DOWN: 0, LEFT: -1, RIGHT: 1 };
const DY = { UP: -1, DOWN: 1, LEFT: 0, RIGHT: 0 };

export { DX, DY };

/**
 * @param {number[][]} tiles
 * @param {Set<string>} blockedCells "x,y" occupied by blocking objects
 * @param {{x:number,y:number}} start
 * @param {{x:number,y:number}} goal
 * @returns {{x:number,y:number}[]|null}
 */
export function findPath(tiles, blockedCells, start, goal) {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  const key = (x, y) => `${x},${y}`;
  const inBounds = (x, y) => x >= 0 && x < w && y >= 0 && y < h;
  const walkable = (x, y) =>
    inBounds(x, y) &&
    tiles[y][x] !== TILE.WALL &&
    !blockedCells.has(key(x, y));

  if (!walkable(start.x, start.y) || !walkable(goal.x, goal.y)) return null;

  const open = [{ x: start.x, y: start.y, g: 0, f: 0 }];
  const came = new Map();
  const gScore = new Map([[key(start.x, start.y), 0]]);

  const heuristic = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift();
    const ck = key(cur.x, cur.y);
    if (cur.x === goal.x && cur.y === goal.y) {
      const path = [];
      let k = ck;
      while (k) {
        const [px, py] = k.split(',').map(Number);
        path.push({ x: px, y: py });
        k = came.get(k) ?? null;
      }
      path.reverse();
      return path;
    }
    for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT']) {
      const nx = cur.x + DX[dir];
      const ny = cur.y + DY[dir];
      if (!walkable(nx, ny)) continue;
      const nk = key(nx, ny);
      const tentative = cur.g + 1;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        came.set(nk, ck);
        gScore.set(nk, tentative);
        const f = tentative + heuristic(nx, ny);
        open.push({ x: nx, y: ny, g: tentative, f });
      }
    }
  }
  return null;
}

/**
 * 인접 타일 중 목표로 이동 가능한 첫 경로 (MOVE_OBJ용)
 */
export function pathToAdjacent(tiles, blockedCells, start, targetX, targetY) {
  const neighbors = [
    { x: targetX - 1, y: targetY },
    { x: targetX + 1, y: targetY },
    { x: targetX, y: targetY - 1 },
    { x: targetX, y: targetY + 1 },
  ];
  let best = null;
  let bestLen = Infinity;
  for (const g of neighbors) {
    const p = findPath(tiles, blockedCells, start, g);
    if (p && p.length < bestLen) {
      best = p;
      bestLen = p.length;
    }
  }
  return best;
}
