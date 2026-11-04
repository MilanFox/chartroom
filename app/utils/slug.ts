const MAX_LENGTH = 64;

export const slugFrom = (text: string) => text
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, MAX_LENGTH)
  .replace(/-+$/, '');
