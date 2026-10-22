import { ButtonVariant, NoDataContent } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import { CreateButton, type CreateButtonProps } from '../Catalog/CreateButton';

/** Props for `PersonalEmptyState`. */
export interface PersonalEmptyStateProps {
  /** Headline of the empty state. */
  title: string;
  /** Secondary line under the headline. */
  description: string;
  /** Props of the Create button below the text; omit to render no button. */
  createButton?: CreateButtonProps;
  /** CSS class applied to the headline, on top of the kit's title typography. */
  titleClassName?: string;
  /** CSS class applied to the secondary line, on top of the kit's description typography. */
  descriptionClassName?: string;
}

/** Empty state for the "My" filter with no personal entities, offering a Create action. */
export const PersonalEmptyState: FC<PersonalEmptyStateProps> = ({
  title,
  description,
  createButton,
  titleClassName,
  descriptionClassName,
}) => (
  <NoDataContent
    title={title}
    description={description}
    titleClassName={titleClassName}
    descriptionClassName={descriptionClassName}
    action={
      createButton != null ? (
        <CreateButton variant={ButtonVariant.Secondary} {...createButton} />
      ) : undefined
    }
  />
);
