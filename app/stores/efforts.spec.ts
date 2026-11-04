import { registerEndpoint } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useEffortsStore } from './efforts';
import { useInstanceStore } from './instance';

const effort = (number: number, name: string) => ({
  number,
  name,
  title: name,
  state: 'open',
  status: 'open',
  labels: [],
  createdBy: 'milan',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  statusRollup: { map: null, specs: [], triage: {}, open: number },
});

const unregister: (() => void)[] = [];

describe('useEffortsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    unregister.splice(0).forEach(remove => remove());
  });

  it('loads every Effort, following each cursor', async () => {
    unregister.push(registerEndpoint('/ui/efforts', (event) => {
      const cursor = new URL((event as { web: { request: Request } }).web.request.url).searchParams.get('cursor');
      return cursor === 'page-2'
        ? { items: [effort(3, 'docs')], nextCursor: null }
        : { items: [effort(1, 'tracker'), effort(2, 'cli')], nextCursor: 'page-2' };
    }));
    const efforts = useEffortsStore();

    await efforts.load();

    expect(efforts.efforts.map(({ name }) => name)).toEqual(['tracker', 'cli', 'docs']);
  });

  it('creates an Effort with its title and slug, then reloads the list and the Instance so the picker and the Issues count show it', async () => {
    const sent: unknown[] = [];
    let created = false;
    unregister.push(registerEndpoint('/ui/issues', {
      method: 'POST',
      handler: async (event) => {
        sent.push(await (event as { web: { request: Request } }).web.request.json());
        created = true;
        return { number: 7, kind: 'effort', name: 'docs', title: 'Docs site' };
      },
    }));
    unregister.push(registerEndpoint('/ui/efforts', () => ({ items: created ? [effort(7, 'docs'), effort(1, 'tracker')] : [effort(1, 'tracker')], nextCursor: null })));
    unregister.push(registerEndpoint('/ui/instance', () => ({ openIssues: created ? 5 : 4 })));
    const efforts = useEffortsStore();

    const number = await efforts.create({ title: 'Docs site', name: 'docs' });

    expect(sent).toEqual([{ kind: 'effort', title: 'Docs site', name: 'docs' }]);
    expect(number).toBe(7);
    expect(efforts.efforts.map(({ name }) => name)).toEqual(['docs', 'tracker']);
    expect(useInstanceStore().instance?.openIssues).toBe(5);
  });
});
