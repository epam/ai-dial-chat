import {
  Skeleton,
  SkeletonShimmer,
  SkeletonTone,
  SkeletonVariant,
} from '@epam/ai-dial-ui-kit';
import {
  PDF_SKELETON_FULL_LINES_PER_PARAGRAPH,
  PDF_SKELETON_LAST_LINE_WIDTHS,
  PDF_SKELETON_LINE_HEIGHT,
  PDF_SKELETON_TITLE_WIDTH,
} from '../../constants/pdf-loading-skeleton';

/** Lightweight PDF placeholder that does not load the PDF rendering engine. */
export const PdfLoadingSkeleton = () => (
  <div aria-hidden className="h-full w-full overflow-hidden">
    <SkeletonShimmer className="flex w-full flex-col gap-10 px-15 pt-10">
      <Skeleton
        variant={SkeletonVariant.Text}
        tone={SkeletonTone.Dark}
        width={PDF_SKELETON_TITLE_WIDTH}
        height={PDF_SKELETON_LINE_HEIGHT}
        className="mx-auto max-w-[40%]"
      />
      {PDF_SKELETON_LAST_LINE_WIDTHS.map((lastLineWidth) => (
        <div key={lastLineWidth} className="flex flex-col gap-4">
          {Array.from(
            { length: PDF_SKELETON_FULL_LINES_PER_PARAGRAPH },
            (_, index) => (
              <Skeleton
                key={index}
                variant={SkeletonVariant.Text}
                tone={SkeletonTone.Dark}
                width="100%"
                height={PDF_SKELETON_LINE_HEIGHT}
              />
            ),
          )}
          <Skeleton
            variant={SkeletonVariant.Text}
            tone={SkeletonTone.Dark}
            width={lastLineWidth}
            height={PDF_SKELETON_LINE_HEIGHT}
          />
        </div>
      ))}
    </SkeletonShimmer>
  </div>
);
