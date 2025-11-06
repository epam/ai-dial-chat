import { Theme } from '@/chat/types/themes';
import { ThemeId } from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import tinycolor from 'tinycolor2';

export class ThemesUtil {
  public static getThemes() {
    return JSON.parse(process.env.THEMES!) as Theme[];
  }

  public static getRgbColorByKey(key: ThemeColorAttributes, themeId?: ThemeId) {
    const allThemes = this.getThemes();
    const theme = themeId
      ? allThemes.find((t) => t.id === themeId)
      : allThemes[0];
    const hex = theme?.colors[key];
    return tinycolor(hex).toRgbString();
  }
}
