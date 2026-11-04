import { describe, expect, it } from 'vitest';
import { crumbsFor } from './breadcrumb';

const labels = { issues: 'Issues', efforts: 'Efforts', map: 'Map: {title}', spec: 'Spec: {title}', issue: '#{number}' };
const tracker = { number: 1, name: 'agent-tracker', title: 'Agent Tracker v1' };

describe('crumbsFor', () => {
  it('reads <Efforts> › <Effort> on a dashboard, the Effort being the current page', () => {
    expect(crumbsFor({ page: 'dashboard', effort: tracker }, labels)).toEqual([
      { label: 'Efforts', to: '/' },
      { label: 'Agent Tracker v1' },
    ]);
  });

  it('reads Issues › <Effort> › Map: <title> › #n on a ticket under a map, the Effort crumb opening the dashboard', () => {
    const target = { page: 'issue', issue: { number: 12, kind: 'ticket' }, effort: tracker, parent: { number: 2, kind: 'map', title: 'Agent Tracker v1' } } as const;

    expect(crumbsFor(target, labels)).toEqual([
      { label: 'Issues', to: '/issues' },
      { label: 'Agent Tracker v1', to: '/efforts/1' },
      { label: 'Map: Agent Tracker v1', to: '/issues/2' },
      { label: '#12' },
    ]);
  });

  it('skips the middle crumb on a ticket parented straight to the Effort', () => {
    const target = { page: 'issue', issue: { number: 30, kind: 'ticket' }, effort: tracker, parent: { number: 1, kind: 'effort', title: 'Agent Tracker v1' } } as const;

    expect(crumbsFor(target, labels).map(crumb => crumb.label)).toEqual(['Issues', 'Agent Tracker v1', '#30']);
  });

  it('ends a spec at its own #n', () => {
    const target = { page: 'issue', issue: { number: 19, kind: 'spec' }, effort: tracker, parent: { number: 1, kind: 'effort', title: 'Agent Tracker v1' } } as const;

    expect(crumbsFor(target, labels).map(crumb => crumb.label)).toEqual(['Issues', 'Agent Tracker v1', '#19']);
  });

  it('links the dashboard by number even when the Effort has no slug', () => {
    const target = { page: 'issue', issue: { number: 8, kind: 'map' }, effort: { number: 7, name: null, title: 'Untitled' }, parent: null } as const;

    expect(crumbsFor(target, labels)[1]).toEqual({ label: 'Untitled', to: '/efforts/7' });
  });

  it('reads <Efforts> alone on the Effort list', () => {
    expect(crumbsFor({ page: 'efforts' }, labels)).toEqual([{ label: 'Efforts' }]);
  });
});
