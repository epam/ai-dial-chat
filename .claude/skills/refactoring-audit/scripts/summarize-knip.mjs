#!/usr/bin/env node
/*
 * Summarizes a Knip JSON report (stdin) for the refactoring audit: a count per
 * issue kind, then one tab-separated line per finding. Exits 1 when the input
 * is empty or not a Knip report, so a tool failure is never read as zero
 * findings. Configuration hints are not part of the JSON report; the
 * collector prints them from Knip's text report.
 */

const ISSUE_KINDS = [
  'files',
  'exports',
  'nsExports',
  'types',
  'nsTypes',
  'enumMembers',
  'namespaceMembers',
  'duplicates',
  'dependencies',
  'devDependencies',
  'optionalPeerDependencies',
  'unlisted',
  'binaries',
  'unresolved',
];
const GENERATED_CLIENT_PATTERN = /^libs\/[^/]*api-client\//;

const fail = (message) => {
  console.error(message);
  console.log('summary-status: FAILED');
  process.exitCode = 1;
};

/* A finding is `{ name, line? }`; a duplicates finding is an array of them. */
const describeFinding = (finding) =>
  Array.isArray(finding)
    ? {
        name: finding.map((item) => item.name).join('|'),
        line: finding[0]?.line,
      }
    : { name: finding.name, line: finding.line };

const findingsOf = (issue, kind) =>
  Array.isArray(issue[kind]) ? issue[kind] : [];

const countFindings = (issues, kind) =>
  issues.reduce((total, issue) => total + findingsOf(issue, kind).length, 0);

const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
const input = Buffer.concat(chunks).toString('utf8').trim();

let report;
if (!input) {
  fail('Knip returned no JSON output.');
} else {
  try {
    report = JSON.parse(input);
  } catch (error) {
    fail(`Unable to parse Knip JSON: ${error.message}`);
  }
  if (report && !Array.isArray(report.issues)) {
    fail('Knip JSON has no `issues` array.');
    report = undefined;
  }
}

if (report) {
  const generated = report.issues.filter((issue) =>
    GENERATED_CLIENT_PATTERN.test(issue.file),
  );
  const issues = report.issues.filter(
    (issue) => !GENERATED_CLIENT_PATTERN.test(issue.file),
  );

  console.log('Summary:');
  for (const kind of ISSUE_KINDS) {
    console.log(`${kind}: ${countFindings(issues, kind)}`);
  }
  const filtered = ISSUE_KINDS.reduce(
    (total, kind) => total + countFindings(generated, kind),
    0,
  );
  console.log(`filteredGeneratedClientFindings: ${filtered}`);

  console.log('Findings:');
  let findingCount = 0;
  for (const issue of issues) {
    for (const kind of ISSUE_KINDS) {
      for (const finding of findingsOf(issue, kind)) {
        const { name, line } = describeFinding(finding);
        console.log(`${kind}\t${issue.file}${line ? `:${line}` : ''}\t${name}`);
        findingCount += 1;
      }
    }
  }
  if (findingCount === 0) {
    console.log('(none)');
  }
  console.log('summary-status: COMPLETE');
}
