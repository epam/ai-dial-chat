import { NextApiRequest, NextApiResponse } from 'next';

import {
  isValidAdditionalCssFilename,
  readAdditionalCssFile,
} from '@/src/utils/server/additional-css';

const handler = (req: NextApiRequest, res: NextApiResponse) => {
  const filename = req.query.filename;

  if (!filename || Array.isArray(filename)) {
    return res.status(400).send('Filename not provided');
  }

  if (!isValidAdditionalCssFilename(filename)) {
    return res.status(400).send('Invalid filename');
  }

  const content = readAdditionalCssFile(filename);

  if (content === null) {
    return res.status(404).send('CSS file not found');
  }

  return res.status(200).setHeader('Content-Type', 'text/css').send(content);
};

export default handler;
