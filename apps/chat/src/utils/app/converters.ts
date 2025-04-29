export const convertLaTeXToMarkdownMath = (content: string) => {
  const transformedContent = content.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_, mathContent: string) => `$$\n${mathContent.trim()}\n$$`,
  );

  return transformedContent.replace(
    /\\\((.*?)\\\)/g,
    (_, inlineMathContent: string) => `$${inlineMathContent.trim()}$`,
  );
};
