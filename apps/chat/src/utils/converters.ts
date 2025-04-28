export const convertLaTeXToMarkdownMath = (content: string) => {
  let transformedContent = content.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_, mathContent) => `$$$$ ${mathContent} $$$$`,
  );

  transformedContent = transformedContent.replace(
    /\\begin{(equation\*?|align\*?|gather\*?|multline\*?|displaymath)}([\s\S]*?)\\end{\1}/g,
    (_, envName, inner) => {
      const trimmed = inner.trim();
      if (/[\^_=+\-*/\\]/.test(trimmed)) {
        return `$$\n${trimmed}\n$$`;
      }

      return `\\begin{${envName}}${inner}\\end{${envName}}`;
    },
  );

  return transformedContent.replace(
    /\\\((.*?)\\\)/g,
    (_, inlineMathContent) => `$$ ${inlineMathContent} $$`,
  );
};
