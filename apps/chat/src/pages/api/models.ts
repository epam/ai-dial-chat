import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { validateServerSession } from '@/src/utils/auth/session';
import { getSortedEntities } from '@/src/utils/server/get-sorted-entities';
import { logger } from '@/src/utils/server/logger';

import { authOptions } from './auth/[...nextauth]';

const hrBuddyDescription =
  'Welcome to the dedicated chatbot to HR Campaigns! Here are a few guidelines to ensure you receive the most accurate answer:\n\n<ul><li>Answer accuracy is only guaranteed in <strong>English</strong>.</li><li>The chatbot works with a simple <strong>Q&A mode meaning</strong> it does\n\n not consider previous questions as context for next questions answers. Please try to rephrase your question if you consider the answer is not relevant or precise.</li><li><strong>Do not use</strong> abbreviations or symbols in your queries.</li></ul><br/>HR Buddy support <strong>three different personas: Employee, Manager and HR</strong>. To receive the appropriate answer, you need to declare your persona before making your query.<br/><br/> <ul><li>To query as a manager? Start your question with <strong>"As a manager"</strong>. For example: “As a manager, when is the manager evaluation due?”</li><li>To query as HR? Start your question with <strong>“As a HR”</strong>. For example: “As a HR, how can talent partner facilitate the calibration?”</li><li>If you don\'t input the prompt <strong>"As a manager"</strong>, you will get an "employee" answer by default...</li></ul>';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  const token = await getToken({ req });

  try {
    const entities = await getSortedEntities(token);

    // TODO Remove when HR Buddy description will be updated
    entities.forEach((item) => {
      if (item.id === 'hr-buddy') {
        item.description = hrBuddyDescription;
      }

      return item;
    });

    return res.status(200).json(entities);
  } catch (error) {
    logger.error(error);
    return res.status(500).send('Error');
  }
};

export default handler;
