import { NextApiRequest, NextApiResponse } from 'next';

import { errorsMessages } from '@/constants/errors';
import cssEscape from 'css.escape';

function generateColorsCssVariables(
  variables: Record<string, string> | undefined,
  postfix?: string,
) {
  if (!variables) {
    return '';
  }

  let cssContent = '';
  Object.entries(variables).forEach(([variable, value]) => {
    const postfixValue = postfix ? `-${postfix}` : '';
    let compiledValue = value;
    const regex = '\\d{1,3} \\d{1,3} \\d{1,3}';
    if (!value.startsWith('#') && !value.match(regex)) {
      compiledValue = `var(--${value})`;
    }
    cssContent += `--${cssEscape(
      variable,
    )}${postfixValue}: ${compiledValue};\n`;
  });
  return cssContent;
}

function generateUrlsCssVariables(
  variables: Record<string, string> | undefined,
  postfix?: string,
) {
  if (!variables) {
    return '';
  }

  let cssContent = '';
  Object.entries(variables).forEach(([variable, value]) => {
    if (!value) {
      return;
    }
    const postfixValue = postfix ? `-${postfix}` : '';
    let compiledValue = value;
    if (!value.startsWith('http') && !value.startsWith('//')) {
      compiledValue = `${process.env.THEMES_CONFIG_HOST}/${value}`;
    }
    cssContent += `--${cssEscape(
      variable,
    )}${postfixValue}: url('${compiledValue}');\n`;
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

  const controller = new AbortController();
  const response = await fetch(
    `${process.env.THEMES_CONFIG_HOST}/config.json`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // TODO: add no caching
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

  if (typeof req.query['cssVariables'] !== 'undefined') {
    return res
      .status(200)
      .send(
        wrapCssContents([
          generateColorsCssVariables(json.themes.colorsPalette),
          generateColorsCssVariables(json.themes.dark, 'dark'),
          generateColorsCssVariables(json.themes.light),
          generateUrlsCssVariables({
            'DEFAULT-logo': json.images['DEFAULT-logo'],
          }),
          generateUrlsCssVariables({ 'app-logo': json.images['app-logo'] }),
          generateUrlsCssVariables(json.images.models, 'model'),
          generateUrlsCssVariables(json.images.addons, 'addon'),
        ]),
      );
  }

  return res.status(200).send('');
};

export default handler;
