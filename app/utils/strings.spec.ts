import { describe, expect, it } from 'vitest';
import { formatString, resolveStrings } from './strings';

const catalog = {
  names: { project: 'Chartroom', effort: 'Effort', efforts: 'Efforts' },
  shell: { picker: 'Pick an {effort}', home: '{project} home', list: 'All {efforts}', count: '{count} open' },
};

describe('resolveStrings', () => {
  it('fills the default names when the Instance is not known yet', () => {
    const strings = resolveStrings(catalog, null);

    expect(strings.shell.picker).toBe('Pick an Effort');
    expect(strings.shell.home).toBe('Chartroom home');
    expect(strings.names.efforts).toBe('Efforts');
  });

  it('merges the Instance names over the defaults', () => {
    const strings = resolveStrings(catalog, { projectName: 'Acme', effortName: { singular: 'Initiative', plural: 'Initiatives' } });

    expect(strings.shell.picker).toBe('Pick an Initiative');
    expect(strings.shell.home).toBe('Acme home');
    expect(strings.shell.list).toBe('All Initiatives');
    expect(strings.names).toEqual({ project: 'Acme', effort: 'Initiative', efforts: 'Initiatives' });
  });

  it('leaves runtime placeholders for formatString', () => {
    const strings = resolveStrings(catalog, null);

    expect(strings.shell.count).toBe('{count} open');
    expect(formatString(strings.shell.count, { count: 12 })).toBe('12 open');
  });
});
