import type { IssueDocument } from '~/types/api';
import type { VersionConflict } from '~/utils/conflict';

export type VersionedTextField = 'title' | 'body' | 'name' | 'testInstructions';

const CLEARABLE_FIELDS: VersionedTextField[] = ['name', 'testInstructions'];

export const useVersionedEditor = (issue: () => IssueDocument, field: VersionedTextField, returnFocus?: Ref<HTMLElement | null>) => {
  const issuesStore = useIssuesStore();
  const editing = ref(false);
  const draft = ref('');
  const loadedVersion = ref(0);
  const saving = ref(false);
  const failed = ref(false);
  const failure = shallowRef<unknown>(null);
  const conflict = ref<VersionConflict | null>(null);

  watch(editing, async (isEditing) => {
    if (isEditing) return;
    await nextTick();
    returnFocus?.value?.focus();
  });

  const open = () => {
    draft.value = issue()[field] ?? '';
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

  const valueToSave = () => {
    if (!CLEARABLE_FIELDS.includes(field)) return draft.value;
    const trimmed = draft.value.trim();
    if (!trimmed) return null;
    return field === 'name' ? trimmed : draft.value;
  };

  const save = async () => {
    if (saving.value) return;
    saving.value = true;
    failed.value = false;
    try {
      await issuesStore.edit(issue().number, { [field]: valueToSave() }, loadedVersion.value);
      cancel();
    }
    catch (error) {
      conflict.value = versionConflictOf(error);
      failed.value = conflict.value === null;
      failure.value = failed.value ? error : null;
    }
    finally {
      saving.value = false;
    }
  };

  const reload = async () => {
    await issuesStore.load(issue().number);
    cancel();
  };

  return { editing, draft, saving, failed, failure, conflict, open, cancel, save, reload };
};
