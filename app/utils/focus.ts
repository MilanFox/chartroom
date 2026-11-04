export const focusById = async (id: string) => {
  await nextTick();
  document.getElementById(id)?.focus();
};
