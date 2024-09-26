import { PROMPT_VARIABLE_REGEX } from '@/src/constants/folders';

interface Props {
  template?: string;
}

export const TemplateRenderer = ({ template }: Props) => {
  if (!template) {
    return null;
  }
  const resultNodes = [];
  let match;
  let index = 0;
  while ((match = PROMPT_VARIABLE_REGEX.exec(template)) !== null) {
    if (match.index > index) {
      resultNodes.push(template.slice(index, match.index));
    }
    resultNodes.push(<span className="text-accent-tertiary">{match[0]}</span>);
    index = match.index + match[0].length;
  }
  resultNodes.push(template.slice(index));
  return <>{resultNodes}</>;
};
