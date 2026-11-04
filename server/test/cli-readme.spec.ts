import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VERB_ROUTES } from '../../cli/src/chartroom';

const README = readFileSync(resolve(import.meta.dirname, '../../cli/README.md'), 'utf8');

const commands = [...new Set(VERB_ROUTES.map(route => route.command))];

const exampleLines = [...README.matchAll(/`chart ([^`]+)`/g)].map(match => match[1]!.split(' '));

const commandOf = (words: string[]) => commands
  .filter(command => command.split(' ').every((word, index) => words[index] === word))
  .reduce<string | undefined>((longest, command) => command.length > (longest?.length ?? 0) ? command : longest, undefined);

describe('the CLI README', () => {
  it('has a chart example for every CLI verb', () => {
    const documented = new Set(exampleLines.map(commandOf).filter(Boolean));

    expect(commands.filter(command => !documented.has(command))).toEqual([]);
  });
});
