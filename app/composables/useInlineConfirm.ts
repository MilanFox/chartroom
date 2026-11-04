const focusById = async (id: string) => {
  await nextTick();
  document.getElementById(id)?.focus();
};

export const useInlineConfirm = ({ triggerPrefix }: { triggerPrefix: string }) => {
  const confirming = ref<string | null>(null);

  const confirm = (key: string) => {
    confirming.value = key;
  };

  const keep = (key: string) => {
    confirming.value = null;
    return focusById(`${triggerPrefix}${key}`);
  };

  return { confirming, confirm, keep, focusById };
};
