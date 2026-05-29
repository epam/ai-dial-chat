import {
  DEFAULT_QUICK_APPS_MODEL,
  DEFAULT_QUICK_APPS_SCHEMA_2_ID,
  DialDeploymentToolsetToolTypes,
  ToolsetTypes,
} from '@/chat/constants/quick-apps';
import { ApiTypeSchemaApplication } from '@/chat/types/applications';
import { DialAIEntityFeatures } from '@/chat/types/models';
import {
  DialAppTransportType,
  DialDeploymentToolset,
  QuickApp2Config,
} from '@/chat/types/quick-apps';
import { ApplicationBuilderBase } from '@/src/testData/applications/applicationBuilderBase';
import { ItemUtil } from '@/src/utils';

// Builds a Quick App 2.0 API payload. Items go into tool_sets the same way the
// chat form does: model → dial-deployment tool, app → dial-app, toolset → dial-mcp.
export class QuickApp2Builder extends ApplicationBuilderBase<ApiTypeSchemaApplication> {
  protected reset(): ApiTypeSchemaApplication {
    super.reset();
    this.application.features = {
      assistant_attachments_in_request_supported: true,
    } as unknown as DialAIEntityFeatures;
    this.application.application_type_schema_id =
      DEFAULT_QUICK_APPS_SCHEMA_2_ID;
    this.application.application_properties =
      this.getDefaultConfig() as unknown as ApiTypeSchemaApplication['application_properties'];
    return this.application;
  }

  // No conversation_starters when there are none — same as the chat form.
  private getDefaultConfig(): Omit<QuickApp2Config, 'conversation_starters'> {
    return {
      orchestrator: {
        deployment: { deployment_id: DEFAULT_QUICK_APPS_MODEL },
        system_prompt: { type: 'custom', variables: {}, content: '' },
      },
      contexts: [],
      tool_sets: [
        {
          name: 'dial-deployment-tool-set',
          type: ToolsetTypes.DialDeployment,
          tools: [],
        },
      ],
      features: { timestamp: null },
    };
  }

  private get config(): QuickApp2Config {
    return this.application
      .application_properties as unknown as QuickApp2Config;
  }

  private get deploymentToolset(): DialDeploymentToolset {
    return this.config.tool_sets.find(
      (toolset) => toolset.type === ToolsetTypes.DialDeployment,
    ) as DialDeploymentToolset;
  }

  withOrchestratorModel(modelId: string): this {
    this.config.orchestrator.deployment.deployment_id = modelId;
    return this;
  }

  withInstructions(instructions: string): this {
    this.config.orchestrator.system_prompt.content = instructions;
    return this;
  }

  addModel(modelId: string): this {
    this.deploymentToolset.tools.push({
      type: DialDeploymentToolsetToolTypes.DialDeploymentSimple,
      deployment_id: ItemUtil.getEncodedItemId(modelId),
    });
    return this;
  }

  addApp(app: { id: string; name: string }): this {
    this.config.tool_sets.unshift({
      name: app.name,
      type: ToolsetTypes.DialApp,
      deployment_id: ItemUtil.getEncodedItemId(app.id),
      transport: DialAppTransportType.MCP,
    });
    return this;
  }

  addToolset(toolsetId: string): this {
    this.config.tool_sets.unshift({
      type: ToolsetTypes.DialMcp,
      deployment_id: ItemUtil.getEncodedItemId(toolsetId),
    });
    return this;
  }

  withCodeInterpreter(): this {
    this.config.tool_sets.push({
      template_name: 'py_interpreter',
      type: ToolsetTypes.CodeInterpreter,
    });
    return this;
  }
}
