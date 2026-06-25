/* eslint-disable @next/next/no-img-element */
import { useMemo } from 'react';
import { Components } from 'react-markdown';

import classNames from 'classnames';

import {
  isAllowedImageUrl,
  parseAllowedImageHosts,
} from '@/src/utils/app/image-security';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { DESCRIPTION_DELIMITER_REGEX } from '@/src/constants/chat';

import { MemoizedReactMarkdown } from '@/src/components/Markdown/MemoizedReactMarkdown';

import rehypeExternalLinks from 'rehype-external-links';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface Props {
  children: string;
  isShortDescription?: boolean;
  className?: string;
}

export const EntityMarkdownDescription = ({
  children,
  isShortDescription,
  className,
}: Props) => {
  const allowedImageSources = useAppSelector(
    SettingsSelectors.selectAllowedImageSources,
  );

  const transformedChildren = useMemo(() => {
    if (isShortDescription && children) {
      const indexOfDelimiter = children.search(DESCRIPTION_DELIMITER_REGEX);
      return children.slice(
        0,
        indexOfDelimiter === -1 ? children.length : indexOfDelimiter,
      );
    } else {
      return children;
    }
  }, [children, isShortDescription]);

  const components: Components = useMemo(() => {
    const allowedImageHosts = parseAllowedImageHosts(allowedImageSources);

    return {
      img({ src, ...props }) {
        // Strip external images entirely to prevent silent data exfiltration
        // via auto-loaded image URLs.
        if (
          !isAllowedImageUrl(
            typeof src === 'string' ? src : undefined,
            allowedImageHosts,
          )
        ) {
          return null;
        }

        return <img src={src} {...props} />;
      },
    };
  }, [allowedImageSources]);

  return (
    <MemoizedReactMarkdown
      className={classNames(
        className,
        'prose-sm break-words text-xs prose-a:break-all prose-a:underline prose-ol:pl-2 sm:prose-ol:pl-[1.625em]',
      )}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        rehypeSanitize,
        [
          rehypeExternalLinks,
          { target: '_blank', rel: ['noopener', 'noreferrer'] },
        ],
      ]}
      components={components}
    >
      {transformedChildren}
    </MemoizedReactMarkdown>
  );
};
