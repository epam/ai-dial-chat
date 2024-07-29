import { Response } from 'node-fetch';

export async function getResponseErrorMsg(res: Response) {
  let resBody: unknown;
  let msg: unknown;
  try {
    resBody = await res?.text();
  } catch (err) {
    resBody = undefined;
  }
  try {
    msg = await res.json();
  } catch (err) {
    msg = resBody;
  }

  return msg;
}
