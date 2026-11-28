import { describe, expect, it } from 'vitest';
import { preprocessLaTeX } from '../latex';

describe('preprocessLaTeX', () => {
  it.each([
    [
      'returns the same string if no LaTeX patterns are found',
      { content: 'This is a test string without LaTeX or dollar signs' },
    ],
    [
      'returns the same string if no dollar signs are present',
      { content: 'This has LaTeX \\(x^2\\) and \\[y^2\\] but no dollars' },
    ],
    /* \(...\)/\[...\] are left untouched here by design: micromark-extension-llm-math (aliased
     * in place of micromark-extension-math at the bundler level) parses them directly, so no
     * string rewriting is needed. See MarkdownRenderer.spec.tsx for the end-to-end render check. */
    [
      'preserves valid inline LaTeX delimiters \\(...\\)',
      { content: 'This is inline LaTeX: \\(x^2 + y^2 = z^2\\)' },
    ],
    [
      'preserves valid block LaTeX delimiters \\[...\\]',
      { content: 'This is block LaTeX: \\[E = mc^2\\]' },
    ],
    [
      'leaves escaped citation brackets inside code untouched',
      { content: '`\\[Source: [a.com](https://a.com)\\]`' },
    ],
    [
      'preserves valid double dollar delimiters',
      { content: 'This is valid: $$x^2 + y^2 = z^2$$' },
    ],
    [
      'does not escape already escaped dollar signs',
      { content: 'Already escaped \\$50 and \\$100' },
    ],
    [
      'does not convert already escaped single dollars',
      { content: 'Escaped \\$x^2\\$ should not change' },
    ],
  ])('%s', (_name, { content }) => {
    expect(preprocessLaTeX(content)).toBe(content);
  });

  it.each([
    [
      'turns escaped brackets around a citation list back into literal brackets',
      {
        content:
          'Grew 20%. \\[Sources: [cvc.com](https://example.com/a-b), [ft.com](https://ft.com/x)\\]',
        expected:
          'Grew 20%. &#91;Sources: [cvc.com](https://example.com/a-b), [ft.com](https://ft.com/x)&#93;',
      },
    ],
    [
      'turns escaped parentheses around a bare URL back into literal parentheses',
      {
        content: 'See \\(https://example.com/a-b\\) and \\(x^2\\)',
        expected: 'See &#40;https://example.com/a-b&#41; and \\(x^2\\)',
      },
    ],
    [
      'keeps escaped citation brackets literal alongside dollar math',
      {
        content: 'Cost $x^2$ \\[Source: [a.com](https://a.com)\\]',
        expected: 'Cost $$x^2$$ &#91;Source: [a.com](https://a.com)&#93;',
      },
    ],
    [
      'converts single dollar delimiters to double dollars',
      {
        content: 'Inline math: $x^2 + y^2 = z^2$',
        expected: 'Inline math: $$x^2 + y^2 = z^2$$',
      },
    ],
    [
      'converts multiple single dollar expressions',
      {
        content: 'First $a + b = c$ and second $x^2 + y^2 = z^2$',
        expected: 'First $$a + b = c$$ and second $$x^2 + y^2 = z^2$$',
      },
    ],
    [
      'escapes currency dollar signs',
      {
        content: 'Price is $50 and $100',
        expected: 'Price is \\$50 and \\$100',
      },
    ],
    [
      'escapes currency with spaces',
      { content: '$50 is $20 + $30', expected: '\\$50 is \\$20 + \\$30' },
    ],
    [
      'escapes currency with commas',
      {
        content: 'The price is $1,000,000 for this item.',
        expected: 'The price is \\$1,000,000 for this item.',
      },
    ],
    [
      'escapes currency with decimals',
      {
        content: 'Total: $29.50 plus tax',
        expected: 'Total: \\$29.50 plus tax',
      },
    ],
    [
      'converts LaTeX expressions while escaping currency',
      {
        content: 'LaTeX $x^2$ and price $50',
        expected: 'LaTeX $$x^2$$ and price \\$50',
      },
    ],
    [
      'handles the Goldbach Conjecture example',
      {
        content:
          '- **Goldbach Conjecture**: $2n = p + q$ (every even integer > 2)',
        expected:
          '- **Goldbach Conjecture**: $$2n = p + q$$ (every even integer > 2)',
      },
    ],
    [
      'escapes mhchem commands',
      {
        content: '$\\ce{H2O}$ and $\\pu{123 J}$',
        expected: '$$\\\\ce{H2O}$$ and $$\\\\pu{123 J}$$',
      },
    ],
    [
      'handles complex mixed content',
      {
        content: `Valid double $$y^2$$
Currency $100 and $200
Single dollar math $x^2 + y^2$
Chemical $\\ce{H2O}$
Valid brackets \\[z^2\\]`,
        expected: `Valid double $$y^2$$
Currency \\$100 and \\$200
Single dollar math $$x^2 + y^2$$
Chemical $$\\\\ce{H2O}$$
Valid brackets \\[z^2\\]`,
      },
    ],
    [
      'handles multiple equations with currency',
      {
        content: `- **Euler's Totient Function**: $\\phi(n) = n \\prod_{p|n} \\left(1 - \\frac{1}{p}\\right)$
- **Total Savings**: $500 + $200 + $150 = $850`,
        expected: `- **Euler's Totient Function**: $$\\phi(n) = n \\prod_{p|n} \\left(1 - \\frac{1}{p}\\right)$$
- **Total Savings**: \\$500 + \\$200 + \\$150 = \\$850`,
      },
    ],
    [
      'handles inline code blocks',
      {
        content: 'Outside $x^2$ and inside code: `$100`',
        expected: 'Outside $$x^2$$ and inside code: `$100`',
      },
    ],
    [
      'handles multiline code blocks',
      {
        content: '```\n$100\n$variable\n```\nOutside $x^2$',
        expected: '```\n$100\n$variable\n```\nOutside $$x^2$$',
      },
    ],
    [
      'preserves LaTeX expressions with special characters',
      {
        content: 'The set is defined as $\\{x | x > 0\\}$.',
        expected: 'The set is defined as $$\\{x | x > 0\\}$$.',
      },
    ],
    [
      'handles complex physics equations',
      {
        content: `- **Schrödinger Equation**: $i\\hbar\\frac{\\partial}{\\partial t}|\\psi\\rangle = \\hat{H}|\\psi\\rangle$
- **Einstein Field Equations**: $G_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}$`,
        expected: `- **Schrödinger Equation**: $$i\\hbar\\frac{\\partial}{\\partial t}|\\psi\\rangle = \\hat{H}|\\psi\\rangle$$
- **Einstein Field Equations**: $$G_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}$$`,
      },
    ],
    [
      'handles financial calculations with currency',
      {
        content: `- **Simple Interest**: $A = P + Prt = $1,000 + ($1,000)(0.05)(2) = $1,100$
- **ROI**: $\\text{ROI} = \\frac{$1,200 - $1,000}{$1,000} \\times 100\\% = 20\\%$`,
        expected: `- **Simple Interest**: $$A = P + Prt = \\$1,000 + (\\$1,000)(0.05)(2) = \\$1,100$$
- **ROI**: $$\\text{ROI} = \\frac{\\$1,200 - \\$1,000}{\\$1,000} \\times 100\\% = 20\\%$$`,
      },
    ],
    [
      'does not convert partial or malformed expressions',
      {
        content: 'A single $ sign should not be converted',
        expected: 'A single $ sign should not be converted',
      },
    ],
    [
      'handles nested parentheses in LaTeX',
      {
        content:
          'Matrix determinant: $\\det(A) = \\sum_{\\sigma \\in S_n} \\text{sgn}(\\sigma) \\prod_{i=1}^n a_{i,\\sigma(i)}$',
        expected:
          'Matrix determinant: $$\\det(A) = \\sum_{\\sigma \\in S_n} \\text{sgn}(\\sigma) \\prod_{i=1}^n a_{i,\\sigma(i)}$$',
      },
    ],
    [
      'preserves spacing in equations',
      {
        content: 'Equation: $f(x) = 2x + 3$ where x is a variable.',
        expected: 'Equation: $$f(x) = 2x + 3$$ where x is a variable.',
      },
    ],
    [
      'does not convert LaTeX with newlines inside',
      {
        content: `This has $x
y$ which spans lines`,
        expected: `This has $x
y$ which spans lines`,
      },
    ],
    [
      'handles multiple dollar signs in text',
      {
        content: 'Price $100 then equation $x + y = z$ then another price $50',
        expected:
          'Price \\$100 then equation $$x + y = z$$ then another price \\$50',
      },
    ],
    [
      'handles complex LaTeX with currency in the same expression',
      {
        content: 'Calculate $\\text{Total} = \\$500 + \\$200$',
        expected: 'Calculate $$\\text{Total} = \\$500 + \\$200$$',
      },
    ],
    [
      'preserves already escaped dollars inside LaTeX',
      {
        content: 'The formula $f(x) = \\$2x$ represents cost',
        expected: 'The formula $$f(x) = \\$2x$$ represents cost',
      },
    ],
    [
      'handles adjacent LaTeX and currency',
      {
        content: 'Formula $x^2$ costs $25',
        expected: 'Formula $$x^2$$ costs \\$25',
      },
    ],
    [
      'handles LaTeX with special characters and currency',
      {
        content: 'Set $\\{x | x > \\$0\\}$ for positive prices',
        expected: 'Set $$\\{x | x > \\$0\\}$$ for positive prices',
      },
    ],
    [
      'does not convert when the closing dollar is preceded by a backtick',
      {
        content:
          'The error "invalid $lookup namespace" occurs when using `$lookup` operator',
        expected:
          'The error "invalid $lookup namespace" occurs when using `$lookup` operator',
      },
    ],
    [
      'handles mixed backtick and non-backtick cases',
      {
        content: 'Use $x + y$ in math but `$lookup` in code',
        expected: 'Use $$x + y$$ in math but `$lookup` in code',
      },
    ],
    [
      'escapes currency amounts without commas',
      {
        content:
          'The total amount invested is $1157.90 (existing amount) + $500 (new investment) = $1657.90.',
        expected:
          'The total amount invested is \\$1157.90 (existing amount) + \\$500 (new investment) = \\$1657.90.',
      },
    ],
    [
      'handles large currency amounts',
      {
        content: 'You can win $1000000 or even $9999999.99!',
        expected: 'You can win \\$1000000 or even \\$9999999.99!',
      },
    ],
    [
      'escapes currency with many decimal places',
      {
        content: 'Bitcoin: $0.00001234, Gas: $3.999, Rate: $1.234567890',
        expected: 'Bitcoin: \\$0.00001234, Gas: \\$3.999, Rate: \\$1.234567890',
      },
    ],
    [
      'escapes abbreviated currency notation',
      { content: '$250k is 25% of $1M', expected: '\\$250k is 25% of \\$1M' },
    ],
    [
      'handles various abbreviated currency formats',
      {
        content: 'Revenue: $5M to $10M, funding: $1.5B, price: $5K',
        expected: 'Revenue: \\$5M to \\$10M, funding: \\$1.5B, price: \\$5K',
      },
    ],
  ])('%s', (_name, { content, expected }) => {
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles an empty string', () => {
    expect(preprocessLaTeX('')).toBe('');
  });

  /* [#8753](https://github.com/epam/ai-dial-chat/issues/8753), second failure: a currency-shaped opening delimiter was escaped on its
   * own, which left its partner free to open the next span and shifted every pairing
   * along the line — `$0 < x$ and then $y \in H$` typeset the English words and printed
   * both formulas as source. */
  describe('a formula whose first character is a digit', () => {
    it.each([
      [
        'converts an inline formula that opens on a digit',
        {
          content: 'B: $0 < x$ and then $y \\in H$ done.',
          expected: 'B: $$0 < x$$ and then $$y \\in H$$ done.',
        },
      ],
      [
        'keeps a formula that opens on a digit and a backslash relation',
        {
          content: 'On $[0,T]$ where $0 \\le T \\le \\infty$ holds',
          expected: 'On $$[0,T]$$ where $$0 \\le T \\le \\infty$$ holds',
        },
      ],
      [
        'keeps LaTeX glued straight onto a leading digit',
        {
          content: 'Growth is $2^n$ and the angle is $2\\pi$ radians',
          expected: 'Growth is $$2^n$$ and the angle is $$2\\pi$$ radians',
        },
      ],
      [
        'declines both delimiters of a bare number so the rest of the line still pairs',
        {
          content: 'It goes to $0$, so $L^2$ and $-1/2$ follow.',
          expected: 'It goes to \\$0\\$, so $$L^2$$ and $$-1/2$$ follow.',
        },
      ],
      [
        'keeps a bare-number price literal',
        {
          content: 'C: cost is $2$ exactly.',
          expected: 'C: cost is \\$2\\$ exactly.',
        },
      ],
      [
        'leaves a trailing dollar alone when it closes an enclosing formula',
        {
          content: 'Total $T = $1,000 + $100$',
          expected: 'Total $$T = \\$1,000 + \\$100$$',
        },
      ],
      [
        'still sees a relation separated from the amount by several spaces',
        {
          content: 'Range $0 \t < x$ here',
          expected: 'Range $$0 \t < x$$ here',
        },
      ],
      [
        'converts a formula that opens on a digit and an arithmetic operator',
        {
          content:
            '- **Subcritical** if $1 - \\frac{3}{p} - \\frac{2}{q} < 0 \\iff \\frac{2}{q} + \\frac{3}{p} < 1$',
          expected:
            '- **Subcritical** if $$1 - \\frac{3}{p} - \\frac{2}{q} < 0 \\iff \\frac{2}{q} + \\frac{3}{p} < 1$$',
        },
      ],
      [
        'converts a digit-first formula whose only math marker is a control sequence',
        {
          content: 'The angle is $2 \\pi r$ around',
          expected: 'The angle is $$2 \\pi r$$ around',
        },
      ],
      [
        'converts a digit-first formula marked only by a superscript',
        {
          content: 'It grows like $2 n^2$ overall',
          expected: 'It grows like $$2 n^2$$ overall',
        },
      ],
      [
        'still escapes a price when the span holds no LaTeX markup',
        {
          content: 'Price $100 then equation $x + y = z$ then another $50',
          expected:
            'Price \\$100 then equation $$x + y = z$$ then another \\$50',
        },
      ],
      [
        'escapes an amount followed by prose even when a later formula is on the line',
        {
          content: 'It costs $50 and the ratio $x^2$ holds',
          expected: 'It costs \\$50 and the ratio $$x^2$$ holds',
        },
      ],
    ])('%s', (_name, { content, expected }) => {
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('renders a digit-first formula exactly like its letter-first twin', () => {
      const digitFirst = preprocessLaTeX('$0 < x$ and then $y \\in H$ done.');
      const letterFirst = preprocessLaTeX('$z < x$ and then $y \\in H$ done.');
      expect(digitFirst.replace('0', 'z')).toBe(letterFirst);
    });

    it('escapes an amount trailed by a long whitespace run in linear time', () => {
      const tabs = '\t'.repeat(200_000);
      expect(preprocessLaTeX(`$0${tabs}x`)).toBe(`\\$0${tabs}x`);
    });
  });

  /* [#8753](https://github.com/epam/ai-dial-chat/issues/8753), first failure: `remark-math` reads the rest of a line-leading `$$` fence
   * as discardable meta and only closes on a line holding nothing but `$$`, so
   * `$$\begin{aligned}` … `\end{aligned}$$` lost the environment opener, never closed, and
   * swallowed every heading and paragraph after it as raw LaTeX. */
  describe('display math fences', () => {
    it.each([
      [
        'moves an environment opener off the opening fence line',
        {
          content: '$$\\begin{aligned}\nx &= 1\n\\end{aligned}$$',
          expected: '$$\n\\begin{aligned}\nx &= 1\n\\end{aligned}\n$$',
        },
      ],
      [
        'keeps the content after a display block out of the block',
        {
          content:
            '$$\\begin{aligned}\n&\\left| \\int_0^T u \\right| \\le C\n\\end{aligned}$$\n\n##### Conclusion\n\nThe end.',
          expected:
            '$$\n\\begin{aligned}\n&\\left| \\int_0^T u \\right| \\le C\n\\end{aligned}\n$$\n\n##### Conclusion\n\nThe end.',
        },
      ],
      [
        'breaks trailing prose off the closing fence line',
        {
          content: '$$\na = b\n$$ and then more',
          expected: '$$\na = b\n$$\n and then more',
        },
      ],
      [
        'splits the fences of a single-line display block onto their own lines',
        { content: '$$x^2 + y^2 = z^2$$', expected: '$$\nx^2 + y^2 = z^2\n$$' },
      ],
      [
        'splits the fences of a single-line block sitting in its own paragraph',
        {
          content: 'Before.\n\n$$x_{1,2,3} = 0$$\n\nAfter.',
          expected: 'Before.\n\n$$\nx_{1,2,3} = 0\n$$\n\nAfter.',
        },
      ],
      [
        'splits the fences of a single-line block on a line of its own inside a paragraph',
        {
          content: 'The result is:\n$$E = mc^2$$\nwhich follows.',
          expected: 'The result is:\n$$\nE = mc^2\n$$\nwhich follows.',
        },
      ],
      [
        'normalizes each of several display blocks',
        {
          content:
            '$$\\begin{aligned}\na\n\\end{aligned}$$\n\nText\n\n$$\nb\n$$',
          expected:
            '$$\n\\begin{aligned}\na\n\\end{aligned}\n$$\n\nText\n\n$$\nb\n$$',
        },
      ],
    ])('%s', (_name, { content, expected }) => {
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it.each([
      [
        'leaves an already well-formed display block untouched',
        { content: 'Text\n\n$$\nx = 1\n$$\n\nMore.' },
      ],
      [
        'leaves a single-line block followed by prose on its line untouched',
        { content: '$$x^2$$ is the answer.' },
      ],
      ['leaves an empty display span untouched', { content: '$$$$' }],
      [
        'leaves a display block that starts mid-line untouched',
        { content: 'Consider $$\\begin{aligned}\nx &= 1\n\\end{aligned}$$' },
      ],
      [
        'leaves display fences inside a fenced code block untouched',
        { content: '```\n$$\\begin{aligned}\nx\n\\end{aligned}$$\n```' },
      ],
    ])('%s', (_name, { content }) => {
      expect(preprocessLaTeX(content)).toBe(content);
    });
  });
});
