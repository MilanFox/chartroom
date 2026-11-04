#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import type { ParseArgsOptionsConfig } from 'node:util';

// eslint-disable-next-line no-unused-vars -- the core rule misreads type-level parameters
type Handler<Args extends unknown[], Result> = (...args: Args) => Result;

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

type Flags = Record<string, string | boolean | (string | boolean)[] | undefined>;

interface Input {
  flags: Flags
  text: Handler<[string], Promise<string | undefined>>
}

interface Verb {
  words: string[]
  method: Method
  path: string
  positionals?: string[]
  pathFlags?: Record<string, string>
  flags?: ParseArgsOptionsConfig
  query?: string[]
  paged?: boolean
  body?: Handler<[Input], Promise<Record<string, unknown>>>
  ifVersion?: boolean
  markdown?: boolean
  alsoWrites?: string[]
}

interface Output {
  write: Handler<[string], boolean>
}

export interface CliContext {
  argv: string[]
  env: Record<string, string | undefined>
  stdin: AsyncIterable<string | Uint8Array>
  stdout: Output
  stderr: Output
  version?: string
}

class UsageError extends Error {}

class ApiFailure extends Error {
  constructor(readonly envelope: string) {
    super(envelope);
  }
}

const valueFlags = (...names: string[]): ParseArgsOptionsConfig => Object.fromEntries(names.map(name => [name, { type: 'string' }]));

const inlineOrFileFlags = (...names: string[]) => valueFlags(...names.flatMap(name => [name, `${name}-file`]));

const asNumber = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

const GLOBAL_FLAGS = valueFlags('url', 'token');

const PAGE_QUERY = ['limit', 'cursor'];

const PAGING_FLAGS: ParseArgsOptionsConfig = { ...valueFlags(...PAGE_QUERY), all: { type: 'boolean' } };

const ISSUE_FILTERS = ['kind', 'state', 'label', 'parent', 'effort', 'assignee', 'missing', 'numbers', 'q', 'view', 'sort', 'order'];

const LINK_FIELDS = ['role', 'type', 'title'];

const COMMENT_BODY: Partial<Verb> = {
  flags: inlineOrFileFlags('body'),
  body: async ({ text }) => ({ body: await text('body') }),
};

const BLOCKER_BY: Partial<Verb> = { pathFlags: { blocker: 'by' }, flags: valueFlags('by') };

const issueVerb = (command: string, route: string, rest: Partial<Verb> = {}): Verb => {
  const [method, path = ''] = route.split(' ');
  return { words: ['issue', ...command.split(' ')], method: method as Method, path: `/issues/{number}${path}`, positionals: ['number'], ...rest };
};

const VERBS: Verb[] = [
  {
    words: ['issue', 'create'],
    method: 'post',
    path: '/issues',
    flags: { ...valueFlags('kind', 'title', 'parent', 'name'), ...inlineOrFileFlags('body'), 'label': { type: 'string', multiple: true }, 'blocked-by': { type: 'string', multiple: true } },
    body: async ({ flags, text }) => ({
      kind: flags.kind,
      title: flags.title,
      body: await text('body'),
      parent: asNumber(flags.parent),
      labels: flags.label,
      blockedBy: (flags['blocked-by'] as string[] | undefined)?.map(asNumber),
      name: flags.name,
    }),
  },
  issueVerb('view', 'get'),
  {
    words: ['issue', 'list'],
    method: 'get',
    path: '/issues',
    flags: { ...valueFlags(...ISSUE_FILTERS.filter(name => name !== 'label' && name !== 'q')), label: { type: 'string', multiple: true }, q: { type: 'string', short: 'q' } },
    query: ISSUE_FILTERS,
    paged: true,
  },
  issueVerb('edit', 'patch', {
    flags: { ...valueFlags('title', 'parent', 'name', 'if-version'), ...inlineOrFileFlags('body', 'test-instructions'), 'no-parent': { type: 'boolean' } },
    ifVersion: true,
    body: async ({ flags, text }) => {
      if (flags.parent !== undefined && flags['no-parent']) throw new UsageError('pass --parent or --no-parent, not both');
      return {
        title: flags.title,
        body: await text('body'),
        parent: flags['no-parent'] ? null : asNumber(flags.parent),
        name: flags.name,
        testInstructions: await text('test-instructions'),
      };
    },
  }),
  issueVerb('append', 'post /body/append', {
    flags: { ...valueFlags('section'), ...inlineOrFileFlags('text') },
    body: async ({ flags, text }) => ({ section: flags.section, text: await text('text') }),
  }),
  issueVerb('delete', 'delete'),
  issueVerb('claim', 'post /claim'),
  issueVerb('unassign', 'delete /assignee'),
  issueVerb('close', 'post /close', {
    flags: inlineOrFileFlags('comment'),
    body: async ({ text }) => ({ comment: await text('comment') }),
  }),
  issueVerb('reopen', 'post /reopen'),
  issueVerb('changes', 'get /changes', { flags: valueFlags('field'), query: ['field'], paged: true }),
  issueVerb('label add', 'put /labels/{label}', { positionals: ['number', 'label'] }),
  issueVerb('label remove', 'delete /labels/{label}', { positionals: ['number', 'label'] }),
  issueVerb('block', 'put /blockers/{blocker}', BLOCKER_BY),
  issueVerb('unblock', 'delete /blockers/{blocker}', BLOCKER_BY),
  issueVerb('comment', 'post /comments', COMMENT_BODY),
  issueVerb('comment edit', 'patch /comments/{id}', { ...COMMENT_BODY, positionals: ['number', 'id'] }),
  issueVerb('comment delete', 'delete /comments/{id}', { positionals: ['number', 'id'] }),
  issueVerb('link add', 'post /links', {
    flags: valueFlags(...LINK_FIELDS, 'url'),
    body: async ({ flags }) => ({ role: flags.role, type: flags.type, url: flags.url, title: flags.title }),
  }),
  issueVerb('link edit', 'patch /links/{id}', {
    positionals: ['number', 'id'],
    flags: valueFlags(...LINK_FIELDS),
    body: async ({ flags }) => ({ role: flags.role, type: flags.type, title: flags.title }),
  }),
  issueVerb('link remove', 'delete /links/{id}', { positionals: ['number', 'id'] }),
  { words: ['effort', 'list'], method: 'get', path: '/efforts', flags: valueFlags('sort', 'order'), query: ['sort', 'order'], paged: true },
  { words: ['effort', 'view'], method: 'get', path: '/efforts/{handle}', positionals: ['handle'] },
  { words: ['effort', 'artifacts'], method: 'get', path: '/efforts/{handle}/artifacts.md', positionals: ['handle'], markdown: true },
  { words: ['environments'], method: 'get', path: '/environments' },
  { words: ['credential-pointers'], method: 'get', path: '/credential-pointers' },
  { words: ['labels'], method: 'get', path: '/labels' },
  { words: ['holders'], method: 'get', path: '/holders' },
  { words: ['me'], method: 'get', path: '/me' },
  { words: ['instance'], method: 'get', path: '/instance' },
  {
    words: ['adapter'],
    method: 'get',
    path: '/instance/adapter/issue-tracker.md',
    flags: valueFlags('write'),
    markdown: true,
    alsoWrites: ['/instance/adapter/triage-labels.md'],
  },
];

const routesOf = (verb: Verb) => [verb.path, ...verb.alsoWrites ?? []];

export const VERB_ROUTES = VERBS.flatMap(verb => routesOf(verb).map(path => ({ command: verb.words.join(' '), method: verb.method, path })));

const ownFlags = (verb: Verb): ParseArgsOptionsConfig => ({ ...verb.flags, ...verb.paged ? PAGING_FLAGS : {} });

const verbOptions = (verb: Verb): ParseArgsOptionsConfig => ({ ...GLOBAL_FLAGS, ...ownFlags(verb) });

const usageLine = (verb: Verb) => [
  ...verb.words,
  ...(verb.positionals ?? []).map(name => `<${name}>`),
  ...Object.values(verb.pathFlags ?? {}).map(flag => `--${flag} <${flag}>`),
  ...Object.entries(ownFlags(verb))
    .filter(([name]) => !Object.values(verb.pathFlags ?? {}).includes(name))
    .map(([name, option]) => `[${option.short ? `-${option.short}` : `--${name}`}${option.type === 'boolean' ? '' : ' <value>'}]`),
].join(' ');

const usage = () => [
  'usage: chartroom <command> [flags]',
  '',
  'Configured by CHARTROOM_URL and CHARTROOM_TOKEN; --url and --token override them, except on issue link add, where --url is the Link target.',
  'Any *-file flag reads stdin when given -.',
  '',
  ...VERBS.map(verb => `  ${usageLine(verb)}`),
  '',
].join('\n');

const findVerb = (argv: string[]) => {
  const verb = VERBS
    .filter(candidate => candidate.words.every((word, index) => argv[index] === word))
    .reduce<Verb | undefined>((longest, candidate) => candidate.words.length > (longest?.words.length ?? 0) ? candidate : longest, undefined);
  if (!verb) throw new UsageError(argv.length ? `unknown command: ${argv.join(' ')}` : 'no command given');
  return verb;
};

const optionNamed = (arg: string, options: ParseArgsOptionsConfig) =>
  arg.startsWith('--') ? options[arg.slice(2)] : Object.values(options).find(option => option.short && arg === `-${option.short}`);

const attachDashLeadingValues = (args: string[], options: ParseArgsOptionsConfig) => {
  const attached: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === '--') return [...attached, ...args.slice(index)];
    const takesValue = optionNamed(arg, options)?.type === 'string' && index + 1 < args.length;
    attached.push(takesValue ? `${arg}${arg.startsWith('--') ? '=' : ''}${args[++index]}` : arg);
  }
  return attached;
};

const parseVerbArgs = (verb: Verb, argv: string[]) => {
  const options = verbOptions(verb);
  try {
    return parseArgs({ args: attachDashLeadingValues(argv.slice(verb.words.length), options), options, strict: true, allowPositionals: true });
  }
  catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
};

const readAll = async (stream: AsyncIterable<string | Uint8Array>) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
};

const textReader = (flags: Flags, stdin: CliContext['stdin']) => {
  const stdinFlags = Object.keys(flags).filter(name => name.endsWith('-file') && flags[name] === '-');
  if (stdinFlags.length > 1) throw new UsageError(`only one flag can read stdin, got ${stdinFlags.map(name => `--${name} -`).join(' and ')}`);
  return async (name: string) => {
    const inline = flags[name] as string | undefined;
    const file = flags[`${name}-file`] as string | undefined;
    if (inline !== undefined && file !== undefined) throw new UsageError(`pass --${name} or --${name}-file, not both`);
    if (file === undefined) return inline;
    if (file === '-') return readAll(stdin);
    return readFile(file, 'utf8').catch(() => {
      throw new UsageError(`cannot read ${file}`);
    });
  };
};

const fillPath = (verb: Verb, positionals: string[], flags: Flags) => {
  if (positionals.length !== (verb.positionals ?? []).length) throw new UsageError(`expected ${usageLine(verb)}`);
  const values: Record<string, string> = Object.fromEntries((verb.positionals ?? []).map((name, index) => [name, positionals[index]!]));
  for (const [param, flag] of Object.entries(verb.pathFlags ?? {})) {
    if (typeof flags[flag] !== 'string') throw new UsageError(`--${flag} is required`);
    values[param] = flags[flag];
  }
  return verb.path.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(values[name]!));
};

const queryOf = (verb: Verb, flags: Flags) => {
  const query = new URLSearchParams();
  for (const name of [...verb.query ?? [], ...verb.paged ? PAGE_QUERY : []]) {
    for (const value of [flags[name]].flat()) if (typeof value === 'string') query.append(name, value);
  }
  return query;
};

const reach = async (root: string, path: string, init: RequestInit = {}) => {
  try {
    return await fetch(`${root}${path}`, init);
  }
  catch (error) {
    const reason = error instanceof Error && error.cause instanceof Error ? error.cause.message : String(error);
    throw new ApiFailure(JSON.stringify({ error: { code: 'unreachable', message: `cannot reach ${root}: ${reason}` } }));
  }
};

const majorOf = (version: string) => version.split('.')[0];

const ownVersion = () => (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

const warnOnMajorMismatch = async (root: string, context: CliContext) => {
  const health = await reach(root, '/health');
  const { version: instanceVersion } = await health.json().catch(() => ({})) as { version?: string };
  const cliVersion = context.version ?? ownVersion();
  if (typeof instanceVersion === 'string' && majorOf(instanceVersion) !== majorOf(cliVersion)) {
    context.stderr.write(`chartroom: the instance runs ${instanceVersion} but this CLI is ${cliVersion}; use npx -y chartroom@${majorOf(instanceVersion)}\n`);
  }
};

const execute = async (context: CliContext) => {
  const verb = findVerb(context.argv);
  const { values: flags, positionals } = parseVerbArgs(verb, context.argv);
  const path = fillPath(verb, positionals, flags);
  const body = verb.body && JSON.stringify(await verb.body({ flags, text: textReader(flags, context.stdin) }));
  // issue link add owns --url as the Link target, so its instance URL comes from the environment only
  const url = (verb.flags?.url ? undefined : flags.url as string | undefined) ?? context.env.CHARTROOM_URL;
  const secret = (flags.token as string | undefined) ?? context.env.CHARTROOM_TOKEN;
  if (!url) throw new UsageError('set CHARTROOM_URL or pass --url');
  const root = url.replace(/\/+$/, '');
  await warnOnMajorMismatch(root, context);

  const headers: Record<string, string> = secret ? { authorization: `Bearer ${secret}` } : {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (verb.ifVersion && typeof flags['if-version'] === 'string') headers['if-match'] = `"${flags['if-version']}"`;
  const call = async (callPath: string, query = queryOf(verb, flags)) => {
    const response = await reach(root, `/api/v1${callPath}${query.size ? `?${query}` : ''}`, { method: verb.method.toUpperCase(), headers, body });
    if (!response.ok) throw new ApiFailure(await response.text());
    return response;
  };

  if (verb.markdown && typeof flags.write === 'string') {
    await mkdir(flags.write, { recursive: true });
    for (const filePath of routesOf(verb)) {
      const served = Buffer.from(await (await call(filePath)).arrayBuffer());
      await writeFile(join(flags.write, basename(filePath)), served);
    }
    return 0;
  }
  if (verb.markdown) {
    context.stdout.write(await (await call(path)).text());
    return 0;
  }
  if (verb.paged && flags.all) {
    const items: unknown[] = [];
    const query = queryOf(verb, flags);
    for (;;) {
      const page = await (await call(path, query)).json() as { items: unknown[], nextCursor: string | null };
      items.push(...page.items);
      if (!page.nextCursor) break;
      query.set('cursor', page.nextCursor);
    }
    context.stdout.write(`${JSON.stringify(items, null, 2)}\n`);
    return 0;
  }
  const response = await call(path);
  if (response.status !== 204) context.stdout.write(`${JSON.stringify(await response.json(), null, 2)}\n`);
  return 0;
};

export const runCli = async (context: CliContext) => {
  try {
    return await execute(context);
  }
  catch (error) {
    if (error instanceof ApiFailure) {
      context.stderr.write(`${error.envelope}\n`);
      return 1;
    }
    if (!(error instanceof UsageError)) throw error;
    context.stderr.write(`chartroom: ${error.message}\n\n${usage()}`);
    return 2;
  }
};

if (import.meta.main) {
  process.exitCode = await runCli({ argv: process.argv.slice(2), env: process.env, stdin: process.stdin, stdout: process.stdout, stderr: process.stderr });
}
