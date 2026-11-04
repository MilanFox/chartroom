import type { CliContext, Output } from './shared.js';
import { CliExit } from './shared.js';

const ansi = (code: string) => (text: string) => `\u001b[${code}m${text}\u001b[0m`;

const unstyled = (text: string) => text;

export const stylesFor = (output: Output, env: CliContext['env']) => {
  const styled = output.isTTY === true && !env.NO_COLOR;
  return {
    styled,
    bold: styled ? ansi('1') : unstyled,
    dim: styled ? ansi('2') : unstyled,
    green: styled ? ansi('32') : unstyled,
    cyan: styled ? ansi('36') : unstyled,
    boldYellow: styled ? ansi('1;33') : unstyled,
    chip: styled ? (text: string) => ansi('48;5;236;38;5;117')(` ${text} `) : unstyled,
  };
};

export const visibleLength = (text: string) => [...text].length;

export const wrap = (text: string, width: number) => {
  const words = text.split(' ').flatMap(word => visibleLength(word) > width ? word.match(new RegExp(`.{1,${width}}`, 'gu'))! : [word]);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && visibleLength(line) + 1 + visibleLength(word) > width) {
      lines.push(line);
      line = word;
    }
    else line = line ? `${line} ${word}` : word;
  }
  return [...lines, line];
};

export const boxWidth = (columns: number | undefined) => Math.max(Math.min(columns || 80, 80), 24);

export const checklistBox = (steps: string[], columns: number | undefined, { bold, dim }: ReturnType<typeof stylesFor>) => {
  const width = boxWidth(columns);
  const inner = width - 4;
  const row = (text = '', visible = visibleLength(text)) => `${dim('│')} ${text}${' '.repeat(inner - visible)} ${dim('│')}`;
  const stepRows = steps.flatMap((step, index) => step.split('\n').flatMap(paragraph => wrap(paragraph, inner - 3)).map((line, lineIndex) => lineIndex
    ? row(`   ${line}`)
    : row(`${bold(`${index + 1}.`)} ${line}`, visibleLength(line) + 3)));
  return [
    `${dim('╭─')} ${bold('First start')} ${dim(`${'─'.repeat(width - 16)}╮`)}`,
    row(),
    ...stepRows,
    row(),
    dim(`╰${'─'.repeat(width - 2)}╯`),
  ];
};

export const terminalAsk = (input: NodeJS.ReadStream, output: Output): NonNullable<CliContext['ask']> => {
  let pending = '';
  return (question, { hidden = false } = {}) => new Promise((resolve, reject) => {
    let typed = '';
    const settle = (finish: () => void) => {
      input.off('data', onData);
      input.off('end', onEnd);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
      finish();
    };
    const consume = () => {
      while (pending) {
        const char = String.fromCodePoint(pending.codePointAt(0)!);
        pending = pending.slice(char.length);
        if (char === '\u0003') {
          settle(() => reject(new CliExit('interrupted, nothing written', 130)));
          return;
        }
        if (char === '\u0004') {
          settle(() => resolve(null));
          return;
        }
        if (char === '\r' || char === '\n') {
          if (char === '\r' && pending.startsWith('\n')) pending = pending.slice(1);
          settle(() => resolve(typed));
          return;
        }
        if (char === '\u001b') {
          pending = pending.slice(/^(\[[0-?]*[ -/]*[@-~]|O.)?/.exec(pending)![0].length);
          continue;
        }
        if (char === '\u007f' || char === '\b') {
          if (typed) output.write('\b \b');
          typed = typed.slice(0, -1);
        }
        else if (char >= ' ') {
          typed += char;
          output.write(hidden ? '*' : char);
        }
      }
    };
    const onData = (chunk: string) => {
      pending += chunk;
      consume();
    };
    const onEnd = () => settle(() => resolve(null));
    input.setEncoding('utf8');
    input.setRawMode(true);
    output.write(question);
    input.on('data', onData);
    input.on('end', onEnd);
    input.resume();
    consume();
  });
};
