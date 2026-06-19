import type { CatalogItem, FavoriteItem } from '@epam/ai-dial-catalog';
import { Catalog, CatalogEntityType } from '@epam/ai-dial-catalog';
import type { TabModel } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { mapDeploymentToCatalogItem } from '../../utils/map-deployment-to-catalog-item';

// TODO: replace with actual data from backend
const MOCK_CATALOG_ITEMS: CatalogItem[] = [
  // ── Models ──────────────────────────────────────────────────────────────────
  {
    id: 'gpt-4o',
    type: CatalogEntityType.Model,
    name: 'GPT-4o',
    description:
      'Most capable GPT-4 model with vision support and multimodal input handling.',
    longDescription: `GPT-4o ("o" for "omni") is OpenAI's most capable production model, combining text, vision, and structured output in a single endpoint.

Capabilities
• Vision: Accepts images, screenshots, charts, and documents inline with text.
• Structured output: Enforces JSON schemas via the response_format parameter with strict mode.
• Function calling: Parallel tool calls for deterministic API integration.
• 128 k-token context window with retrieval-accurate performance across the full range.

Performance
• MMLU (5-shot): 88.7% — above GPT-4 Turbo (86.5%) at 2× the speed and half the cost.
• HumanEval (code generation): 90.2%.
• Supports image, audio, and video inputs in a single request.

Pricing
Input: $5 / 1M tokens · Output: $15 / 1M tokens
Batch API (async, 50% discount): $2.50 / $7.50

Limitations
• Knowledge cutoff: April 2024.
• No native web browsing or code execution — use tool calls or the Assistants API.
• Maximum output: 4,096 tokens per turn.`,
    pricing: ['Pay-as-you-go'],
    isFeatured: true,
    folder: ['OpenAI'],
    from: 'OpenAI',
    domain: 'General',
    useCase: 'Chat',
    maturity: 'GA',
    version: '2024-05',
    lastUsed: '10 min ago',
    logoColor: '#10A37F',
    logoInitial: 'G',
    overview: {
      sections: [
        {
          title: 'Capabilities',
          specs: [
            { label: 'Chat', value: true },
            { label: 'Reasoning', value: true },
            { label: 'Generation', value: true },
            { label: 'Knowledge', value: true },
            { label: 'Instructions', value: true },
            { label: 'Context', value: true },
            { label: 'Multimodal', value: true },
            { label: 'Tools', value: true },
            { label: 'Structured output', value: true },
          ],
        },
        {
          title: 'Specification',
          specs: [
            { label: 'Context window', value: '128K tokens' },
            { label: 'Max output', value: '4,096 tokens' },
            { label: 'Input type', value: 'Text, image, audio' },
            { label: 'Output type', value: 'Text' },
            { label: 'Languages', value: 'Multilingual' },
            { label: 'System prompt', value: true },
            { label: 'Temperature', value: true },
            { label: 'Seed', value: true },
            { label: 'URL attachments', value: false },
            { label: 'Folder attachments', value: false },
          ],
        },
      ],
    },
  },
  {
    id: 'gpt-4o-mini',
    type: CatalogEntityType.Model,
    name: 'GPT-4o mini',
    description:
      'Fast and cost-efficient variant of GPT-4o for high-volume tasks.',
    pricing: ['Pay-as-you-go'],
    folder: ['OpenAI'],
    from: 'OpenAI',
    domain: 'General',
    useCase: 'Chat',
    maturity: 'GA',
    version: '2024-07',
    lastUsed: '30 min ago',
    logoColor: '#10A37F',
    logoInitial: 'G',
  },
  {
    id: 'claude-3-5-sonnet',
    type: CatalogEntityType.Model,
    name: 'Claude 3.5 Sonnet',
    description:
      'Highly intelligent model balancing speed and capability for complex reasoning tasks.',
    longDescription: `Claude 3.5 Sonnet is Anthropic's flagship model as of late 2024, leading benchmarks in coding, reasoning, and vision while maintaining the safety guarantees of the Claude model family.

What's new in 3.5 Sonnet
This release ships with computer-use capability — an experimental feature that lets Claude control desktop GUIs by observing screenshots and issuing keyboard and mouse actions.

Reasoning & Coding
• SWE-bench Verified: 49.0% (state of the art at release, up from 40.4% on Claude 3 Opus).
• TAU-bench (tool use): 69.7% retail, 46.5% airline domains.
• Grad-level reasoning (GPQA Diamond): 65.0%.

Context & Pricing
200 k-token context window with full document and image support.
Input: $3 / 1M · Output: $15 / 1M · Cache write: $3.75 / 1M · Cache read: $0.30 / 1M

Best for
Complex coding tasks, multi-step agentic pipelines, document analysis, and computer-use automation.`,
    pricing: ['Pay-as-you-go'],
    isFeatured: true,
    folder: ['Anthropic'],
    from: 'Anthropic',
    domain: 'General',
    useCase: 'Chat',
    maturity: 'GA',
    version: '20241022',
    lastUsed: '1 hour ago',
    logoColor: '#CC7B3A',
    logoInitial: 'C',
    overview: {
      sections: [
        {
          title: 'Capabilities',
          specs: [
            { label: 'Chat', value: true },
            { label: 'Reasoning', value: true },
            { label: 'Generation', value: true },
            { label: 'Knowledge', value: true },
            { label: 'Instructions', value: true },
            { label: 'Context', value: true },
            { label: 'Multimodal', value: true },
            { label: 'Computer use', value: true },
            { label: 'Tools', value: true },
          ],
        },
        {
          title: 'Specification',
          specs: [
            { label: 'Context window', value: '200K tokens' },
            { label: 'Max output', value: '8,192 tokens' },
            { label: 'Input type', value: 'Text, image' },
            { label: 'Output type', value: 'Text' },
            { label: 'Languages', value: 'Multilingual' },
            { label: 'System prompt', value: true },
            { label: 'Temperature', value: true },
            { label: 'Seed', value: false },
            { label: 'URL attachments', value: false },
            { label: 'Folder attachments', value: false },
          ],
        },
      ],
    },
  },
  {
    id: 'claude-3-haiku',
    type: CatalogEntityType.Model,
    name: 'Claude 3 Haiku',
    description:
      'Fastest and most compact model for near-instant responsiveness.',
    pricing: ['Pay-as-you-go'],
    folder: ['Anthropic'],
    from: 'Anthropic',
    domain: 'General',
    useCase: 'Chat',
    maturity: 'GA',
    version: '20240307',
    lastUsed: '2 hours ago',
    logoColor: '#CC7B3A',
    logoInitial: 'C',
  },
  {
    id: 'gemini-1-5-pro',
    type: CatalogEntityType.Model,
    name: 'Gemini 1.5 Pro',
    description:
      'Long-context multimodal model from Google DeepMind with 2M token window.',
    pricing: ['Pay-as-you-go'],
    folder: ['Google'],
    from: 'Google',
    domain: 'General',
    useCase: 'Chat',
    maturity: 'GA',
    version: '002',
    lastUsed: 'Yesterday',
    logoColor: '#4285F4',
    logoInitial: 'G',
  },
  {
    id: 'gemini-1-5-flash',
    type: CatalogEntityType.Model,
    name: 'Gemini 1.5 Flash',
    description:
      'Optimized for speed and efficiency with a 1M token context window.',
    pricing: ['Pay-as-you-go'],
    folder: ['Google'],
    from: 'Google',
    domain: 'General',
    useCase: 'Chat',
    maturity: 'GA',
    version: '002',
    lastUsed: '4 hours ago',
    logoColor: '#4285F4',
    logoInitial: 'G',
  },
  {
    id: 'dall-e-3',
    type: CatalogEntityType.Model,
    name: 'DALL·E 3',
    description:
      'Generate realistic images and art from natural language descriptions.',
    pricing: ['Pay-as-you-go'],
    folder: ['OpenAI'],
    from: 'OpenAI',
    domain: 'Image',
    useCase: 'Generation',
    maturity: 'GA',
    version: '',
    lastUsed: '3 days ago',
    logoColor: '#10A37F',
    logoInitial: 'D',
  },
  {
    id: 'mistral-large',
    type: CatalogEntityType.Model,
    name: 'Mistral Large',
    description:
      'Top-tier reasoning model for high-complexity enterprise tasks.',
    pricing: ['Pay-as-you-go'],
    folder: ['Mistral AI'],
    from: 'Mistral AI',
    domain: 'General',
    useCase: 'Chat',
    maturity: 'GA',
    version: '2407',
    lastUsed: '5 days ago',
    logoColor: '#F0701C',
    logoInitial: 'M',
  },
  {
    id: 'llama-3-70b',
    type: CatalogEntityType.Model,
    name: 'Llama 3 70B',
    description:
      'Meta open-source model with strong reasoning and instruction following.',
    pricing: ['Free'],
    folder: ['Meta'],
    from: 'Meta',
    domain: 'General',
    useCase: 'Chat',
    maturity: 'GA',
    version: '3.1',
    lastUsed: '1 week ago',
    logoColor: '#0668E1',
    logoInitial: 'L',
  },
  // ── Agents ───────────────────────────────────────────────────────────────────
  {
    id: 'code-assistant',
    type: CatalogEntityType.Agent,
    name: 'Code Assistant',
    description:
      'AI agent for code review, generation, refactoring, and debugging across any language.',
    longDescription: `Code Assistant is EPAM's flagship agentic coding tool, combining code generation, automated review, and multi-file refactoring in a single agent.

Core capabilities
• Code generation: Write complete functions, classes, and modules from natural language descriptions.
• Automated review: Detect bugs, security issues, and style violations across any supported language.
• Refactoring: Apply consistent rename, extract, and restructure operations across multiple files.
• Debugging: Root-cause analysis with step-by-step fix suggestions and test generation.

Supported languages
Python, JavaScript, TypeScript, Java, C#, Go, Rust, SQL, and shell scripts.

How it works
The agent operates in an agentic loop — reading your existing code context, planning changes, and applying them incrementally. Each change is verified before the next step, minimising unintended side effects.

Best practices
• Provide a clear problem description: the more context, the more targeted the output.
• Review generated code before committing — the agent flags uncertainty but may miss edge cases.
• Use interactive review mode to step through each proposed change before accepting it.`,
    pricing: ['Free'],
    isFeatured: true,
    folder: ['EPAM', 'Agents'],
    from: 'EPAM',
    domain: 'Coding',
    useCase: 'Development',
    maturity: 'Beta',
    version: '1.0',
    lastUsed: '2 days ago',
    logoColor: '#6C63FF',
    logoInitial: 'C',
    overview: {
      sections: [
        {
          title: 'Capabilities',
          specs: [
            { label: 'Code generation', value: true },
            { label: 'Code review', value: true },
            { label: 'Refactoring', value: true },
            { label: 'Debugging', value: true },
            { label: 'Test generation', value: true },
            { label: 'Multi-file edits', value: true },
            { label: 'Web search', value: false },
            { label: 'Image input', value: false },
          ],
        },
        {
          title: 'Specification',
          specs: [
            {
              label: 'Supported langs',
              value: 'Python, JS, TS, Java, C#, Go, Rust',
            },
            { label: 'Max steps', value: '20 per task' },
            { label: 'Input type', value: 'Text, code files' },
            { label: 'Output type', value: 'Text, code' },
            { label: 'System prompt', value: false },
            { label: 'Temperature', value: false },
            { label: 'File attachments', value: true },
            { label: 'Folder attachments', value: true },
          ],
        },
      ],
    },
  },
  {
    id: 'data-analyst',
    type: CatalogEntityType.Agent,
    name: 'Data Analyst',
    description:
      'Autonomous agent that queries datasets, runs statistical analyses, and generates charts.',
    pricing: ['Pay-as-you-go'],
    folder: ['EPAM', 'Agents'],
    from: 'EPAM',
    domain: 'Analytics',
    useCase: 'Research',
    maturity: 'Beta',
    version: '0.9',
    lastUsed: '3 days ago',
    logoColor: '#3B82F6',
    logoInitial: 'D',
  },
  {
    id: 'customer-support',
    type: CatalogEntityType.Agent,
    name: 'Customer Support',
    description:
      'Handles tier-1 support tickets with CRM integration and escalation logic.',
    pricing: ['By request'],
    folder: ['EPAM', 'Agents'],
    from: 'EPAM',
    domain: 'General',
    useCase: 'Support',
    maturity: 'GA',
    version: '2.3',
    lastUsed: 'Yesterday',
    logoColor: '#22C55E',
    logoInitial: 'S',
  },
  {
    id: 'doc-writer',
    type: CatalogEntityType.Agent,
    name: 'Doc Writer',
    description:
      'Generates technical documentation, release notes, and API references from source code.',
    pricing: ['Free'],
    folder: ['EPAM', 'Agents'],
    from: 'EPAM',
    domain: 'Coding',
    useCase: 'Development',
    maturity: 'Alpha',
    version: '0.4',
    lastUsed: '1 week ago',
    logoColor: '#EAB308',
    logoInitial: 'D',
  },
  // ── Toolsets ─────────────────────────────────────────────────────────────────
  {
    id: 'web-search-tool',
    type: CatalogEntityType.Toolset,
    name: 'Web Search',
    description:
      'Enables real-time web search capabilities for any model via Bing or Google APIs.',
    pricing: ['Free'],
    folder: ['EPAM', 'Tools'],
    from: 'EPAM',
    domain: 'Search',
    useCase: 'Research',
    maturity: 'GA',
    version: '2.1',
    lastUsed: '5 min ago',
    logoColor: '#FF6B6B',
    logoInitial: 'W',
  },
  {
    id: 'file-converter',
    type: CatalogEntityType.Toolset,
    name: 'File Converter',
    description:
      'Converts documents between PDF, DOCX, XLSX, CSV, and Markdown formats.',
    pricing: ['Free'],
    folder: ['EPAM', 'Tools'],
    from: 'EPAM',
    domain: 'Productivity',
    useCase: 'Utilities',
    maturity: 'GA',
    version: '1.5',
    lastUsed: '2 hours ago',
    logoColor: '#F97316',
    logoInitial: 'F',
  },
  {
    id: 'code-interpreter',
    type: CatalogEntityType.Toolset,
    name: 'Code Interpreter',
    description:
      'Executes Python and JavaScript snippets in a sandboxed environment with output capture.',
    longDescription: `Code Interpreter provides a secure, sandboxed execution environment for Python and JavaScript, enabling models to run code and return structured results inline.

Execution model
Code runs in an isolated container with no network access and a 30-second timeout per cell. Outputs — stdout, stderr, charts, and generated files — are captured and returned alongside the model response.

Supported runtimes
• Python 3.11 with NumPy, pandas, matplotlib, scikit-learn, and Pillow pre-installed.
• Node.js 20 for JavaScript data transformations and scripting tasks.

Use cases
• Data analysis: Load CSVs, compute statistics, and generate plots without leaving the chat.
• Mathematics: Solve equations symbolically or numerically.
• Prototyping: Test algorithms and scripts against real data before productionising.

Limits
• Max execution time: 30 seconds per cell.
• Max output size: 2 MB per run.
• No persistent storage between sessions — upload files per request.`,
    pricing: ['Pay-as-you-go'],
    isFeatured: true,
    folder: ['EPAM', 'Tools'],
    from: 'EPAM',
    domain: 'Coding',
    useCase: 'Development',
    maturity: 'GA',
    version: '3.0',
    lastUsed: '1 day ago',
    logoColor: '#8B5CF6',
    logoInitial: 'C',
    overview: {
      sections: [
        {
          title: 'Capabilities',
          specs: [
            { label: 'Python execution', value: true },
            { label: 'JS execution', value: true },
            { label: 'Data analysis', value: true },
            { label: 'Chart generation', value: true },
            { label: 'File output', value: true },
            { label: 'Network access', value: false },
            { label: 'Persistent storage', value: false },
          ],
        },
        {
          title: 'Specification',
          specs: [
            { label: 'Python version', value: '3.11' },
            { label: 'Node.js version', value: '20' },
            { label: 'Max exec time', value: '30 seconds per cell' },
            { label: 'Max output size', value: '2 MB per run' },
            {
              label: 'Pre-installed libs',
              value: 'NumPy, pandas, matplotlib, scikit-learn',
            },
            { label: 'File attachments', value: true },
            { label: 'Folder attachments', value: false },
          ],
        },
      ],
    },
  },
  {
    id: 'image-analyzer',
    type: CatalogEntityType.Toolset,
    name: 'Image Analyzer',
    description:
      'Extracts text, objects, and metadata from images using computer vision.',
    pricing: ['Pay-as-you-go'],
    folder: ['EPAM', 'Tools'],
    from: 'EPAM',
    domain: 'Image',
    useCase: 'Analysis',
    maturity: 'Beta',
    version: '1.2',
    lastUsed: '4 days ago',
    logoColor: '#06B6D4',
    logoInitial: 'I',
  },
  // ── Guardrails ───────────────────────────────────────────────────────────────
  {
    id: 'pii-filter',
    type: CatalogEntityType.Guardrail,
    name: 'PII Filter',
    description:
      'Detects and redacts personally identifiable information from model inputs and outputs.',
    longDescription: `PII Filter is a real-time guardrail that detects and redacts personally identifiable information from both model inputs and outputs before they are stored or returned to the user.

Detected entity types
• Identity: full names, national ID numbers, passport numbers, driver's licence numbers.
• Contact: email addresses, phone numbers, postal addresses.
• Financial: credit card numbers, bank account numbers, IBAN codes.
• Health: medical record numbers, diagnosis codes (ICD-10), prescription identifiers.

Detection approach
The filter combines rule-based pattern matching (regex) with a fine-tuned NER model to minimise both false positives and missed detections. Confidence thresholds are configurable per entity type.

Redaction modes
• Mask: Replace detected values with a type label, e.g. [EMAIL].
• Hash: Replace with a consistent one-way hash for pseudonymisation.
• Delete: Remove the span entirely from the text.

Compliance
Designed to support GDPR Article 25 (data protection by design), HIPAA Safe Harbor de-identification, and CCPA consumer data requirements.`,
    pricing: ['Free'],
    isFeatured: true,
    folder: ['EPAM', 'Safety'],
    from: 'EPAM',
    domain: 'Safety',
    useCase: 'Compliance',
    maturity: 'GA',
    version: '1.4',
    lastUsed: 'Today',
    logoColor: '#EF4444',
    logoInitial: 'P',
  },
  {
    id: 'toxicity-detector',
    type: CatalogEntityType.Guardrail,
    name: 'Toxicity Detector',
    description:
      'Classifies and blocks harmful, offensive, or policy-violating content in real time.',
    pricing: ['Free'],
    folder: ['EPAM', 'Safety'],
    from: 'EPAM',
    domain: 'Safety',
    useCase: 'Moderation',
    maturity: 'GA',
    version: '2.0',
    lastUsed: 'Today',
    logoColor: '#DC2626',
    logoInitial: 'T',
  },
  {
    id: 'topic-restriction',
    type: CatalogEntityType.Guardrail,
    name: 'Topic Restriction',
    description:
      'Enforces conversation boundaries by blocking out-of-scope topics per policy.',
    pricing: ['Free'],
    folder: ['EPAM', 'Safety'],
    from: 'EPAM',
    domain: 'Safety',
    useCase: 'Compliance',
    maturity: 'Beta',
    version: '0.8',
    lastUsed: '2 days ago',
    logoColor: '#B91C1C',
    logoInitial: 'T',
  },
  {
    id: 'hallucination-guard',
    type: CatalogEntityType.Guardrail,
    name: 'Hallucination Guard',
    description:
      'Scores model responses for factual consistency against provided source documents.',
    pricing: ['Pay-as-you-go'],
    folder: ['EPAM', 'Safety'],
    from: 'EPAM',
    domain: 'Safety',
    useCase: 'Quality',
    maturity: 'Alpha',
    version: '0.3',
    lastUsed: '1 week ago',
    logoColor: '#7F1D1D',
    logoInitial: 'H',
  },
  // ── Skills ───────────────────────────────────────────────────────────────────
  {
    id: 'sql-skill',
    type: CatalogEntityType.Skill,
    name: 'SQL Query Builder',
    description:
      'Translates natural language questions into optimized SQL queries for relational databases.',
    longDescription: `SQL Query Builder translates natural language questions into optimised, production-ready SQL queries for any relational database.

How it works
Given a natural language question and a database schema (table names, column types, and relationships), the skill generates a syntactically correct SQL query, explains its reasoning, and flags potential performance concerns such as missing indexes or full-table scans.

Supported dialects
PostgreSQL, MySQL 8, Microsoft SQL Server (T-SQL), SQLite, BigQuery, and Snowflake SQL.

Key features
• Schema-aware: Understands foreign keys and joins without being told explicitly.
• Parameterised output: Generates prepared-statement placeholders (?, $1) to prevent SQL injection.
• Query explanation: Provides a plain-English breakdown of each clause alongside the SQL.
• Optimisation hints: Suggests indexes and rewrites inefficient subqueries as CTEs or window functions.

Limitations
• Requires a schema description in the prompt or as a structured input.
• Does not execute queries — output must be reviewed and run by the consuming application.
• Complex recursive queries (WITH RECURSIVE) may require manual refinement.`,
    pricing: ['Free'],
    isFeatured: true,
    folder: ['EPAM', 'Skills'],
    from: 'EPAM',
    domain: 'Analytics',
    useCase: 'Development',
    maturity: 'GA',
    version: '1.1',
    lastUsed: '3 hours ago',
    logoColor: '#0EA5E9',
    logoInitial: 'S',
  },
  {
    id: 'summarizer-skill',
    type: CatalogEntityType.Skill,
    name: 'Document Summarizer',
    description:
      'Produces structured summaries of long documents with key-point extraction.',
    pricing: ['Free'],
    folder: ['EPAM', 'Skills'],
    from: 'EPAM',
    domain: 'Productivity',
    useCase: 'Research',
    maturity: 'GA',
    version: '2.0',
    lastUsed: '6 hours ago',
    logoColor: '#14B8A6',
    logoInitial: 'S',
  },
  {
    id: 'translation-skill',
    type: CatalogEntityType.Skill,
    name: 'Translator',
    description:
      'Translates text across 100+ languages with terminology and tone preservation.',
    pricing: ['Pay-as-you-go'],
    folder: ['EPAM', 'Skills'],
    from: 'EPAM',
    domain: 'General',
    useCase: 'Utilities',
    maturity: 'GA',
    version: '3.2',
    lastUsed: 'Yesterday',
    logoColor: '#A855F7',
    logoInitial: 'T',
  },
];

const CATALOG_TABS: TabModel[] = [
  { id: CatalogEntityType.Model, label: 'Models' },
  { id: CatalogEntityType.Agent, label: 'Agents' },
  { id: CatalogEntityType.Toolset, label: 'Toolsets' },
  { id: CatalogEntityType.Guardrail, label: 'Guardrails' },
  { id: CatalogEntityType.Skill, label: 'Skills' },
];

// TODO: add favorites functionality and replace with actual favorites from backend
const EMPTY_FAVORITES: FavoriteItem[] = [
  {
    id: 'web-search-tool',
    type: CatalogEntityType.Toolset,
    name: 'Web Search',
    version: '2.1',
    lastUsed: '5 min ago',
    lastUsedAt: Date.now() - 5 * 60 * 1000,
    logoColor: '#FF6B6B',
    logoInitial: 'W',
    isStarred: true,
  },
  {
    id: 'gpt-4o',
    type: CatalogEntityType.Model,
    name: 'GPT-4o',
    version: '2024-05',
    lastUsed: '10 min ago',
    lastUsedAt: Date.now() - 10 * 60 * 1000,
    logoColor: '#10A37F',
    logoInitial: 'G',
    isStarred: true,
  },
  {
    id: 'pii-filter',
    type: CatalogEntityType.Guardrail,
    name: 'PII Filter',
    version: '1.4',
    lastUsed: '30 min ago',
    lastUsedAt: Date.now() - 30 * 60 * 1000,
    logoColor: '#EF4444',
    logoInitial: 'P',
    isStarred: true,
  },
  {
    id: 'claude-3-5-sonnet',
    type: CatalogEntityType.Model,
    name: 'Claude 3.5 Sonnet',
    version: '20241022',
    lastUsed: '1 hour ago',
    lastUsedAt: Date.now() - 1 * 60 * 60 * 1000,
    logoColor: '#CC7B3A',
    logoInitial: 'C',
    isStarred: true,
  },
  {
    id: 'code-interpreter',
    type: CatalogEntityType.Toolset,
    name: 'Code Interpreter',
    version: '3.0',
    lastUsed: '2 hours ago',
    lastUsedAt: Date.now() - 2 * 60 * 60 * 1000,
    logoColor: '#8B5CF6',
    logoInitial: 'C',
    isStarred: true,
  },
  {
    id: 'sql-skill',
    type: CatalogEntityType.Skill,
    name: 'SQL Query Builder',
    version: '1.1',
    lastUsed: '3 hours ago',
    lastUsedAt: Date.now() - 3 * 60 * 60 * 1000,
    logoColor: '#0EA5E9',
    logoInitial: 'S',
    isStarred: true,
  },
  {
    id: 'code-assistant',
    type: CatalogEntityType.Agent,
    name: 'Code Assistant',
    version: '1.0',
    lastUsed: 'Yesterday',
    lastUsedAt: Date.now() - 24 * 60 * 60 * 1000,
    logoColor: '#6C63FF',
    logoInitial: 'C',
    isStarred: true,
  },
  {
    id: 'gemini-1-5-pro',
    type: CatalogEntityType.Model,
    name: 'Gemini 1.5 Pro',
    version: '002',
    lastUsed: 'Yesterday',
    lastUsedAt: Date.now() - 30 * 60 * 60 * 1000,
    logoColor: '#4285F4',
    logoInitial: 'G',
    isStarred: true,
  },
  {
    id: 'summarizer-skill',
    type: CatalogEntityType.Skill,
    name: 'Doc Summarizer',
    version: '2.0',
    lastUsed: '2 days ago',
    lastUsedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    logoColor: '#14B8A6',
    logoInitial: 'S',
    isStarred: true,
  },
  {
    id: 'data-analyst',
    type: CatalogEntityType.Agent,
    name: 'Data Analyst',
    version: '0.9',
    lastUsed: '3 days ago',
    lastUsedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    logoColor: '#3B82F6',
    logoInitial: 'D',
    isStarred: true,
  },
  {
    id: 'mistral-large',
    type: CatalogEntityType.Model,
    name: 'Mistral Large',
    version: '2407',
    lastUsed: '5 days ago',
    lastUsedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    logoColor: '#F0701C',
    logoInitial: 'M',
    isStarred: true,
  },
  {
    id: 'translation-skill',
    type: CatalogEntityType.Skill,
    name: 'Translator',
    version: '3.2',
    lastUsed: '1 week ago',
    lastUsedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    logoColor: '#A855F7',
    logoInitial: 'T',
    isStarred: true,
  },
];

const CatalogView: FC = () => {
  const { t } = useTranslation();
  const { items: deployments } = useDeployments();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const catalogItems = useMemo(
    () => deployments.map(mapDeploymentToCatalogItem),
    [deployments],
  );

  // TODO: replace with a real API call, e.g. GET /api/catalog/{id}/about
  const fetchAboutContent = useCallback(
    (item: CatalogItem): Promise<string | undefined> =>
      new Promise((resolve) => {
        setTimeout(() => resolve(item.longDescription), 1200);
      }),
    [],
  );

  return (
    <Catalog
      items={MOCK_CATALOG_ITEMS}
      favorites={EMPTY_FAVORITES}
      tabs={CATALOG_TABS}
      onFetchAboutContent={fetchAboutContent}
      texts={{
        pageTitle: t(CatalogI18nKeys.PageTitle),
        createLabel: t(ButtonsI18nKeys.Create),
        favoritesTitle: t(CatalogI18nKeys.FavoritesTitle),
        browseTitle: t(ButtonsI18nKeys.Browse),
        searchPlaceholder: t(CatalogI18nKeys.SearchPlaceholder),
        noResultsDescription: t(CatalogI18nKeys.NoResultsDescription),
        ariaLabel: t(CatalogI18nKeys.AriaLabel),
      }}
    />
  );
};

export default memo(CatalogView);
