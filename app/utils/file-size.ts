const UNITS = ['B', 'KB', 'MB', 'GB'];

export const formatFileSize = (bytes: number) => {
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const rounded = size < 10 && unit > 0 ? Math.round(size * 10) / 10 : Math.round(size);
  return `${rounded} ${UNITS[unit]}`;
};
