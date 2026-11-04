const TEXT_EDIT_KEYS = ['Enter', 'Backspace', 'Delete'];
const PASS_THROUGH_KEYS = ['Tab', 'Shift', 'Escape'];

const editsValue = (event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey) return false;
  if (event.target instanceof HTMLSelectElement) return !PASS_THROUGH_KEYS.includes(event.key);
  return event.key.length === 1 || TEXT_EDIT_KEYS.includes(event.key);
};

export const useElevationGate = () => {
  const session = useSessionStore();
  const locked = computed(() => !session.adminUntil);
  const prompting = ref<string | null>(null);
  let control: HTMLElement | null = null;

  const open = (key: string, target: EventTarget | null) => {
    control = target as HTMLElement | null;
    prompting.value = key;
  };

  const close = async () => {
    prompting.value = null;
    await nextTick();
    control?.focus();
  };

  const lockedControl = (key: string) => ({
    mousedown: (event: MouseEvent) => {
      if (locked.value && event.target instanceof HTMLSelectElement) event.preventDefault();
    },
    click: (event: MouseEvent) => {
      if (locked.value) open(key, event.currentTarget);
    },
    keydown: (event: KeyboardEvent) => {
      if (!locked.value || !editsValue(event)) return;
      event.preventDefault();
      open(key, event.currentTarget);
    },
  });

  return { locked, prompting, open, close, lockedControl };
};
