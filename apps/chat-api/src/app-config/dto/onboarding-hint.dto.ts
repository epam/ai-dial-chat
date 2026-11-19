import { ApiProperty } from '@nestjs/swagger';
import { OnboardingHintPage } from '../types/onboarding-hint-page';
import { OnboardingHintTarget } from '../types/onboarding-hint-target';

export class OnboardingHintDto {
  @ApiProperty({
    description:
      'Stable identifier of the hint. The client remembers which ids a user has seen, so changing an id shows that hint again. Letters, digits, ".", "_" and "-", at most 64 characters; duplicates after the first are dropped server-side.',
    example: 'new-chat',
  })
  id!: string;

  @ApiProperty({
    description:
      'The UI element the hint points at. A closed list; the client resolves it and skips the hint when that element is not on screen.',
    enum: OnboardingHintTarget,
    enumName: 'OnboardingHintTarget',
    example: OnboardingHintTarget.NewChat,
  })
  target!: OnboardingHintTarget;

  @ApiProperty({
    description:
      'Hint heading. Plain text; never interpreted as markup. Entries without one are dropped server-side.',
    example: 'Start a new conversation',
  })
  title!: string;

  @ApiProperty({
    description:
      'Supporting copy under the heading. Plain text; never interpreted as markup. Null when unset or blank.',
    example: 'Each chat keeps its own history and model.',
    nullable: true,
    type: String,
  })
  description!: string | null;

  @ApiProperty({
    description:
      'Pages the hint is shown on. Empty when unset: the hint is then shown on the home page (new chat and conversations) only. Unknown names are dropped server-side.',
    enum: OnboardingHintPage,
    enumName: 'OnboardingHintPage',
    isArray: true,
    example: [OnboardingHintPage.Catalog],
  })
  pages!: OnboardingHintPage[];
}
