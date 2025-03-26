import { Theme } from '@/chat/types/themes';
import { ThemeId } from '@/src/testData';
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
}
