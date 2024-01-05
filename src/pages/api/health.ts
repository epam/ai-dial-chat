import { NextApiRequest, NextApiResponse } from 'next';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function handler(_: NextApiRequest, res: NextApiResponse<any>) {
  res.status(200).send('Healthy');
}
