import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { ParseArgsOptionsConfig } from 'node:util';

// eslint-disable-next-line no-unused-vars -- the core rule misreads type-level parameters
export type Handler<Args extends unknown[], Result> = (...args: Args) => Result;

export interface Output {
  write: Handler<[string], boolean>
  isTTY?: boolean
  columns?: number
}

export interface CliContext {
  argv: string[]
  env: Record<string, string | undefined>
  cwd?: string
  stdin: AsyncIterable<string | Uint8Array>
  stdout: Output
  stderr: Output
  version?: string
  ask?: Handler<[string, AskOptions?], Promise<string | null>>
  startInstance?: Handler<[string], Promise<number>>
}

export interface AskOptions {
  hidden?: boolean
}

export class UsageError extends Error {}

export class CliExit extends Error {
  // eslint-disable-next-line no-unused-vars -- the core rule misreads parameter properties
  constructor(message: string, readonly exitCode = 1) {
    super(message);
  }
}

export const strictArgs = (args: string[], options: ParseArgsOptionsConfig) => {
  try {
    return parseArgs({ args, options, strict: true, allowPositionals: true });
  }
  catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
};

export const majorOf = (version: string) => version.split('.')[0];

export const ownVersion = () => (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
