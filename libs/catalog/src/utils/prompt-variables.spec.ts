import { describe, expect, it } from 'vitest';
import {
  PROMPT_VARIABLE_CLASS_NAME,
  rehypePromptVariables,
} from './prompt-variables';

interface TestNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: TestNode[];
}

const text = (value: string): TestNode => ({ type: 'text', value });

const element = (tagName: string, children: TestNode[]): TestNode => ({
  type: 'element',
  tagName,
  children,
});

const run = (tree: TestNode): TestNode => {
  rehypePromptVariables()(tree);
  return tree;
};

const variableValues = (node: TestNode): string[] => {
  const found: string[] = [];
  const walk = (current: TestNode) => {
    const classNames = current.properties?.['className'];
    if (
      Array.isArray(classNames) &&
      classNames.includes(PROMPT_VARIABLE_CLASS_NAME)
    ) {
      found.push(current.children?.[0]?.value ?? '');
    }
    (current.children ?? []).forEach(walk);
  };
  walk(node);
  return found;
};

describe('rehypePromptVariables', () => {
  it('wraps a placeholder in a span and keeps the surrounding text', () => {
    const tree = run(
      element('root', [element('p', [text('Reply to {{email}} kindly.')])]),
    );

    const paragraph = tree.children?.[0];
    expect(
      paragraph?.children?.map((child) => child.value ?? child.tagName),
    ).toEqual(['Reply to ', 'span', ' kindly.']);
    expect(variableValues(tree)).toEqual(['{{email}}']);
  });

  it('wraps every placeholder in one text run', () => {
    const tree = run(
      element('root', [element('p', [text('{{a}} then {{b}} then {{c}}')])]),
    );

    expect(variableValues(tree)).toEqual(['{{a}}', '{{b}}', '{{c}}']);
  });

  it('handles a placeholder at the very start and end', () => {
    const tree = run(element('root', [element('p', [text('{{only}}')])]));

    expect(tree.children?.[0]?.children).toHaveLength(1);
    expect(variableValues(tree)).toEqual(['{{only}}']);
  });

  it('leaves text without a placeholder untouched', () => {
    const tree = run(element('root', [element('p', [text('plain prose')])]));

    expect(tree.children?.[0]?.children?.[0]).toEqual(text('plain prose'));
  });

  it('skips code and pre subtrees', () => {
    const tree = run(
      element('root', [
        element('pre', [element('code', [text('{{email}}')])]),
        element('code', [text('{{tone}}')]),
      ]),
    );

    expect(variableValues(tree)).toEqual([]);
  });

  it('does not treat an empty or unclosed brace run as a placeholder', () => {
    const tree = run(
      element('root', [element('p', [text('{{}} and {{unclosed')])]),
    );

    expect(variableValues(tree)).toEqual([]);
  });

  it('does not let one stray brace pair swallow the rest of the text', () => {
    const tree = run(
      element('root', [element('p', [text('{{ {{real}} tail')])]),
    );

    /* The inner run cannot contain braces, so only the well-formed token matches. */
    expect(variableValues(tree)).toEqual(['{{real}}']);
  });

  it('descends into nested elements', () => {
    const tree = run(
      element('root', [
        element('ul', [element('li', [element('strong', [text('{{tone}}')])])]),
      ]),
    );

    expect(variableValues(tree)).toEqual(['{{tone}}']);
  });
});
