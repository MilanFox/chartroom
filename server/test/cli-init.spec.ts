import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { runCli } from '../../cli/src/chartroom';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

const CLI_ROOT = join(REPO_ROOT, 'cli');

const execFileAsync = promisify(execFile);

const freshDir = () => mkdtempSync(join(tmpdir(), 'chartroom-init-'));

interface Terminal {
  answers: (string | null)[]
  startExitCode?: number
}

const chartroom = async (argv: string[], version = '7.3.1', terminal?: Terminal) => {
  let stdout = '';
  let stderr = '';
  const questions: { question: string, hidden: boolean }[] = [];
  const startedIn: string[] = [];
  const code = await runCli({
    argv,
    env: {},
    stdin: Readable.from(['']),
    stdout: { write: (chunk: string) => (stdout += chunk, true) },
    stderr: { write: (chunk: string) => (stderr += chunk, true) },
    version,
    ...terminal && {
      ask: async (question: string, options?: { hidden?: boolean }) => {
        questions.push({ question, hidden: options?.hidden ?? false });
        const answer = terminal.answers.shift();
        return answer === undefined ? null : answer;
      },
      startInstance: async (dir: string) => (startedIn.push(dir), terminal.startExitCode ?? 0),
    },
  });
  return { code, stdout, stderr, questions, startedIn };
};

const GENERATED_PASSWORD = /^[A-Za-z0-9_-]{24,}$/;

const passwordOf = (envText: string, name: string) => envText.match(new RegExp(`^${name}=(.*)$`, 'm'))![1]!;

describe('chartroom init', () => {
  it('writes compose.yaml as compose.example.yaml pinned to the CLI version, without CHARTROOM_URL or a token', async () => {
    const dir = freshDir();

    const result = await chartroom(['init', dir]);

    const example = readFileSync(join(REPO_ROOT, 'compose.example.yaml'), 'utf8');
    expect(result.code).toBe(0);
    expect(readFileSync(join(dir, 'compose.yaml'), 'utf8')).toBe(example.replace(/ghcr\.io\/milanfox\/chartroom:\d+\.\d+\.\d+/, 'ghcr.io/milanfox/chartroom:7.3.1'));
  });

  it('writes .env as .env.example with two fresh random passwords, readable by the owner only', async () => {
    const dir = freshDir();
    const other = freshDir();

    await chartroom(['init', dir]);
    await chartroom(['init', other]);

    const env = readFileSync(join(dir, '.env'), 'utf8');
    const passwords = [dir, other].flatMap(target => ['CHARTROOM_ADMIN_PASSWORD', 'CHARTROOM_VIEWER_PASSWORD'].map(name => passwordOf(readFileSync(join(target, '.env'), 'utf8'), name)));
    expect(env.replace(/^(CHARTROOM_(ADMIN|VIEWER)_PASSWORD=).*$/gm, '$1')).toBe(readFileSync(join(REPO_ROOT, '.env.example'), 'utf8'));
    for (const password of passwords) expect(password).toMatch(GENERATED_PASSWORD);
    expect(new Set(passwords).size).toBe(4);
    expect(statSync(join(dir, '.env')).mode & 0o777).toBe(0o600);
  });

  it('refuses with exit 1 and a one-line error naming the file when either file exists, and writes nothing', async () => {
    for (const existing of ['compose.yaml', '.env']) {
      const dir = freshDir();
      writeFileSync(join(dir, existing), 'kept');

      const result = await chartroom(['init', dir]);

      expect(result, existing).toMatchObject({ code: 1, stdout: '', stderr: expect.stringMatching(new RegExp(`^chartroom: [^\\n]*${existing.replace('.', '\\.')} already exists\\n$`)) });
      expect(readdirSync(dir), existing).toEqual([existing]);
      expect(readFileSync(join(dir, existing), 'utf8'), existing).toBe('kept');
    }
  });

  it('creates a missing directory and prints the first-start checklist with the local URL and the CLI major', async () => {
    const dir = join(freshDir(), 'nested', 'chartroom');

    const result = await chartroom(['init', dir]);

    expect(result).toMatchObject({
      code: 0, stderr: '', stdout: [
        `Wrote compose.yaml and .env to ${dir}. The passwords are in ${dir}/.env.`,
        '',
        'First start:',
        `1. cd ${dir} && docker compose up -d`,
        '2. Open http://localhost:3000',
        `3. Sign in with the viewer password (in ${dir}/.env)`,
        '4. Admin menu → "Enter admin password…" → elevate with the admin password',
        '5. Follow "First-run setup" on the admin page: project name, Effort word, Environments, create the first Token holder — copy its secret, it is shown once',
        '6. In your project repo:',
        '   export CHARTROOM_URL=http://localhost:3000',
        '   export CHARTROOM_TOKEN=<the holder\'s secret>',
        '   npx -y chartroom-cli@7 adapter --write docs/agents',
        '',
        'More: https://github.com/MilanFox/chartroom/blob/main/docs/operating.md',
        '',
      ].join('\n')
    });
    expect(readdirSync(dir).sort()).toEqual(['.env', 'compose.yaml']);
  });

  it('the built bin writes into the current directory by default, pinned to the package version', async () => {
    const dir = freshDir();
    const { version } = JSON.parse(readFileSync(join(CLI_ROOT, 'package.json'), 'utf8'));

    const { stdout } = await execFileAsync(process.execPath, [join(CLI_ROOT, 'dist', 'chartroom.js'), 'init'], { cwd: dir, env: {} });

    expect(stdout).toContain('1. docker compose up -d\n');
    expect(readFileSync(join(dir, 'compose.yaml'), 'utf8')).toContain(`image: ghcr.io/milanfox/chartroom:${version}\n`);
    expect(readdirSync(dir).sort()).toEqual(['.env', 'compose.yaml']);
  });

  it('is listed in the usage', async () => {
    expect((await chartroom(['frobnicate'])).stderr).toContain('\n  init [dir]\n');
  });

  it('a flag or a second directory is a usage error with exit 2 and writes nothing', async () => {
    for (const extra of [['--force'], ['a', 'b']]) {
      const cwdBefore = readdirSync('.');

      const result = await chartroom(['init', ...extra.map(arg => arg.startsWith('-') ? arg : join(freshDir(), arg))]);

      expect(result, extra.join(' ')).toMatchObject({ code: 2, stdout: '' });
      expect(result.stderr, extra.join(' ')).toContain('usage: chartroom');
      expect(readdirSync('.'), extra.join(' ')).toEqual(cwdBefore);
    }
  });

  describe('in a terminal', () => {
    it('walks seven steps and writes the typed passwords, public URL, port and update choice', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['typed-admin', 'typed-viewer', 'https://chart.example.com', '8080', 'n', 'y', 'n'] });

      const example = readFileSync(join(REPO_ROOT, '.env.example'), 'utf8');
      expect(result.code).toBe(0);
      expect(readFileSync(join(dir, '.env'), 'utf8')).toBe(example
        .replace('CHARTROOM_ADMIN_PASSWORD=', 'CHARTROOM_ADMIN_PASSWORD=\'typed-admin\'')
        .replace('CHARTROOM_VIEWER_PASSWORD=', 'CHARTROOM_VIEWER_PASSWORD=\'typed-viewer\'')
        .replace('# CHARTROOM_BASE_URL=', 'CHARTROOM_BASE_URL=https://chart.example.com')
        .replace('# CHARTROOM_UPDATE_CHECK=true', 'CHARTROOM_UPDATE_CHECK=false'));
      expect(readFileSync(join(dir, 'compose.yaml'), 'utf8')).toContain('      - "127.0.0.1:8080:3000"\n');
      expect(result.questions.map(({ hidden }) => hidden)).toEqual([true, true, false, false, false, false, false]);
      expect([...result.stderr.matchAll(/^Step (\d) of 7 — /gm)].map(([, step]) => step)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
      expect(result.stderr).not.toContain('typed-admin');
      expect(result.stderr).not.toContain('typed-viewer');
      expect(result.stderr).toMatch(/Admin password: set\n/);
      expect(result.stdout).toContain('2. Open https://chart.example.com\n   Put a TLS reverse proxy in front: https://github.com/MilanFox/chartroom/blob/main/docs/operating.md#tls-at-the-reverse-proxy\n');
      expect(result.stdout).toContain('   export CHARTROOM_URL=https://chart.example.com\n');
      expect(result.stdout).not.toContain('typed-');
      expect(result.startedIn).toEqual([]);
    });

    it('takes every default on Enter: generated passwords, no public URL, port 3000, update check on, not started', async () => {
      const dir = freshDir();
      const plain = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['', '', '', '', '', '', ''] });
      const nonInteractive = await chartroom(['init', plain]);

      const env = readFileSync(join(dir, '.env'), 'utf8');
      expect(result.code).toBe(0);
      expect(env.replace(/^(CHARTROOM_(ADMIN|VIEWER)_PASSWORD=).*$/gm, '$1')).toBe(readFileSync(join(REPO_ROOT, '.env.example'), 'utf8'));
      expect(passwordOf(env, 'CHARTROOM_ADMIN_PASSWORD')).toMatch(GENERATED_PASSWORD);
      expect(passwordOf(env, 'CHARTROOM_VIEWER_PASSWORD')).toMatch(GENERATED_PASSWORD);
      expect(readFileSync(join(dir, 'compose.yaml'), 'utf8')).toBe(readFileSync(join(plain, 'compose.yaml'), 'utf8'));
      expect(result.stderr).toContain('Admin password: generated\nViewer password: generated\n');
      expect(result.stderr).not.toContain(passwordOf(env, 'CHARTROOM_ADMIN_PASSWORD'));
      expect(result.stdout).toBe(nonInteractive.stdout.replaceAll(plain, dir));
      expect(result.startedIn).toEqual([]);
    });

    it('re-asks on a viewer password equal to the admin one, a non-http URL, an out-of-range port and an unclear yes/no', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['same', 'same', 'other', 'ftp://example.com', 'not a url', '', '0', '70000', 'abc', '3001', 'maybe', '', '', ''] });

      const env = readFileSync(join(dir, '.env'), 'utf8');
      expect(result.code).toBe(0);
      expect(result.questions).toHaveLength(14);
      expect(passwordOf(env, 'CHARTROOM_ADMIN_PASSWORD')).toBe('\'same\'');
      expect(passwordOf(env, 'CHARTROOM_VIEWER_PASSWORD')).toBe('\'other\'');
      expect(env).toContain('\n# CHARTROOM_BASE_URL=\n');
      expect(readFileSync(join(dir, 'compose.yaml'), 'utf8')).toContain('"127.0.0.1:3001:3000"');
      expect(result.stdout).toContain('2. Open http://localhost:3001\n3. ');
    });

    it('single-quotes typed passwords and re-asks one holding a single quote or a control character', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['it\'s', 'tab\there', 'a#b$c "d', 'x\u001bz', '', '', '', '', '', ''] });

      const env = readFileSync(join(dir, '.env'), 'utf8');
      expect(result.code).toBe(0);
      expect(result.questions).toHaveLength(10);
      expect(result.stderr.match(/^Must not contain ' or control characters\.$/gm)).toHaveLength(3);
      expect(env).toContain('\nCHARTROOM_ADMIN_PASSWORD=\'a#b$c "d\'\n');
      expect(passwordOf(env, 'CHARTROOM_VIEWER_PASSWORD')).toMatch(GENERATED_PASSWORD);
    });

    it('keeps the surrounding spaces of a typed password but trims the other answers', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['  admin pw ', ' viewer ', '  https://chart.example.com ', ' 8080 ', ' n ', ' y ', ' n '] });

      const env = readFileSync(join(dir, '.env'), 'utf8');
      expect(result.code).toBe(0);
      expect(passwordOf(env, 'CHARTROOM_ADMIN_PASSWORD')).toBe('\'  admin pw \'');
      expect(passwordOf(env, 'CHARTROOM_VIEWER_PASSWORD')).toBe('\' viewer \'');
      expect(env).toContain('\nCHARTROOM_BASE_URL=https://chart.example.com\n');
      expect(env).toContain('\nCHARTROOM_UPDATE_CHECK=false\n');
      expect(readFileSync(join(dir, 'compose.yaml'), 'utf8')).toContain('"127.0.0.1:8080:3000"');
    });

    it('declining the review exits 1 and writes nothing, not even the directory', async () => {
      const dir = join(freshDir(), 'chartroom');

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['', '', '', '', '', 'n'] });

      expect(result).toMatchObject({ code: 1, stdout: '', stderr: expect.stringMatching(/chartroom: aborted, nothing written\n$/) });
      expect(existsSync(dir)).toBe(false);
    });

    it('input ending mid-wizard exits 1 and writes nothing', async () => {
      const dir = join(freshDir(), 'chartroom');

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['', null] });

      expect(result).toMatchObject({ code: 1, stdout: '' });
      expect(existsSync(dir)).toBe(false);
    });

    it('refuses an existing file before asking anything', async () => {
      const dir = freshDir();
      writeFileSync(join(dir, '.env'), 'kept');

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['', '', '', '', '', '', ''] });

      expect(result).toMatchObject({ code: 1, questions: [] });
    });

    it('starting now runs the instance in the directory and drops the docker step from the checklist', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['', '', '', '', '', '', 'y'] });

      expect(result).toMatchObject({ code: 0, startedIn: [dir] });
      expect(result.stdout).not.toContain('docker compose up -d');
      expect(result.stdout).toContain('\n1. Open http://localhost:3000\n2. Sign in with the viewer password');
      expect(result.stdout).toContain('\n5. In your project repo:\n');
    });

    it('a failed start exits with its code and keeps the docker step in the checklist', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['', '', '', '', '', '', 'y'], startExitCode: 3 });

      expect(result.code).toBe(3);
      expect(result.stdout).toContain(`\n1. cd ${dir} && docker compose up -d\n`);
    });
  });
});
