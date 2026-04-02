import { MAP_IDS } from './mapsData.js';

/** 서버 초기 상태와 동일 (로컬 폴백) */
export function createLocalInitialState() {
  return {
    mapId: MAP_IDS.FOREST,
    player: { x: 7, y: 13 },
    facing: 'DOWN',
    weapon: 'hand',
    inventory: { wood: 0, iron: 0, essence: 0 },
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
      { id: 'portal', type: 'portal', x: 7, y: 1 },
    ],
    gameOver: false,
    victory: false,
    log: [],
  };
}
