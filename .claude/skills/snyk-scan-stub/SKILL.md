---
name: snyk-scan-stub
description: Synthetic Snyk Code SARIF 2.1.0 producer for SDLC chain validation. Emits a fixed, realistically-shaped Snyk Code SARIF report under payload.sarif so a downstream triage agent has deterministic, real-format input. NOT a real scanner — replace with stage-snyk.yml when the real Snyk pipeline lands.
---

# Synthetic Snyk-Scan Stub (chain-validation fixture, real SARIF shape)

This is a **test fixture**, not a real scanner. Its job is to emit a
deterministic report **in the real Snyk Code SARIF 2.1.0 shape** so the
`snyk-triage` agent exercises actual SARIF parsing (ruleId→rule join, nested
`locations`, `level`/`security-severity`, `codeFlows`) — not just an
easy flat JSON.

Do **not** read the diff, scan the repo, or invent findings. Ignore the
working tree. Use the **`Write` tool** to save the JSON below **verbatim** to
`stage-output.json` at the repo root. Copy it exactly — do not reformat,
re-indent, summarize, or drop fields. The embedded `payload.sarif` object is
what a real `snyk code test --sarif` run would produce (trimmed to two
results).

```json
{
  "stage": "snyk-scan-stub",
  "status": "passed_with_findings",
  "summary": "Synthetic Snyk Code SARIF (2.1.0): 2 results emitted under payload.sarif for triage-chain validation.",
  "payload": {
    "scanner": "snyk-code",
    "report_format": "sarif-2.1.0",
    "report_location": "payload.sarif",
    "sarif": {
      "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
      "version": "2.1.0",
      "runs": [
        {
          "tool": {
            "driver": {
              "name": "SnykCode",
              "semanticVersion": "1.0.0",
              "version": "1.0.0",
              "rules": [
                {
                  "id": "javascript/OpenRedirect",
                  "name": "OpenRedirect",
                  "shortDescription": { "text": "Open Redirect" },
                  "defaultConfiguration": { "level": "error" },
                  "help": {
                    "markdown": "Unsanitized input flowing into a redirect target lets an attacker redirect users to an arbitrary site (phishing).",
                    "text": "Unsanitized input flowing into a redirect target lets an attacker redirect users to an arbitrary site (phishing)."
                  },
                  "properties": {
                    "tags": ["javascript", "security", "CWE-601", "Security"],
                    "categories": ["Security"],
                    "precision": "very-high",
                    "repoDatasetSize": 3211,
                    "cwe": ["CWE-601"],
                    "security-severity": "7.3"
                  }
                },
                {
                  "id": "javascript/CodeInjection",
                  "name": "CodeInjection",
                  "shortDescription": { "text": "Code Injection" },
                  "defaultConfiguration": { "level": "error" },
                  "help": {
                    "markdown": "Untrusted input passed to a dynamic evaluation sink (eval) allows arbitrary code execution.",
                    "text": "Untrusted input passed to a dynamic evaluation sink (eval) allows arbitrary code execution."
                  },
                  "properties": {
                    "tags": ["javascript", "security", "CWE-94", "Security"],
                    "categories": ["Security"],
                    "precision": "very-high",
                    "repoDatasetSize": 1894,
                    "cwe": ["CWE-94"],
                    "security-severity": "9.1"
                  }
                }
              ]
            }
          },
          "results": [
            {
              "ruleId": "javascript/OpenRedirect",
              "ruleIndex": 0,
              "level": "error",
              "message": {
                "text": "Unsanitized input from the HTTP request (callbackUrl) flows into res.redirect, where it is used as a redirect target. This may result in an Open Redirect vulnerability."
              },
              "locations": [
                {
                  "physicalLocation": {
                    "artifactLocation": {
                      "uri": "apps/chat-api/src/auth/auth.controller.ts",
                      "uriBaseId": "%SRCROOT%"
                    },
                    "region": {
                      "startLine": 315,
                      "endLine": 315,
                      "startColumn": 5,
                      "endColumn": 25
                    }
                  }
                }
              ],
              "fingerprints": {
                "0": "3d9f1c7a8b2e4f60a1c5d2e7b9043f18",
                "1": "openredirect.authcontroller.v1"
              },
              "codeFlows": [
                {
                  "threadFlows": [
                    {
                      "locations": [
                        {
                          "location": {
                            "physicalLocation": {
                              "artifactLocation": {
                                "uri": "apps/chat-api/src/auth/auth.controller.ts",
                                "uriBaseId": "%SRCROOT%"
                              },
                              "region": {
                                "startLine": 163,
                                "endLine": 163,
                                "startColumn": 5,
                                "endColumn": 44
                              }
                            }
                          }
                        },
                        {
                          "location": {
                            "physicalLocation": {
                              "artifactLocation": {
                                "uri": "apps/chat-api/src/auth/auth.controller.ts",
                                "uriBaseId": "%SRCROOT%"
                              },
                              "region": {
                                "startLine": 233,
                                "endLine": 236,
                                "startColumn": 5,
                                "endColumn": 6
                              }
                            }
                          }
                        },
                        {
                          "location": {
                            "physicalLocation": {
                              "artifactLocation": {
                                "uri": "apps/chat-api/src/auth/auth.controller.ts",
                                "uriBaseId": "%SRCROOT%"
                              },
                              "region": {
                                "startLine": 315,
                                "endLine": 315,
                                "startColumn": 5,
                                "endColumn": 25
                              }
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              ],
              "properties": { "priorityScore": 720, "isAutofixable": false }
            },
            {
              "ruleId": "javascript/CodeInjection",
              "ruleIndex": 1,
              "level": "error",
              "message": {
                "text": "Untrusted input is passed to eval(), allowing arbitrary code execution (CWE-94)."
              },
              "locations": [
                {
                  "physicalLocation": {
                    "artifactLocation": {
                      "uri": "apps/chat-api/src/legacy/unsafe-eval.ts",
                      "uriBaseId": "%SRCROOT%"
                    },
                    "region": {
                      "startLine": 42,
                      "endLine": 42,
                      "startColumn": 3,
                      "endColumn": 28
                    }
                  }
                }
              ],
              "fingerprints": {
                "0": "a17be03c9d4422f15e8c6b07d3219ef4",
                "1": "codeinjection.legacyeval.v1"
              },
              "codeFlows": [
                {
                  "threadFlows": [
                    {
                      "locations": [
                        {
                          "location": {
                            "physicalLocation": {
                              "artifactLocation": {
                                "uri": "apps/chat-api/src/legacy/unsafe-eval.ts",
                                "uriBaseId": "%SRCROOT%"
                              },
                              "region": {
                                "startLine": 38,
                                "endLine": 38,
                                "startColumn": 3,
                                "endColumn": 30
                              }
                            }
                          }
                        },
                        {
                          "location": {
                            "physicalLocation": {
                              "artifactLocation": {
                                "uri": "apps/chat-api/src/legacy/unsafe-eval.ts",
                                "uriBaseId": "%SRCROOT%"
                              },
                              "region": {
                                "startLine": 42,
                                "endLine": 42,
                                "startColumn": 3,
                                "endColumn": 28
                              }
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              ],
              "properties": { "priorityScore": 850, "isAutofixable": false }
            }
          ],
          "properties": {
            "coverage": [
              {
                "files": 1,
                "isSuppressed": false,
                "lang": "TypeScript",
                "type": "SUPPORTED"
              }
            ]
          }
        }
      ]
    }
  }
}
```

The two results are intentionally checkable against the repo:

- **Result 1** (`javascript/OpenRedirect`, `auth.controller.ts:315`) points at a
  **real** sink whose redirect targets are allowlist-validated by
  `resolveCallbackUrl()` (the codeFlow even passes through line 233 where that
  validation happens). A correct triage verdict is **FALSE_POSITIVE**, citing
  that mitigation.
- **Result 2** (`javascript/CodeInjection`, `legacy/unsafe-eval.ts:42`) points
  at a **non-existent** file. A correct verdict is **NOT_APPLICABLE** /
  **FALSE_POSITIVE** (the sink is not present in the repo).

The point of the fixture is to exercise the chain plumbing **and** real-SARIF
parsing; the verdicts above are the signal that triage parsed the SARIF and
inspected the code.
