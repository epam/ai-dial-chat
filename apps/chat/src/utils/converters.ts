export const convertLaTeXToMarkdownMath = (content: string) => {
  const transformedContent = content.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_, mathContent) => `$$$$ ${mathContent} $$$$`,
  );

  return transformedContent.replace(
    /\\\((.*?)\\\)/g,
    (_, inlineMathContent) => `$$ ${inlineMathContent} $$`,
  );
};
