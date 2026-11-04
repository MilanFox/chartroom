import { beforeAll, describe, expect, it } from 'vitest';
import { apiClient, holderSecret, uiClient } from './clients';
import { TEST_PASSWORDS, useTestServer } from './harness';
import type { LaunchedServer } from './harness';

const elevatedViewer = async (server: LaunchedServer) => {
  const ui = uiClient(server);
  await ui.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
  await ui.elevate(TEST_PASSWORDS.CHARTROOM_ADMIN_PASSWORD);
  return ui;
};

type ApiClient = ReturnType<typeof apiClient>;

const invalidOn = (field: string) => ({ status: 400, body: { error: { code: 'invalid', field } } });

const DEFAULT_TRIAGE_LABELS = {
  'needs-triage': 'Needs triage',
  'needs-info': 'Needs info',
  'ready-for-agent': 'Ready for agent',
  'ready-for-human': 'Ready for human',
  'wontfix': 'Won\'t fix',
};

describe('instance settings', () => {
  const server = useTestServer();
  let alice: ApiClient;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  it('a fresh Instance reports the default settings on both mounts', async () => {
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    const viaApi = await alice.json('GET', '/instance');
    const viaUi = await viewer.json('GET', '/instance');

    expect(viaApi).toEqual({
      status: 200,
      body: {
        projectName: 'Chartroom',
        effortName: { singular: 'Effort', plural: 'Efforts' },
        triageLabels: DEFAULT_TRIAGE_LABELS,
        version: '0.1.0',
        updateAvailable: null,
        openIssues: 0,
      },
    });
    expect(viaUi).toEqual(viaApi);
  });

  it('an elevated session renames the project, the Effort word and a triage Display label; the next reads reflect it', async () => {
    const admin = await elevatedViewer(server);

    const written = await admin.json('PATCH', '/instance', { body: { projectName: 'Acme Tracker', effortName: { singular: 'Initiative' }, triageLabels: { 'needs-info': 'Waiting on reporter' } } });

    expect(written.status).toBe(200);
    expect(written.body).toMatchObject({ projectName: 'Acme Tracker', updatedBy: 'admin', updatedAt: expect.any(String) });
    const instance = (await alice.json('GET', '/instance')).body;
    expect(instance).toMatchObject({
      projectName: 'Acme Tracker',
      effortName: { singular: 'Initiative', plural: 'Initiatives' },
      triageLabels: { ...DEFAULT_TRIAGE_LABELS, 'needs-info': 'Waiting on reporter' },
    });
    const triageState = (await alice.json('GET', '/labels')).body.find((group: { id: string }) => group.id === 'triage-state');
    expect(triageState.labels).toContainEqual({ id: 'needs-info', displayLabel: 'Waiting on reporter' });

    await admin.json('PATCH', '/instance', { body: { effortName: { singular: 'Story', plural: 'Stories' } } });
    expect((await alice.json('GET', '/instance')).body).toMatchObject({ projectName: 'Acme Tracker', effortName: { singular: 'Story', plural: 'Stories' } });
  });

  it('a settings write without elevation is forbidden for a Viewer and a holder session', async () => {
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    const holder = uiClient(server);
    await holder.login(await holderSecret(server, 'bob'));

    expect(await viewer.json('PATCH', '/instance', { body: { projectName: 'Nope' } })).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
    expect(await holder.json('PATCH', '/instance', { body: { projectName: 'Nope' } })).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
    expect(await alice.json('PATCH', '/instance', { body: { projectName: 'Nope' } })).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
  });

  it('refuses a blank project name, a blank Effort word and an unknown triage label', async () => {
    const admin = await elevatedViewer(server);

    expect(await admin.json('PATCH', '/instance', { body: { projectName: ' ' } })).toMatchObject(invalidOn('projectName'));
    expect(await admin.json('PATCH', '/instance', { body: { effortName: { singular: '' } } })).toMatchObject(invalidOn('effortName.singular'));
    expect(await admin.json('PATCH', '/instance', { body: { effortName: 'Story' } })).toMatchObject(invalidOn('effortName'));
    expect(await admin.json('PATCH', '/instance', { body: { triageLabels: { bug: 'Bug' } } })).toMatchObject(invalidOn('triageLabels.bug'));
    expect(await admin.json('PATCH', '/instance', { body: { triageLabels: { wontfix: '' } } })).toMatchObject(invalidOn('triageLabels.wontfix'));
  });

  it('openIssues counts open issues of every Kind and moves on create and close', async () => {
    const openIssues = async () => (await alice.json('GET', '/instance')).body.openIssues;
    const before = await openIssues();

    const effort = (await alice.json('POST', '/issues', { body: { kind: 'effort', title: 'Checkout', name: 'checkout' } })).body;
    await alice.json('POST', '/issues', { body: { kind: 'ticket', title: 'Pay', parent: effort.number } });
    expect(await openIssues()).toBe(before + 2);

    await alice.json('POST', `/issues/${effort.number}/close`);
    expect(await openIssues()).toBe(before + 1);
  });
});

describe('environments and credential pointers', () => {
  const server = useTestServer();
  let alice: ApiClient;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  it('an Admin creates, updates and deletes an Environment and a pointer bound to it by id', async () => {
    const admin = await elevatedViewer(server);

    const staging = await admin.json('POST', '/environments', { body: { name: 'Staging', url: 'https://staging.example.com' } });
    expect(staging).toMatchObject({ status: 201, body: { name: 'Staging', url: 'https://staging.example.com', notes: null, credentialPointers: [], updatedBy: 'admin' } });
    const pointer = await admin.json('POST', '/credential-pointers', { body: { label: 'QA admin', accountName: 'qa-admin', whereToFind: 'Team vault, entry "Staging QA"', environment: staging.body.id } });
    expect(pointer).toMatchObject({ status: 201, body: { label: 'QA admin', accountName: 'qa-admin', whereToFind: 'Team vault, entry "Staging QA"', environment: staging.body.id, updatedBy: 'admin' } });

    const updatedEnvironment = await admin.json('PATCH', `/environments/${staging.body.id}`, { body: { name: 'Staging EU', notes: 'Reset nightly' } });
    const updatedPointer = await admin.json('PATCH', `/credential-pointers/${pointer.body.id}`, { body: { accountName: 'qa-lead' } });
    expect(updatedEnvironment).toMatchObject({ status: 200, body: { name: 'Staging EU', url: 'https://staging.example.com', notes: 'Reset nightly' } });
    expect(updatedPointer).toMatchObject({ status: 200, body: { label: 'QA admin', accountName: 'qa-lead', environment: staging.body.id } });

    const listed = await alice.json('GET', '/environments');
    expect(listed).toEqual({
      status: 200,
      body: [{
        id: staging.body.id,
        name: 'Staging EU',
        url: 'https://staging.example.com',
        notes: 'Reset nightly',
        credentialPointers: [{ id: pointer.body.id, label: 'QA admin', accountName: 'qa-lead', whereToFind: 'Team vault, entry "Staging QA"', environment: staging.body.id }],
      }],
    });

    expect(await admin.json('DELETE', `/environments/${staging.body.id}`)).toMatchObject({ status: 204 });
    expect((await alice.json('GET', '/environments')).body).toEqual([]);
    expect((await alice.json('GET', '/credential-pointers')).body).toEqual([expect.objectContaining({ id: pointer.body.id, environment: null })]);

    expect(await admin.json('DELETE', `/credential-pointers/${pointer.body.id}`)).toMatchObject({ status: 204 });
    expect((await alice.json('GET', '/credential-pointers')).body).toEqual([]);
  });

  it('a pointer rebinds to another Environment and unbinds with null; unknown ids are not-found', async () => {
    const admin = await elevatedViewer(server);
    const production = (await admin.json('POST', '/environments', { body: { name: 'Production', url: 'https://example.com' } })).body;
    const pointer = (await admin.json('POST', '/credential-pointers', { body: { label: 'Support', accountName: 'support', whereToFind: 'Ask ops' } })).body;
    expect(pointer.environment).toBeNull();

    expect((await admin.json('PATCH', `/credential-pointers/${pointer.id}`, { body: { environment: production.id } })).body.environment).toBe(production.id);
    expect((await admin.json('PATCH', `/credential-pointers/${pointer.id}`, { body: { environment: null } })).body.environment).toBeNull();

    expect(await admin.json('POST', '/credential-pointers', { body: { label: 'x', accountName: 'x', whereToFind: 'x', environment: 9999 } })).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
    expect(await admin.json('PATCH', '/environments/9999', { body: { name: 'x' } })).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
    expect(await admin.json('DELETE', '/credential-pointers/9999')).toMatchObject({ status: 404, body: { error: { code: 'not-found' } } });
  });

  it('refuses a missing name, a relative url and a blank pointer field', async () => {
    const admin = await elevatedViewer(server);

    expect(await admin.json('POST', '/environments', { body: { url: 'https://example.com' } })).toMatchObject(invalidOn('name'));
    expect(await admin.json('POST', '/environments', { body: { name: 'Local', url: 'localhost' } })).toMatchObject(invalidOn('url'));
    expect(await admin.json('POST', '/credential-pointers', { body: { label: 'x', accountName: ' ', whereToFind: 'x' } })).toMatchObject(invalidOn('accountName'));
    expect(await admin.json('POST', '/credential-pointers', { body: { label: 'x', accountName: 'x', whereToFind: 'x', environment: 'staging' } })).toMatchObject(invalidOn('environment'));
  });

  it('a non-elevated Viewer sees Environments without pointers and no pointer list; a holder and an elevated Viewer see both', async () => {
    const admin = await elevatedViewer(server);
    const environment = (await admin.json('POST', '/environments', { body: { name: 'Review', url: 'https://review.example.com' } })).body;
    const bound = (await admin.json('POST', '/credential-pointers', { body: { label: 'Reviewer', accountName: 'reviewer', whereToFind: 'Wiki', environment: environment.id } })).body;
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    const holder = uiClient(server);
    await holder.login(await holderSecret(server, 'carol'));

    const viewerEnvironments = (await viewer.json('GET', '/environments')).body;
    expect(viewerEnvironments.find((listed: { id: number }) => listed.id === environment.id)).toEqual({ id: environment.id, name: 'Review', url: 'https://review.example.com', notes: null });
    expect(await viewer.json('GET', '/credential-pointers')).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });

    for (const reader of [alice, holder, admin]) {
      const listed = (await reader.json('GET', '/environments')).body.find((candidate: { id: number }) => candidate.id === environment.id);
      expect(listed.credentialPointers).toContainEqual(expect.objectContaining({ id: bound.id, accountName: 'reviewer' }));
      const pointers = await reader.json('GET', '/credential-pointers');
      expect(pointers.status).toBe(200);
      expect(pointers.body).toContainEqual(expect.objectContaining({ id: bound.id, environment: environment.id }));
    }
  });

  it('every Environment and pointer write is forbidden without elevation', async () => {
    const admin = await elevatedViewer(server);
    const environment = (await admin.json('POST', '/environments', { body: { name: 'Dev', url: 'https://dev.example.com' } })).body;
    const pointer = (await admin.json('POST', '/credential-pointers', { body: { label: 'Dev', accountName: 'dev', whereToFind: 'Wiki' } })).body;
    const holder = uiClient(server);
    await holder.login(await holderSecret(server, 'bob'));
    const forbidden = { status: 403, body: { error: { code: 'forbidden' } } };

    expect(await holder.json('POST', '/environments', { body: { name: 'x', url: 'https://x.example.com' } })).toMatchObject(forbidden);
    expect(await holder.json('PATCH', `/environments/${environment.id}`, { body: { name: 'x' } })).toMatchObject(forbidden);
    expect(await holder.json('DELETE', `/environments/${environment.id}`)).toMatchObject(forbidden);
    expect(await holder.json('POST', '/credential-pointers', { body: { label: 'x', accountName: 'x', whereToFind: 'x' } })).toMatchObject(forbidden);
    expect(await holder.json('PATCH', `/credential-pointers/${pointer.id}`, { body: { label: 'x' } })).toMatchObject(forbidden);
    expect(await holder.json('DELETE', `/credential-pointers/${pointer.id}`)).toMatchObject(forbidden);
    expect(await alice.json('POST', '/environments', { body: { name: 'x', url: 'https://x.example.com' } })).toMatchObject({ status: 404 });
  });
});

describe('secret-looking input', () => {
  const server = useTestServer();

  const SECRET_LOOKING = [
    'chr_alice_4fJ9kQ2pX7',
    'ghp_16C7e42F292c6912E7710c838347Ae178B4a',
    'glpat-xxxxxxxxxxxxxxxxxxxx',
    'sk-proj-abc123',
    'xoxb-1234-5678',
    'AKIAIOSFODNN7EXAMPLE',
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    'password: hunter2',
    'Password:hunter2',
    'pw=hunter2',
    'token=abc',
    'access_token=abc',
    'db_password: hunter2',
    'see 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b in the vault',
  ];

  it('refuses each secret pattern on the account name, the where-to-find text and the notes, naming the field', async () => {
    const admin = await elevatedViewer(server);
    const environment = (await admin.json('POST', '/environments', { body: { name: 'Staging', url: 'https://staging.example.com' } })).body;
    const pointer = (await admin.json('POST', '/credential-pointers', { body: { label: 'QA', accountName: 'qa', whereToFind: 'Vault' } })).body;

    for (const secret of SECRET_LOOKING) {
      expect(await admin.json('POST', '/credential-pointers', { body: { label: 'QA', accountName: secret, whereToFind: 'Vault' } }), secret).toMatchObject(invalidOn('accountName'));
      expect(await admin.json('POST', '/credential-pointers', { body: { label: 'QA', accountName: 'qa', whereToFind: secret } }), secret).toMatchObject(invalidOn('whereToFind'));
      expect(await admin.json('PATCH', `/credential-pointers/${pointer.id}`, { body: { accountName: secret } }), secret).toMatchObject(invalidOn('accountName'));
      expect(await admin.json('PATCH', `/credential-pointers/${pointer.id}`, { body: { whereToFind: secret } }), secret).toMatchObject(invalidOn('whereToFind'));
      expect(await admin.json('POST', '/environments', { body: { name: 'Prod', url: 'https://example.com', notes: secret } }), secret).toMatchObject(invalidOn('notes'));
      expect(await admin.json('PATCH', `/environments/${environment.id}`, { body: { notes: secret } }), secret).toMatchObject(invalidOn('notes'));
    }
    expect((await admin.json('GET', '/credential-pointers')).body).toHaveLength(1);
  });

  it('lets an ordinary account name and a long sentence through', async () => {
    const admin = await elevatedViewer(server);
    const sentence = 'Ask the platform team in the #ops channel for the shared 1Password entry called Staging QA administrator, then sign in with the task-runner account and reset it afterwards.';

    const pointer = await admin.json('POST', '/credential-pointers', { body: { label: 'QA admin', accountName: 'qa-admin@example.com', whereToFind: sentence } });
    const environment = await admin.json('POST', '/environments', { body: { name: 'Staging', url: 'https://staging.example.com', notes: sentence } });

    expect(pointer).toMatchObject({ status: 201, body: { accountName: 'qa-admin@example.com', whereToFind: sentence } });
    expect(environment).toMatchObject({ status: 201, body: { notes: sentence } });
  });
});

describe('the Adapter files', () => {
  const server = useTestServer();
  let alice: ApiClient;

  beforeAll(async () => {
    alice = apiClient(server, await holderSecret(server, 'alice', 'Alice'));
  });

  const adapterFile = async (client: { request: ApiClient['request'] }, name: string) => {
    const response = await client.request('GET', `/instance/adapter/${name}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^text\/markdown/);
    return response.text();
  };

  it('issue-tracker.md speaks this Instance\'s words with the header, the major and the Label groups table', async () => {
    const doc = await adapterFile(alice, 'issue-tracker.md');
    const today = new Date().toISOString().slice(0, 10);

    expect(doc).toMatch(/^# Issue tracker: Chartroom\n/);
    expect(doc).toContain(`<!-- Generated by Chartroom 0.1.0 on ${today} from ${server.baseUrl}. Do not edit by hand: re-run \`chartroom adapter --write docs/agents\` after changing instance settings. -->`);
    expect(doc).toContain(`live in the Chartroom instance at **${server.baseUrl}**`);
    expect(doc).toContain('Run it as `npx -y chartroom-cli@0 <command>`');
    expect(doc).toContain('This instance calls an effort an **Effort** (plural **Efforts**)');
    expect(doc).toContain('## Label groups on this instance');
    expect(doc).toContain('| `triage-category` | `bug`, `enhancement` | yes |');
    expect(doc).toContain('| `triage-state` | `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` | yes |');
    expect(doc).toContain('| `wayfinder-type` | `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, `wayfinder:task` | yes |');
    expect(doc).not.toMatch(/tracker\.example\.com|\{\{/);
  });

  it('issue-tracker.md carries the spec\'s recipes for edits, appends, reporter activity, changes, list links, PRs, setup and finishing', async () => {
    const doc = await adapterFile(alice, 'issue-tracker.md');

    expect(doc).toContain(`Chartroom at \`${server.baseUrl}\`; run \`npx -y chartroom-cli@0 adapter --write docs/agents\``);
    expect(doc).toContain('`setup-matt-pocock-skills`');
    expect(doc).toContain('`chartroom issue edit <n> --if-version <version> --body-file -`');
    expect(doc).toContain('`conflict`');
    expect(doc).toContain('`chartroom issue append <map n> --section "Decisions so far" --text "- [<ticket title>](<ticket url>): <gist>"`');
    expect(doc).toContain('`## Decisions so far`');
    expect(doc).toContain('the newest comment\'s `author` equals the issue\'s `createdBy`');
    expect(doc).not.toMatch(/system comment/i);
    expect(doc).toContain('`chartroom issue changes <n>`');
    expect(doc).toContain(`A link to a list is \`${server.baseUrl}/issues?\` plus the same query \`issue list\` would send: the frontier of a map is \`?view=frontier&parent=<map n>\`, a picked set is \`?numbers=12,45\`.`);
    expect(doc).toContain('**PRs as a request surface: no.**');
    expect(doc).toContain('## When a ticket\'s work is finished');
    expect(doc).toContain('- **Done.** An issue is done when its `state` is `closed`, nothing else.');
    expect(doc).toContain('`chartroom issue list --view frontier --parent <map n> --all`');
    expect(doc).toContain('`chartroom issue list --missing triage-state --state open --sort createdAt --all`');
  });

  it('triage-labels.md shows the default Display labels with the header', async () => {
    const doc = await adapterFile(alice, 'triage-labels.md');
    const today = new Date().toISOString().slice(0, 10);

    expect(doc).toMatch(/^# Triage Labels\n/);
    expect(doc).toContain(`<!-- Generated by Chartroom 0.1.0 on ${today} from ${server.baseUrl}. Do not edit by hand: re-run \`chartroom adapter --write docs/agents\` after changing a display label. -->`);
    expect(doc).toContain('| `needs-triage` | `needs-triage` | Needs triage | Maintainer needs to evaluate this issue |');
    expect(doc).toContain('| `wontfix` | `wontfix` | Won\'t fix | Will not be actioned |');
  });

  it('both files follow a settings change on the next request and are readable by a Viewer', async () => {
    const admin = await elevatedViewer(server);
    await admin.json('PATCH', '/instance', { body: { effortName: { singular: 'Initiative' }, triageLabels: { 'ready-for-agent': 'AFK ready' } } });
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    const tracker = await adapterFile(viewer, 'issue-tracker.md');
    const triage = await adapterFile(alice, 'triage-labels.md');

    expect(tracker).toContain('This instance calls an effort an **Initiative** (plural **Initiatives**)');
    expect(tracker).toContain('Create the issue under its Initiative.');
    expect(tracker).not.toMatch(/\bEfforts?\b/);
    expect(tracker).toContain('`chartroom effort view <slug>`');
    expect(triage).toContain('| `ready-for-agent` | `ready-for-agent` | AFK ready | Fully specified, ready for an AFK agent |');
  });
});

describe('the admin page reads', () => {
  const server = useTestServer();

  it('every session reads the runtime settings from environment variables, read-only', async () => {
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);

    expect(await viewer.json('GET', '/runtime')).toEqual({
      status: 200,
      body: { baseUrl: null, trustProxy: false, port: server.port, updateCheck: true },
    });
    expect(await viewer.json('PATCH', '/runtime', { body: { port: 1 } })).toMatchObject({ status: 404 });
  });

  it('first run lasts until the first holder exists and never returns, even after that holder is revoked', async () => {
    const admin = await elevatedViewer(server);
    expect(await admin.json('GET', '/setup')).toEqual({ status: 200, body: { firstRun: true } });

    await admin.createHolder('alice');
    expect(await admin.json('GET', '/setup')).toEqual({ status: 200, body: { firstRun: false } });

    await admin.json('POST', '/holders/alice/revoke');
    const viewer = uiClient(server);
    await viewer.login(TEST_PASSWORDS.CHARTROOM_VIEWER_PASSWORD);
    expect(await viewer.json('GET', '/setup')).toEqual({ status: 200, body: { firstRun: false } });
  });
});
