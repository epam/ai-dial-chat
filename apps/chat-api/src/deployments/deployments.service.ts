import { Injectable, Logger } from '@nestjs/common';
import { AppService } from '../app/app.service';
import { handleDialError } from '../common/utils/dial-error';

@Injectable()
export class DeploymentsService extends AppService {
  protected logger = new Logger(DeploymentsService.name);

  async getDeployments() {
    try {
      return await this.client.getDeployments();
    } catch (error) {
      this.logger.error('DIAL Core rejected getDeployments', error);
      return handleDialError(error);
    }
  }

  async getDeployment(name: string) {
    try {
      return await this.client.getDeployment(name);
    } catch (error) {
      this.logger.error('DIAL Core rejected getDeployment', error);
      return handleDialError(error);
    }
  }
}
