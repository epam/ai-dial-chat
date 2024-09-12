import { IconStarFilled } from '@tabler/icons-react';
import { useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

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
        <button
          onClick={onClose}
          className="rounded border-[1px] border-primary  px-3 py-2 text-sm font-semibold"
        >
          {t('Cancel')}
        </button>
        <button
          disabled={!selectedRating}
          className="rounded bg-accent-primary px-3 py-2 text-sm font-semibold disabled:bg-controls-disable disabled:text-controls-disable"
          onClick={onRatingApply}
        >
          {t('Send')}
        </button>
      </div>
    </>
  );
};
