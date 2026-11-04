import type { LinkFormProps } from '~/components/molecules/LinkForm/LinkForm.types';

export const useLinkError = () => {
  const { strings } = useStrings();
  return (failure: unknown): LinkFormProps['error'] => {
    const messages = strings.value.issue.fields.links.errors;
    const field = apiErrorField(failure);
    if (apiErrorCode(failure) === 'conflict') return { field: 'url', message: messages.taken };
    if (field === 'url') return { field, message: messages.url };
    if (field === 'title') return { field, message: messages.title };
    return { field: null, message: strings.value.issue.fields.failed };
  };
};
