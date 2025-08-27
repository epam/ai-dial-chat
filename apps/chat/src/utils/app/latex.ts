/**
 * Preprocesses LaTeX content by replacing delimiters and escaping certain characters.
 *
 * @param content The input string containing LaTeX expressions.
 * @returns The processed string with replaced delimiters and escaped characters.
 */
export function preprocessLaTeX(content: string) {
  // Step 1: Protect code blocks
  const codeBlocks: string[] = [];
  content = content.replace(
    /(```[\s\S]*?```|`[^`\n]+`)/g,
    (_, code: string) => {
      codeBlocks.push(code);
      return `<<CODE_BLOCK_${codeBlocks.length - 1}>>`;
    },
  );

  // Step 2: Protect existing LaTeX expressions
  const latexExpressions: string[] = [];
  content = content.replace(
    /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g,
    (match) => {
      latexExpressions.push(match);
      return `<<LATEX_${latexExpressions.length - 1}>>`;
    },
  );

  // Step 3: Escape dollar signs that are likely currency indicators
  content = content.replace(/\$(?=\d)/g, '\\$');

  // Step 4: Restore LaTeX expressions
  content = content.replace(
    /<<LATEX_(\d+)>>/g,
    (_, index: string) => latexExpressions[parseInt(index)],
  );

  // Step 5: Restore code blocks
  content = content.replace(
    /<<CODE_BLOCK_(\d+)>>/g,
    (_, index: string) => codeBlocks[parseInt(index)],
  );

  // Step 6: Apply additional escaping functions
  content = escapeBrackets(content);
  content = escapeMhchem(content);

  return content;
}

export function escapeBrackets(text: string) {
  const pattern =
    /(```[\S\s]*?```|`.*?`)|\\\[([\S\s]*?[^\\])\\]|\\\((.*?)\\\)/g;
  return text.replace(
    pattern,
    (
      match,
      codeBlock: string | undefined,
      squareBracket: string | undefined,
      roundBracket: string | undefined,
    ) => {
      if (codeBlock != null) {
        return codeBlock;
      } else if (squareBracket != null) {
        return `$$${squareBracket}$$`;
      } else if (roundBracket != null) {
        return `$${roundBracket}$`;
      }

      return match;
    },
  );
}

export function escapeMhchem(text: string) {
  return text.replaceAll('$\\ce{', '$\\\\ce{').replaceAll('$\\pu{', '$\\\\pu{');
}
