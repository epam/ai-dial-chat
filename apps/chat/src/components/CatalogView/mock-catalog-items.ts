import type { CatalogItem } from '@epam/ai-dial-catalog';
import {
  CatalogEntityType,
  CodeLanguage,
  EntityTag,
} from '@epam/ai-dial-catalog';

const avatar = (name: string, bg: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&bold=true&size=64&rounded=false`;

export const MOCK_CATALOG_ITEMS: CatalogItem[] = [
  // ── Models ────────────────────────────────────────────────────────────────
  {
    id: 'gpt-4o',
    type: CatalogEntityType.Model,
    name: 'GPT-4o',
    version: '2024-11',
    lastUsed: '2 min ago',
    updatedAt: Date.now() - 2 * 60 * 1000,
    iconUrl: avatar('GPT 4o', '10A37F'),
    description:
      'Most capable GPT-4 model with vision, audio, and faster response times.',
    folder: ['OpenAI'],
    provider: 'OpenAI',
    topics: ['Chat', 'Vision', 'Reasoning', 'Code'],
    isUserFavorite: true,
    isStarred: true,
    isFeatured: true,
    summary: {
      tag: EntityTag.Featured,
      dailyLimit: {
        used: 120000,
        total: 500000,
        resetLabel: 'Resets Mon 12:00 AM',
      },
    },
    details: {
      overview: {
        sections: [
          {
            title: 'Capabilities',
            specs: [
              { label: 'Reasoning', value: true },
              { label: 'Instructions', value: true },
              { label: 'Tools', value: true },
              { label: 'Structured output', value: true },
            ],
          },
          {
            title: 'Specification',
            specs: [
              { label: 'Hosted by', value: 'Microsoft Azure' },
              { label: 'Context window', value: '128K tokens' },
              { label: 'Max output tokens', value: '16K tokens' },
              { label: 'Input type', value: 'Text · Image · Audio' },
              { label: 'Output type', value: 'Text · Audio' },
              {
                label: 'Languages',
                value:
                  'English · Spanish · French · German · Japanese · Chinese',
              },
            ],
          },
        ],
      },
      pricing: {
        prices: [
          { label: 'Input', price: '$2.50 / 1M tokens' },
          { label: 'Output', price: '$10.00 / 1M tokens' },
          { label: 'Cached input', price: '$1.25 / 1M tokens' },
          { label: 'Batch input', price: '$1.25 / 1M tokens' },
          { label: 'Batch output', price: '$5.00 / 1M tokens' },
        ],
        limits: [
          { label: 'Daily limit', value: '500K tokens / user' },
          { label: 'Rate limit', value: '10K tokens / min' },
          { label: 'Max file size', value: '20 MB' },
        ],
      },
      api: {
        resource: { modelId: 'gpt-4o-2024-11-20' },
        endpoints: [
          {
            label: 'Azure OpenAI Endpoint',
            url: 'https://ai.example.com/azure/openai/deployments/gpt-4o',
            snippets: [
              {
                language: CodeLanguage.Python,
                code: `from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint="https://ai.example.com/azure/openai/deployments/gpt-4o",
    api_key="<YOUR_API_KEY>",
    api_version="2024-08-01-preview",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)

print(response.choices[0].message.content)`,
              },
              {
                language: CodeLanguage.Curl,
                code: `curl "https://ai.example.com/azure/openai/deployments/gpt-4o/chat/completions?api-version=2024-08-01-preview" \\
  -H "Content-Type: application/json" \\
  -H "api-key: <YOUR_API_KEY>" \\
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
              },
              {
                language: CodeLanguage.JavaScript,
                code: `import { AzureOpenAI } from 'openai';

const client = new AzureOpenAI({
  endpoint: 'https://ai.example.com/azure/openai/deployments/gpt-4o',
  apiKey: '<YOUR_API_KEY>',
  apiVersion: '2024-08-01-preview',
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);`,
              },
            ],
          },
          {
            label: 'Anthropic Endpoint',
            url: 'https://ai.example.com/anthropic',
            snippets: [
              {
                language: CodeLanguage.Python,
                code: `import anthropic

client = anthropic.Anthropic(
    base_url="https://ai.example.com/anthropic",
    api_key="<YOUR_API_KEY>",
)

message = client.messages.create(
    model="gpt-4o-2024-11-20",
    max_tokens=512,
    messages=[{"role": "user", "content": "Hello!"}],
)

print(message.content[0].text)`,
              },
              {
                language: CodeLanguage.Curl,
                code: `curl https://ai.example.com/anthropic/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: <YOUR_API_KEY>" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "gpt-4o-2024-11-20",
    "max_tokens": 512,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
              },
              {
                language: CodeLanguage.JavaScript,
                code: `import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  baseURL: 'https://ai.example.com/anthropic',
  apiKey: '<YOUR_API_KEY>',
});

const message = await client.messages.create({
  model: 'gpt-4o-2024-11-20',
  max_tokens: 512,
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(message.content[0].text);`,
              },
            ],
          },
          {
            label: 'Responses Endpoint',
            url: 'https://ai.example.com/openai/responses',
            snippets: [
              {
                language: CodeLanguage.Python,
                code: `from openai import OpenAI

client = OpenAI(
    base_url="https://ai.example.com/openai/responses",
    api_key="<YOUR_API_KEY>",
)

response = client.responses.create(
    model="gpt-4o",
    input="Hello!",
)

print(response.output_text)`,
              },
              {
                language: CodeLanguage.Curl,
                code: `curl https://ai.example.com/openai/responses/v1/responses \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -d '{
    "model": "gpt-4o",
    "input": "Hello!"
  }'`,
              },
              {
                language: CodeLanguage.JavaScript,
                code: `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://ai.example.com/openai/responses',
  apiKey: '<YOUR_API_KEY>',
});

const response = await client.responses.create({
  model: 'gpt-4o',
  input: 'Hello!',
});

console.log(response.output_text);`,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'claude-3-5-sonnet',
    type: CatalogEntityType.Model,
    name: 'Claude 3.5 Sonnet',
    version: '20241022',
    lastUsed: '1 hr ago',
    updatedAt: Date.now() - 60 * 60 * 1000,
    iconUrl: avatar('Claude', 'D4705E'),
    description:
      "Anthropic's most intelligent model — strong at coding, analysis, and reasoning.",
    folder: ['Anthropic'],
    provider: 'Anthropic',
    topics: ['Chat', 'Code', 'Analysis', 'Reasoning'],
    isUserFavorite: true,
    isStarred: true,
    summary: {
      tag: EntityTag.Featured,
      dailyLimit: {
        used: 80000,
        total: 300000,
        resetLabel: 'Resets Mon 12:00 AM',
      },
    },
    details: {
      overview: {
        sections: [
          {
            title: 'Capabilities',
            specs: [
              { label: 'Reasoning', value: true },
              { label: 'Instructions', value: true },
              { label: 'Tools', value: true },
              { label: 'Structured output', value: true },
            ],
          },
          {
            title: 'Specification',
            specs: [
              { label: 'Hosted by', value: 'Anthropic' },
              { label: 'Context window', value: '200K tokens' },
              { label: 'Max output tokens', value: '8K tokens' },
              { label: 'Input type', value: 'Text · Image · PDF' },
              { label: 'Output type', value: 'Text' },
              {
                label: 'Languages',
                value:
                  'English · Spanish · French · German · Italian · Portuguese · Japanese · Chinese · Korean',
              },
            ],
          },
        ],
      },
      pricing: {
        prices: [
          { label: 'Input', price: '$3.00 / 1M tokens' },
          { label: 'Output', price: '$15.00 / 1M tokens' },
          { label: 'Prompt cache write', price: '$3.75 / 1M tokens' },
          { label: 'Prompt cache read', price: '$0.30 / 1M tokens' },
        ],
        limits: [
          { label: 'Daily limit', value: '300K tokens / user' },
          { label: 'Rate limit', value: '8K tokens / min' },
        ],
      },
      api: {
        resource: { modelId: 'claude-3-5-sonnet-20241022' },
        endpoints: [
          {
            label: 'Azure OpenAI Endpoint',
            url: 'https://ai.example.com/azure/openai/deployments/claude-3-5-sonnet',
            snippets: [
              {
                language: CodeLanguage.Python,
                code: `from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint="https://ai.example.com/azure/openai/deployments/claude-3-5-sonnet",
    api_key="<YOUR_API_KEY>",
    api_version="2024-08-01-preview",
)

response = client.chat.completions.create(
    model="claude-3-5-sonnet-20241022",
    messages=[{"role": "user", "content": "Explain quantum entanglement."}],
)

print(response.choices[0].message.content)`,
              },
              {
                language: CodeLanguage.Curl,
                code: `curl "https://ai.example.com/azure/openai/deployments/claude-3-5-sonnet/chat/completions?api-version=2024-08-01-preview" \\
  -H "Content-Type: application/json" \\
  -H "api-key: <YOUR_API_KEY>" \\
  -d '{
    "messages": [{"role": "user", "content": "Explain quantum entanglement."}]
  }'`,
              },
              {
                language: CodeLanguage.JavaScript,
                code: `import { AzureOpenAI } from 'openai';

const client = new AzureOpenAI({
  endpoint: 'https://ai.example.com/azure/openai/deployments/claude-3-5-sonnet',
  apiKey: '<YOUR_API_KEY>',
  apiVersion: '2024-08-01-preview',
});

const response = await client.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Explain quantum entanglement.' }],
});

console.log(response.choices[0].message.content);`,
              },
            ],
          },
          {
            label: 'Anthropic Endpoint',
            url: 'https://ai.example.com/anthropic',
            snippets: [
              {
                language: CodeLanguage.Python,
                code: `import anthropic

client = anthropic.Anthropic(
    base_url="https://ai.example.com/anthropic",
    api_key="<YOUR_API_KEY>",
)

message = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Explain quantum entanglement."}],
)

print(message.content[0].text)`,
              },
              {
                language: CodeLanguage.Curl,
                code: `curl https://ai.example.com/anthropic/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: <YOUR_API_KEY>" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Explain quantum entanglement."}]
  }'`,
              },
              {
                language: CodeLanguage.JavaScript,
                code: `import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  baseURL: 'https://ai.example.com/anthropic',
  apiKey: '<YOUR_API_KEY>',
});

const message = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Explain quantum entanglement.' }],
});

console.log(message.content[0].text);`,
              },
            ],
          },
          {
            label: 'Responses Endpoint',
            url: 'https://ai.example.com/openai/responses',
            snippets: [
              {
                language: CodeLanguage.Python,
                code: `from openai import OpenAI

client = OpenAI(
    base_url="https://ai.example.com/openai/responses",
    api_key="<YOUR_API_KEY>",
)

response = client.responses.create(
    model="claude-3-5-sonnet-20241022",
    input="Explain quantum entanglement.",
)

print(response.output_text)`,
              },
              {
                language: CodeLanguage.Curl,
                code: `curl https://ai.example.com/openai/responses/v1/responses \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "input": "Explain quantum entanglement."
  }'`,
              },
              {
                language: CodeLanguage.JavaScript,
                code: `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://ai.example.com/openai/responses',
  apiKey: '<YOUR_API_KEY>',
});

const response = await client.responses.create({
  model: 'claude-3-5-sonnet-20241022',
  input: 'Explain quantum entanglement.',
});

console.log(response.output_text);`,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'gemini-1-5-pro',
    type: CatalogEntityType.Model,
    name: 'Gemini 1.5 Pro',
    version: '002',
    lastUsed: '3 hr ago',
    updatedAt: Date.now() - 3 * 60 * 60 * 1000,
    iconUrl: avatar('Gemini', '4285F4'),
    description: "Google's multimodal model with a 2M token context window.",
    folder: ['Google'],
    provider: 'Google',
    topics: ['Chat', 'Vision', 'Long Context', 'Multimodal'],
    isUserFavorite: false,
    details: {
      overview: {
        sections: [
          {
            title: 'Capabilities',
            specs: [
              { label: 'Reasoning', value: true },
              { label: 'Instructions', value: true },
              { label: 'Tools', value: true },
              { label: 'Structured output', value: true },
            ],
          },
          {
            title: 'Specification',
            specs: [
              { label: 'Hosted by', value: 'Google Vertex AI' },
              { label: 'Context window', value: '2M tokens' },
              { label: 'Max output tokens', value: '8K tokens' },
              {
                label: 'Input type',
                value: 'Text · Image · Audio · Video · PDF',
              },
              { label: 'Output type', value: 'Text' },
              {
                label: 'Languages',
                value:
                  'English · Spanish · French · German · Arabic · Hindi · Japanese · Chinese · Korean',
              },
            ],
          },
        ],
      },
      pricing: {
        prices: [
          { label: 'Input (≤128K)', price: '$1.25 / 1M tokens' },
          { label: 'Input (>128K)', price: '$2.50 / 1M tokens' },
          { label: 'Output', price: '$5.00 / 1M tokens' },
        ],
        limits: [
          { label: 'Daily limit', value: '1M tokens / user' },
          { label: 'Rate limit', value: '4M tokens / min' },
        ],
      },
      api: {
        resource: { modelId: 'gemini-1.5-pro-002' },
        endpoints: [
          {
            label: 'Azure OpenAI Endpoint',
            url: 'https://ai.example.com/azure/openai/deployments/gemini-1-5-pro',
            snippets: [
              {
                language: CodeLanguage.Python,
                code: `from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint="https://ai.example.com/azure/openai/deployments/gemini-1-5-pro",
    api_key="<YOUR_API_KEY>",
    api_version="2024-08-01-preview",
)

response = client.chat.completions.create(
    model="gemini-1.5-pro-002",
    messages=[{"role": "user", "content": "Summarise this document."}],
)

print(response.choices[0].message.content)`,
              },
              {
                language: CodeLanguage.Curl,
                code: `curl "https://ai.example.com/azure/openai/deployments/gemini-1-5-pro/chat/completions?api-version=2024-08-01-preview" \\
  -H "Content-Type: application/json" \\
  -H "api-key: <YOUR_API_KEY>" \\
  -d '{
    "messages": [{"role": "user", "content": "Summarise this document."}]
  }'`,
              },
              {
                language: CodeLanguage.JavaScript,
                code: `import { AzureOpenAI } from 'openai';

const client = new AzureOpenAI({
  endpoint: 'https://ai.example.com/azure/openai/deployments/gemini-1-5-pro',
  apiKey: '<YOUR_API_KEY>',
  apiVersion: '2024-08-01-preview',
});

const response = await client.chat.completions.create({
  model: 'gemini-1.5-pro-002',
  messages: [{ role: 'user', content: 'Summarise this document.' }],
});

console.log(response.choices[0].message.content);`,
              },
            ],
          },
          {
            label: 'Anthropic Endpoint',
            url: 'https://ai.example.com/anthropic',
            snippets: [
              {
                language: CodeLanguage.Python,
                code: `import anthropic

client = anthropic.Anthropic(
    base_url="https://ai.example.com/anthropic",
    api_key="<YOUR_API_KEY>",
)

message = client.messages.create(
    model="gemini-1.5-pro-002",
    max_tokens=2048,
    messages=[{"role": "user", "content": "Summarise this document."}],
)

print(message.content[0].text)`,
              },
              {
                language: CodeLanguage.Curl,
                code: `curl https://ai.example.com/anthropic/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: <YOUR_API_KEY>" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "gemini-1.5-pro-002",
    "max_tokens": 2048,
    "messages": [{"role": "user", "content": "Summarise this document."}]
  }'`,
              },
              {
                language: CodeLanguage.JavaScript,
                code: `import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  baseURL: 'https://ai.example.com/anthropic',
  apiKey: '<YOUR_API_KEY>',
});

const message = await client.messages.create({
  model: 'gemini-1.5-pro-002',
  max_tokens: 2048,
  messages: [{ role: 'user', content: 'Summarise this document.' }],
});

console.log(message.content[0].text);`,
              },
            ],
          },
          {
            label: 'Responses Endpoint',
            url: 'https://ai.example.com/openai/responses',
            snippets: [
              {
                language: CodeLanguage.Python,
                code: `from openai import OpenAI

client = OpenAI(
    base_url="https://ai.example.com/openai/responses",
    api_key="<YOUR_API_KEY>",
)

response = client.responses.create(
    model="gemini-1.5-pro-002",
    input="Summarise this document.",
)

print(response.output_text)`,
              },
              {
                language: CodeLanguage.Curl,
                code: `curl https://ai.example.com/openai/responses/v1/responses \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -d '{
    "model": "gemini-1.5-pro-002",
    "input": "Summarise this document."
  }'`,
              },
              {
                language: CodeLanguage.JavaScript,
                code: `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://ai.example.com/openai/responses',
  apiKey: '<YOUR_API_KEY>',
});

const response = await client.responses.create({
  model: 'gemini-1.5-pro-002',
  input: 'Summarise this document.',
});

console.log(response.output_text);`,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: 'dall-e-3',
    type: CatalogEntityType.Model,
    name: 'DALL·E 3',
    version: '3.0',
    lastUsed: 'Yesterday',
    updatedAt: Date.now() - 24 * 60 * 60 * 1000,
    iconUrl: avatar('DALL E', '10A37F'),
    description:
      'Generates realistic images and art from natural language descriptions.',
    folder: ['OpenAI', 'Image Models'],
    provider: 'OpenAI',
    topics: ['Image Generation', 'Creative'],
    isUserFavorite: false,
    summary: { tag: EntityTag.Beta },
    details: {
      overview: {
        sections: [
          {
            title: 'Capabilities',
            specs: [
              { label: 'Reasoning', value: false },
              { label: 'Instructions', value: true },
              { label: 'Tools', value: false },
              { label: 'Structured output', value: false },
            ],
          },
          {
            title: 'Specification',
            specs: [
              { label: 'Hosted by', value: 'Microsoft Azure' },
              { label: 'Input type', value: 'Text' },
              { label: 'Output type', value: 'Image' },
            ],
          },
        ],
      },
      pricing: {
        prices: [
          { label: 'Standard 1024×1024', price: '$0.040 / image' },
          { label: 'HD 1024×1024', price: '$0.080 / image' },
          { label: 'HD 1024×1792', price: '$0.120 / image' },
        ],
        limits: [
          { label: 'Daily limit', value: '200 images / user' },
          { label: 'Rate limit', value: '5 images / min' },
        ],
      },
      api: {
        resource: { modelId: 'dall-e-3' },
        endpoints: [
          {
            label: 'Azure OpenAI Endpoint',
            url: 'https://ai.example.com/azure/openai/deployments/dall-e-3',
            snippets: [
              {
                language: CodeLanguage.Python,
                code: `from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint="https://ai.example.com/azure/openai/deployments/dall-e-3",
    api_key="<YOUR_API_KEY>",
    api_version="2024-08-01-preview",
)

response = client.images.generate(
    model="dall-e-3",
    prompt="A futuristic city skyline at sunset, digital art",
    size="1024x1024",
    quality="hd",
    n=1,
)

print(response.data[0].url)`,
              },
              {
                language: CodeLanguage.Curl,
                code: `curl "https://ai.example.com/azure/openai/deployments/dall-e-3/images/generations?api-version=2024-08-01-preview" \\
  -H "Content-Type: application/json" \\
  -H "api-key: <YOUR_API_KEY>" \\
  -d '{
    "prompt": "A futuristic city skyline at sunset, digital art",
    "size": "1024x1024",
    "quality": "hd",
    "n": 1
  }'`,
              },
              {
                language: CodeLanguage.JavaScript,
                code: `import { AzureOpenAI } from 'openai';

const client = new AzureOpenAI({
  endpoint: 'https://ai.example.com/azure/openai/deployments/dall-e-3',
  apiKey: '<YOUR_API_KEY>',
  apiVersion: '2024-08-01-preview',
});

const response = await client.images.generate({
  model: 'dall-e-3',
  prompt: 'A futuristic city skyline at sunset, digital art',
  size: '1024x1024',
  quality: 'hd',
  n: 1,
});

console.log(response.data[0].url);`,
              },
            ],
          },
          {
            label: 'Anthropic Endpoint',
            url: 'https://ai.example.com/anthropic',
            snippets: [
              {
                language: CodeLanguage.Python,
                code: `import anthropic

client = anthropic.Anthropic(
    base_url="https://ai.example.com/anthropic",
    api_key="<YOUR_API_KEY>",
)

message = client.messages.create(
    model="dall-e-3",
    max_tokens=512,
    messages=[{
        "role": "user",
        "content": "Generate an image of a futuristic city skyline at sunset.",
    }],
)

print(message.content[0].text)`,
              },
              {
                language: CodeLanguage.Curl,
                code: `curl https://ai.example.com/anthropic/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: <YOUR_API_KEY>" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "dall-e-3",
    "max_tokens": 512,
    "messages": [{
      "role": "user",
      "content": "Generate an image of a futuristic city skyline at sunset."
    }]
  }'`,
              },
              {
                language: CodeLanguage.JavaScript,
                code: `import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  baseURL: 'https://ai.example.com/anthropic',
  apiKey: '<YOUR_API_KEY>',
});

const message = await client.messages.create({
  model: 'dall-e-3',
  max_tokens: 512,
  messages: [{
    role: 'user',
    content: 'Generate an image of a futuristic city skyline at sunset.',
  }],
});

console.log(message.content[0].text);`,
              },
            ],
          },
          {
            label: 'Responses Endpoint',
            url: 'https://ai.example.com/openai/responses',
            snippets: [
              {
                language: CodeLanguage.Python,
                code: `from openai import OpenAI

client = OpenAI(
    base_url="https://ai.example.com/openai/responses",
    api_key="<YOUR_API_KEY>",
)

response = client.responses.create(
    model="dall-e-3",
    input="Generate an image of a futuristic city skyline at sunset.",
)

print(response.output_text)`,
              },
              {
                language: CodeLanguage.Curl,
                code: `curl https://ai.example.com/openai/responses/v1/responses \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -d '{
    "model": "dall-e-3",
    "input": "Generate an image of a futuristic city skyline at sunset."
  }'`,
              },
              {
                language: CodeLanguage.JavaScript,
                code: `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://ai.example.com/openai/responses',
  apiKey: '<YOUR_API_KEY>',
});

const response = await client.responses.create({
  model: 'dall-e-3',
  input: 'Generate an image of a futuristic city skyline at sunset.',
});

console.log(response.output_text);`,
              },
            ],
          },
        ],
      },
    },
  },

  // ── Agents ────────────────────────────────────────────────────────────────
  {
    id: 'code-agent',
    type: CatalogEntityType.Agent,
    name: 'Code Agent',
    version: '1.2',
    lastUsed: '2 days ago',
    updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    iconUrl: avatar('Code Agent', '6366F1'),
    description:
      'An agent specialized in writing, reviewing, and debugging code across multiple languages.',
    folder: ['Agents'],
    topics: ['Code', 'Debugging', 'Review'],
    isUserFavorite: true,
    isStarred: true,
    details: {
      overview: {
        sections: [
          {
            title: 'Specification',
            specs: [
              { label: 'Domain', value: 'Engineering' },
              {
                label: 'Use case',
                value:
                  'Code generation, review, and debugging across multiple languages',
              },
              { label: 'Maturity', value: 'Production' },
              {
                label: 'Permissions',
                value: 'file:read · file:write · shell:execute',
              },
              {
                label: 'Skills',
                value:
                  'code-generation · test-writing · refactoring · bug-detection · documentation',
              },
            ],
          },
          {
            title: 'Configuration',
            specs: [
              { label: 'Base model', value: 'gpt-4o-2024-11-20' },
              {
                label: 'Input attachments',
                value:
                  'text/plain · application/typescript · application/python · text/javascript',
              },
              { label: 'Output attachments', value: 'text/plain' },
              { label: 'Authentication', value: 'API_KEY' },
            ],
          },
        ],
      },
      api: {
        resource: {
          modelId: 'code-agent-v1',
          endpointUrl: 'https://ai.example.com/openai/deployments/code-agent',
        },
        snippets: [
          {
            language: CodeLanguage.Python,
            code: `import openai

client = openai.OpenAI(
    base_url="https://ai.example.com/openai/deployments/code-agent",
    api_key="<YOUR_API_KEY>",
)

response = client.chat.completions.create(
    model="code-agent-v1",
    messages=[{
        "role": "user",
        "content": "Write a Python function that sorts a list of dicts by a given key."
    }],
)

print(response.choices[0].message.content)`,
          },
          {
            language: CodeLanguage.Curl,
            code: `curl https://ai.example.com/openai/deployments/code-agent/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -d '{
    "model": "code-agent-v1",
    "messages": [{
      "role": "user",
      "content": "Write a Python function that sorts a list of dicts by a given key."
    }]
  }'`,
          },
        ],
      },
    },
  },
  {
    id: 'research-agent',
    type: CatalogEntityType.Agent,
    name: 'Research Agent',
    version: '2.0',
    lastUsed: '5 days ago',
    updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    iconUrl: avatar('Research', '8B5CF6'),
    description:
      'Performs deep research by searching the web, reading sources, and synthesizing findings.',
    folder: ['Agents'],
    topics: ['Research', 'Web Search', 'Summarization'],
    isUserFavorite: false,
    details: {
      overview: {
        sections: [
          {
            title: 'Specification',
            specs: [
              { label: 'Domain', value: 'General' },
              {
                label: 'Use case',
                value:
                  'Deep web research, multi-source analysis, and synthesis into structured reports',
              },
              { label: 'Maturity', value: 'Beta' },
              { label: 'Permissions', value: 'web:search · url:read' },
              {
                label: 'Skills',
                value:
                  'web-search · source-reading · citation-generation · multi-source-synthesis',
              },
            ],
          },
          {
            title: 'Configuration',
            specs: [
              { label: 'Base model', value: 'claude-3-5-sonnet-20241022' },
              {
                label: 'Input attachments',
                value: 'application/pdf · text/plain · text/html',
              },
              { label: 'Output attachments', value: 'text/markdown' },
              { label: 'Authentication', value: 'API_KEY' },
            ],
          },
        ],
      },
      api: {
        resource: {
          modelId: 'research-agent-v2',
          endpointUrl:
            'https://ai.example.com/openai/deployments/research-agent',
        },
        snippets: [
          {
            language: CodeLanguage.Python,
            code: `import openai

client = openai.OpenAI(
    base_url="https://ai.example.com/openai/deployments/research-agent",
    api_key="<YOUR_API_KEY>",
)

response = client.chat.completions.create(
    model="research-agent-v2",
    messages=[{
        "role": "user",
        "content": "What are the latest developments in fusion energy?"
    }],
)

print(response.choices[0].message.content)`,
          },
          {
            language: CodeLanguage.Curl,
            code: `curl https://ai.example.com/openai/deployments/research-agent/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -d '{
    "model": "research-agent-v2",
    "messages": [{
      "role": "user",
      "content": "What are the latest developments in fusion energy?"
    }]
  }'`,
          },
        ],
      },
    },
  },

  // ── Toolsets ──────────────────────────────────────────────────────────────
  {
    id: 'web-search-toolset',
    type: CatalogEntityType.Toolset,
    name: 'Web Search',
    version: '2.1',
    lastUsed: '1 week ago',
    updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    iconUrl: avatar('Web Search', 'F59E0B'),
    description: 'Enables models to search the web for up-to-date information.',
    folder: ['Toolsets'],
    topics: ['Search', 'Web', 'Real-time'],
    isUserFavorite: false,
    details: {
      overview: {
        sections: [
          {
            title: 'Specification',
            specs: [
              { label: 'Provider', value: 'Bing Search API' },
              { label: 'Authentication', value: 'API_KEY' },
              { label: 'Permissions', value: 'web:search · news:search' },
            ],
          },
        ],
      },
      tools: {
        tools: [
          {
            name: 'web_search',
            description:
              'Search the web for recent information and return ranked results.',
            inputParams: [
              { name: 'query', type: 'string', isRequired: true },
              { name: 'num_results', type: 'integer', isRequired: false },
              { name: 'region', type: 'string', isRequired: false },
            ],
            annotations: [
              { key: 'readonlyHint', value: 'true' },
              { key: 'openWorldHint', value: 'true' },
            ],
          },
          {
            name: 'news_search',
            description: 'Search recent news articles filtered by date range.',
            inputParams: [
              { name: 'query', type: 'string', isRequired: true },
              { name: 'days_back', type: 'integer', isRequired: false },
              { name: 'num_results', type: 'integer', isRequired: false },
            ],
            annotations: [{ key: 'readonlyHint', value: 'true' }],
          },
        ],
      },
    },
  },
  {
    id: 'code-interpreter-toolset',
    type: CatalogEntityType.Toolset,
    name: 'Code Interpreter',
    version: '1.0',
    lastUsed: '2 weeks ago',
    updatedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    iconUrl: avatar('Code Interpreter', '3B82F6'),
    description:
      'Executes Python code in a sandboxed environment for data analysis and visualization.',
    folder: ['Toolsets'],
    topics: ['Code', 'Data Analysis', 'Python'],
    isUserFavorite: false,
    summary: { tag: EntityTag.Beta },
    details: {
      overview: {
        sections: [
          {
            title: 'Specification',
            specs: [
              { label: 'Provider', value: 'Sandbox Engine v3' },
              { label: 'Authentication', value: 'NONE' },
              {
                label: 'Permissions',
                value: 'code:execute · file:read · file:write · network:none',
              },
            ],
          },
        ],
      },
      tools: {
        tools: [
          {
            name: 'execute_python',
            description:
              'Execute a Python code snippet in a sandboxed environment and return stdout/stderr.',
            inputParams: [
              { name: 'code', type: 'string', isRequired: true },
              { name: 'timeout_seconds', type: 'integer', isRequired: false },
            ],
            annotations: [{ key: 'destructiveHint', value: 'false' }],
          },
          {
            name: 'upload_file',
            description:
              'Upload a file into the sandbox for the current session.',
            inputParams: [
              { name: 'filename', type: 'string', isRequired: true },
              { name: 'content_base64', type: 'string', isRequired: true },
            ],
          },
          {
            name: 'download_file',
            description:
              'Download a file produced by code execution as base64.',
            inputParams: [
              { name: 'filename', type: 'string', isRequired: true },
            ],
            annotations: [{ key: 'readonlyHint', value: 'true' }],
          },
        ],
      },
    },
  },

  // ── Guardrails ────────────────────────────────────────────────────────────
  {
    id: 'pii-guardrail',
    type: CatalogEntityType.Guardrail,
    name: 'PII Filter',
    version: '1.3',
    lastUsed: '3 days ago',
    updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    iconUrl: avatar('PII Filter', 'EF4444'),
    description:
      'Detects and redacts personally identifiable information in model inputs and outputs.',
    folder: ['Guardrails'],
    topics: ['Security', 'Privacy', 'Compliance'],
    isUserFavorite: false,
    details: {
      overview: {
        sections: [
          {
            title: 'Specification',
            specs: [
              { label: 'Stage', value: 'BOTH' },
              { label: 'Type', value: 'PII_REDACTION' },
              {
                label: 'Checks',
                value:
                  'names · email-addresses · phone-numbers · ssn · credit-cards · ip-addresses · dates-of-birth · medical-records',
              },
              { label: 'Action on match', value: 'REDACT' },
              { label: 'Sensitivity', value: 'HIGH' },
              { label: 'Compliance', value: 'GDPR · HIPAA · CCPA' },
              { label: 'Applies to', value: 'chat-input · chat-output' },
              { label: 'Failure mode', value: 'FAIL_CLOSED' },
              { label: 'Logging', value: true },
            ],
          },
        ],
      },
    },
  },

  // ── Skills ────────────────────────────────────────────────────────────────
  {
    id: 'summarization-skill',
    type: CatalogEntityType.Skill,
    name: 'Document Summarizer',
    version: '1.0',
    lastUsed: '4 days ago',
    updatedAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
    iconUrl: avatar('Summarize', '06B6D4'),
    description:
      'Summarizes long documents into concise bullet-point or paragraph form.',
    folder: ['Skills'],
    topics: ['Summarization', 'Documents'],
    isUserFavorite: false,
    summary: { tag: EntityTag.Free },
    details: {
      overview: {
        sections: [
          {
            title: 'Specification',
            specs: [
              {
                label: 'Allowed tools',
                value: 'document-read · summarize · key-quotes',
              },
              {
                label: 'Bundled resources',
                value: 'summary-prompts.yaml · output-formats.json',
              },
            ],
          },
          {
            title: 'Context',
            specs: [
              {
                label: 'Skill prompt',
                value:
                  'You are an expert document summarizer. Produce concise, accurate summaries that preserve key information. Support bullet-point, paragraph, and executive formats. Extract key quotes on request.',
              },
            ],
          },
        ],
      },
    },
  },
];
