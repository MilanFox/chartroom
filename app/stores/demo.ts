// SCAFFOLD FILE — proves Pinia store wiring works. Safe to delete once you add a real store.
import { defineStore } from 'pinia';

export const useDemoStore = defineStore('demo', () => {
  const count = ref(0);
  const double = computed(() => count.value * 2);

  const increment = () => count.value += 1;
  const decrement = () => count.value -= 1;
  const reset = () => count.value = 0;

  return { count, double, increment, decrement, reset };
});
