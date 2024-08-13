import { DialAIEntityModel } from '@/chat/types/models';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { RecentEntities } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class RecentEntitiesAssertion {
  readonly recentEntities: RecentEntities;

  constructor(recentEntities: RecentEntities) {
    this.recentEntities = recentEntities;
  }

  public async assertPlaybackIconState(expectedState: ElementState) {
    const playbackButton =
      this.recentEntities.playbackButton.getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(playbackButton, ExpectedMessages.playbackIconIsSelected)
          .toBeVisible()
      : await expect
          .soft(playbackButton, ExpectedMessages.playbackIconIsHidden)
          .toBeVisible();
  }

  public async assertReplayAsIsBordersColor(expectedColor: string) {
    const borderColors =
      await this.recentEntities.replayAsIsButton.getAllBorderColors();
    Object.values(borderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.borderColorsAreValid)
          .toBe(expectedColor);
      });
    });
  }

  public async assertRecentEntityBordersColor(
    entity: DialAIEntityModel,
    expectedColor: string,
  ) {
    const entityBorderColors = await this.recentEntities.talkToGroup.groupEntity
      .groupEntity(entity)
      .getAllBorderColors();
    Object.values(entityBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.borderColorsAreValid)
          .toBe(expectedColor);
      });
    });
  }
}
