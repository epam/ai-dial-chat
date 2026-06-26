import type {
  CatalogItemApiDetails,
  CatalogItemPricing,
  CatalogItemTabData,
  CodeSnippet,
  OverviewSection,
} from '@epam/ai-dial-catalog';
import { CodeLanguage } from '@epam/ai-dial-catalog';
import type {
  AgentEntityDetails,
  EntitySpecificDetails,
  GuardrailEntityDetails,
  ModelEntityDetails,
  ModelPricing,
  SkillEntityDetails,
  ToolsetEntityDetails,
} from '../types/entity-details';

const formatTokens = (n: number): string =>
  n >= 1_000_000
    ? `${n / 1_000_000}M tokens`
    : n >= 1_000
      ? `${n / 1_000}K tokens`
      : `${n} tokens`;

const mapModelDetails = (data: ModelEntityDetails): CatalogItemTabData => {
  const sections: OverviewSection[] = [];

  if (data.capabilities != null) {
    const { capabilities: c } = data;
    sections.push({
      title: 'Capabilities',
      specs: [
        { label: 'Chat', value: c.hasChat },
        { label: 'Reasoning', value: c.hasReasoning },
        { label: 'Generation', value: c.hasGeneration },
        { label: 'Knowledge', value: c.hasKnowledge },
        { label: 'Instructions', value: c.hasInstructions },
        { label: 'Context', value: c.hasContext },
        { label: 'Multimodal', value: c.hasMultimodal },
        { label: 'Tools', value: c.hasTools },
        { label: 'Structured output', value: c.hasStructuredOutput },
      ],
    });
  }

  if (data.specification != null) {
    const { specification: s } = data;
    const specs: OverviewSection['specs'] = [];

    if (s.contextWindowTokens != null)
      specs.push({
        label: 'Context window',
        value: formatTokens(s.contextWindowTokens),
      });
    if (s.maxOutputTokens != null)
      specs.push({
        label: 'Max output tokens',
        value: formatTokens(s.maxOutputTokens),
      });
    if (s.inputTypes?.length)
      specs.push({ label: 'Input type', value: s.inputTypes.join(' · ') });
    if (s.outputTypes?.length)
      specs.push({ label: 'Output type', value: s.outputTypes.join(' · ') });
    if (s.languages?.length)
      specs.push({ label: 'Languages', value: s.languages.join(' · ') });
    if (s.availability != null)
      specs.push({ label: 'Availability', value: s.availability });
    if (s.hasSystemPrompt != null)
      specs.push({ label: 'System prompt', value: s.hasSystemPrompt });
    if (s.hasTools != null) specs.push({ label: 'Tools', value: s.hasTools });
    if (s.hasTemperature != null)
      specs.push({ label: 'Temperature supported', value: s.hasTemperature });
    if (s.hasSeed != null) specs.push({ label: 'Seed', value: s.hasSeed });
    if (s.hasUrlAttachments != null)
      specs.push({ label: 'URL attachments', value: s.hasUrlAttachments });
    if (s.hasFolderAttachments != null)
      specs.push({
        label: 'Folder attachments',
        value: s.hasFolderAttachments,
      });
    if (s.hasAssistantAttachments != null)
      specs.push({
        label: 'Assistant attachments in request',
        value: s.hasAssistantAttachments,
      });

    if (specs.length > 0) sections.push({ title: 'Specification', specs });
  }

  const pricing = mapModelPricing(data.pricing);
  const api = mapModelApi(data);

  return {
    overview: sections.length > 0 ? { sections } : undefined,
    pricing,
    api,
  };
};

const mapModelPricing = (
  pricing: ModelPricing | undefined,
): CatalogItemPricing | undefined => {
  if (pricing == null) return undefined;

  const prices = [
    pricing.inputTokensPrice != null && {
      label: 'Input tokens',
      price: pricing.inputTokensPrice,
    },
    pricing.outputTokensPrice != null && {
      label: 'Output tokens',
      price: pricing.outputTokensPrice,
    },
    pricing.cachedInputPrice != null && {
      label: 'Cached input',
      price: pricing.cachedInputPrice,
    },
    pricing.batchPrice != null && {
      label: 'Batch / async',
      price: pricing.batchPrice,
    },
  ].filter(Boolean) as CatalogItemPricing['prices'];

  const limits = [
    pricing.dailyLimit != null && {
      label: 'Daily limit',
      value: pricing.dailyLimit,
    },
    pricing.weeklyLimit != null && {
      label: 'Weekly limit',
      value: pricing.weeklyLimit,
    },
    pricing.monthlyLimit != null && {
      label: 'Monthly limit',
      value: pricing.monthlyLimit,
    },
  ].filter(Boolean) as CatalogItemPricing['limits'];

  if (!prices?.length && !limits?.length) return undefined;
  return { prices, limits };
};

const mapModelApi = (
  data: ModelEntityDetails,
): CatalogItemApiDetails | undefined => {
  const { api } = data;
  if (api == null) return undefined;

  const snippets: CodeSnippet[] = [];
  if (api.pythonSnippet != null)
    snippets.push({ language: CodeLanguage.Python, code: api.pythonSnippet });
  if (api.curlSnippet != null)
    snippets.push({ language: CodeLanguage.Curl, code: api.curlSnippet });
  if (api.jsSnippet != null)
    snippets.push({ language: CodeLanguage.JavaScript, code: api.jsSnippet });

  const resource =
    api.modelId != null || api.endpointUrl != null
      ? { modelId: api.modelId, endpointUrl: api.endpointUrl }
      : undefined;

  if (resource == null && snippets.length === 0) return undefined;
  return { resource, snippets: snippets.length > 0 ? snippets : undefined };
};

const mapAgentDetails = (data: AgentEntityDetails): CatalogItemTabData => {
  const sections: OverviewSection[] = [];

  if (data.specification != null) {
    const { specification: s } = data;
    const specs: OverviewSection['specs'] = [];

    if (s.domain != null) specs.push({ label: 'Domain', value: s.domain });
    if (s.useCase != null) specs.push({ label: 'Use case', value: s.useCase });
    if (s.maturity != null)
      specs.push({ label: 'Maturity', value: s.maturity });
    if (s.permissions?.length)
      specs.push({ label: 'Permissions', value: s.permissions.join(' · ') });
    if (s.skills?.length)
      specs.push({ label: 'Skills', value: s.skills.join(' · ') });

    if (specs.length > 0) sections.push({ title: 'Specification', specs });
  }

  if (data.configuration != null) {
    const { configuration: c } = data;
    const specs: OverviewSection['specs'] = [];

    if (c.baseModelId != null)
      specs.push({ label: 'Base model', value: c.baseModelId });
    if (c.inputAttachmentTypes?.length)
      specs.push({
        label: 'Input attachments',
        value: c.inputAttachmentTypes.join(' · '),
      });
    if (c.outputAttachmentTypes?.length)
      specs.push({
        label: 'Output attachments',
        value: c.outputAttachmentTypes.join(' · '),
      });
    if (c.authentication != null)
      specs.push({ label: 'Authentication', value: c.authentication });

    if (specs.length > 0) sections.push({ title: 'Configuration', specs });
  }

  if (data.capabilityLinks?.length) {
    sections.push({
      title: 'References',
      specs: data.capabilityLinks.map((ref) => ({
        label: ref.id,
        value: ref.label,
      })),
    });
  }

  const api: CatalogItemApiDetails | undefined =
    data.api != null
      ? {
          resource:
            data.api.endpointUrl != null
              ? { endpointUrl: data.api.endpointUrl }
              : undefined,
          requestExample: data.api.requestExample,
          responseSchema: data.api.responseSchema,
        }
      : undefined;

  return {
    overview: sections.length > 0 ? { sections } : undefined,
    api,
  };
};

const mapToolsetDetails = (data: ToolsetEntityDetails): CatalogItemTabData => {
  const sections: OverviewSection[] = [];

  if (data.specification != null) {
    const { specification: s } = data;
    const specs: OverviewSection['specs'] = [];

    if (s.provider != null)
      specs.push({ label: 'Provider', value: s.provider });
    if (s.authentication != null)
      specs.push({ label: 'Authentication', value: s.authentication });
    if (s.permissions?.length)
      specs.push({ label: 'Permissions', value: s.permissions.join(' · ') });

    if (specs.length > 0) sections.push({ title: 'Specification', specs });
  }

  return {
    overview: sections.length > 0 ? { sections } : undefined,
  };
};

const mapGuardrailDetails = (
  data: GuardrailEntityDetails,
): CatalogItemTabData => {
  const sections: OverviewSection[] = [];

  if (data.specification != null) {
    const { specification: s } = data;
    const specs: OverviewSection['specs'] = [];

    if (s.stage != null) specs.push({ label: 'Stage', value: s.stage });
    if (s.type != null) specs.push({ label: 'Type', value: s.type });
    if (s.checks?.length)
      specs.push({ label: 'Checks', value: s.checks.join(' · ') });
    if (s.actionOnMatch != null)
      specs.push({ label: 'Action on match', value: s.actionOnMatch });
    if (s.sensitivity != null)
      specs.push({ label: 'Sensitivity', value: s.sensitivity });
    if (s.compliance?.length)
      specs.push({ label: 'Compliance', value: s.compliance.join(' · ') });
    if (s.appliesTo?.length)
      specs.push({ label: 'Applies to', value: s.appliesTo.join(' · ') });
    if (s.failureMode != null)
      specs.push({ label: 'Failure mode', value: s.failureMode });
    if (s.hasLogging != null)
      specs.push({ label: 'Logging', value: s.hasLogging });

    if (specs.length > 0) sections.push({ title: 'Specification', specs });
  }

  return {
    overview: sections.length > 0 ? { sections } : undefined,
  };
};

const mapSkillDetails = (data: SkillEntityDetails): CatalogItemTabData => {
  const sections: OverviewSection[] = [];

  if (data.about != null) {
    const { about: a } = data;
    const specs: OverviewSection['specs'] = [];

    if (a.allowedTools?.length)
      specs.push({ label: 'Allowed tools', value: a.allowedTools.join(' · ') });
    if (a.bundledResources?.length)
      specs.push({
        label: 'Bundled resources',
        value: a.bundledResources.join(' · '),
      });

    if (specs.length > 0) sections.push({ title: 'Specification', specs });

    if (a.skillPrompt != null) {
      sections.push({
        title: 'Context',
        specs: [{ label: 'Skill prompt', value: a.skillPrompt }],
      });
    }
  }

  return {
    overview: sections.length > 0 ? { sections } : undefined,
  };
};

/** Converts a strongly-typed entity domain model into the lib's `CatalogItemTabData` shape. */
export const mapEntityDetailsToCatalogDetails = (
  details: EntitySpecificDetails,
): CatalogItemTabData => {
  switch (details.type) {
    case 'MODEL':
      return mapModelDetails(details.data);
    case 'AGENT':
      return mapAgentDetails(details.data);
    case 'TOOLSET':
      return mapToolsetDetails(details.data);
    case 'GUARDRAIL':
      return mapGuardrailDetails(details.data);
    case 'SKILL':
      return mapSkillDetails(details.data);
  }
};
