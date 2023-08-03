import { NextApiRequest, NextApiResponse } from 'next';

import { errorsMessages } from '@/constants/errors';
import cssEscape from 'css.escape';

let cachedTheme = '';
let cachedThemeExpiration: number | undefined;

const hexToRgb = (hex: string) => {
  // http://stackoverflow.com/a/5624139
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (_, r, g, b) => {
    return r + r + g + g + b + b;
  });

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : null;
};

function generateColorsCssVariables(
  variables: Record<string, string> | undefined,
) {
  if (!variables) {
    return '';
  }

  let cssContent = '';
  Object.entries(variables).forEach(([variable, value]) => {
    let compiledValue = value;
    const rgbRegex = '\\d{1,3} \\d{1,3} \\d{1,3}';

    if (value.startsWith('#')) {
      const rgbValue = hexToRgb(value);
      compiledValue = `${rgbValue?.join(' ') || ''}`;
    } else if (!value.match(rgbRegex)) {
      compiledValue = `var(--${value})`;
    }
    cssContent += `--${cssEscape(variable)}: ${compiledValue};\n`;
  });
  return cssContent;
}

function generateUrlsCssVariables(
  variables: Record<string, string> | undefined,
) {
  if (!variables) {
    return '';
  }

  let cssContent = '';
  Object.entries(variables).forEach(([variable, value]) => {
    if (!value) {
      return;
    }
    let compiledValue = value;
    if (!value.startsWith('http') && !value.startsWith('//')) {
      compiledValue = `${process.env.THEMES_CONFIG_HOST}/${value}`;
    }
    cssContent += `--${cssEscape(variable)}: url('${compiledValue}');\n`;
  });
  return cssContent;
}

function wrapCssContents(contents: string[]): string {
  return `:root:root {\n ${contents.join('')}\n }\n`;
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!process.env.THEMES_CONFIG_HOST) {
    return res.status(500).send(errorsMessages.customThemesConfigNotProvided);
  }

  if (
    cachedThemeExpiration &&
    cachedTheme &&
    cachedThemeExpiration > Date.now()
  ) {
    return res.status(200).send(cachedTheme);
  }

  const controller = new AbortController();
  const response = await fetch(
    `${process.env.THEMES_CONFIG_HOST}/config.json`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    },
  );

  if (!response.ok) {
    console.error(
      `Received error when fetching config file: ${response.status} ${
        response.statusText
      } ${await response.text()}`,
    );
    return res.status(500).send(errorsMessages.generalServer);
  }

  const json = await response.json();

  const dayInMs = 86400000;
  cachedTheme = wrapCssContents([
    generateColorsCssVariables(json.themes.colorsPalette),
    generateUrlsCssVariables({
      ...json.images,
    }),
  ]);
  cachedThemeExpiration = Date.now() + dayInMs;

  return res.status(200).send(cachedTheme);
};

export default handler;
