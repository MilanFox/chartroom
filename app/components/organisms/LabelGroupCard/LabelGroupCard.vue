<template>
  <li class="label-group-card" :data-group="group.id">
    <div class="label-group-card__header">
      <h4 class="label-group-card__name">{{ group.displayName }}</h4>

      <code class="label-group-card__id">{{ group.id }}</code>

      <span class="label-group-card__tools">
        <AdminAction
          v-if="!first"
          :id="labelDomId('group-up', group.id)"
          label="↑"
          :aria-label="format(strings.admin.labels.moveGroupUp, { group: group.displayName })"
          variant="quiet"
          @run="moveGroup(-1)"
        />

        <AdminAction
          v-if="!last"
          :id="labelDomId('group-down', group.id)"
          label="↓"
          :aria-label="format(strings.admin.labels.moveGroupDown, { group: group.displayName })"
          variant="quiet"
          @run="moveGroup(1)"
        />

        <AdminAction
          :id="labelDomId('delete', group.id)"
          :label="strings.admin.labels.deleteGroup"
          :aria-label="format(strings.admin.labels.deleteGroupNamed, { group: group.displayName })"
          variant="danger"
          @run="askDelete"
        />
      </span>
    </div>

    <InlineConfirm
      v-if="deleteConfirm.confirming.value === group.id"
      class="label-group-card__confirm"
      :message="format(strings.admin.labels.confirmDelete, { group: group.displayName })"
      :confirm-label="strings.admin.labels.deleteGroup"
      :keep-label="strings.admin.labels.keep"
      @confirm="deleteGroup"
      @keep="deleteConfirm.keep(group.id)"
    />

    <form class="label-group-card__names" novalidate @submit.prevent="saveNames">
      <LockedField
        :id="labelDomId('name', group.id)"
        v-model="draft.displayName"
        name="displayName"
        :label="strings.admin.labels.groupName"
        :aria-label="`${strings.admin.labels.groupName} ${group.id}`"
        :error="nameError"
        @input="nameError = ''"
      />

      <ol class="label-group-card__members" :aria-label="format(strings.admin.labels.members, { group: group.displayName })">
        <li
          v-for="(member, memberIndex) in group.labels"
          :key="member.id"
          class="label-group-card__member"
          :class="{ 'label-group-card__member--dragged': dragged === member.id }"
          @dragover="allowDrop"
          @drop="drop(memberIndex, $event)"
        >
          <span
            class="label-group-card__grip"
            :class="{ 'label-group-card__grip--locked': locked }"
            draggable="true"
            aria-hidden="true"
            @dragstart="dragStart(member.id, $event)"
            @dragend="dragged = null"
          >
            <Icon name="grip" :size="16" />
          </span>

          <LockedField
            :id="labelDomId('member', group.id, member.id)"
            v-model="draft.members[member.id]"
            :name="`displayLabel-${member.id}`"
            :label="member.id"
            :aria-label="`${strings.admin.labels.memberLabel} ${member.id}`"
            :error="memberErrors[member.id]"
            inline
            @input="memberErrors[member.id] = ''"
          />

          <span class="label-group-card__move">
            <AdminAction
              v-if="memberIndex > 0"
              :id="labelDomId('up', group.id, member.id)"
              label="↑"
              :aria-label="format(strings.admin.labels.moveUp, { label: member.displayLabel })"
              variant="quiet"
              class="label-group-card__up"
              @run="moveMember(member.id, -1)"
            />

            <AdminAction
              v-if="memberIndex < group.labels.length - 1"
              :id="labelDomId('down', group.id, member.id)"
              label="↓"
              :aria-label="format(strings.admin.labels.moveDown, { label: member.displayLabel })"
              variant="quiet"
              class="label-group-card__down"
              @run="moveMember(member.id, 1)"
            />
          </span>

          <AdminAction
            :id="labelDomId('remove', group.id, member.id)"
            :label="strings.admin.labels.remove"
            :aria-label="format(strings.admin.labels.removeMember, { label: member.displayLabel })"
            variant="danger"
            @run="askRemove(member.id)"
          />

          <InlineConfirm
            v-if="removeConfirm.confirming.value === member.id"
            class="label-group-card__wide"
            :message="format(strings.admin.labels.confirmRemove, { label: member.displayLabel, group: group.displayName })"
            :confirm-label="strings.admin.labels.remove"
            :keep-label="strings.admin.labels.keep"
            @confirm="removeMember(member.id)"
            @keep="removeConfirm.keep(member.id)"
          />
        </li>
      </ol>

      <div class="label-group-card__actions">
        <AdminAction :label="saveAction.busy ? strings.admin.labels.saving : strings.admin.labels.saveNames" type="submit" />

        <p role="status" class="label-group-card__status" :class="{ 'label-group-card__status--failed': cardFeedback?.failed }">{{ cardFeedback?.message }}</p>
      </div>
    </form>

    <form class="label-group-card__add" novalidate @submit.prevent="addMember">
      <LockedField
        :id="labelDomId('add', group.id)"
        v-model="addition.id"
        name="memberId"
        :label="strings.admin.labels.memberId"
        :hint="strings.admin.labels.idHint"
        :error="addError"
        autocapitalize="off"
        spellcheck="false"
        @input="addError = ''"
      />

      <LockedField :id="labelDomId('add-label', group.id)" v-model="addition.displayLabel" name="memberDisplayLabel" :label="strings.admin.labels.memberDisplayLabel" />

      <div class="label-group-card__submit">
        <AdminAction :label="addAction.busy ? strings.admin.labels.adding : strings.admin.labels.addMember" type="submit" />
      </div>

      <div role="status" class="label-group-card__status label-group-card__wide" :class="{ 'label-group-card__status--failed': addFeedback?.failed }">
        <template v-if="addFeedback">
          {{ addFeedback.message }}

          <ul v-if="addFeedback.issues.length" class="label-group-card__issues">
            <li v-for="number in addFeedback.issues" :key="number"><NuxtLink :to="issuePath(number)">#{{ number }}</NuxtLink></li>
          </ul>
        </template>
      </div>
    </form>
  </li>
</template>

<script setup lang="ts">
import type { LabelGroupCardProps } from './LabelGroupCard.types';

interface Feedback {
  message: string
  failed: boolean
  issues: number[]
}

interface Synced {
  displayName: string
  members: Record<string, string>
}

const props = defineProps<LabelGroupCardProps>();

const labelGroupsStore = useLabelGroupsStore();
const { strings, format } = useStrings();
const { locked } = useElevationGate();

const deleteConfirm = useInlineConfirm({ triggerPrefix: `${labelDomId('delete')}--` });
const removeConfirm = useInlineConfirm({ triggerPrefix: `${labelDomId('remove', props.group.id)}--` });

const draft = reactive<Synced>({ displayName: '', members: {} });
const addition = reactive({ id: '', displayLabel: '' });
const nameError = ref('');
const memberErrors = ref<Record<string, string>>({});
const addError = ref('');
const cardFeedback = ref<Feedback>();
const addFeedback = ref<Feedback>();
const dragged = ref<string | null>(null);
const saveAction = reactive(useAction());
const addAction = reactive(useAction());
const changeAction = reactive(useAction());

let synced: Synced | undefined;

const followServer = ({ draft: draftValue, before, after, failed }: { draft: string | undefined, before: string | undefined, after: string, failed: string | undefined }) => {
  if (draftValue === undefined || before === undefined) return after;
  if (after === before || draftValue !== before || failed) return draftValue;
  return after;
};

watch(() => props.group, (group) => {
  const previous = synced;
  const members = Object.fromEntries(group.labels.map(member => [
    member.id,
    followServer({ draft: draft.members[member.id], before: previous?.members[member.id], after: member.displayLabel, failed: memberErrors.value[member.id] }),
  ]));
  draft.displayName = followServer({ draft: previous ? draft.displayName : undefined, before: previous?.displayName, after: group.displayName, failed: nameError.value });
  draft.members = members;
  synced = { displayName: group.displayName, members: Object.fromEntries(group.labels.map(member => [member.id, member.displayLabel])) };
}, { immediate: true });

const failedFeedback = (): Feedback => ({ message: strings.value.admin.labels.errors.failed, failed: true, issues: [] });

const change = (write: () => Promise<unknown>) => changeAction.run(() => {
  cardFeedback.value = undefined;
  return write();
}, () => {
  cardFeedback.value = failedFeedback();
  return '';
});

const moveGroup = async (offset: number) => {
  if (await change(() => labelGroupsStore.moveLabelGroup(props.group.id, offset))) focusById(labelDomId(offset < 0 ? 'group-up' : 'group-down', props.group.id));
};

const moveMember = async (memberId: string, offset: number) => {
  if (await change(() => labelGroupsStore.moveGroupMember(props.group.id, memberId, offset))) focusById(labelDomId(offset < 0 ? 'up' : 'down', props.group.id, memberId));
};

const dragStart = (memberId: string, event: DragEvent) => {
  if (locked.value) {
    event.preventDefault();
    return;
  }
  dragged.value = memberId;
  event.dataTransfer?.setData('text/plain', memberId);
};

const allowDrop = (event: DragEvent) => {
  if (dragged.value) event.preventDefault();
};

const drop = async (targetIndex: number, event: DragEvent) => {
  const memberId = dragged.value;
  dragged.value = null;
  if (!memberId) return;
  event.preventDefault();
  const sourceIndex = props.group.labels.findIndex(member => member.id === memberId);
  if (sourceIndex < 0 || sourceIndex === targetIndex) return;
  await change(() => labelGroupsStore.moveGroupMember(props.group.id, memberId, targetIndex - sourceIndex));
};

const reportRename = (failure: unknown, memberId?: string) => {
  const fieldError = fieldErrorOf(failure, ['displayName', 'displayLabel']);
  if (!fieldError) {
    cardFeedback.value = failedFeedback();
    return;
  }
  if (memberId === undefined) nameError.value = fieldError.message;
  else memberErrors.value[memberId] = fieldError.message;
  focusById(memberId === undefined ? labelDomId('name', props.group.id) : labelDomId('member', props.group.id, memberId));
};

const saveNames = async () => {
  if (locked.value) return;
  const { group } = props;
  cardFeedback.value = undefined;
  const renames = [
    ...(draft.displayName.trim() !== group.displayName ? [{ memberId: undefined, write: () => labelGroupsStore.renameLabelGroup(group.id, draft.displayName.trim()) }] : []),
    ...group.labels
      .filter(member => (draft.members[member.id] ?? '').trim() !== member.displayLabel)
      .map(member => ({ memberId: member.id, write: () => labelGroupsStore.renameGroupMember(group.id, member.id, (draft.members[member.id] ?? '').trim()) })),
  ];
  await saveAction.run(async () => {
    for (const rename of renames) {
      try {
        await rename.write();
      }
      catch (failure) {
        reportRename(failure, rename.memberId);
        return;
      }
    }
    cardFeedback.value = { message: strings.value.admin.labels.saved, failed: false, issues: [] };
  }, () => '');
};

const explainAdd = (failure: unknown) => {
  const issues = memberClashOf(failure);
  if (issues) {
    addFeedback.value = { message: format(strings.value.admin.labels.errors.conflict, { group: props.group.displayName }), failed: true, issues };
    return '';
  }
  const fieldError = fieldErrorOf(failure, ['id']);
  if (!fieldError) {
    addFeedback.value = failedFeedback();
    return '';
  }
  addError.value = fieldError.message;
  focusById(labelDomId('add', props.group.id));
  return '';
};

const addMember = async () => {
  if (locked.value) return;
  addFeedback.value = undefined;
  addError.value = '';
  const added = await addAction.run(
    () => labelGroupsStore.addGroupMember(props.group.id, { id: addition.id.trim(), displayLabel: addition.displayLabel.trim() || null }),
    explainAdd,
  );
  if (added) Object.assign(addition, { id: '', displayLabel: '' });
};

const askDelete = () => {
  removeConfirm.confirming.value = null;
  deleteConfirm.confirm(props.group.id);
};

const askRemove = (memberId: string) => {
  deleteConfirm.confirming.value = null;
  removeConfirm.confirm(memberId);
};

const removeMember = async (memberId: string) => {
  if (!await change(() => labelGroupsStore.removeGroupMember(props.group.id, memberId))) return;
  removeConfirm.confirming.value = null;
  focusById(labelDomId('add', props.group.id));
};

const deleteGroup = async () => {
  if (!await change(() => labelGroupsStore.deleteLabelGroup(props.group.id))) return;
  deleteConfirm.confirming.value = null;
  focusById(labelDomId('new', 'id'));
};

const prefill = (label: string) => {
  Object.assign(addition, { id: label, displayLabel: '' });
  addError.value = '';
  addFeedback.value = undefined;
  focusById(labelDomId('add', props.group.id));
};

defineExpose({ prefill });
</script>

<style lang="scss" scoped>
.label-group-card {
  padding: $space-3;
  border: 1px solid var(--color-rule);
  border-radius: $radius;

  &__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;

    :deep(.elevation-prompt) {
      flex-basis: 100%;
    }
  }

  &__name {
    margin: 0;
    font-size: $font-size-base;
  }

  &__id {
    color: var(--color-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: $font-size-meta;
  }

  &__tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-1;
    margin-left: auto;

    :deep(.elevation-prompt) {
      flex-basis: 100%;
    }
  }

  &__confirm {
    margin-top: $space-2;
  }

  &__names {
    margin-top: $space-3;
  }

  &__members {
    display: flex;
    flex-direction: column;
    gap: $space-1;
    margin: $space-3 0 0;
    padding: 0;
    list-style: none;
  }

  &__member {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: $space-1 $space-2;
    padding: $space-1 0;
    border-top: 1px solid var(--color-rule);

    &--dragged {
      opacity: 0.5;
    }

    :deep(.locked-field) {
      flex: 1 1 18rem;
    }

    :deep(.elevation-prompt) {
      flex-basis: 100%;
    }
  }

  &__grip {
    display: inline-flex;
    align-self: center;
    color: var(--color-muted);
    cursor: grab;

    &--locked {
      opacity: 0.5;
      cursor: default;
    }
  }

  &__move {
    display: inline-grid;
    grid-template-columns: repeat(2, $control-height);
    gap: $space-1;

    :deep(.elevation-prompt) {
      grid-column: 1 / -1;
    }
  }

  &__up {
    grid-column: 1;
  }

  &__down {
    grid-column: 2;
  }

  &__wide {
    flex-basis: 100%;
    grid-column: 1 / -1;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2 $space-3;
    margin-top: $space-3;
  }

  &__status {
    margin: 0;
    color: var(--color-muted);
    font-size: $font-size-meta;

    &--failed {
      @include error-line;
    }
  }

  &__issues {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
    margin: $space-1 0 0;
    padding: 0;
    list-style: none;
  }

  &__add {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: $space-2 $space-3;
    margin-top: $space-3;

    @include respond(sm) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    :deep(.locked-field__hint) {
      @include visually-hidden;
    }
  }

  &__submit {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
    grid-column: 1 / -1;
  }
}
</style>
