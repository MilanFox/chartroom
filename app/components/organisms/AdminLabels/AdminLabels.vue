<template>
  <AdminSection id="labels" :heading="strings.shell.adminSections.labels" :intro="strings.admin.labels.intro">
    <h3 class="admin-labels__heading">{{ strings.admin.labels.seededHeading }}</h3>

    <p class="admin-labels__muted">{{ strings.admin.labels.seededHint }}</p>

    <ul class="admin-labels__groups">
      <li v-for="group in seededGroups" :key="group.id" class="admin-labels__card" :data-group="group.id">
        <div class="admin-labels__header">
          <h4 class="admin-labels__name">{{ group.displayName }}</h4>

          <code class="admin-labels__id">{{ group.id }}</code>

          <span class="admin-labels__seeded">{{ strings.admin.labels.seeded }}</span>
        </div>

        <ul class="admin-labels__chips" :aria-label="format(strings.admin.labels.members, { group: group.displayName })">
          <li v-for="member in group.labels" :key="member.id" class="admin-labels__chip">
            {{ member.displayLabel }}<code v-if="member.displayLabel !== member.id" class="admin-labels__chip-id">{{ member.id }}</code>
          </li>
        </ul>
      </li>
    </ul>

    <h3 class="admin-labels__heading">{{ strings.admin.labels.adminHeading }}</h3>

    <ul v-if="adminGroups.length" class="admin-labels__groups">
      <li v-for="(group, groupIndex) in adminGroups" :key="group.id" class="admin-labels__card" :data-group="group.id">
        <div class="admin-labels__header">
          <h4 class="admin-labels__name">{{ group.displayName }}</h4>

          <code class="admin-labels__id">{{ group.id }}</code>

          <span class="admin-labels__tools">
            <AdminAction
              v-if="groupIndex > 0"
              :id="`${baseId}-group-up-${group.id}`"
              label="↑"
              :aria-label="format(strings.admin.labels.moveGroupUp, { group: group.displayName })"
              variant="quiet"
              @run="moveGroup(group.id, -1)"
            />

            <AdminAction
              v-if="groupIndex < adminGroups.length - 1"
              :id="`${baseId}-group-down-${group.id}`"
              label="↓"
              :aria-label="format(strings.admin.labels.moveGroupDown, { group: group.displayName })"
              variant="quiet"
              @run="moveGroup(group.id, 1)"
            />

            <AdminAction
              :id="`${baseId}-delete-${group.id}`"
              :label="strings.admin.labels.deleteGroup"
              :aria-label="format(strings.admin.labels.deleteGroupNamed, { group: group.displayName })"
              variant="danger"
              @run="confirm(`delete-${group.id}`)"
            />
          </span>
        </div>

        <div v-if="confirming === `delete-${group.id}`" role="group" class="admin-labels__confirm" :aria-labelledby="`${baseId}-confirm-delete-${group.id}`">
          <span :id="`${baseId}-confirm-delete-${group.id}`">{{ format(strings.admin.labels.confirmDelete, { group: group.displayName }) }}</span>

          <button :id="`${baseId}-confirm-button-delete-${group.id}`" type="button" class="admin-labels__danger" @click="deleteGroup(group.id)">{{ strings.admin.labels.deleteGroup }}</button>

          <button type="button" class="admin-labels__keep" @click="keep(`delete-${group.id}`)">{{ strings.admin.labels.keep }}</button>
        </div>

        <form class="admin-labels__names" novalidate @submit.prevent="saveNames(group)">
          <div class="admin-labels__field">
            <label :for="`${baseId}-name-${group.id}`" class="admin-labels__label">{{ strings.admin.labels.groupName }}<span class="admin-labels__hidden"> {{ group.id }}</span>

              <Icon v-if="locked" name="lock" :size="12" class="admin-labels__lock" /></label>

            <input
              :id="`${baseId}-name-${group.id}`"
              v-model="names[group.id]!.displayName"
              name="displayName"
              class="admin-labels__input"
              autocomplete="off"
              :readonly="locked"
              :aria-disabled="locked ? 'true' : undefined"
              :aria-invalid="Boolean(fieldErrors[`name-${group.id}`])"
              :aria-describedby="`${baseId}-name-${group.id}-error`"
              v-on="lockedControl(`name-${group.id}`)"
              @input="fieldErrors[`name-${group.id}`] = ''"
            />

            <p :id="`${baseId}-name-${group.id}-error`" role="status" class="admin-labels__error">{{ fieldErrors[`name-${group.id}`] }}</p>

            <ElevationPrompt v-if="prompting === `name-${group.id}`" @elevated="close" @cancel="close" />
          </div>

          <ol class="admin-labels__members" :aria-label="format(strings.admin.labels.members, { group: group.displayName })">
            <li
              v-for="(member, memberIndex) in group.labels"
              :key="member.id"
              class="admin-labels__member"
              :class="{ 'admin-labels__member--dragged': dragged?.memberId === member.id && dragged.groupId === group.id }"
              @dragover="allowDrop(group.id, $event)"
              @drop="drop(group.id, memberIndex, $event)"
            >
              <span
                class="admin-labels__grip"
                :class="{ 'admin-labels__grip--locked': locked }"
                draggable="true"
                aria-hidden="true"
                @dragstart="dragStart(group.id, member.id, $event)"
                @dragend="dragged = null"
              >
                <Icon name="grip" :size="16" />
              </span>

              <label :for="`${baseId}-member-${group.id}-${member.id}`" class="admin-labels__member-id">
                <span class="admin-labels__hidden">{{ strings.admin.labels.memberLabel }} </span>

                {{ member.id }}<Icon v-if="locked" name="lock" :size="12" class="admin-labels__lock" />
              </label>

              <input
                :id="`${baseId}-member-${group.id}-${member.id}`"
                v-model="names[group.id]!.members[member.id]"
                :name="`displayLabel-${member.id}`"
                class="admin-labels__input admin-labels__member-input"
                autocomplete="off"
                :readonly="locked"
                :aria-disabled="locked ? 'true' : undefined"
                :aria-invalid="Boolean(fieldErrors[`member-${group.id}-${member.id}`])"
                :aria-describedby="`${baseId}-member-${group.id}-${member.id}-error`"
                v-on="lockedControl(`member-${group.id}-${member.id}`)"
                @input="fieldErrors[`member-${group.id}-${member.id}`] = ''"
              />

              <span class="admin-labels__move">
                <AdminAction
                  v-if="memberIndex > 0"
                  :id="`${baseId}-up-${group.id}-${member.id}`"
                  label="↑"
                  :aria-label="format(strings.admin.labels.moveUp, { label: member.displayLabel })"
                  variant="quiet"
                  class="admin-labels__up"
                  @run="moveMember(group.id, member.id, -1)"
                />

                <AdminAction
                  v-if="memberIndex < group.labels.length - 1"
                  :id="`${baseId}-down-${group.id}-${member.id}`"
                  label="↓"
                  :aria-label="format(strings.admin.labels.moveDown, { label: member.displayLabel })"
                  variant="quiet"
                  class="admin-labels__down"
                  @run="moveMember(group.id, member.id, 1)"
                />
              </span>

              <AdminAction
                :id="`${baseId}-remove-${group.id}-${member.id}`"
                :label="strings.admin.labels.remove"
                :aria-label="format(strings.admin.labels.removeMember, { label: member.displayLabel })"
                variant="danger"
                @run="confirm(`remove-${group.id}-${member.id}`)"
              />

              <p :id="`${baseId}-member-${group.id}-${member.id}-error`" role="status" class="admin-labels__error admin-labels__wide">{{ fieldErrors[`member-${group.id}-${member.id}`] }}</p>

              <ElevationPrompt v-if="prompting === `member-${group.id}-${member.id}`" @elevated="close" @cancel="close" />

              <div v-if="confirming === `remove-${group.id}-${member.id}`" role="group" class="admin-labels__confirm admin-labels__wide" :aria-labelledby="`${baseId}-confirm-remove-${group.id}-${member.id}`">
                <span :id="`${baseId}-confirm-remove-${group.id}-${member.id}`">{{ format(strings.admin.labels.confirmRemove, { label: member.displayLabel, group: group.displayName }) }}</span>

                <button :id="`${baseId}-confirm-button-remove-${group.id}-${member.id}`" type="button" class="admin-labels__danger" @click="removeMember(group.id, member.id)">{{ strings.admin.labels.remove }}</button>

                <button type="button" class="admin-labels__keep" @click="keep(`remove-${group.id}-${member.id}`)">{{ strings.admin.labels.keep }}</button>
              </div>
            </li>
          </ol>

          <div class="admin-labels__actions">
            <AdminAction :label="saving === group.id ? strings.admin.labels.saving : strings.admin.labels.saveNames" type="submit" />

            <p role="status" class="admin-labels__status" :class="{ 'admin-labels__status--failed': feedback[`card-${group.id}`]?.failed }">{{ feedback[`card-${group.id}`]?.message }}</p>
          </div>
        </form>

        <form class="admin-labels__add" novalidate @submit.prevent="addMember(group)">
          <div class="admin-labels__field">
            <label :for="`${baseId}-add-${group.id}`" class="admin-labels__label">{{ strings.admin.labels.memberId }}<Icon v-if="locked" name="lock" :size="12" class="admin-labels__lock" /></label>

            <input
              :id="`${baseId}-add-${group.id}`"
              v-model="additions[group.id]!.id"
              name="memberId"
              class="admin-labels__input"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              :readonly="locked"
              :aria-disabled="locked ? 'true' : undefined"
              :aria-invalid="Boolean(fieldErrors[`add-${group.id}`])"
              :aria-describedby="`${baseId}-id-hint ${baseId}-add-${group.id}-error`"
              v-on="lockedControl(`add-${group.id}`)"
              @input="fieldErrors[`add-${group.id}`] = ''"
            />

            <p :id="`${baseId}-add-${group.id}-error`" role="status" class="admin-labels__error">{{ fieldErrors[`add-${group.id}`] }}</p>

            <ElevationPrompt v-if="prompting === `add-${group.id}`" @elevated="close" @cancel="close" />
          </div>

          <div class="admin-labels__field">
            <label :for="`${baseId}-add-label-${group.id}`" class="admin-labels__label">{{ strings.admin.labels.memberDisplayLabel }}<Icon v-if="locked" name="lock" :size="12" class="admin-labels__lock" /></label>

            <input
              :id="`${baseId}-add-label-${group.id}`"
              v-model="additions[group.id]!.displayLabel"
              name="memberDisplayLabel"
              class="admin-labels__input"
              autocomplete="off"
              :readonly="locked"
              :aria-disabled="locked ? 'true' : undefined"
              v-on="lockedControl(`add-label-${group.id}`)"
            />

            <ElevationPrompt v-if="prompting === `add-label-${group.id}`" @elevated="close" @cancel="close" />
          </div>

          <div class="admin-labels__submit">
            <AdminAction :label="adding === group.id ? strings.admin.labels.adding : strings.admin.labels.addMember" type="submit" />
          </div>

          <div role="status" class="admin-labels__status admin-labels__wide" :class="{ 'admin-labels__status--failed': feedback[`add-${group.id}`]?.failed }">
            <template v-if="feedback[`add-${group.id}`]">
              {{ feedback[`add-${group.id}`]!.message }}

              <ul v-if="feedback[`add-${group.id}`]!.issues.length" class="admin-labels__issues">
                <li v-for="number in feedback[`add-${group.id}`]!.issues" :key="number"><NuxtLink :to="issuePath(number)">#{{ number }}</NuxtLink></li>
              </ul>
            </template>
          </div>
        </form>
      </li>
    </ul>

    <p v-else class="admin-labels__muted">{{ strings.admin.labels.noGroups }}</p>

    <p :id="`${baseId}-id-hint`" class="admin-labels__hidden">{{ strings.admin.labels.idHint }}</p>

    <form class="admin-labels__create" novalidate @submit.prevent="createGroup">
      <h3 class="admin-labels__heading admin-labels__wide">{{ strings.admin.labels.newGroup }}</h3>

      <div v-for="field in createFields" :key="field.key" class="admin-labels__field">
        <label :for="`${baseId}-${field.key}`" class="admin-labels__label">{{ field.label }}<Icon v-if="locked" name="lock" :size="12" class="admin-labels__lock" /></label>

        <input
          :id="`${baseId}-${field.key}`"
          v-model="newGroup[field.model]"
          :name="field.name"
          class="admin-labels__input"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :readonly="locked"
          :aria-disabled="locked ? 'true' : undefined"
          :aria-invalid="Boolean(fieldErrors[field.key])"
          :aria-describedby="`${field.hint ? `${baseId}-${field.key}-hint ` : ''}${baseId}-${field.key}-error`"
          v-on="lockedControl(field.key)"
          @input="fieldErrors[field.key] = ''"
        />

        <p v-if="field.hint" :id="`${baseId}-${field.key}-hint`" class="admin-labels__hint">{{ field.hint }}</p>

        <p :id="`${baseId}-${field.key}-error`" role="status" class="admin-labels__error">{{ fieldErrors[field.key] }}</p>

        <ElevationPrompt v-if="prompting === field.key" @elevated="close" @cancel="close" />
      </div>

      <div class="admin-labels__submit">
        <AdminAction :label="creating ? strings.admin.labels.creating : strings.admin.labels.create" type="submit" variant="primary" />
      </div>

      <div role="status" class="admin-labels__status admin-labels__wide" :class="{ 'admin-labels__status--failed': feedback.create?.failed }">
        <template v-if="feedback.create">
          {{ feedback.create.message }}

          <ul v-if="feedback.create.issues.length" class="admin-labels__issues">
            <li v-for="number in feedback.create.issues" :key="number"><NuxtLink :to="issuePath(number)">#{{ number }}</NuxtLink></li>
          </ul>
        </template>
      </div>
    </form>

    <h3 :id="`${baseId}-free-form`" class="admin-labels__heading">{{ strings.admin.labels.freeFormHeading }}</h3>

    <div v-if="labelGroupsStore.freeFormLabels.length" class="admin-labels__scroll" role="region" tabindex="0" :aria-labelledby="`${baseId}-free-form`">
      <table class="admin-labels__table">
        <thead>
          <tr>
            <th scope="col">{{ strings.admin.labels.label }}</th>

            <th scope="col">{{ strings.admin.labels.issues }}</th>

            <th v-if="adminGroups.length" scope="col">{{ strings.admin.labels.promote }}</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="freeForm in labelGroupsStore.freeFormLabels" :key="freeForm.label">
            <th scope="row" class="admin-labels__free-label">{{ freeForm.label }}</th>

            <td>{{ freeForm.count }}</td>

            <td v-if="adminGroups.length">
              <span class="admin-labels__promote">
                <select
                  value=""
                  class="admin-labels__select"
                  :aria-label="format(strings.admin.labels.promoteLabel, { label: freeForm.label })"
                  :aria-disabled="locked ? 'true' : undefined"
                  v-on="lockedControl(`promote-${freeForm.label}`)"
                  @change="promote(freeForm.label, $event.target as HTMLSelectElement)"
                >
                  <option value="">{{ strings.admin.labels.promote }}</option>

                  <option v-for="group in adminGroups" :key="group.id" :value="group.id">{{ group.displayName }}</option>
                </select>

                <Icon v-if="locked" name="lock" :size="12" />
              </span>

              <ElevationPrompt v-if="prompting === `promote-${freeForm.label}`" @elevated="close" @cancel="close" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else class="admin-labels__muted">{{ strings.admin.labels.freeFormEmpty }}</p>

    <p v-if="labelGroupsStore.freeFormLabels.length && !adminGroups.length" class="admin-labels__muted">{{ strings.admin.labels.promoteHint }}</p>
  </AdminSection>
</template>

<script setup lang="ts">
import type { LabelGroup } from '~/types/api';

interface Feedback {
  message: string
  failed: boolean
  issues: number[]
}

const labelGroupsStore = useLabelGroupsStore();
const { strings, format } = useStrings();
const baseId = useId();
const names = reactive<Record<string, { displayName: string, members: Record<string, string> }>>({});
const additions = reactive<Record<string, { id: string, displayLabel: string }>>({});
const newGroup = reactive({ id: '', displayName: '', firstMember: '' });
const fieldErrors = ref<Record<string, string>>({});
const feedback = ref<Record<string, Feedback | undefined>>({});
const saving = ref<string | null>(null);
const adding = ref<string | null>(null);
const creating = ref(false);
const dragged = ref<{ groupId: string, memberId: string } | null>(null);

const { locked, prompting, close, lockedControl } = useElevationGate();

const { confirming, confirm, keep, focusById } = useInlineConfirm({ baseId, triggerPrefix: `${baseId}-` });

const seededGroups = computed(() => labelGroupsStore.labelGroups.filter(group => group.seeded));
const adminGroups = computed(() => labelGroupsStore.labelGroups.filter(group => !group.seeded));

const createFields = computed(() => {
  const { labels } = strings.value.admin;
  return [
    { key: 'new-id', model: 'id', name: 'groupId', label: labels.groupId, hint: labels.idHint },
    { key: 'new-name', model: 'displayName', name: 'groupDisplayName', label: labels.displayNameOptional, hint: '' },
    { key: 'new-first', model: 'firstMember', name: 'firstMember', label: labels.firstMember, hint: '' },
  ] as const;
});

const synced: Record<string, { displayName: string, members: Record<string, string> }> = {};

const followServer = ({ draft, before, after, errorKey }: { draft: string | undefined, before: string | undefined, after: string, errorKey: string }) => {
  if (draft === undefined || before === undefined) return after;
  if (after === before || draft !== before || fieldErrors.value[errorKey]) return draft;
  return after;
};

watch(adminGroups, (groups) => {
  for (const group of groups) {
    const draft = names[group.id];
    const before = synced[group.id];
    names[group.id] = {
      displayName: followServer({ draft: draft?.displayName, before: before?.displayName, after: group.displayName, errorKey: `name-${group.id}` }),
      members: Object.fromEntries(group.labels.map(member => [
        member.id,
        followServer({ draft: draft?.members[member.id], before: before?.members[member.id], after: member.displayLabel, errorKey: `member-${group.id}-${member.id}` }),
      ])),
    };
    synced[group.id] = { displayName: group.displayName, members: Object.fromEntries(group.labels.map(member => [member.id, member.displayLabel])) };
    additions[group.id] ??= { id: '', displayLabel: '' };
  }
}, { immediate: true });

const report = (failure: unknown, { key, fields, group }: { key: string, fields: Record<string, string>, group: string }) => {
  const issues = memberClashOf(failure);
  if (issues) {
    feedback.value[key] = { message: format(strings.value.admin.labels.errors.conflict, { group }), failed: true, issues };
    return;
  }
  const field = fields[apiErrorField(failure) ?? ''];
  if (field) {
    fieldErrors.value[field] = apiErrorMessage(failure);
    focusById(`${baseId}-${field}`);
    return;
  }
  feedback.value[key] = { message: strings.value.admin.labels.errors.failed, failed: true, issues: [] };
};

const attempt = async (key: string, write: () => Promise<unknown>) => {
  feedback.value[key] = undefined;
  try {
    await write();
    return true;
  }
  catch {
    feedback.value[key] = { message: strings.value.admin.labels.errors.failed, failed: true, issues: [] };
    return false;
  }
};

const moveGroup = async (groupId: string, offset: number) => {
  const direction = offset < 0 ? 'up' : 'down';
  if (await attempt(`card-${groupId}`, () => labelGroupsStore.moveLabelGroup(groupId, offset))) focusById(`${baseId}-group-${direction}-${groupId}`);
};

const moveMember = async (groupId: string, memberId: string, offset: number) => {
  const direction = offset < 0 ? 'up' : 'down';
  if (await attempt(`card-${groupId}`, () => labelGroupsStore.moveGroupMember(groupId, memberId, offset))) focusById(`${baseId}-${direction}-${groupId}-${memberId}`);
};

const dragStart = (groupId: string, memberId: string, event: DragEvent) => {
  if (locked.value) {
    event.preventDefault();
    return;
  }
  dragged.value = { groupId, memberId };
  event.dataTransfer?.setData('text/plain', memberId);
};

const allowDrop = (groupId: string, event: DragEvent) => {
  if (dragged.value?.groupId === groupId) event.preventDefault();
};

const drop = async (group: string, targetIndex: number, event: DragEvent) => {
  const source = dragged.value;
  dragged.value = null;
  if (source?.groupId !== group) return;
  event.preventDefault();
  const sourceIndex = adminGroups.value.find(candidate => candidate.id === group)?.labels.findIndex(member => member.id === source.memberId) ?? -1;
  if (sourceIndex < 0 || sourceIndex === targetIndex) return;
  await attempt(`card-${group}`, () => labelGroupsStore.moveGroupMember(group, source.memberId, targetIndex - sourceIndex));
};

const saveNames = async (group: LabelGroup) => {
  if (locked.value || saving.value) return;
  const draft = names[group.id]!;
  saving.value = group.id;
  feedback.value[`card-${group.id}`] = undefined;
  const renames = [
    ...(draft.displayName.trim() !== group.displayName ? [{ field: `name-${group.id}`, write: () => labelGroupsStore.renameLabelGroup(group.id, draft.displayName.trim()) }] : []),
    ...group.labels
      .filter(member => (draft.members[member.id] ?? '').trim() !== member.displayLabel)
      .map(member => ({ field: `member-${group.id}-${member.id}`, write: () => labelGroupsStore.renameGroupMember(group.id, member.id, (draft.members[member.id] ?? '').trim()) })),
  ];
  try {
    for (const rename of renames) {
      try {
        await rename.write();
      }
      catch (failure) {
        report(failure, { key: `card-${group.id}`, fields: { displayName: rename.field, displayLabel: rename.field }, group: group.displayName });
        return;
      }
    }
    feedback.value[`card-${group.id}`] = { message: strings.value.admin.labels.saved, failed: false, issues: [] };
  }
  finally {
    saving.value = null;
  }
};

const addMember = async (group: LabelGroup) => {
  if (locked.value || adding.value) return;
  const addition = additions[group.id]!;
  adding.value = group.id;
  feedback.value[`add-${group.id}`] = undefined;
  fieldErrors.value[`add-${group.id}`] = '';
  try {
    await labelGroupsStore.addGroupMember(group.id, { id: addition.id.trim(), displayLabel: addition.displayLabel.trim() || null });
    additions[group.id] = { id: '', displayLabel: '' };
  }
  catch (failure) {
    report(failure, { key: `add-${group.id}`, fields: { id: `add-${group.id}` }, group: group.displayName });
  }
  finally {
    adding.value = null;
  }
};

const removeMember = async (groupId: string, memberId: string) => {
  if (await attempt(`card-${groupId}`, () => labelGroupsStore.removeGroupMember(groupId, memberId))) {
    confirming.value = null;
    focusById(`${baseId}-add-${groupId}`);
  }
};

const deleteGroup = async (groupId: string) => {
  if (await attempt(`card-${groupId}`, () => labelGroupsStore.deleteLabelGroup(groupId))) {
    confirming.value = null;
    focusById(`${baseId}-new-id`);
  }
};

const createGroup = async () => {
  if (locked.value || creating.value) return;
  creating.value = true;
  feedback.value.create = undefined;
  fieldErrors.value = { ...fieldErrors.value, 'new-id': '', 'new-first': '' };
  const id = newGroup.id.trim();
  const firstMember = newGroup.firstMember.trim();
  try {
    await labelGroupsStore.createLabelGroup({ id, displayName: newGroup.displayName.trim() || null, labels: firstMember ? [{ id: firstMember, displayLabel: null }] : [] });
    Object.assign(newGroup, { id: '', displayName: '', firstMember: '' });
    focusById(`${baseId}-add-${id}`);
  }
  catch (failure) {
    report(failure, { key: 'create', fields: { id: 'new-id', labels: 'new-first' }, group: newGroup.displayName.trim() || id });
  }
  finally {
    creating.value = false;
  }
};

const promote = (label: string, select: HTMLSelectElement) => {
  const groupId = select.value;
  select.value = '';
  if (locked.value || !additions[groupId]) return;
  additions[groupId] = { id: label, displayLabel: '' };
  fieldErrors.value[`add-${groupId}`] = '';
  feedback.value[`add-${groupId}`] = undefined;
  focusById(`${baseId}-add-${groupId}`);
};
</script>

<style lang="scss" scoped>
.admin-labels {
  &__heading {
    margin: $space-6 0 $space-2;
    font-size: $font-size-base;

    &:first-child {
      margin-top: 0;
    }
  }

  &__groups {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__card {
    padding: $space-3;
    border: 1px solid var(--color-rule);
    border-radius: $radius;
  }

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

  &__id,
  &__member-id,
  &__chip-id,
  &__free-label {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: $font-size-meta;
  }

  &__id,
  &__chip-id {
    color: var(--color-muted);
  }

  &__chip-id {
    margin-left: $space-1;
  }

  &__seeded {
    @include label-chip;
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

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
    margin: $space-2 0 0;
    padding: 0;
    list-style: none;
  }

  &__chip {
    @include label-chip;
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
    align-items: center;
    gap: $space-1 $space-2;
    padding: $space-1 0;
    border-top: 1px solid var(--color-rule);

    &--dragged {
      opacity: 0.5;
    }

    :deep(.elevation-prompt) {
      flex-basis: 100%;
    }
  }

  &__grip {
    display: inline-flex;
    color: var(--color-muted);
    cursor: grab;

    &--locked {
      opacity: 0.5;
      cursor: default;
    }
  }

  &__member-id {
    flex: 0 0 8rem;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  &__member-input {
    flex: 1 1 10rem;
    min-width: 0;
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

  &__field {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__label {
    margin-bottom: $space-1;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__input {
    @include text-field;

    &:read-only {
      border-color: var(--color-rule);
      background: var(--color-surface-alt);
      color: var(--color-muted);
    }
  }

  &__select {
    @include text-field;
  }

  &__lock {
    margin-left: $space-1;
  }

  &__hidden {
    @include visually-hidden;
  }

  &__hint,
  &__muted {
    margin: $space-1 0 0;
    color: var(--color-muted);
    font-size: $font-size-meta;
  }

  &__error {
    @include error-line;
    margin: 0;
    font-size: $font-size-meta;

    &:empty {
      display: none;
    }
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

  &__add,
  &__create {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: $space-2 $space-3;
    margin-top: $space-3;

    @include respond(sm) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  &__create {
    @include respond(sm) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .admin-labels__heading {
      margin-bottom: 0;
    }
  }

  &__submit {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
    grid-column: 1 / -1;
  }

  &__confirm {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    margin-top: $space-2;
    padding: $space-2 $space-3;
    border-radius: $radius-control;
    background: var(--color-tint-blocked);
  }

  &__danger {
    @include button-secondary;
    color: var(--color-state-blocked);
  }

  &__keep {
    @include button-quiet;
    height: $control-height;
  }

  &__scroll {
    overflow-x: auto;

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }

  &__table {
    width: 100%;
    border-collapse: collapse;

    th,
    td {
      padding: $space-2;
      border-bottom: 1px solid var(--color-rule);
      text-align: left;
      vertical-align: top;
    }

    thead th {
      color: var(--color-muted);
      font-size: $font-size-meta;
      font-weight: 600;
    }
  }

  &__free-label {
    font-weight: 400;
  }

  &__promote {
    display: inline-flex;
    align-items: center;
    gap: $space-1;
  }
}
</style>
