import { execFile } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';
import { runCli } from '../../cli/src/chartroom';
import { apiClient, holderSecret } from './clients';
import { freePort, useTestServer } from './harness';

const CLI_ROOT = resolve(import.meta.dirname, '../../cli');

const execFileAsync = promisify(execFile);

const rowNumbers = (rows: { number: number }[]) => rows.map(row => row.number);

describe('the CLI', () => {
  const server = useTestServer();
  let aliceSecret: string;
  let aliceApi: ReturnType<typeof apiClient>;

  beforeAll(async () => {
    aliceSecret = await holderSecret(server, 'alice', 'Alice');
    aliceApi = apiClient(server, aliceSecret);
  });

  const chartroom = async (argv: string[], options: { stdin?: string, secret?: string, version?: string } = {}) => {
    let stdout = '';
    let stderr = '';
    const code = await runCli({
      argv,
      env: { CHARTROOM_URL: server.baseUrl, CHARTROOM_TOKEN: options.secret ?? aliceSecret },
      stdin: Readable.from([options.stdin ?? '']),
      stdout: { write: (chunk: string) => (stdout += chunk, true) },
      stderr: { write: (chunk: string) => (stderr += chunk, true) },
      version: options.version,
    });
    return { code, stdout, stderr };
  };

  const printedJson = async (argv: string[]) => JSON.parse((await chartroom(argv)).stdout);

  const createTicket = (title: string, ...flags: string[]) => printedJson(['issue', 'create', '--kind', 'ticket', '--title', title, ...flags]);

  const expectEnvelope = (result: Awaited<ReturnType<typeof chartroom>>, code: string) => {
    expect(result).toMatchObject({ code: 1, stdout: '' });
    expect(JSON.parse(result.stderr)).toMatchObject({ error: { code } });
  };

  it('me prints the holder behind the secret as pretty JSON', async () => {
    const result = await chartroom(['me']);

    expect(result).toEqual({ code: 0, stdout: `${JSON.stringify({ slug: 'alice', displayName: 'Alice' }, null, 2)}\n`, stderr: '' });
  });

  it('a rejected secret is the API envelope on stderr with exit 1 and nothing on stdout', async () => {
    const served = await (await apiClient(server, 'wrong').request('GET', '/me')).text();

    const result = await chartroom(['me'], { secret: 'wrong' });

    expect(result).toEqual({ code: 1, stdout: '', stderr: `${served}\n` });
    expect(JSON.parse(result.stderr)).toMatchObject({ error: { code: 'unauthenticated' } });
  });

  it('an unreachable instance is the unreachable code on stderr with exit 1', async () => {
    const closedUrl = `http://127.0.0.1:${await freePort()}`;

    const result = await chartroom(['me', '--url', closedUrl]);

    expect(result).toMatchObject({ code: 1, stdout: '' });
    expect(JSON.parse(result.stderr)).toEqual({ error: { code: 'unreachable', message: expect.stringContaining(closedUrl) } });
  });

  it('a wrong flag, an unknown command or a missing argument is usage on stderr with exit 2', async () => {
    for (const argv of [['me', '--bogus'], ['frobnicate'], [], ['issue', 'view'], ['issue', 'view', '1', '2'], ['issue', 'block', '1']]) {
      const result = await chartroom(argv);

      expect(result, argv.join(' ')).toMatchObject({ code: 2, stdout: '' });
      expect(result.stderr, argv.join(' ')).toContain('usage: chartroom');
    }
  });

  it('issue create and issue view print the Document the API serves', async () => {
    const blocker = await createTicket('Blocker');
    const created = await chartroom(['issue', 'create', '--kind', 'ticket', '--title', 'Wire it', '--body', 'Do it', '--label', 'bug', '--label', 'needs-triage', '--blocked-by', String(blocker.number)]);
    const { number } = JSON.parse(created.stdout);

    const viewed = await chartroom(['issue', 'view', String(number)]);

    expect(created).toMatchObject({ code: 0, stderr: '' });
    expect(JSON.parse(created.stdout)).toMatchObject({ kind: 'ticket', title: 'Wire it', body: 'Do it', labels: ['bug', 'needs-triage'], blockedBy: [{ title: 'Blocker', open: true }], createdBy: 'alice' });
    expect(viewed).toEqual({ code: 0, stdout: `${JSON.stringify((await aliceApi.json('GET', `/issues/${number}`)).body, null, 2)}\n`, stderr: '' });
  });

  it('viewing an unknown issue is the not-found envelope with exit 1', async () => {
    expectEnvelope(await chartroom(['issue', 'view', '999999']), 'not-found');
  });

  it('claiming an issue another holder holds is the conflict envelope with exit 1', async () => {
    const bobSecret = await holderSecret(server, 'bob-claims', 'Bob');
    const { number } = await createTicket('Contested');
    await chartroom(['issue', 'claim', String(number)]);

    expectEnvelope(await chartroom(['issue', 'claim', String(number)], { secret: bobSecret }), 'conflict');
  });

  it('editing another holder\'s comment is the forbidden envelope with exit 1', async () => {
    const bobSecret = await holderSecret(server, 'bob-comments', 'Bob');
    const { number } = await createTicket('Commented');
    const comment = await printedJson(['issue', 'comment', String(number), '--body', 'Mine']);

    expectEnvelope(await chartroom(['issue', 'comment', 'edit', String(number), String(comment.id), '--body', 'Hijacked'], { secret: bobSecret }), 'forbidden');
  });

  it('appending to a missing section is the invalid envelope with exit 1', async () => {
    const { number } = await createTicket('No sections');

    expectEnvelope(await chartroom(['issue', 'append', String(number), '--section', 'Nowhere', '--text', 'x']), 'invalid');
  });

  describe('issue list on a store larger than one page', () => {
    let bulkNumbers: number[];

    beforeAll(async () => {
      const bulk = await Promise.all(Array.from({ length: 52 }, (_, index) => createTicket(`Bulk ${index}`, '--label', 'bulk')));
      bulkNumbers = rowNumbers(bulk).sort((a, b) => a - b);
    });

    it('prints the first page as the items, nextCursor and effortCounts envelope', async () => {
      const page = await printedJson(['issue', 'list', '--label', 'bulk']);

      expect(page).toEqual({ items: expect.any(Array), nextCursor: expect.any(String), effortCounts: [{ effort: null, count: 52 }] });
      expect(rowNumbers(page.items)).toEqual(bulkNumbers.slice(0, 50));
    });

    it('pages by hand with --limit and --cursor', async () => {
      const firstPage = await printedJson(['issue', 'list', '--label', 'bulk', '--limit', '30']);
      const secondPage = await printedJson(['issue', 'list', '--label', 'bulk', '--limit', '30', '--cursor', firstPage.nextCursor]);

      expect(rowNumbers([...firstPage.items, ...secondPage.items])).toEqual(bulkNumbers);
      expect(secondPage.nextCursor).toBeNull();
    });

    it('--all follows every cursor and prints one plain array', async () => {
      const result = await chartroom(['issue', 'list', '--label', 'bulk', '--all']);

      expect(result.code).toBe(0);
      expect(rowNumbers(JSON.parse(result.stdout))).toEqual(bulkNumbers);
    });
  });

  it('every -file flag given - reads stdin', async () => {
    const created = JSON.parse((await chartroom(['issue', 'create', '--kind', 'ticket', '--title', 'Piped', '--body-file', '-'], { stdin: '## Notes\n\nfrom stdin' })).stdout);
    const appended = JSON.parse((await chartroom(['issue', 'append', String(created.number), '--section', 'Notes', '--text-file', '-'], { stdin: 'appended' })).stdout);
    const closed = JSON.parse((await chartroom(['issue', 'close', String(created.number), '--comment-file', '-'], { stdin: 'Done via pipe' })).stdout);
    const effort = await printedJson(['issue', 'create', '--kind', 'effort', '--name', 'piped', '--title', 'Piped effort']);
    const edited = JSON.parse((await chartroom(['issue', 'edit', String(effort.number), '--test-instructions-file', '-'], { stdin: 'Open staging' })).stdout);

    expect(created.body).toBe('## Notes\n\nfrom stdin');
    expect(appended.body).toBe('## Notes\n\nfrom stdin\nappended');
    expect(closed).toMatchObject({ state: 'closed', resolution: { body: 'Done via pipe' } });
    expect(edited.testInstructions).toBe('Open staging');
  });

  it('two -file flags both reading stdin are a usage error with exit 2 and write nothing', async () => {
    const effort = await printedJson(['issue', 'create', '--kind', 'effort', '--name', 'two-pipes', '--title', 'Two pipes', '--body', 'Kept']);

    const result = await chartroom(['issue', 'edit', String(effort.number), '--body-file', '-', '--test-instructions-file', '-'], { stdin: 'piped' });

    expect(result).toMatchObject({ code: 2, stdout: '' });
    expect(result.stderr).toContain('usage: chartroom');
    expect(await printedJson(['issue', 'view', String(effort.number)])).toMatchObject({ body: 'Kept', testInstructions: null, version: 1 });
  });

  it('issue list -q takes a search text that starts with a dash', async () => {
    const { number } = await createTicket('Handle -dashed input');

    const result = await chartroom(['issue', 'list', '-q', '-dashed']);

    expect(result.code).toBe(0);
    expect(rowNumbers(JSON.parse(result.stdout).items)).toEqual([number]);
  });

  it('issue list takes --missing more than once, ANDing the groups', async () => {
    const { number } = await createTicket('Untriaged and untyped', '--label', 'cli-missing');
    await createTicket('Triaged', '--label', 'cli-missing', '--label', 'needs-info');
    await createTicket('Typed', '--label', 'cli-missing', '--label', 'wayfinder:task');

    const result = await chartroom(['issue', 'list', '--label', 'cli-missing', '--missing', 'triage-state', '--missing', 'wayfinder-type']);

    expect(result.code).toBe(0);
    expect(rowNumbers(JSON.parse(result.stdout).items)).toEqual([number]);
  });

  it('edit --if-version with a stale version surfaces the conflict and does not retry', async () => {
    const { number, version } = await createTicket('Original');
    await chartroom(['issue', 'edit', String(number), '--if-version', String(version), '--title', 'First writer']);

    const stale = await chartroom(['issue', 'edit', String(number), '--if-version', String(version), '--title', 'Second writer']);

    expect(stale).toMatchObject({ code: 1, stdout: '' });
    expect(JSON.parse(stale.stderr)).toMatchObject({ error: { code: 'conflict', field: 'version' } });
    expect(await printedJson(['issue', 'view', String(number)])).toMatchObject({ title: 'First writer', version: version + 1 });
  });

  it('adapter prints issue-tracker.md, adapter --write writes both files byte-identical to the served ones', async () => {
    const servedFile = async (file: string) => Buffer.from(await (await aliceApi.request('GET', `/instance/adapter/${file}`)).arrayBuffer());
    const directory = join(mkdtempSync(join(tmpdir(), 'chartroom-adapter-')), 'docs', 'agents');

    const printed = await chartroom(['adapter']);
    const written = await chartroom(['adapter', '--write', directory]);

    expect(printed).toEqual({ code: 0, stdout: (await servedFile('issue-tracker.md')).toString('utf8'), stderr: '' });
    expect(written).toEqual({ code: 0, stdout: '', stderr: '' });
    expect(readFileSync(join(directory, 'issue-tracker.md'))).toEqual(await servedFile('issue-tracker.md'));
    expect(readFileSync(join(directory, 'triage-labels.md'))).toEqual(await servedFile('triage-labels.md'));
  });

  it('effort artifacts prints the markdown list as served', async () => {
    const effort = await printedJson(['issue', 'create', '--kind', 'effort', '--name', 'handoff', '--title', 'Hand-off']);
    const ticket = await createTicket('Spike it', '--parent', String(effort.number));
    await chartroom(['issue', 'link', 'add', String(ticket.number), '--role', 'artifact', '--type', 'branch', '--url', 'https://git.example/tree/spike', '--title', 'Spike']);

    const result = await chartroom(['effort', 'artifacts', 'handoff']);

    expect(result).toEqual({ code: 0, stdout: '- [Spike](https://git.example/tree/spike)\n', stderr: '' });
  });

  it('an instance on another major prints one warning line on stderr and still completes the call', async () => {
    const result = await chartroom(['me'], { version: '9.0.0' });

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ slug: 'alice', displayName: 'Alice' });
    expect(result.stderr.split('\n')).toEqual([expect.stringMatching(/0\.1\.0.*9\.0\.0|9\.0\.0.*0\.1\.0/), '']);
  });

  it('every verb reaches its route and prints the API JSON unchanged; writes without a body print nothing', async () => {
    const servedJson = async (path: string) => (await aliceApi.json('GET', path)).body;
    const succeeds = async (argv: string[]) => {
      const result = await chartroom(argv);
      expect(result, argv.join(' ')).toMatchObject({ code: 0, stderr: '' });
      return JSON.parse(result.stdout);
    };
    const printsNothing = async (argv: string[]) => expect(await chartroom(argv), argv.join(' ')).toEqual({ code: 0, stdout: '', stderr: '' });
    const printsDocument = async (argv: string[], number: number) => expect(await succeeds(argv)).toEqual(await servedJson(`/issues/${number}`));

    const effort = await succeeds(['issue', 'create', '--kind', 'effort', '--name', 'walk', '--title', 'Walk']);
    const map = await succeeds(['issue', 'create', '--kind', 'map', '--parent', String(effort.number), '--title', 'Map', '--body', '## Decisions so far\n']);
    const ticket = await succeeds(['issue', 'create', '--kind', 'ticket', '--parent', String(map.number), '--title', 'Ticket']);
    const blocker = await succeeds(['issue', 'create', '--kind', 'ticket', '--title', 'Blocker']);
    const ticketNumber = String(ticket.number);

    await printsDocument(['issue', 'view', ticketNumber], ticket.number);
    await printsDocument(['issue', 'edit', ticketNumber, '--title', 'Ticket, renamed', '--no-parent'], ticket.number);
    await printsDocument(['issue', 'edit', ticketNumber, '--parent', String(map.number)], ticket.number);
    await printsDocument(['issue', 'append', String(map.number), '--section', 'Decisions so far', '--text', '- decided'], map.number);
    await printsNothing(['issue', 'label', 'add', ticketNumber, 'needs-triage']);
    await printsNothing(['issue', 'label', 'remove', ticketNumber, 'needs-triage']);
    await printsNothing(['issue', 'block', ticketNumber, '--by', String(blocker.number)]);
    expect((await servedJson(`/issues/${ticketNumber}`)).blockedBy).toEqual([{ number: blocker.number, title: 'Blocker', open: true }]);
    await printsNothing(['issue', 'unblock', ticketNumber, '--by', String(blocker.number)]);
    expect((await servedJson(`/issues/${ticketNumber}`)).blockedBy).toEqual([]);
    const comment = await succeeds(['issue', 'comment', ticketNumber, '--body', 'First']);
    expect(await succeeds(['issue', 'comment', 'edit', ticketNumber, String(comment.id), '--body', 'Edited'])).toMatchObject({ id: comment.id, body: 'Edited' });
    await printsNothing(['issue', 'comment', 'delete', ticketNumber, String(comment.id)]);
    const link = await succeeds(['issue', 'link', 'add', ticketNumber, '--role', 'resource', '--type', 'doc', '--url', 'https://docs.example/brief', '--title', 'Brief']);
    expect(await succeeds(['issue', 'link', 'edit', ticketNumber, String(link.id), '--title', 'Brief v2'])).toEqual({ ...link, title: 'Brief v2' });
    await printsNothing(['issue', 'link', 'remove', ticketNumber, String(link.id)]);
    expect((await servedJson(`/issues/${ticketNumber}`)).links).toEqual([]);
    await printsDocument(['issue', 'claim', ticketNumber], ticket.number);
    await printsDocument(['issue', 'unassign', ticketNumber], ticket.number);
    await printsDocument(['issue', 'close', ticketNumber, '--comment', 'Done'], ticket.number);
    await printsDocument(['issue', 'reopen', ticketNumber], ticket.number);
    expect(await succeeds(['issue', 'changes', ticketNumber, '--field', 'title'])).toEqual(await servedJson(`/issues/${ticketNumber}/changes?field=title`));
    expect(await succeeds(['issue', 'list', '--view', 'frontier', '--parent', String(map.number)])).toEqual(await servedJson(`/issues?view=frontier&parent=${map.number}`));
    expect(await succeeds(['effort', 'list'])).toEqual(await servedJson('/efforts'));
    expect(await succeeds(['effort', 'view', 'walk'])).toEqual(await servedJson('/efforts/walk'));
    for (const read of ['environments', 'credential-pointers', 'labels', 'holders', 'me', 'instance']) {
      expect(await succeeds([read])).toEqual(await servedJson(`/${read}`));
    }
    await printsNothing(['issue', 'delete', String(blocker.number)]);
    expect(JSON.parse((await chartroom(['issue', 'view', String(blocker.number)])).stderr)).toMatchObject({ error: { code: 'not-found' } });
  });

  it('the package ships chart and chartroom as one ESM file at the instance version with zero runtime dependencies', () => {
    const manifest = JSON.parse(readFileSync(join(CLI_ROOT, 'package.json'), 'utf8'));
    const rootManifest = JSON.parse(readFileSync(join(CLI_ROOT, '..', 'package.json'), 'utf8'));
    const compiled = readFileSync(join(CLI_ROOT, manifest.bin.chartroom), 'utf8');

    expect(manifest).toMatchObject({ name: 'chartroom-cli', version: rootManifest.version, type: 'module', bin: { 'chartroom-cli': 'dist/chartroom.js', 'chartroom': 'dist/chartroom.js', 'chart': 'dist/chartroom.js' }, files: ['dist'] });
    expect(manifest.dependencies).toBeUndefined();
    expect(readdirSync(join(CLI_ROOT, 'dist'))).toEqual(['chartroom.js']);
    expect(compiled.startsWith('#!/usr/bin/env node\n')).toBe(true);
    expect([...compiled.matchAll(/from '([^']+)'/g)].every(([, specifier]) => specifier!.startsWith('node:'))).toBe(true);
  });

  it('the built bin runs a command when executed directly', async () => {
    const manifest = JSON.parse(readFileSync(join(CLI_ROOT, 'package.json'), 'utf8'));

    const { stdout } = await execFileAsync(process.execPath, [join(CLI_ROOT, manifest.bin.chart), 'me'], { env: { CHARTROOM_URL: server.baseUrl, CHARTROOM_TOKEN: aliceSecret } });

    expect(JSON.parse(stdout)).toEqual({ slug: 'alice', displayName: 'Alice' });
  });
});
