import { loadPrompts } from './promptLoader.js';
import { parseLlmCommandPayload } from './commandParser.js';
import { simulateCommands, summarizeStateForPrompt } from '../game/engine.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function logSection(title, payload) {
  console.log(`[CommandAdventure][LLM] ${title}`, payload);
}

/** 2차 대사/휴리스틱용 — 내부 object_id 를 일반 명칭으로만 표현 */
function objectIdToFriendlyLabel(objectId) {
  if (!objectId || typeof objectId !== 'string') return '대상';
  if (objectId.startsWith('tree_')) return '나무';
  if (objectId.startsWith('ore_')) return '광맥';
  if (objectId === 'anvil') return '모루';
  if (objectId === 'dragon') return '드래곤';
  if (objectId === 'portal') return '포탈';
  if (objectId === 'demon_king') return '마왕';
  return '대상';
}

function directionToKorean(dir) {
  const m = { UP: '위', DOWN: '아래', LEFT: '왼쪽', RIGHT: '오른쪽' };
  return m[dir] || '방향';
}

/** 엔진 오류 코드 → 플레이어에게 보여줄 한국어 (내부 코드 문자열 노출 방지) */
function humanizeCommandError(code) {
  const c = code && String(code);
  const table = {
    game_ended: '이미 이 판은 끝난 상태라서',
    unknown_object: '그런 대상은 여기 없어서',
    unreachable: '길이 막혀 가까이 가지 못해서',
    not_adjacent: '바로 옆에 붙어 있지 않아서',
    already_stump: '이미 베어진 나무라서',
    ore_empty: '이미 캐 낸 광맥이라서',
    anvil_gone: '모루를 쓸 수 없어서',
    no_portal: '지금은 포탈을 쓸 수 없어서',
    cannot_interact: '지금은 거기와 상호작용할 수 없어서',
    cannot_attack: '지금은 공격할 수 없어서',
    invalid_map: '그 맵으로는 갈 수 없어서',
    unknown_command: '명령을 이해하지 못해서',
  };
  return table[c] ?? '조건이 맞지 않아서';
}

/**
 * 확정 커맨드 배열을 내부 id 없이 자연어 줄로 요약 (2차 LLM 입력용)
 * @param {unknown[]} executed
 */
function summarizeExecutedForReply(executed) {
  if (!Array.isArray(executed) || executed.length === 0) return '(없음)';
  const lines = [];
  for (const c of executed) {
    if (!c || typeof c !== 'object' || !c.type) continue;
    switch (c.type) {
      case 'MOVE_DIR':
        lines.push(
          `${directionToKorean(c.direction)}쪽으로 최대 ${c.distance ?? 0}칸까지 이동하려 함`
        );
        break;
      case 'MOVE_OBJ':
        lines.push(`${objectIdToFriendlyLabel(c.objectId)} 쪽으로 가려 함`);
        break;
      case 'INTERACT':
        lines.push(`${objectIdToFriendlyLabel(c.objectId)}와 상호작용하려 함`);
        break;
      case 'ATTACK':
        lines.push(`${objectIdToFriendlyLabel(c.objectId)}를 공격하려 함`);
        break;
      case 'MOVE_MAP':
        lines.push(
          Number(c.mapId) === 2 ? '마왕이 있는 구역으로 이동하려 함' : '숲 쪽으로 이동하려 함'
        );
        break;
      case 'IDLE':
        lines.push('잠시 멈춤');
        break;
      default:
        lines.push('행동 하나를 시도함');
    }
  }
  return lines.length ? lines.map((s, i) => `${i + 1}. ${s}`).join('\n') : '(없음)';
}

/**
 * 시뮬 이벤트를 내부 id 없이 자연어로 요약 (2차 LLM 입력용)
 * @param {unknown[]} events
 */
function summarizeEventsForReply(events) {
  if (!Array.isArray(events) || events.length === 0) return '(없음)';
  const lines = [];
  for (const e of events) {
    if (!e || typeof e !== 'object' || !e.type) continue;
    switch (e.type) {
      case 'command_failed':
        lines.push(`실패: ${humanizeCommandError(e.error)}`);
        break;
      case 'move_dir':
      case 'move_path':
        lines.push('이동함');
        break;
      case 'gather':
        if (e.resource === 'wood') lines.push('나무를 채집함');
        else if (e.resource === 'iron') lines.push('철을 캠');
        else lines.push('자원을 얻음');
        break;
      case 'craft':
        lines.push(Number(e.tier) === 2 ? '검을 한 단계 강화함' : '검을 만들었음');
        break;
      case 'craft_fail':
        lines.push('제작이 되지 않음(재료나 상태 문제)');
        break;
      case 'combat':
        lines.push(e.win ? '전투에서 이김' : '전투에서 졌음');
        break;
      case 'loot':
        lines.push('귀한 전리품을 얻음');
        break;
      case 'map_change':
        lines.push(Number(e.mapId) === 2 ? '마왕의 영역으로 들어옴' : '숲으로 돌아옴');
        break;
      case 'destroy':
        lines.push('무언가가 사라지거나 부서짐');
        break;
      case 'npc_line':
        if (e.text && typeof e.text === 'string') lines.push(`주변의 말: ${e.text}`);
        else lines.push('누군가 말을 걸어 옴');
        break;
      case 'victory':
        lines.push('마왕을 쓰러뜨림');
        break;
      case 'idle':
        lines.push('특별한 일 없음');
        break;
      default:
        lines.push('상황이 바뀜');
    }
  }
  return lines.length ? lines.map((s, i) => `${i + 1}. ${s}`).join('\n') : '(없음)';
}

async function chatComplete(messages, model, logLabel) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');

  logSection(`${logLabel} 요청`, {
    model,
    messageCount: messages.length,
    lastUserPreview: messages.filter((m) => m.role === 'user').pop()?.content?.slice(0, 400),
  });

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    logSection(`${logLabel} HTTP 오류`, { status: res.status, body: t.slice(0, 800) });
    throw new Error(`OpenAI HTTP ${res.status}: ${t.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';
  logSection(`${logLabel} 응답`, { rawLength: text.length, rawPreview: text.slice(0, 600) });
  return text;
}

/** API 키 없을 때 휴리스틱 커맨드 */
function fallbackCommands(userMessage, gameState) {
  const msg = userMessage.toLowerCase();
  const cmds = [];
  if (/재시작|리셋|처음/.test(userMessage)) return ['IDLE()'];
  if (/위로|북쪽|up/i.test(msg)) cmds.push('MOVE_DIR(UP,1)');
  else if (/아래|남쪽|down/i.test(msg)) cmds.push('MOVE_DIR(DOWN,1)');
  else if (/왼쪽|좌|left/i.test(msg)) cmds.push('MOVE_DIR(LEFT,1)');
  else if (/오른쪽|우|right/i.test(msg)) cmds.push('MOVE_DIR(RIGHT,1)');

  if (/나무|벌목|채집/.test(msg) && /베|부수|공격|때/.test(msg)) cmds.push('ATTACK(tree_1)');
  else if (/나무/.test(msg)) cmds.push('MOVE_OBJ(tree_1)', 'INTERACT(tree_1)');
  if (/광|철|캐/.test(msg)) cmds.push('MOVE_OBJ(ore_1)', 'INTERACT(ore_1)');
  if (
    /모루/.test(msg) ||
    /제작/.test(msg) ||
    /강화|2차|업그레이드|드래곤\s*소드|정수.*검|검.*정수/.test(msg) ||
    (/검/.test(msg) && !/공격|때|베/.test(msg))
  ) {
    cmds.push('MOVE_OBJ(anvil)', 'INTERACT(anvil)');
  }
  if (/드래곤|용/.test(msg) && /공격|때|베/.test(msg)) cmds.push('MOVE_OBJ(dragon)', 'ATTACK(dragon)');
  else if (/드래곤|용/.test(msg)) cmds.push('MOVE_OBJ(dragon)', 'INTERACT(dragon)');
  if (/마왕|보스/.test(msg) && /공격/.test(msg)) cmds.push('MOVE_OBJ(demon_king)', 'ATTACK(demon_king)');
  if (/포탈|성|마왕의 성|맵\s*2|2\s*맵/.test(msg)) cmds.push('MOVE_OBJ(portal)', 'INTERACT(portal)');
  if (cmds.length === 0) cmds.push('IDLE()');
  return cmds;
}

/**
 * API 키 없을 때 또는 대사 API 실패 시 — 플레이어 문장·실행 결과를 반영한 비고정 대사
 * @param {string} userMessage
 * @param {unknown[]} executed
 * @param {unknown[]} events
 */
function contextualHeuristicReply(userMessage, executed, events) {
  const fail = events.find((e) => e && e.type === 'command_failed');
  if (fail) {
    const why = humanizeCommandError(fail.error);
    return `「${userMessage}」대로 하려 했는데, ${why} 막혔어. 다시 말해줄래?`;
  }

  if (events.some((e) => e?.type === 'victory')) {
    return `이걸 해냈어! 마왕을 쓰러뜨렸다고… 네 덕분이야.`;
  }
  const combatLoss = events.find((e) => e?.type === 'combat' && e.win === false);
  if (combatLoss) {
    return `윽… 상대가 너무 강했어. 이대로는 안 될 것 같아. 다시 준비하자.`;
  }
  const combatWin = events.find((e) => e?.type === 'combat' && e.win === true);
  if (combatWin) {
    if (events.some((e) => e?.type === 'loot' && e.resource === 'essence')) {
      return `간신히 이겼어! 드래곤의 정수도 손에 넣었지.`;
    }
    return `해냈어! 이번 한 판은 우리 쪽이었어.`;
  }

  if (events.some((e) => e?.type === 'map_change')) {
    return `자, 이쪽으로 왔어. 분위기가 확 바뀌었네.`;
  }
  if (events.some((e) => e?.type === 'gather' && e.resource === 'wood')) {
    return `나무는 잘 챙겼어. 다음은 뭘 할까?`;
  }
  if (events.some((e) => e?.type === 'gather' && e.resource === 'iron')) {
    return `철도 꽤 나왔어. 모루 쪽으로 갈까?`;
  }
  if (events.some((e) => e?.type === 'craft' && e.tier === 1)) {
    return `모루에서 검을 만들었어! 이제 한결 든든해.`;
  }
  if (events.some((e) => e?.type === 'craft' && e.tier === 2)) {
    return `검이 한 단계 더 빛나… 드래곤 소드다!`;
  }
  if (events.some((e) => e?.type === 'craft_fail')) {
    return `재료가 아직 부족한 것 같아. 좀 더 모아보자.`;
  }
  if (events.some((e) => e?.type === 'npc_line')) {
    const line = events.find((e) => e?.type === 'npc_line')?.text ?? '';
    return line ? `응… ${line}` : `상대가 할 말이 있는 것 같아.`;
  }
  if (executed.length && executed.every((c) => c?.type === 'IDLE')) {
    return `「${userMessage}」… 음, 지금은 어떻게 움직여야 할지 애매해. 다시 말해줄래?`;
  }
  if (executed.length) {
    return `알겠어, 말한 대로 움직여 볼게. 조금만 지켜봐 줘.`;
  }
  return `지금은 뭘 해야 할지 잘 모르겠어. 다시 한번만 말해줄래?`;
}

/**
 * @param {string} userMessage
 * @param {import('../game/engine.js').GameState} gameState
 */
export async function runPipeline(userMessage, gameState) {
  const prompts = loadPrompts();
  const stateBlock = summarizeStateForPrompt(gameState);
  const modelCmd = process.env.OPENAI_MODEL_COMMAND || prompts.modelCommand;
  const modelReply = process.env.OPENAI_MODEL_REPLY || prompts.modelReply;

  logSection('입력 수신', {
    userPreview: userMessage.slice(0, 200),
    mapId: gameState.mapId,
    weapon: gameState.weapon,
  });

  let commandRaw = '';
  if (process.env.OPENAI_API_KEY) {
    commandRaw = await chatComplete(
      [
        { role: 'system', content: prompts.commandSystem },
        {
          role: 'user',
          content: `게임상태:\n${stateBlock}\n\n플레이어 입력:\n${userMessage}\n\n응답: JSON 문자열 배열만.`,
        },
      ],
      modelCmd,
      '1차_커맨드'
    );
  } else {
    commandRaw = JSON.stringify(fallbackCommands(userMessage, gameState));
    logSection('1차_커맨드(API키없음)', { commandRaw });
  }

  let parsed = parseLlmCommandPayload(commandRaw);
  logSection('커맨드 정제', {
    parsedCount: parsed.length,
    parsed: parsed.map((c) => JSON.stringify(c)),
  });
  if (!parsed.length) parsed = [{ type: 'IDLE' }];

  const { state: newState, executed, events, steps } = simulateCommands(gameState, parsed);
  logSection('시뮬 결과', {
    executed: executed.map((c) => JSON.stringify(c)),
    eventTypes: events.map((e) => e?.type),
    gameOver: newState.gameOver,
    victory: newState.victory,
  });

  const actionSummary = summarizeExecutedForReply(executed);
  const outcomeSummary = summarizeEventsForReply(events);
  logSection('2차_대사_입력요약', {
    actionSummaryPreview: actionSummary.slice(0, 500),
    outcomeSummaryPreview: outcomeSummary.slice(0, 800),
  });

  let reply = '';
  if (process.env.OPENAI_API_KEY) {
    try {
      reply = await chatComplete(
        [
          { role: 'system', content: prompts.replySystem },
          {
            role: 'user',
            content: `플레이어 원문:\n${userMessage}\n\n시도한 행동 요약(내부 코드 없음):\n${actionSummary}\n\n실제 결과 요약(내부 코드 없음):\n${outcomeSummary}`,
          },
        ],
        modelReply,
        '2차_대사'
      );
    } catch (err) {
      logSection('2차_대사 실패_휴리스틱으로 대체', { error: String(err?.message || err) });
      reply = contextualHeuristicReply(userMessage, executed, events);
    }
    if (!reply.trim()) {
      logSection('2차_대사 빈문자_휴리스틱', {});
      reply = contextualHeuristicReply(userMessage, executed, events);
    }
  } else {
    reply = contextualHeuristicReply(userMessage, executed, events);
    logSection('2차_대사(API키없음_휴리스틱)', { replyPreview: reply.slice(0, 200) });
  }

  return {
    reply,
    commands: executed,
    events,
    steps,
    gameState: newState,
  };
}

export { parseLlmCommandPayload };
