#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseEnv } from 'node:util';
import type { ParseArgsOptionsConfig } from 'node:util';
import { initInstance } from './init.js';
import type { CliContext, Handler, Output } from './shared.js';
import { CliExit, majorOf, ownVersion, strictArgs, UsageError } from './shared.js';
import { terminalAsk } from './terminal.js';

export type { CliContext } from './shared.js';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

type Flags = Record<string, string | boolean | (string | boolean)[] | undefined>;

interface Input {
  flags: Flags
  values: Record<string, string>
  text: Handler<[string], Promise<string | undefined>>
  file: Handler<[string], Promise<string>>
}

interface Verb {
  words: string[]
  summary: string
  method: Method
  path: string
  positionals?: string[]
  pathFlags?: Record<string, string>
  pathValues?: Handler<[Record<string, string>, Flags], Record<string, string>>
  flags?: ParseArgsOptionsConfig
  query?: string[]
  paged?: boolean
  body?: Handler<[Input], Promise<Record<string, unknown>>>
  ifVersion?: boolean
  markdown?: boolean
  paths?: string[]
  print?: Handler<[PrintInput], Promise<number>>
}

interface PrintInput {
  flags: Flags
  call: Handler<[string], Promise<Response>>
  stdout: Output
}

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

const issueVerb = (command: string, route: string, rest: Pick<Verb, 'summary'> & Partial<Verb>): Verb => {
  const [method, path = ''] = route.split(' ');
  return { words: ['issue', ...command.split(' ')], method: method as Method, path: `/issues/{number}${path}`, positionals: ['number'], ...rest };
};

const researchSlug = ({ file }: Record<string, string>, flags: Flags) => {
  if (typeof flags.slug === 'string') return { slug: flags.slug };
  if (file === '-') throw new UsageError('research put - reads stdin and needs --slug');
  return { slug: basename(file!).replace(/\.md$/, '') };
};

const ADAPTER_PATHS = ['/instance/adapter/issue-tracker.md', '/instance/adapter/triage-labels.md'];

const printAdapter = async ({ flags, call, stdout }: PrintInput) => {
  if (typeof flags.write === 'string') {
    await mkdir(flags.write, { recursive: true });
    for (const filePath of ADAPTER_PATHS) {
      const served = Buffer.from(await (await call(filePath)).arrayBuffer());
      await writeFile(join(flags.write, basename(filePath)), served);
    }
    return 0;
  }
  for (const filePath of ADAPTER_PATHS) stdout.write(`<!-- docs/agents/${basename(filePath)} -->\n${await (await call(filePath)).text()}`);
  return 0;
};

export const VERBS: Verb[] = [
  {
    words: ['issue', 'create'],
    summary: 'Create an issue and print the Document.',
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
  issueVerb('view', 'get', { summary: 'Print an issue.' }),
  {
    words: ['issue', 'list'],
    summary: 'List issues, filtered, sorted and paged; --all follows every page.',
    method: 'get',
    path: '/issues',
    flags: { ...valueFlags(...ISSUE_FILTERS.filter(name => !['label', 'missing', 'q'].includes(name))), label: { type: 'string', multiple: true }, missing: { type: 'string', multiple: true }, q: { type: 'string', short: 'q' } },
    query: ISSUE_FILTERS,
    paged: true,
  },
  issueVerb('edit', 'patch', {
    summary: 'Edit an issue; --if-version rejects the edit when the issue changed meanwhile.',
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
    summary: 'Append text to a section of an issue body.',
    flags: { ...valueFlags('section'), ...inlineOrFileFlags('text') },
    body: async ({ flags, text }) => ({ section: flags.section, text: await text('text') }),
  }),
  issueVerb('replace-section', 'put /body/section', {
    summary: 'Replace one ## section of an issue body.',
    flags: { ...valueFlags('section', 'if-version'), ...inlineOrFileFlags('text') },
    ifVersion: true,
    body: async ({ flags, text }) => ({ section: flags.section, text: await text('text') }),
  }),
  issueVerb('delete', 'delete', { summary: 'Delete an issue.' }),
  issueVerb('claim', 'post /claim', { summary: 'Claim an issue for the calling holder.' }),
  issueVerb('unassign', 'delete /assignee', { summary: 'Remove the assignee from an issue.' }),
  issueVerb('close', 'post /close', {
    summary: 'Close an issue, optionally with a comment.',
    flags: inlineOrFileFlags('comment'),
    body: async ({ text }) => ({ comment: await text('comment') }),
  }),
  issueVerb('reopen', 'post /reopen', { summary: 'Reopen a closed issue.' }),
  issueVerb('changes', 'get /changes', { summary: 'List the change history of an issue, optionally for one field.', flags: valueFlags('field'), query: ['field'], paged: true }),
  issueVerb('label add', 'put /labels/{label}', { summary: 'Add a label to an issue.', positionals: ['number', 'label'] }),
  issueVerb('label remove', 'delete /labels/{label}', { summary: 'Remove a label from an issue.', positionals: ['number', 'label'] }),
  issueVerb('block', 'put /blockers/{blocker}', { summary: 'Mark an issue as blocked by another.', ...BLOCKER_BY }),
  issueVerb('unblock', 'delete /blockers/{blocker}', { summary: 'Remove a blocker from an issue.', ...BLOCKER_BY }),
  issueVerb('comment', 'post /comments', { summary: 'Add a comment to an issue.', ...COMMENT_BODY }),
  issueVerb('comment edit', 'patch /comments/{id}', { summary: 'Edit a comment on an issue.', ...COMMENT_BODY, positionals: ['number', 'id'] }),
  issueVerb('comment delete', 'delete /comments/{id}', { summary: 'Delete a comment from an issue.', positionals: ['number', 'id'] }),
  issueVerb('link add', 'post /links', {
    summary: 'Add a Link to an issue; --url is the Link target.',
    flags: valueFlags(...LINK_FIELDS, 'url'),
    body: async ({ flags }) => ({ role: flags.role, type: flags.type, url: flags.url, title: flags.title }),
  }),
  issueVerb('link edit', 'patch /links/{id}', {
    summary: 'Edit a Link on an issue.',
    positionals: ['number', 'id'],
    flags: valueFlags(...LINK_FIELDS),
    body: async ({ flags }) => ({ role: flags.role, type: flags.type, title: flags.title }),
  }),
  issueVerb('link remove', 'delete /links/{id}', { summary: 'Remove a Link from an issue.', positionals: ['number', 'id'] }),
  {
    words: ['research', 'put'],
    summary: 'Attach a research file to an issue; the slug defaults to the file name.',
    method: 'put',
    path: '/issues/{number}/research/{slug}',
    positionals: ['number', 'file'],
    flags: valueFlags('slug'),
    pathValues: researchSlug,
    body: async ({ values, file }) => ({ body: await file(values.file!) }),
  },
  { words: ['research', 'list'], summary: 'List the research attached to an issue.', method: 'get', path: '/issues/{number}/research', positionals: ['number'] },
  { words: ['research', 'view'], summary: 'Print one research file of an issue.', method: 'get', path: '/issues/{number}/research/{slug}', positionals: ['number', 'slug'] },
  { words: ['effort', 'list'], summary: 'List efforts, sorted and paged; --all follows every page.', method: 'get', path: '/efforts', flags: valueFlags('sort', 'order'), query: ['sort', 'order'], paged: true },
  { words: ['effort', 'view'], summary: 'Print an effort.', method: 'get', path: '/efforts/{handle}', positionals: ['handle'] },
  { words: ['effort', 'artifacts'], summary: 'Print the artifacts of an effort as Markdown.', method: 'get', path: '/efforts/{handle}/artifacts.md', positionals: ['handle'], markdown: true },
  { words: ['environments'], summary: 'List the environments.', method: 'get', path: '/environments' },
  { words: ['credential-pointers'], summary: 'List the credential pointers.', method: 'get', path: '/credential-pointers' },
  { words: ['labels'], summary: 'List the labels.', method: 'get', path: '/labels' },
  { words: ['holders'], summary: 'List the holders.', method: 'get', path: '/holders' },
  { words: ['me'], summary: 'Print the calling holder.', method: 'get', path: '/me' },
  { words: ['instance'], summary: 'Print the instance.', method: 'get', path: '/instance' },
  {
    words: ['adapter'],
    summary: 'Print the adapter docs the instance serves, or write them to a directory with --write.',
    method: 'get',
    path: ADAPTER_PATHS[0]!,
    paths: ADAPTER_PATHS,
    flags: valueFlags('write'),
    print: printAdapter,
  },
];

const routesOf = (verb: Verb) => verb.paths ?? [verb.path];

const ownFlags = (verb: Verb): ParseArgsOptionsConfig => ({ ...verb.flags, ...verb.paged ? PAGING_FLAGS : {} });

const verbOptions = (verb: Verb): ParseArgsOptionsConfig => ({ ...GLOBAL_FLAGS, ...ownFlags(verb) });

const SENTINEL = 'sentinel';

const bodyFieldsOf = async (verb: Verb) => {
  const flags = new Proxy({}, { get: (_, name) => name === 'no-parent' ? undefined : [SENTINEL] }) as Flags;
  const values = new Proxy({}, { get: () => SENTINEL }) as Record<string, string>;
  return verb.body ? Object.keys(await verb.body({ flags, values, text: async () => SENTINEL, file: async () => SENTINEL })) : [];
};

export const VERB_ROUTES = await Promise.all(VERBS.flatMap(verb => routesOf(verb).map(async path => ({
  command: verb.words.join(' '),
  method: verb.method,
  path,
  query: [...verb.query ?? [], ...verb.paged ? PAGE_QUERY : []],
  bodyFields: await bodyFieldsOf(verb),
  flags: Object.keys(verbOptions(verb)),
}))));

const INIT_HELP = [
  'usage: chartroom init [dir]',
  '',
  'Write a compose.yaml and .env for a new instance into dir (default .), asking for settings when run in a terminal.',
  '',
  'options:',
  '  --help',
  '',
].join('\n');

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
  '       chartroom --version | --help',
  '',
  'Configured by CHARTROOM_URL and CHARTROOM_TOKEN; --url and --token override them, except on issue link add, where --url is the Link target.',
  'Any *-file flag reads stdin when given -, and so does research put given - as the file, with --slug.',
  '',
  '  init [dir]',
  ...VERBS.map(verb => `  ${usageLine(verb)}`),
  '',
].join('\n');

const optionLine = (name: string, option: { type: string }) => `  --${name}${option.type === 'boolean' ? '' : ' <value>'}`;

const verbHelp = (verb: Verb) => [
  `usage: chartroom ${usageLine(verb)}`,
  '',
  verb.summary,
  '',
  'options:',
  ...Object.entries(verbOptions(verb)).map(([name, option]) => optionLine(name, option)),
  optionLine('help', { type: 'boolean' }),
  '',
].join('\n');

const groupHelp = (verbs: Verb[]) => [
  ...verbs.flatMap(verb => [`  chartroom ${usageLine(verb)}`, `      ${verb.summary}`]),
  '',
].join('\n');

const helpFor = (argv: string[]) => {
  const flagStart = argv.findIndex(arg => arg.startsWith('-'));
  const commandWords = flagStart === -1 ? argv : argv.slice(0, flagStart);
  const [exact] = VERBS.filter(verb => verb.words.every((word, index) => commandWords[index] === word)).sort((a, b) => b.words.length - a.words.length);
  if (exact) return verbHelp(exact);
  const group = VERBS.filter(verb => commandWords.every((word, index) => verb.words[index] === word));
  return group.length ? groupHelp(group) : undefined;
};

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
  return strictArgs(attachDashLeadingValues(argv.slice(verb.words.length), options), options);
};

const readAll = async (stream: AsyncIterable<string | Uint8Array>) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
};

const fileReader = (stdin: CliContext['stdin']) => async (file: string) => {
  if (file === '-') return readAll(stdin);
  return readFile(file, 'utf8').catch(() => {
    throw new UsageError(`cannot read ${file}`);
  });
};

const textReader = (flags: Flags, stdin: CliContext['stdin']) => {
  const stdinFlags = Object.keys(flags).filter(name => name.endsWith('-file') && flags[name] === '-');
  if (stdinFlags.length > 1) throw new UsageError(`only one flag can read stdin, got ${stdinFlags.map(name => `--${name} -`).join(' and ')}`);
  return async (name: string) => {
    const inline = flags[name] as string | undefined;
    const file = flags[`${name}-file`] as string | undefined;
    if (inline !== undefined && file !== undefined) throw new UsageError(`pass --${name} or --${name}-file, not both`);
    if (file === undefined) return inline;
    return fileReader(stdin)(file);
  };
};

const pathValuesOf = (verb: Verb, positionals: string[], flags: Flags) => {
  if (positionals.length !== (verb.positionals ?? []).length) throw new UsageError(`expected ${usageLine(verb)}`);
  const values: Record<string, string> = Object.fromEntries((verb.positionals ?? []).map((name, index) => [name, positionals[index]!]));
  for (const [param, flag] of Object.entries(verb.pathFlags ?? {})) {
    if (typeof flags[flag] !== 'string') throw new UsageError(`--${flag} is required`);
    values[param] = flags[flag];
  }
  return { ...values, ...verb.pathValues?.(values, flags) };
};

const fillPath = (verb: Verb, values: Record<string, string>) =>
  verb.path.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(values[name]!));

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

const warnOnMajorMismatch = async (root: string, context: CliContext) => {
  const health = await reach(root, '/health');
  const { version: instanceVersion } = await health.json().catch(() => ({})) as { version?: string };
  const cliVersion = context.version ?? ownVersion();
  if (typeof instanceVersion === 'string' && majorOf(instanceVersion) !== majorOf(cliVersion)) {
    const major = majorOf(instanceVersion);
    context.stderr.write(`chartroom: the instance runs ${instanceVersion} but this CLI is ${cliVersion}; install chartroom-cli@${major} (npm install -g chartroom-cli@${major}) or use npx -y chartroom-cli@${major}\n`);
  }
};

const dotEnvIn = (cwd: string) => {
  const file = join(cwd, '.env');
  try {
    return parseEnv(readFileSync(file, 'utf8'));
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new CliExit(`cannot read ${file}: ${(error as Error).message}`);
  }
};

const execute = async (context: CliContext) => {
  const optionsEnd = context.argv.indexOf('--');
  if (context.argv[0] !== '--help' && context.argv.slice(0, optionsEnd === -1 ? undefined : optionsEnd).includes('--help')) {
    const help = context.argv[0] === 'init' ? INIT_HELP : helpFor(context.argv);
    if (help) {
      context.stdout.write(help);
      return 0;
    }
  }
  if (context.argv[0] === 'init') return initInstance(context);
  if (context.argv[0] === '--version' || context.argv[0] === '-v') {
    context.stdout.write(`${context.version ?? ownVersion()}\n`);
    return 0;
  }
  if (context.argv[0] === '--help' || context.argv[0] === '-h') {
    context.stdout.write(usage());
    return 0;
  }
  const verb = findVerb(context.argv);
  const { values: flags, positionals } = parseVerbArgs(verb, context.argv);
  const values = pathValuesOf(verb, positionals, flags);
  const path = fillPath(verb, values);
  const body = verb.body && JSON.stringify(await verb.body({ flags, values, text: textReader(flags, context.stdin), file: fileReader(context.stdin) }));
  const env = { ...dotEnvIn(context.cwd ?? process.cwd()), ...context.env };
  // issue link add owns --url as the Link target, so its instance URL comes from the environment or ./.env only
  const ownsUrlFlag = 'url' in (verb.flags ?? {});
  const url = (ownsUrlFlag ? undefined : flags.url as string | undefined) ?? env.CHARTROOM_URL;
  const secret = (flags.token as string | undefined) ?? env.CHARTROOM_TOKEN;
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

  if (verb.print) return verb.print({ flags, call, stdout: context.stdout });
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
      if (!page.nextCursor) {
        context.stdout.write(`${JSON.stringify({ ...page, items }, null, 2)}\n`);
        return 0;
      }
      query.set('cursor', page.nextCursor);
    }
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
    if (error instanceof CliExit) {
      context.stderr.write(`chartroom: ${error.message}\n`);
      return error.exitCode;
    }
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
  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  process.exitCode = await runCli({ argv: process.argv.slice(2), env: process.env, stdin: process.stdin, stdout: process.stdout, stderr: process.stderr, ...interactive && { ask: terminalAsk(process.stdin, process.stderr) } });
}
