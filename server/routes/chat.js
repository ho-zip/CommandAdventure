import { Router } from 'express';
import { runPipeline } from '../services/openaiPipeline.js';
import { createInitialState } from '../game/engine.js';

const router = Router();

router.post('/chat', async (req, res) => {
  try {
    const { message, gameState } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message required' });
    }
    const base = gameState && typeof gameState === 'object' ? gameState : createInitialState();
    const out = await runPipeline(message.trim(), base);
    res.json({
      reply: out.reply,
      commands: out.commands,
      events: out.events,
      steps: out.steps,
      gameState: out.gameState,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

router.post('/reset', (_req, res) => {
  res.json({ gameState: createInitialState() });
});

export default router;
