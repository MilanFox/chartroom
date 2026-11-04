import type { IssueDocument } from '~/types/api';
import type { VersionConflict } from '~/utils/conflict';

export type VersionedTextField = 'title' | 'body';

export const useVersionedEditor = (issue: () => IssueDocument, field: VersionedTextField) => {
  const issuesStore = useIssuesStore();
  const editing = ref(false);
  const draft = ref('');
  const loadedVersion = ref(0);
  const saving = ref(false);
  const failed = ref(false);
  const conflict = ref<VersionConflict | null>(null);

  const open = () => {
    draft.value = issue()[field];
    loadedVersion.value = issue().version;
    conflict.value = null;
    failed.value = false;
    editing.value = true;
  };

  const cancel = () => {
    editing.value = false;
    conflict.value = null;
    failed.value = false;
  };

  const save = async () => {
    if (saving.value) return;
    saving.value = true;
    failed.value = false;
    try {
      await issuesStore.edit(issue().number, { [field]: draft.value }, loadedVersion.value);
      cancel();
    }
    catch (failure) {
      conflict.value = versionConflictOf(failure);
      failed.value = conflict.value === null;
    }
    finally {
      saving.value = false;
    }
  };

  const reload = async () => {
    await issuesStore.load(issue().number);
    cancel();
  };

  return { editing, draft, saving, failed, conflict, open, cancel, save, reload };
};
