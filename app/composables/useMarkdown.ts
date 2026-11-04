import DOMPurify from 'dompurify';
import { marked } from 'marked';

export const useMarkdown = () => {
  const render = (source: string) => (DOMPurify.isSupported ? DOMPurify.sanitize(marked.parse(source, { async: false })) : null);
  return { render };
};
