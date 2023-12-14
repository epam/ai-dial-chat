import { NextApiRequest, NextApiResponse } from 'next';

import { logger } from '@/src/utils/server/logger';

import { ThemesConfig } from '@/src/types/themes';

import { errorsMessages } from '@/src/constants/errors';

import cssEscape from 'css.escape';
import fetch from 'node-fetch';

let cachedTheme = '';
let cachedThemeExpiration: number | undefined;

function generateColorsCssVariables(
  variables: Record<string, string> | undefined,
) {
  if (!variables) {
    return '';
  }

  let cssContent = '';
  Object.entries(variables).forEach(([variable, value]) => {
    let compiledValue = value;

    if (!value.startsWith('#')) {
      compiledValue = '';
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

function wrapCssContents(wrapper: string, contents: string[]): string {
  return `${wrapper} {\n ${contents.join('')}\n }\n`;
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
    return res
      .status(200)
      .setHeader('Content-Type', 'text/css')
      .send(cachedTheme);
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
    logger.error(
      `Received error when fetching config file: ${response.status} ${
        response.statusText
      } ${await response.text()}`,
    );
    return res.status(500).send(errorsMessages.generalServer);
  }

  const json = (await response.json()) as ThemesConfig;

  const dayInMs = 86400000;

  cachedTheme = [
    ...json.themes.map((theme) =>
      wrapCssContents(`.${theme.id}`, [
        generateColorsCssVariables(theme.colors),
        generateUrlsCssVariables({ 'app-logo': theme['app-logo'] }),
      ]),
    ),
    generateUrlsCssVariables({
      ...json.images,
    }),
  ].join('\n');
  cachedThemeExpiration = Date.now() + dayInMs;

  return res
    .status(200)
    .setHeader('Content-Type', 'text/css')
    .send(cachedTheme);
};

export default handler;
