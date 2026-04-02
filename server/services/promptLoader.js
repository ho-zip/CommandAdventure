import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.join(__dirname, '..', 'prompt.json');

/**
 * 요청마다 디스크에서 다시 읽음 (요구사항: 재시작 없이 반영)
 */
export function loadPrompts() {
  const raw = fs.readFileSync(PROMPT_PATH, 'utf8');
  return JSON.parse(raw);
}
