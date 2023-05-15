import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { OpenAIError, OpenAIStream } from '@/utils/server';

import { ChatBody, Message } from '@/types/chat';

import { authOptions } from './auth/[...nextauth]';

// 1@ts-expect-error
// import wasm from '../../node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm?module';
// import wasm from '@dqbd/tiktoken/lite/tiktoken_bg.wasm';
import tiktokenModel from '@dqbd/tiktoken/encoders/cl100k_base.json';
import { Tiktoken, init } from '@dqbd/tiktoken/lite/init';
import { readFileSync } from 'fs';
import path from 'path';
import { getHeaders } from '../../utils/server/getHeaders';

// export const config = {
//   runtime: 'edge',
// };

const wasm = readFileSync(
  path.resolve(
    __dirname,
    '../../../../node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm',
  ),
);

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).send('');
  }

  try {
    const { model, messages, key, prompt, temperature, id } = req.body as ChatBody;

    await init((imports) => WebAssembly.instantiate(wasm, imports));
    const encoding = new Tiktoken(
      tiktokenModel.bpe_ranks,
      tiktokenModel.special_tokens,
      tiktokenModel.pat_str,
    );

    let promptToSend = prompt;
    if (!promptToSend) {
      promptToSend = DEFAULT_SYSTEM_PROMPT;
    }

    let temperatureToUse = temperature;
    if (temperatureToUse == null) {
      temperatureToUse = DEFAULT_TEMPERATURE;
    }

    const prompt_tokens = encoding.encode(promptToSend);

    let tokenCount = prompt_tokens.length;
    let messagesToSend: Message[] = [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const tokens = encoding.encode(message.content);

      if (tokenCount + tokens.length + 1000 > model.tokenLimit) {
        break;
      }
      tokenCount += tokens.length;
      messagesToSend = [message, ...messagesToSend];
    }

    encoding.free();

    const stream = await OpenAIStream(
      model,
      promptToSend,
      temperatureToUse,
      key,
      messagesToSend,
      getHeaders(session, id),
    );
    res.setHeader('Transfer-Encoding', 'chunked');
    // return new Response(stream);
    const reader = stream.getReader();
    const processStream = async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          res.write(value);
        }
      } catch (error) {
        console.error('Error reading stream:', error);
        res.status(500);
      } finally {
        res.end();
      }
    };

    await processStream();
  } catch (error) {
    console.error(error);
    if (error instanceof OpenAIError) {
      // return new Response('Error', { status: 500, statusText: error.message });
      return res.status(500).send(error.message);
    } else {
      // return new Response('Error', { status: 500 });
      return res.status(500).send('Error');
    }
  }
};

export default handler;
