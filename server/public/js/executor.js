import { Renderer } from './renderer.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {{ ok?:boolean, events?:any[] }[]} steps
 * @param {Renderer} renderer
 */
export async function playSteps(steps, renderer, opts = {}) {
  const ms = opts.msPerTile ?? 110;
  for (const step of steps) {
    if (step && step.ok === false) break;
    const events = step?.events ?? [];
    for (const ev of events) {
      await playEvent(ev, renderer, ms);
    }
  }
}

async function playEvent(ev, renderer, ms) {
  switch (ev.type) {
    case 'idle':
      await sleep(120);
      return;
    case 'move_dir': {
      const path = ev.path ?? [];
      await renderer.animatePath(path, ms);
      return;
    }
    case 'move_path': {
      const path = ev.path ?? [];
      await renderer.animatePath(path, ms);
      return;
    }
    case 'gather':
      await renderer.pulseObject(ev.objectId);
      return;
    case 'destroy':
      await renderer.shakeObject(ev.objectId);
      return;
    case 'craft':
      await sleep(200);
      return;
    case 'craft_fail':
      await sleep(200);
      return;
    case 'npc_line':
      renderer.setBubbleText(ev.text, { autoHideMs: 3000 });
      await sleep(120);
      return;
    case 'combat': {
      renderer.setAttackPose(true);
      await renderer.lungeToward(ev.targetId, 180);
      await renderer.shakeObject(ev.targetId);
      renderer.setAttackPose(false);
      await sleep(200);
      return;
    }
    case 'loot':
      await sleep(200);
      return;
    case 'map_change':
      document.body.classList.add('fade-dim');
      await sleep(350);
      document.body.classList.remove('fade-dim');
      return;
    default:
      return;
  }
}
