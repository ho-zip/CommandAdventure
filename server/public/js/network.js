export async function postChat(message, gameState) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, gameState }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function postReset() {
  const res = await fetch('/api/reset', { method: 'POST' });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}
