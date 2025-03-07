import { Theme } from '@/chat/types/themes';
import { EntityType, ThemeId } from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import tinycolor from 'tinycolor2';

export class ThemesUtil {
  public static getThemes() {
    return JSON.parse(process.env.THEMES!) as Theme[];
  }

  public static getRgbColorByKey(key: string, themeId = ThemeId.dark) {
    const theme = this.getThemes().find((t) => t.id === themeId);
    const hex = theme?.colors[key];
    return tinycolor(hex).toRgbString();
  }

  public static getEntityCheckboxAndBackgroundColor(
    theme: string,
    entityType: EntityType,
  ): { checkboxColor: string; backgroundColor: string } {
    if (theme === ThemeId.dark) {
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
    } else if (theme === ThemeId.light) {
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
