import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import chatRouter from './routes/chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, 'public');

app.use(cors({ origin: true }));
app.use(express.json({ limit: '512kb' }));

app.use('/api', chatRouter);

// 정적 파일 (클라이언트)
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`CommandAdventure server http://localhost:${PORT}`);
});
