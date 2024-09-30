import { PROMPT_VARIABLE_REGEX } from '@/src/constants/folders';
import { Fragment } from 'react';

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
      resultNodes.push(<Fragment key={index}>{template.slice(index, match.index)}</Fragment>);
    }
    resultNodes.push(<span key={match.index} className="text-accent-tertiary">{match[0]}</span>);
    index = match.index + match[0].length;
  }
  resultNodes.push(<Fragment key={index}>{template.slice(index)}</Fragment>);
  return <>{resultNodes}</>;
};
