import { describe, expect, it } from 'vitest';
import { firstRunChecklist } from './first-run';

const defaults = { project: 'Chartroom', effort: 'Effort', efforts: 'Efforts' };
const fresh = { projectName: 'Chartroom', effortName: { singular: 'Effort', plural: 'Efforts' } };

const doneOf = (items: ReturnType<typeof firstRunChecklist>) => Object.fromEntries(items.map(item => [item.id, item.done]));

describe('firstRunChecklist', () => {
  it('walks a fresh Instance through the four steps in order, each linking to its section', () => {
    const items = firstRunChecklist({ names: fresh, defaults, environments: 0, holders: 0 });

    expect(items).toEqual([
      { id: 'project', section: 'settings', done: false },
      { id: 'effort', section: 'settings', done: false },
      { id: 'environments', section: 'environments', done: false },
      { id: 'holder', section: 'holders', done: false },
    ]);
  });

  it('strikes the project and the Effort word once they differ from the defaults', () => {
    const named = { projectName: 'Acme Tracker', effortName: { singular: 'Initiative', plural: 'Initiatives' } };

    expect(doneOf(firstRunChecklist({ names: named, defaults, environments: 0, holders: 0 }))).toMatchObject({ project: true, effort: true });
    expect(doneOf(firstRunChecklist({ names: { ...fresh, projectName: 'Acme' }, defaults, environments: 0, holders: 0 }))).toMatchObject({ project: true, effort: false });
  });

  it('strikes the project and the Effort word once Settings were saved, even when the names kept their defaults', () => {
    expect(doneOf(firstRunChecklist({ names: fresh, defaults, environments: 0, holders: 0, settingsSaved: true }))).toMatchObject({ project: true, effort: true });
  });

  it('strikes Environments with the first Environment and the holder step with the first holder', () => {
    expect(doneOf(firstRunChecklist({ names: fresh, defaults, environments: 1, holders: 1 }))).toMatchObject({ environments: true, holder: true });
  });

  it('leaves the names unstruck while the Instance has not loaded', () => {
    expect(doneOf(firstRunChecklist({ names: null, defaults, environments: 0, holders: 0 }))).toMatchObject({ project: false, effort: false });
  });
});
