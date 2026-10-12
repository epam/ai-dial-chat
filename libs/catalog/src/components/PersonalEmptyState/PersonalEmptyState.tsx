import { ButtonVariant, NoDataContent } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import {
  CreateButton,
  type CreateButtonProps,
} from '../Catalog/CreateButton';

/** Props for `PersonalEmptyState`. */
export interface PersonalEmptyStateProps {
  /** Headline of the empty state. */
  title: string;
  /** Secondary line under the headline. */
  description: string;
  /** Props of the Create button below the text; omit to render no button. */
  createButton?: CreateButtonProps;
  /** CSS class applied to the headline. Defaults to `'dial-small-semi-text text-primary'`. */
  titleClassName?: string;
  /** CSS class applied to the secondary line. Defaults to `'dial-tiny-text text-secondary'`. */
  descriptionClassName?: string;
}

/** Empty state for the "My" filter with no personal entities, offering a Create action. */
export const PersonalEmptyState: FC<PersonalEmptyStateProps> = ({
  title,
  description,
  createButton,
  titleClassName = 'dial-small-semi-text text-primary',
  descriptionClassName = 'dial-tiny-text text-secondary',
}) => (
  <div className="flex size-full flex-col items-center justify-center gap-4 text-center">
    <NoDataContent
      title={title}
      description={description}
      className="size-auto"
      titleClassName={titleClassName}
      descriptionClassName={descriptionClassName}
    />
    {createButton != null && (
      <CreateButton variant={ButtonVariant.Secondary} {...createButton} />
    )}
  </div>
);
