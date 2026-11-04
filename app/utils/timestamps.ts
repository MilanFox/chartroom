import { clockTime } from './elevation';

const twoDigits = (value: number) => String(value).padStart(2, '0');

export const formatDate = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
};

export const formatTimestamp = (iso: string) => `${formatDate(iso)} ${clockTime(new Date(iso))}`;
