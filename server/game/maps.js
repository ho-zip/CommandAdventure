import { MAP_IDS, TILE } from './domain.js';

const SIZE = 15;

function emptyGrid(fill = TILE.FLOOR) {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(fill));
}

/** 외곽 벽 + 내부 장애물 일부 (TLS_02 개념) */
function ringWall(grid) {
  for (let i = 0; i < SIZE; i++) {
    grid[0][i] = TILE.WALL;
    grid[SIZE - 1][i] = TILE.WALL;
    grid[i][0] = TILE.WALL;
    grid[i][SIZE - 1] = TILE.WALL;
  }
  return grid;
}

/** Map 1: 평화의 숲 — 15x15 */
export const mapForest = {
  id: MAP_IDS.FOREST,
  name: 'peaceful_forest',
  size: SIZE,
  tiles: ringWall(emptyGrid(TILE.FLOOR)),
  /** 플레이어 시작: 최하단 중앙 */
  spawn: { x: 7, y: 13 },
  objects: [
    { id: 'anvil', type: 'anvil', x: 7, y: 10 },
    { id: 'tree_1', type: 'tree', x: 3, y: 8 },
    { id: 'tree_2', type: 'tree', x: 4, y: 5 },
    { id: 'tree_3', type: 'tree', x: 11, y: 8 },
    { id: 'tree_4', type: 'tree', x: 10, y: 5 },
    { id: 'ore_1', type: 'ore', x: 2, y: 11 },
    { id: 'ore_2', type: 'ore', x: 12, y: 11 },
    { id: 'ore_3', type: 'ore', x: 5, y: 7 },
    { id: 'ore_4', type: 'ore', x: 9, y: 7 },
    { id: 'dragon', type: 'dragon', x: 1, y: 1 },
    /** 포탈: 북쪽 중앙, Map2 이동 */
    { id: 'portal', type: 'portal', x: 7, y: 1 },
  ],
};

/** Map 2: 마왕 — 자원/모루 없음 */
export const mapDemon = {
  id: MAP_IDS.DEMON,
  name: 'demon_arena',
  size: SIZE,
  tiles: ringWall(emptyGrid(TILE.FLOOR)),
  spawn: { x: 7, y: 13 },
  objects: [{ id: 'demon_king', type: 'demon', x: 7, y: 2 }],
};

export const MAPS = {
  [MAP_IDS.FOREST]: mapForest,
  [MAP_IDS.DEMON]: mapDemon,
};

export function getMap(mapId) {
  return MAPS[mapId] ?? mapForest;
}
