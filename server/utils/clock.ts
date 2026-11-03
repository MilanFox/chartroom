export const nowIso = () => new Date().toISOString();

export const isoAfterSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();
