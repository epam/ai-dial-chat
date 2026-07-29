import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FooterController } from './footer.controller';
import { FooterService } from './footer.service';

@Module({
  imports: [AuthModule],
  controllers: [FooterController],
  providers: [FooterService],
})
export class FooterModule {}
