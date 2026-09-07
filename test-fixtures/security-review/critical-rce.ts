// TEST_ONLY — DO NOT MERGE.
// This file intentionally contains a security vulnerability for validating
// the automated security review workflow. The branch this lives on
// (test/security-review-workflow) must never be merged into any deployable
// branch.

import { exec } from 'child_process';
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { host } = req.query;

  exec(`ping -c 1 ${host}`, (err, stdout) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json({ output: stdout });
  });
}

// cool