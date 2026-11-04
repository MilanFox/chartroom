// eslint-disable-next-line no-unused-vars -- the core rule misreads type-level parameters
type ExplainFailure = (failure: unknown) => string;

export const useIssueAction = () => {
  const busy = ref(false);
  const error = ref('');

  const run = async (action: () => Promise<unknown>, explain: ExplainFailure) => {
    if (busy.value) return false;
    busy.value = true;
    error.value = '';
    try {
      await action();
      return true;
    }
    catch (failure) {
      error.value = explain(failure);
      return false;
    }
    finally {
      busy.value = false;
    }
  };

  return { busy, error, run };
};
