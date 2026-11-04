import { defineStore } from 'pinia';
import type { Me } from '~/types/api';

const CLOCK_TICK_MS = 15_000;

export const useSessionStore = defineStore('session', () => {
  const uiFetch = useUiFetch();
  const me = ref<Me | null>(null);
  const loaded = ref(false);
  const now = shallowRef(new Date());
  useIntervalFn(() => now.value = new Date(), CLOCK_TICK_MS);

  const isViewer = computed(() => me.value?.viewer === true);
  const adminUntil = computed(() => elevationEnd(me.value, now.value));

  const load = async () => {
    try {
      me.value = await uiFetch<Me>('/me');
    }
    catch (error) {
      if (apiErrorCode(error) !== 'unauthenticated') throw error;
      me.value = null;
    }
    loaded.value = true;
  };

  const login = async (secret: string) => {
    me.value = await uiFetch<Me>('/login', { method: 'POST', body: { secret } });
    loaded.value = true;
  };

  const logout = async () => {
    await uiFetch('/logout', { method: 'POST' });
    me.value = null;
  };

  const elevate = async (password: string) => {
    me.value = await uiFetch<Me>('/elevate', { method: 'POST', body: { password } });
  };

  const dropElevation = async () => {
    me.value = await uiFetch<Me>('/elevate', { method: 'DELETE' });
  };

  return { me, loaded, isViewer, adminUntil, load, login, logout, elevate, dropElevation };
});
