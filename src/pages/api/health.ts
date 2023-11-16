import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_: NextApiRequest, res: NextApiResponse<any>) {
  res.status(200).send('Healthy');
}
