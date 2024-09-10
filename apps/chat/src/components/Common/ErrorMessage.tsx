import { IconExclamationCircle } from '@tabler/icons-react';

export interface Props {
  error?: string;
}

export const ErrorMessage = ({ error }: Props) => {
  if (!error?.length) {
    return null;
  }

  const renderTextWithLinks = (text: string) => {
    const linkRegex = /<a href="([^"]+)">([^<]+)<\/a>/g;
    const parts = [];
    let match;
    let lastIndex = 0;

    while ((match = linkRegex.exec(text)) !== null) {
      const [fullMatch, href, linkText] = match;
      const startIndex = match.index;

      // Push text before the link
      parts.push(text.substring(lastIndex, startIndex));

      // Push link component
      parts.push(<a href={href} key={href} className="underline" target="_blank">{linkText}</a>);

      lastIndex = startIndex + fullMatch.length;
    }

    // Push the rest of the text after the last link
    parts.push(text.substring(lastIndex));

    return parts;
  };

  return (
    <div className="flex w-full gap-3 rounded bg-error p-3 text-error">
      <span className="flex shrink-0 items-center">
        <IconExclamationCircle size={24} />
      </span>
      <span className="truncate whitespace-pre-wrap" data-qa="error-text">
        {renderTextWithLinks(error)}
      </span>
    </div>
  );
};
