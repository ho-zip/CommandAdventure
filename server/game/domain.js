/** @typedef {'hand'|'sword1'|'sword2'} WeaponTier */

export const WEAPON = {
  HAND: 'hand',
  SWORD1: 'sword1',
  SWORD2: 'sword2',
};

/** 오브젝트 타입 (에셋/렌더 키와 연동) */
export const OBJECT_TYPES = {
  TREE: 'tree',
  TREE_STUMP: 'tree_stump',
  ORE: 'ore',
  ORE_DEPLETED: 'ore_depleted',
  ANVIL: 'anvil',
  ANVIL_DESTROYED: 'anvil_destroyed',
  DRAGON: 'dragon',
  DRAGON_DEFEATED: 'dragon_defeated',
  DEMON: 'demon',
  DEMON_DEFEATED: 'demon_defeated',
  PORTAL: 'portal',
};

export const DIRECTIONS = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

export const MAP_IDS = {
  FOREST: 1,
  DEMON: 2,
};

/** 타일: 바닥 / 벽 */
export const TILE = {
  FLOOR: 0,
  WALL: 1,
};
