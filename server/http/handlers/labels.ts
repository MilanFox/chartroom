export const labelGroupList = () => listLabelGroups();

const LABEL_GROUP_PROPERTIES = {
  id: { type: 'string' },
  displayName: { type: 'string' },
  seeded: { type: 'boolean', description: 'Seeded groups allow no member add, remove or reorder and no delete' },
  exclusive: { type: 'boolean', const: true, description: 'Always true: adding a member removes its siblings' },
  labels: {
    type: 'array',
    description: 'Members in group order; id is the bare label string',
    items: { type: 'object', properties: { id: { type: 'string' }, displayLabel: { type: 'string' } }, required: ['id', 'displayLabel'] },
  },
};

export const LABEL_GROUP_SCHEMA = { type: 'object', properties: LABEL_GROUP_PROPERTIES, required: Object.keys(LABEL_GROUP_PROPERTIES) };
