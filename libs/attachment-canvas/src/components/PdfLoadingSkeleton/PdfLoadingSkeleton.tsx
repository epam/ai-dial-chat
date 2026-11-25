import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  SKELETON_BAR_CLASS_NAME,
  SKELETON_BAR_HEIGHT,
  Skeleton,
  SkeletonShimmer,
  SkeletonTone,
  SkeletonVariant,
} from '@epam/ai-dial-ui-kit';
import {
  PDF_SKELETON_FULL_LINES_PER_PARAGRAPH,
  PDF_SKELETON_LAST_LINE_WIDTHS,
  PDF_SKELETON_TITLE_WIDTH,
} from '../../constants/pdf-loading-skeleton';

/** Lightweight PDF placeholder that does not load the PDF rendering engine. */
export const PdfLoadingSkeleton = () => (
  <div aria-hidden className="h-full w-full overflow-hidden">
    <SkeletonShimmer className="flex w-full flex-col gap-10 px-15 pt-10">
      <Skeleton
        variant={SkeletonVariant.Text}
        tone={SkeletonTone.Sunken}
        width={PDF_SKELETON_TITLE_WIDTH}
        height={SKELETON_BAR_HEIGHT}
        className={mergeClasses('mx-auto max-w-[40%]', SKELETON_BAR_CLASS_NAME)}
      />
      {PDF_SKELETON_LAST_LINE_WIDTHS.map((lastLineWidth) => (
        <div key={lastLineWidth} className="flex flex-col gap-4">
          {Array.from(
            { length: PDF_SKELETON_FULL_LINES_PER_PARAGRAPH },
            (_, index) => (
              <Skeleton
                key={index}
                variant={SkeletonVariant.Text}
                tone={SkeletonTone.Sunken}
                width="100%"
                height={SKELETON_BAR_HEIGHT}
                className={SKELETON_BAR_CLASS_NAME}
              />
            ),
          )}
          <Skeleton
            variant={SkeletonVariant.Text}
            tone={SkeletonTone.Base}
            width={lastLineWidth}
            height={SKELETON_BAR_HEIGHT}
            className={SKELETON_BAR_CLASS_NAME}
          />
        </div>
      ))}
    </SkeletonShimmer>
  </div>
);
