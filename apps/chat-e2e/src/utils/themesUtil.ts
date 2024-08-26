import { EntityType, Theme } from '@/src/testData';
import { Colors } from '@/src/ui/domData';

export class ThemesUtil {
  public static getEntityColors(
    theme: string,
    entityType: EntityType,
  ): { checkboxColor: string; backgroundColor: string } {
    if (theme === Theme.dark) {
      if (entityType === EntityType.Conversation) {
        return {
          checkboxColor: Colors.textAccentSecondary,
          backgroundColor: Colors.backgroundAccentSecondaryAlphaDark,
        };
      } else {
        return {
          checkboxColor: Colors.textSecondary,
          backgroundColor: Colors.backgroundAccentTertiaryAlphaDark,
        };
      }
    } else if (theme === Theme.light) {
      if (entityType === EntityType.Conversation) {
        return {
          checkboxColor: Colors.backgroundAccentSecondaryLight,
          backgroundColor: Colors.backgroundAccentSecondaryAlphaLight,
        };
      } else {
        return {
          checkboxColor: Colors.textAccentTertiaryLight,
          backgroundColor: Colors.backgroundAccentTertiaryAlphaLight,
        };
      }
    } else {
      return {
        checkboxColor: '',
        backgroundColor: '',
      };
    }
  }
}
