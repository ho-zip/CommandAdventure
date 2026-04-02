/**
 * 서버/클라이언트 공통 커맨드 규격 (문서화 + 런타임 힌트)
 * 실제 파싱은 서버 commandParser.js
 */
export const COMMAND_KINDS = [
  'MOVE_DIR',
  'MOVE_OBJ',
  'INTERACT',
  'ATTACK',
  'MOVE_MAP',
  'IDLE',
];

/** @typedef {{type:'MOVE_DIR', direction:'UP'|'DOWN'|'LEFT'|'RIGHT', distance:number}} CmdMoveDir */
/** @typedef {{type:'MOVE_OBJ', objectId:string}} CmdMoveObj */
/** @typedef {{type:'INTERACT', objectId:string}} CmdInteract */
/** @typedef {{type:'ATTACK', objectId:string}} CmdAttack */
/** @typedef {{type:'MOVE_MAP', mapId:number}} CmdMoveMap */
/** @typedef {{type:'IDLE'}} CmdIdle */
/** @typedef {CmdMoveDir|CmdMoveObj|CmdInteract|CmdAttack|CmdMoveMap|CmdIdle} GameCommand */
