#!/usr/bin/env node

const chunks = [];

for await (const chunk of process.stdin) {
  chunks.push(chunk);
}

const input = Buffer.concat(chunks).toString('utf8').trim();

if (!input) {
  console.error('Knip returned no JSON output.');
  process.exitCode = 1;
} else {
  let report;

  try {
    report = JSON.parse(input);
  } catch (error) {
    console.error(`Unable to parse Knip JSON: ${error.message}`);
    process.exitCode = 1;
  }

  if (report) {
    const issueKinds = [
      'files',
      'exports',
      'nsExports',
      'types',
      'nsTypes',
      'enumMembers',
      'namespaceMembers',
      'dependencies',
      'unlisted',
      'unresolved',
    ];
    const allIssues = Array.isArray(report.issues) ? report.issues : [];
    const generatedClientPattern = /^libs\/[^/]*api-client\//;
    const ignoredIssues = allIssues.filter((issue) =>
      generatedClientPattern.test(issue.file),
    );
    const issues = allIssues.filter(
      (issue) => !generatedClientPattern.test(issue.file),
    );
    const ignoredFindingCount = ignoredIssues.reduce(
      (total, issue) =>
        total +
        issueKinds.reduce(
          (issueTotal, kind) =>
            issueTotal + (Array.isArray(issue[kind]) ? issue[kind].length : 0),
          0,
        ),
      0,
    );

    console.log('Summary:');
    for (const kind of issueKinds) {
      const count = issues.reduce(
        (total, issue) =>
          total + (Array.isArray(issue[kind]) ? issue[kind].length : 0),
        0,
      );
      console.log(`${kind}: ${count}`);
    }
    console.log(`filteredGeneratedClientFindings: ${ignoredFindingCount}`);

    console.log('Findings:');
    let findingCount = 0;

    for (const issue of issues) {
      for (const kind of issueKinds) {
        const findings = Array.isArray(issue[kind]) ? issue[kind] : [];

        for (const finding of findings) {
          const location = finding.line ? `:${finding.line}` : '';
          console.log(`${kind}\t${issue.file}${location}\t${finding.name}`);
          findingCount += 1;
        }
      }
    }

    if (findingCount === 0) {
      console.log('(none)');
    }
  }
}
