// import { NextApiRequest, NextApiResponse } from 'next';
// import { getServerSession } from 'next-auth';
// import { getToken } from 'next-auth/jwt';

// import { validateServerSession } from '@/src/utils/auth/session';
// import { getApiHeaders } from '@/src/utils/server/get-headers';
// import { logger } from '@/src/utils/server/logger';

// import { DialAIError } from '@/src/types/error';
// import { CreateApplicationModel } from '@/src/types/applications';

// import { errorsMessages } from '@/src/constants/errors';

// import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

// import fetch from 'node-fetch';

// const handler = async (req: NextApiRequest, res: NextApiResponse) => {
//   const session = await getServerSession(req, res, authOptions);
//   const isSessionValid = validateServerSession(session, req, res);

//   if (!isSessionValid) {
//     return;
//   }

//   const token = await getToken({ req });
  
  
//   try {
//     const body = req.body as CreateApplicationModel;
    
//     const proxyRes = await fetch(
//       `${process.env.DIAL_API_HOST}/v1/applications/4oPcqm6mdcWM5vTGzHVcPYMyhxwVyX8CBNERN7my1spvwjF68mnt5WLMeYHKHcPXjW/my-custom-application`,
//       {
//         method: 'PUT',
//         headers: getApiHeaders({ jwt: token?.access_token as string }),
//         body: JSON.stringify(body),
//       },
//     );

//     let json: unknown;
//     if (!proxyRes.ok) {
//       try {
//         json = await proxyRes.json();
//       } catch (err) {
//         json = undefined;
//       }

//       throw new DialAIError(
//         (typeof json === 'string' && json) || proxyRes.statusText,
//         '',
//         '',
//         proxyRes.status + '',
//       );
//     }

//     json = await proxyRes.json();
//     return res.status(200).send(json);
//   } catch (error: unknown) {
//     logger.error(error);
//     if (error instanceof DialAIError) {
//       return res
//         .status(parseInt(error.code, 10) || 500)
//         .send(error.message || errorsMessages.generalServer);
//     }
//     return res.status(500).send(errorsMessages.generalServer);
//   }
// };

// export default handler;


import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';

import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import { DialAIError } from '@/src/types/error';
import { CreateApplicationModel } from '@/src/types/applications';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);

  if (!isSessionValid) {
    return;
  }

  const token = await getToken({ req });

  // Extract slug from request
  const urlSlug = Array.isArray(req.query.slug)
    ? req.query.slug.join('/')
    : req.query.slug;

    console.log(urlSlug,'urlSlug');
    

  try {
    const body = req.body as CreateApplicationModel;
    
    // Use urlSlug in your fetch request URL
    const proxyRes = await fetch(
      `${process.env.DIAL_API_HOST}/v1/applications/${urlSlug}`,
      {
        method: 'PUT',
        headers: getApiHeaders({ jwt: token?.access_token as string }),
        body: JSON.stringify(body),
      },
    );

    let json: unknown;
    if (!proxyRes.ok) {
      try {
        json = await proxyRes.json();
      } catch (err) {
        json = undefined;
      }

      throw new DialAIError(
        (typeof json === 'string' && json) || proxyRes.statusText,
        '',
        '',
        proxyRes.status + '',
      );
    }

    json = await proxyRes.json();
    return res.status(200).send(json); 
  } catch (error: unknown) {
    logger.error(error);
    if (error instanceof DialAIError) {
      return res
        .status(parseInt(error.code, 10) || 500)
        .send(error.message || errorsMessages.generalServer);
    }
    return res.status(500).send(errorsMessages.generalServer);
  }
};

export default handler;