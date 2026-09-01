/**
 * Per-thread participant token. Random, session-scoped, never sent anywhere but the
 * reply endpoint — the server only ever stores a hash of it combined with the thread id,
 * so the same person is unlinkable across threads.
 */
export function participantToken(threadId: string): string {
  const key = `thread_participant_${threadId}`;
  let token = sessionStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    sessionStorage.setItem(key, token);
  }
  return token;
}
