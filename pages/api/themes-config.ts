import { NextApiRequest, NextApiResponse } from 'next';

import { errorsMessages } from '@/constants/errors';

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
    cssContent += `--${variable}${postfixValue}: ${compiledValue};\n`;
  });
  return cssContent;
}

function wrapCssContents(contents: string[]): string {
  return `:root {\n ${contents.join('\n')}\n }\n`;
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
        ]),
      );
  }

  return res.status(200).send('');
};

export default handler;
