import { describe, expect, it } from 'vitest';
import { useMarkdown } from './useMarkdown';

describe('useMarkdown', () => {
  it('renders markdown to HTML', () => {
    const { render } = useMarkdown();

    expect(render('## Question\n\nHow does **this** look?')).toBe('<h2>Question</h2>\n<p>How does <strong>this</strong> look?</p>\n');
  });

  it('renders a script tag in a body inert', () => {
    const { render } = useMarkdown();

    expect(render('Before\n\n<script>window.pwned = true</script>\n\nAfter')).toBe('<p>Before</p>\n<p>After</p>\n');
  });

  it('strips event handlers and javascript: links', () => {
    const { render } = useMarkdown();

    const html = render('<img src="x.png" onerror="window.pwned = true">\n\n[click](javascript:window.pwned=true)');

    expect(html).not.toMatch(/onerror|javascript:/);
    expect(html).toContain('<img src="x.png">');
  });
});
