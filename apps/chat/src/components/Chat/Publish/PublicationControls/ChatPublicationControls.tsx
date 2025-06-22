import { IconPencilMinus } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';

import { IconButton } from '@/src/components/Common/IconButton';
import { ScrollDownButton } from '@/src/components/Common/ScrollDownButton';

import { PublicationControls } from './PublicationControls';

import { ConversationInfo, PublishActions } from '@epam/ai-dial-shared';

interface Props {
  entity: ConversationInfo;
  showScrollDownButton: boolean;
  onScrollDownClick: () => void;
  onToggleInput: () => void;
}

export const ChatPublicationControls = ({
  entity,
  showScrollDownButton,
  onScrollDownClick,
  onToggleInput,
}: Props) => {
  const resourceToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourceToReviewByReviewUrl(state, entity.id),
  );
  const publication = useAppSelector((state) =>
    PublicationSelectors.selectPublicationByUrl(
      state,
      resourceToReview?.publicationUrl ?? '',
    ),
  );

  const isUnpublishing = useMemo(() => {
    const action = publication?.resources?.find(
      ({ reviewUrl }) => resourceToReview?.reviewUrl === reviewUrl,
    )?.action;

    return action === PublishActions.DELETE;
  }, [publication, resourceToReview]);

  return (
    <PublicationControls
      controlsClassNames="mx-2 mb-2 mt-5 flex-row md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:w-[768px] lg:max-w-3xl"
      entity={entity}
    >
      {!isUnpublishing && (
        <IconButton
          Icon={IconPencilMinus}
          name="Edit"
          dataQa="edit-chat"
          onClick={onToggleInput}
        />
      )}
      {showScrollDownButton && (
        <ScrollDownButton
          className="-top-16 right-0 md:-top-20"
          onScrollDownClick={onScrollDownClick}
        />
      )}
    </PublicationControls>
  );
};
