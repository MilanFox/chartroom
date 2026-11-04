export const useClaimError = () => {
  const { strings, format } = useStrings();
  return (failure: unknown) => {
    const claimConflict = claimConflictOf(failure);
    if (!claimConflict) return null;
    const messages = strings.value.issue.fields.claim;
    return claimConflict.holder ? format(messages.heldBy, { slug: claimConflict.holder }) : messages.heldBySomeone;
  };
};
