export const convertLaTeXToMarkdownMath = (content: string) => {
  let transformedContent = content.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_, mathContent: string) => `$$\n${mathContent.trim()}\n$$`,
  );

  transformedContent = transformedContent.replace(
    /\\begin{(equation\*?|align\*?|gather\*?|multline\*?|displaymath)}([\s\S]*?)\\end{\1}/g,
    (_, envName: string, inner: string) => {
      if (/[\^_=+\-*/\\]/.test(inner)) {
        return `$$${inner.trim()}$$`;
      }

      return `\\begin{${envName}}${inner}\\end{${envName}}`;
    },
  );

  return transformedContent.replace(
    /\\\((.*?)\\\)/g,
    (_, inlineMathContent: string) => `$${inlineMathContent.trim()}$`,
  );
};
