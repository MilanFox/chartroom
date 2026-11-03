const CACHE_VERSION_KEY = 'cache-meta:cache-version';
const CACHE_IDENTIFIER = 'cache:';

export const getCacheVersion = async () => {
  const storage = useStorage();
  const version = await storage.getItem<number>(CACHE_VERSION_KEY);
  return version || 1;
};

export const incrementCacheVersion = async () => {
  const storage = useStorage();
  const currentVersion = await getCacheVersion();
  const nextVersion = currentVersion + 1;

  const keys = await storage.getKeys();
  const cacheKeys = keys.filter(key => key.startsWith(CACHE_IDENTIFIER));
  await Promise.all(cacheKeys.map(key => storage.removeItem(key)));

  await storage.setItem(CACHE_VERSION_KEY, nextVersion);
  return nextVersion;
};

export const getCacheKey = async (key: string) => {
  const version = await getCacheVersion();
  return `${CACHE_IDENTIFIER}${key}-${version}`;
};

export const MAX_CACHE_AGE = 60 * 15;
