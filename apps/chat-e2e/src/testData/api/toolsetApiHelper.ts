import { BackendEntity } from '@/chat/types/common';
import { API } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { BucketUtil, ItemUtil, toolsetNamePrefix } from '@/src/utils';
import { Toolset } from '@epam/ai-dial-shared';

export class ToolsetApiHelper extends BaseApiHelper {
  public async createToolset(toolsetModel: Toolset) {
    const url = `${API.toolsetCreateHost()}/${this.userBucket ?? BucketUtil.getBucket()}/${toolsetModel.display_name}${ItemUtil.entityIdSeparator}${toolsetModel.display_version}`;
    const response = await this.request.post(
      this.getHost(ItemUtil.getEncodedItemId(url)),
      {
        data: toolsetModel,
      },
    );
    this.apiAssertion.assertResponseCode(
      response,
      toolsetModel.display_name,
      200,
    );
    return (await response.json()) as BackendEntity;
  }

  public async listToolsets() {
    const response = await this.request.get(this.getHost(API.toolsetsHost()));
    this.apiAssertion.assertResponseCode(response, undefined, 200);
    const toolsets = await response.json();
    return toolsets.data as Toolset[];
  }

  public async deleteAllToolsets() {
    const allToolsets = await this.listToolsets();
    const e2eToolsets = Object.values(allToolsets).filter((toolset) =>
      toolset.display_name
        .toLowerCase()
        .includes(toolsetNamePrefix.toLowerCase()),
    );
    for (const toolset of e2eToolsets) {
      await this.deleteToolset(toolset);
    }
  }

  public async deleteToolset(toolset: Toolset) {
    const path = `${API.api}/${toolset.id}`;
    const response = await this.request.delete(this.getHost(path));
    this.apiAssertion.assertResponseCode(response, toolset.display_name, 200);
  }
}
