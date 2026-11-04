import type { Me } from '~/types/api';

export const elevationEnd = (me: Me | null, now: Date) => {
  const until = me?.admin ? new Date(me.admin.until) : null;
  return until && until > now ? until : null;
};

const twoDigits = (value: number) => String(value).padStart(2, '0');

export const clockTime = (date: Date) => `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
