export const useDerivedSlug = (source: Ref<string>) => {
  const slug = ref(slugFrom(source.value));
  let following = true;

  watch(source, (text) => {
    if (following) slug.value = slugFrom(text);
  });

  watch(slug, (value) => {
    following = value === '' || value === slugFrom(source.value);
  });

  return slug;
};
