import { describe, expect, it } from 'vitest';
import { preprocessLaTeX } from '../latex';

describe('preprocessLaTeX', () => {
  it('returns the same string if no LaTeX patterns are found', () => {
    const content = 'This is a test string without LaTeX or dollar signs';
    expect(preprocessLaTeX(content)).toBe(content);
  });

  it('returns the same string if no dollar signs are present', () => {
    const content = 'This has LaTeX \\(x^2\\) and \\[y^2\\] but no dollars';
    expect(preprocessLaTeX(content)).toBe(content);
  });

  /* \(...\)/\[...\] are left untouched here by design: micromark-extension-llm-math (aliased
   * in place of micromark-extension-math at the bundler level) parses them directly, so no
   * string rewriting is needed. See MarkdownRenderer.spec.tsx for the end-to-end render check. */
  it('preserves valid inline LaTeX delimiters \\(...\\)', () => {
    const content = 'This is inline LaTeX: \\(x^2 + y^2 = z^2\\)';
    expect(preprocessLaTeX(content)).toBe(content);
  });

  it('preserves valid block LaTeX delimiters \\[...\\]', () => {
    const content = 'This is block LaTeX: \\[E = mc^2\\]';
    expect(preprocessLaTeX(content)).toBe(content);
  });

  it('preserves valid double dollar delimiters', () => {
    const content = 'This is valid: $$x^2 + y^2 = z^2$$';
    expect(preprocessLaTeX(content)).toBe(content);
  });

  it('converts single dollar delimiters to double dollars', () => {
    const content = 'Inline math: $x^2 + y^2 = z^2$';
    const expected = 'Inline math: $$x^2 + y^2 = z^2$$';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('converts multiple single dollar expressions', () => {
    const content = 'First $a + b = c$ and second $x^2 + y^2 = z^2$';
    const expected = 'First $$a + b = c$$ and second $$x^2 + y^2 = z^2$$';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('escapes currency dollar signs', () => {
    const content = 'Price is $50 and $100';
    const expected = 'Price is \\$50 and \\$100';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('escapes currency with spaces', () => {
    const content = '$50 is $20 + $30';
    const expected = '\\$50 is \\$20 + \\$30';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('escapes currency with commas', () => {
    const content = 'The price is $1,000,000 for this item.';
    const expected = 'The price is \\$1,000,000 for this item.';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('escapes currency with decimals', () => {
    const content = 'Total: $29.50 plus tax';
    const expected = 'Total: \\$29.50 plus tax';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('converts LaTeX expressions while escaping currency', () => {
    const content = 'LaTeX $x^2$ and price $50';
    const expected = 'LaTeX $$x^2$$ and price \\$50';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles the Goldbach Conjecture example', () => {
    const content =
      '- **Goldbach Conjecture**: $2n = p + q$ (every even integer > 2)';
    const expected =
      '- **Goldbach Conjecture**: $$2n = p + q$$ (every even integer > 2)';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('does not escape already escaped dollar signs', () => {
    const content = 'Already escaped \\$50 and \\$100';
    expect(preprocessLaTeX(content)).toBe(content);
  });

  it('does not convert already escaped single dollars', () => {
    const content = 'Escaped \\$x^2\\$ should not change';
    expect(preprocessLaTeX(content)).toBe(content);
  });

  it('escapes mhchem commands', () => {
    const content = '$\\ce{H2O}$ and $\\pu{123 J}$';
    const expected = '$$\\\\ce{H2O}$$ and $$\\\\pu{123 J}$$';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles an empty string', () => {
    expect(preprocessLaTeX('')).toBe('');
  });

  it('handles complex mixed content', () => {
    const content = `Valid double $$y^2$$
Currency $100 and $200
Single dollar math $x^2 + y^2$
Chemical $\\ce{H2O}$
Valid brackets \\[z^2\\]`;
    const expected = `Valid double $$y^2$$
Currency \\$100 and \\$200
Single dollar math $$x^2 + y^2$$
Chemical $$\\\\ce{H2O}$$
Valid brackets \\[z^2\\]`;
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles multiple equations with currency', () => {
    const content = `- **Euler's Totient Function**: $\\phi(n) = n \\prod_{p|n} \\left(1 - \\frac{1}{p}\\right)$
- **Total Savings**: $500 + $200 + $150 = $850`;
    const expected = `- **Euler's Totient Function**: $$\\phi(n) = n \\prod_{p|n} \\left(1 - \\frac{1}{p}\\right)$$
- **Total Savings**: \\$500 + \\$200 + \\$150 = \\$850`;
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles inline code blocks', () => {
    const content = 'Outside $x^2$ and inside code: `$100`';
    const expected = 'Outside $$x^2$$ and inside code: `$100`';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles multiline code blocks', () => {
    const content = '```\n$100\n$variable\n```\nOutside $x^2$';
    const expected = '```\n$100\n$variable\n```\nOutside $$x^2$$';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('preserves LaTeX expressions with special characters', () => {
    const content = 'The set is defined as $\\{x | x > 0\\}$.';
    const expected = 'The set is defined as $$\\{x | x > 0\\}$$.';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles complex physics equations', () => {
    const content = `- **Schrödinger Equation**: $i\\hbar\\frac{\\partial}{\\partial t}|\\psi\\rangle = \\hat{H}|\\psi\\rangle$
- **Einstein Field Equations**: $G_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}$`;
    const expected = `- **Schrödinger Equation**: $$i\\hbar\\frac{\\partial}{\\partial t}|\\psi\\rangle = \\hat{H}|\\psi\\rangle$$
- **Einstein Field Equations**: $$G_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}$$`;
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles financial calculations with currency', () => {
    const content = `- **Simple Interest**: $A = P + Prt = $1,000 + ($1,000)(0.05)(2) = $1,100$
- **ROI**: $\\text{ROI} = \\frac{$1,200 - $1,000}{$1,000} \\times 100\\% = 20\\%$`;
    const expected = `- **Simple Interest**: $$A = P + Prt = \\$1,000 + (\\$1,000)(0.05)(2) = \\$1,100$$
- **ROI**: $$\\text{ROI} = \\frac{\\$1,200 - \\$1,000}{\\$1,000} \\times 100\\% = 20\\%$$`;
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('does not convert partial or malformed expressions', () => {
    const content = 'A single $ sign should not be converted';
    const expected = 'A single $ sign should not be converted';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles nested parentheses in LaTeX', () => {
    const content =
      'Matrix determinant: $\\det(A) = \\sum_{\\sigma \\in S_n} \\text{sgn}(\\sigma) \\prod_{i=1}^n a_{i,\\sigma(i)}$';
    const expected =
      'Matrix determinant: $$\\det(A) = \\sum_{\\sigma \\in S_n} \\text{sgn}(\\sigma) \\prod_{i=1}^n a_{i,\\sigma(i)}$$';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('preserves spacing in equations', () => {
    const content = 'Equation: $f(x) = 2x + 3$ where x is a variable.';
    const expected = 'Equation: $$f(x) = 2x + 3$$ where x is a variable.';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('does not convert LaTeX with newlines inside', () => {
    const content = `This has $x
y$ which spans lines`;
    const expected = `This has $x
y$ which spans lines`;
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles multiple dollar signs in text', () => {
    const content =
      'Price $100 then equation $x + y = z$ then another price $50';
    const expected =
      'Price \\$100 then equation $$x + y = z$$ then another price \\$50';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles complex LaTeX with currency in the same expression', () => {
    const content = 'Calculate $\\text{Total} = \\$500 + \\$200$';
    const expected = 'Calculate $$\\text{Total} = \\$500 + \\$200$$';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('preserves already escaped dollars inside LaTeX', () => {
    const content = 'The formula $f(x) = \\$2x$ represents cost';
    const expected = 'The formula $$f(x) = \\$2x$$ represents cost';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles adjacent LaTeX and currency', () => {
    const content = 'Formula $x^2$ costs $25';
    const expected = 'Formula $$x^2$$ costs \\$25';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles LaTeX with special characters and currency', () => {
    const content = 'Set $\\{x | x > \\$0\\}$ for positive prices';
    const expected = 'Set $$\\{x | x > \\$0\\}$$ for positive prices';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('does not convert when the closing dollar is preceded by a backtick', () => {
    const content =
      'The error "invalid $lookup namespace" occurs when using `$lookup` operator';
    const expected =
      'The error "invalid $lookup namespace" occurs when using `$lookup` operator';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles mixed backtick and non-backtick cases', () => {
    const content = 'Use $x + y$ in math but `$lookup` in code';
    const expected = 'Use $$x + y$$ in math but `$lookup` in code';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('escapes currency amounts without commas', () => {
    const content =
      'The total amount invested is $1157.90 (existing amount) + $500 (new investment) = $1657.90.';
    const expected =
      'The total amount invested is \\$1157.90 (existing amount) + \\$500 (new investment) = \\$1657.90.';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles large currency amounts', () => {
    const content = 'You can win $1000000 or even $9999999.99!';
    const expected = 'You can win \\$1000000 or even \\$9999999.99!';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('escapes currency with many decimal places', () => {
    const content = 'Bitcoin: $0.00001234, Gas: $3.999, Rate: $1.234567890';
    const expected =
      'Bitcoin: \\$0.00001234, Gas: \\$3.999, Rate: \\$1.234567890';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('escapes abbreviated currency notation', () => {
    const content = '$250k is 25% of $1M';
    const expected = '\\$250k is 25% of \\$1M';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  it('handles various abbreviated currency formats', () => {
    const content = 'Revenue: $5M to $10M, funding: $1.5B, price: $5K';
    const expected = 'Revenue: \\$5M to \\$10M, funding: \\$1.5B, price: \\$5K';
    expect(preprocessLaTeX(content)).toBe(expected);
  });

  /* Issue #8753, second failure: a currency-shaped opening delimiter was escaped on its
   * own, which left its partner free to open the next span and shifted every pairing
   * along the line — `$0 < x$ and then $y \in H$` typeset the English words and printed
   * both formulas as source. */
  describe('a formula whose first character is a digit', () => {
    it('converts an inline formula that opens on a digit', () => {
      const content = 'B: $0 < x$ and then $y \\in H$ done.';
      const expected = 'B: $$0 < x$$ and then $$y \\in H$$ done.';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('renders a digit-first formula exactly like its letter-first twin', () => {
      const digitFirst = preprocessLaTeX('$0 < x$ and then $y \\in H$ done.');
      const letterFirst = preprocessLaTeX('$z < x$ and then $y \\in H$ done.');
      expect(digitFirst.replace('0', 'z')).toBe(letterFirst);
    });

    it('keeps a formula that opens on a digit and a backslash relation', () => {
      const content = 'On $[0,T]$ where $0 \\le T \\le \\infty$ holds';
      const expected = 'On $$[0,T]$$ where $$0 \\le T \\le \\infty$$ holds';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('keeps LaTeX glued straight onto a leading digit', () => {
      const content = 'Growth is $2^n$ and the angle is $2\\pi$ radians';
      const expected = 'Growth is $$2^n$$ and the angle is $$2\\pi$$ radians';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('declines both delimiters of a bare number so the rest of the line still pairs', () => {
      const content = 'It goes to $0$, so $L^2$ and $-1/2$ follow.';
      const expected = 'It goes to \\$0\\$, so $$L^2$$ and $$-1/2$$ follow.';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('keeps a bare-number price literal', () => {
      const content = 'C: cost is $2$ exactly.';
      const expected = 'C: cost is \\$2\\$ exactly.';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('leaves a trailing dollar alone when it closes an enclosing formula', () => {
      const content = 'Total $T = $1,000 + $100$';
      const expected = 'Total $$T = \\$1,000 + \\$100$$';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('still sees a relation separated from the amount by several spaces', () => {
      const content = 'Range $0 \t < x$ here';
      const expected = 'Range $$0 \t < x$$ here';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('converts a formula that opens on a digit and an arithmetic operator', () => {
      const content =
        '- **Subcritical** if $1 - \\frac{3}{p} - \\frac{2}{q} < 0 \\iff \\frac{2}{q} + \\frac{3}{p} < 1$';
      const expected =
        '- **Subcritical** if $$1 - \\frac{3}{p} - \\frac{2}{q} < 0 \\iff \\frac{2}{q} + \\frac{3}{p} < 1$$';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('converts a digit-first formula whose only math marker is a control sequence', () => {
      const content = 'The angle is $2 \\pi r$ around';
      const expected = 'The angle is $$2 \\pi r$$ around';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('converts a digit-first formula marked only by a superscript', () => {
      const content = 'It grows like $2 n^2$ overall';
      const expected = 'It grows like $$2 n^2$$ overall';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('still escapes a price when the span holds no LaTeX markup', () => {
      const content = 'Price $100 then equation $x + y = z$ then another $50';
      const expected =
        'Price \\$100 then equation $$x + y = z$$ then another \\$50';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('escapes an amount followed by prose even when a later formula is on the line', () => {
      const content = 'It costs $50 and the ratio $x^2$ holds';
      const expected = 'It costs \\$50 and the ratio $$x^2$$ holds';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('escapes an amount trailed by a long whitespace run in linear time', () => {
      const tabs = '\t'.repeat(200_000);
      expect(preprocessLaTeX(`$0${tabs}x`)).toBe(`\\$0${tabs}x`);
    });
  });

  /* Issue #8753, first failure: `remark-math` reads the rest of a line-leading `$$` fence
   * as discardable meta and only closes on a line holding nothing but `$$`, so
   * `$$\begin{aligned}` … `\end{aligned}$$` lost the environment opener, never closed, and
   * swallowed every heading and paragraph after it as raw LaTeX. */
  describe('display math fences', () => {
    it('moves an environment opener off the opening fence line', () => {
      const content = '$$\\begin{aligned}\nx &= 1\n\\end{aligned}$$';
      const expected = '$$\n\\begin{aligned}\nx &= 1\n\\end{aligned}\n$$';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('keeps the content after a display block out of the block', () => {
      const content =
        '$$\\begin{aligned}\n&\\left| \\int_0^T u \\right| \\le C\n\\end{aligned}$$\n\n##### Conclusion\n\nThe end.';
      const expected =
        '$$\n\\begin{aligned}\n&\\left| \\int_0^T u \\right| \\le C\n\\end{aligned}\n$$\n\n##### Conclusion\n\nThe end.';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('breaks trailing prose off the closing fence line', () => {
      const content = '$$\na = b\n$$ and then more';
      const expected = '$$\na = b\n$$\n and then more';
      expect(preprocessLaTeX(content)).toBe(expected);
    });

    it('leaves an already well-formed display block untouched', () => {
      const content = 'Text\n\n$$\nx = 1\n$$\n\nMore.';
      expect(preprocessLaTeX(content)).toBe(content);
    });

    it('leaves a single-line display block untouched', () => {
      const content = '$$x^2 + y^2 = z^2$$';
      expect(preprocessLaTeX(content)).toBe(content);
    });

    it('leaves a display block that starts mid-line untouched', () => {
      const content = 'Consider $$\\begin{aligned}\nx &= 1\n\\end{aligned}$$';
      expect(preprocessLaTeX(content)).toBe(content);
    });

    it('leaves display fences inside a fenced code block untouched', () => {
      const content = '```\n$$\\begin{aligned}\nx\n\\end{aligned}$$\n```';
      expect(preprocessLaTeX(content)).toBe(content);
    });

    it('normalizes each of several display blocks', () => {
      const content =
        '$$\\begin{aligned}\na\n\\end{aligned}$$\n\nText\n\n$$\nb\n$$';
      const expected =
        '$$\n\\begin{aligned}\na\n\\end{aligned}\n$$\n\nText\n\n$$\nb\n$$';
      expect(preprocessLaTeX(content)).toBe(expected);
    });
  });
});
