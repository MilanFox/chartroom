import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { Token } from 'marked';

const raiseHeadingsTo = (minHeadingLevel: number) => (token: Token) => {
  if (token.type === 'heading') token.depth = Math.max(minHeadingLevel, token.depth);
};

export const useMarkdown = () => {
  const render = (source: string, minHeadingLevel = 1) =>
    (DOMPurify.isSupported ? DOMPurify.sanitize(marked.parse(source, { async: false, walkTokens: minHeadingLevel > 1 ? raiseHeadingsTo(minHeadingLevel) : null })) : null);
  return { render };
};
