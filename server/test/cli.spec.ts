import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';
import { runCli, VERBS } from '../../cli/src/chartroom';
import { apiClient, holderSecret } from './clients';
import { freePort, useTestServer } from './harness';
import { MANIFEST_MAJOR, MANIFEST_VERSION, NEXT_MAJOR_VERSION } from './manifest-version';

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

  describe('with a .env in the working directory', () => {
    // eslint-disable-next-line no-unused-vars -- the core rule misreads type-level parameters
    const inDirWith = async (prepare: (dotEnvPath: string) => void, argv: string[], env: Record<string, string>) => {
      const cwd = mkdtempSync(join(tmpdir(), 'chartroom-dotenv-'));
      prepare(join(cwd, '.env'));
      let stdout = '';
      let stderr = '';
      const code = await runCli({
        argv,
        env,
        cwd,
        stdin: Readable.from(['']),
        stdout: { write: (chunk: string) => (stdout += chunk, true) },
        stderr: { write: (chunk: string) => (stderr += chunk, true) },
      });
      return { code, stdout, stderr, dotEnvPath: join(cwd, '.env') };
    };

    const ALICE = `${JSON.stringify({ slug: 'alice', displayName: 'Alice' }, null, 2)}\n`;

    it('takes the URL and the secret from the file when the environment has neither', async () => {
      const result = await inDirWith(path => writeFileSync(path, `CHARTROOM_URL=${server.baseUrl}\nCHARTROOM_TOKEN=${aliceSecret}\n`), ['me'], {});

      expect(result).toMatchObject({ code: 0, stdout: ALICE });
    });

    it('the environment wins over the file', async () => {
      const closedUrl = `http://127.0.0.1:${await freePort()}`;

      const result = await inDirWith(path => writeFileSync(path, `CHARTROOM_URL=${closedUrl}\nCHARTROOM_TOKEN=wrong\n`), ['me'], { CHARTROOM_URL: server.baseUrl, CHARTROOM_TOKEN: aliceSecret });

      expect(result).toMatchObject({ code: 0, stdout: ALICE });
    });

    it('--url and --token win over the environment and the file', async () => {
      const closedUrl = `http://127.0.0.1:${await freePort()}`;

      const result = await inDirWith(
        path => writeFileSync(path, `CHARTROOM_URL=${closedUrl}\nCHARTROOM_TOKEN=wrong\n`),
        ['me', '--url', server.baseUrl, '--token', aliceSecret],
        { CHARTROOM_URL: closedUrl, CHARTROOM_TOKEN: 'also-wrong' },
      );

      expect(result).toMatchObject({ code: 0, stdout: ALICE });
    });

    it('a missing file is silent', async () => {
      const result = await inDirWith(() => {}, ['me'], { CHARTROOM_URL: server.baseUrl, CHARTROOM_TOKEN: aliceSecret });

      expect(result).toMatchObject({ code: 0, stdout: ALICE, stderr: '' });
    });

    it('an unreadable file is one line naming it on stderr with exit 1', async () => {
      const result = await inDirWith(mkdirSync, ['me'], { CHARTROOM_URL: server.baseUrl, CHARTROOM_TOKEN: aliceSecret });

      expect(result).toMatchObject({ code: 1, stdout: '' });
      expect(result.stderr).toMatch(new RegExp(`^chartroom: cannot read ${result.dotEnvPath}: [^\n]+\n$`));
    });
  });

  it('--version and -v print the CLI version, --help and -h the usage, on stdout with exit 0', async () => {
    for (const flag of ['--version', '-v']) {
      expect(await chartroom([flag], { version: '9.8.7' }), flag).toEqual({ code: 0, stdout: '9.8.7\n', stderr: '' });
    }
    for (const flag of ['--help', '-h']) {
      const result = await chartroom([flag]);

      expect(result, flag).toMatchObject({ code: 0, stderr: '' });
      expect(result.stdout, flag).toContain('usage: chartroom');
    }
  });

  it('--help after a command or subcommand prints its usage with exit 0, in any position, without acting', async () => {
    const before = (await aliceApi.json('GET', '/issues')).body;
    const commands = [...VERBS.map(verb => verb.words), ['init'], ['issue'], ['issue', 'link'], ['research']];

    for (const words of commands) {
      for (const argv of [[...words, '--help'], [...words, '--help', '--bogus'], ...VERBS.some(verb => verb.words.join() === words.join()) ? [[...words, '1', '2', '--help']] : []]) {
        const result = await chartroom(argv);

        expect(result, argv.join(' ')).toMatchObject({ code: 0, stderr: '' });
        expect(result.stdout, argv.join(' ')).toContain(`chartroom ${words.join(' ')}`);
      }
    }
    const result = await chartroom(['issue', 'create', '--help']);
    expect(result.stdout).toContain('--title <value>');
    expect(result.stdout).toContain('--blocked-by <value>');
    expect((await aliceApi.json('GET', '/issues')).body).toEqual(before);
    expect(await chartroom(['issue', 'delete', '1', '--help'])).toMatchObject({ code: 0, stderr: '' });
    expect(await chartroom(['frobnicate', '--help'])).toMatchObject({ code: 2, stdout: '' });
  });

  it('a wrong flag, an unknown command or a missing argument is usage on stderr with exit 2', async () => {
    for (const argv of [['me', '--bogus'], ['frobnicate'], [], ['issue', 'view'], ['issue', 'view', '1', '2'], ['issue', 'block', '1'], ['research', 'put', '1']]) {
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

    it('--all follows every cursor and prints one page shape holding every item, its nextCursor null', async () => {
      const result = await chartroom(['issue', 'list', '--label', 'bulk', '--all']);
      const allPages = JSON.parse(result.stdout);

      expect(result.code).toBe(0);
      expect(Object.keys(allPages)).toEqual(Object.keys(await printedJson(['issue', 'list', '--label', 'bulk'])));
      expect(rowNumbers(allPages.items)).toEqual(bulkNumbers);
      expect(allPages.nextCursor).toBeNull();
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

  describe('research', () => {
    it('put reads the file, takes the slug from its name and the title from its heading, and prints the note with its url; put again replaces it', async () => {
      const ticket = await createTicket('Transcription spike');
      const directory = mkdtempSync(join(tmpdir(), 'chartroom-research-'));
      const file = join(directory, 'local-transcription.md');
      writeFileSync(file, '# Local transcription\n\nWhisper runs offline.\n');

      const created = await chartroom(['research', 'put', String(ticket.number), file]);
      expect(created).toMatchObject({ code: 0, stderr: '' });
      expect(JSON.parse(created.stdout)).toMatchObject({ slug: 'local-transcription', title: 'Local transcription', body: '# Local transcription\n\nWhisper runs offline.\n', url: `${server.baseUrl}/issues/${ticket.number}/research/local-transcription` });

      writeFileSync(file, '# Local transcription, revised\n');
      expect(JSON.parse((await chartroom(['research', 'put', String(ticket.number), file])).stdout)).toMatchObject({ title: 'Local transcription, revised' });
      expect((await aliceApi.json('GET', `/issues/${ticket.number}/research`)).body.items).toHaveLength(1);
    });

    it('put - reads stdin under --slug; without --slug it is a usage error that writes nothing', async () => {
      const ticket = await createTicket('Piped research');

      const missingSlug = await chartroom(['research', 'put', String(ticket.number), '-'], { stdin: '# Piped' });
      expect(missingSlug).toMatchObject({ code: 2, stdout: '' });
      expect(missingSlug.stderr).toContain('needs --slug');

      const piped = JSON.parse((await chartroom(['research', 'put', String(ticket.number), '-', '--slug', 'piped-notes'], { stdin: '# Piped' })).stdout);
      expect(piped).toMatchObject({ slug: 'piped-notes', title: 'Piped', body: '# Piped' });
      expect((await aliceApi.json('GET', `/issues/${ticket.number}/research`)).body.items.map((note: { slug: string }) => note.slug)).toEqual(['piped-notes']);
    });

    it('--slug overrides the file name; list and view print what the API serves', async () => {
      const ticket = await createTicket('Listed research');
      const file = join(mkdtempSync(join(tmpdir(), 'chartroom-research-')), 'draft.md');
      writeFileSync(file, 'no heading');
      await chartroom(['research', 'put', String(ticket.number), file, '--slug', 'final']);

      const listed = await chartroom(['research', 'list', String(ticket.number)]);
      const viewed = await chartroom(['research', 'view', String(ticket.number), 'final']);

      expect(JSON.parse(listed.stdout)).toEqual((await aliceApi.json('GET', `/issues/${ticket.number}/research`)).body);
      expect(JSON.parse(listed.stdout)).toMatchObject({ items: [{ slug: 'final', title: 'final' }], nextCursor: null });
      expect(JSON.parse(viewed.stdout)).toEqual((await aliceApi.json('GET', `/issues/${ticket.number}/research/final`)).body);
      expectEnvelope(await chartroom(['research', 'view', String(ticket.number), 'missing']), 'not-found');
    });
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

  it('adapter prints both files under a path marker line each, adapter --write writes them byte-identical to the served ones', async () => {
    const servedFile = async (file: string) => Buffer.from(await (await aliceApi.request('GET', `/instance/adapter/${file}`)).arrayBuffer());
    const directory = join(mkdtempSync(join(tmpdir(), 'chartroom-adapter-')), 'docs', 'agents');

    const printed = await chartroom(['adapter']);
    const written = await chartroom(['adapter', '--write', directory]);

    expect(printed).toEqual({
      code: 0,
      stdout: `<!-- docs/agents/issue-tracker.md -->\n${await servedFile('issue-tracker.md')}<!-- docs/agents/triage-labels.md -->\n${await servedFile('triage-labels.md')}`,
      stderr: '',
    });
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

  it('an instance on another major prints one warning line naming the install and npx fixes, and still completes the call', async () => {
    const result = await chartroom(['me'], { version: NEXT_MAJOR_VERSION });

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ slug: 'alice', displayName: 'Alice' });
    expect(result.stderr).toBe(`chartroom: the instance runs ${MANIFEST_VERSION} but this CLI is ${NEXT_MAJOR_VERSION}; install chartroom-cli@${MANIFEST_MAJOR} (npm install -g chartroom-cli@${MANIFEST_MAJOR}) or use npx -y chartroom-cli@${MANIFEST_MAJOR}\n`);
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

  it('the package ships chart and chartroom as one ESM entry at the instance version with zero runtime dependencies', () => {
    const manifest = JSON.parse(readFileSync(join(CLI_ROOT, 'package.json'), 'utf8'));
    const rootManifest = JSON.parse(readFileSync(join(CLI_ROOT, '..', 'package.json'), 'utf8'));
    const compiled = readFileSync(join(CLI_ROOT, manifest.bin.chartroom), 'utf8');

    expect(manifest).toMatchObject({ name: 'chartroom-cli', version: rootManifest.version, type: 'module', bin: { 'chartroom-cli': 'dist/chartroom.js', 'chartroom': 'dist/chartroom.js', 'chart': 'dist/chartroom.js' }, files: ['dist'] });
    expect(manifest.dependencies).toBeUndefined();
    const shipped = readdirSync(join(CLI_ROOT, 'dist')).sort();
    expect(shipped).toEqual(readdirSync(join(CLI_ROOT, 'src')).map(source => source.replace(/\.ts$/, '.js')).sort());
    expect(compiled.startsWith('#!/usr/bin/env node\n')).toBe(true);
    const specifiers = shipped.flatMap(file => [...readFileSync(join(CLI_ROOT, 'dist', file), 'utf8').matchAll(/(?:from|import) '([^']+)'/g)].map(([, specifier]) => specifier!));
    expect(specifiers.filter(specifier => !/^node:|^\.\/[\w-]+\.js$/.test(specifier))).toEqual([]);
  });

  it('the built bin runs a command when executed directly', async () => {
    const manifest = JSON.parse(readFileSync(join(CLI_ROOT, 'package.json'), 'utf8'));

    const { stdout } = await execFileAsync(process.execPath, [join(CLI_ROOT, manifest.bin.chart), 'me'], { env: { CHARTROOM_URL: server.baseUrl, CHARTROOM_TOKEN: aliceSecret } });

    expect(JSON.parse(stdout)).toEqual({ slug: 'alice', displayName: 'Alice' });
  });
});
