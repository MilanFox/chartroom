export const nowIso = () => new Date().toISOString();

export const isoAfterSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

export const stamp = (actor: string) => ({ updatedAt: nowIso(), updatedBy: actor });
