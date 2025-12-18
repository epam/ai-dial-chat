import { IconStarFilled } from '@tabler/icons-react';
import { useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ButtonVariant, DialButton } from '@epam/ai-dial-ui-kit';

const starIdxs = [1, 2, 3, 4, 5];

interface Props {
  onRatingApply: () => void;
  onClose: () => void;
}

export const RatingHandler = ({ onRatingApply, onClose }: Props) => {
  const { t } = useTranslation(Translation.Marketplace);

  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredStars, setHoveredStars] = useState(0);

  return (
    <>
      <div className="mt-3 flex gap-2" onMouseLeave={() => setHoveredStars(0)}>
        {starIdxs.map((rating) => (
          <div
            className={classNames(
              'relative shrink-0 [&_path]:stroke-1',
              !(hoveredStars >= rating || selectedRating >= rating) &&
                '[&_path]:fill-transparent',
            )}
            key={rating}
          >
            <IconStarFilled
              size={32}
              className={classNames(
                (hoveredStars >= rating || selectedRating >= rating) &&
                  'text-accent-secondary [&_path]:fill-current',
              )}
            />
            <input
              onClick={() => setSelectedRating(rating)}
              onMouseEnter={() => setHoveredStars(rating)}
              className="absolute top-0 size-full shrink-0 cursor-pointer appearance-none border-none"
              type="radio"
              name="rate"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex w-full justify-end gap-2">
        <DialButton
          onClick={onClose}
          variant={ButtonVariant.Secondary}
          label={t('Cancel')}
        />
        <DialButton
          disabled={!selectedRating}
          variant={ButtonVariant.Primary}
          label={t('Send')}
          onClick={onRatingApply}
        />
      </div>
    </>
  );
};
