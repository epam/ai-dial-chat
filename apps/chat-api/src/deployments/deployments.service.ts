import { Injectable } from '@nestjs/common';
import { AppService } from '../app/app.service';
import { handleDialError } from '../common/utils/dial-error';

@Injectable()
export class DeploymentsService extends AppService {
  async getDeployments() {
    try {
      return await this.client.getDeployments();
    } catch (error) {
      return handleDialError(error);
    }
  }

  async getDeployment(name: string) {
    try {
      return await this.client.getDeployment(name);
    } catch (error) {
      return handleDialError(error);
    }
  }
}
