import { Module } from '@nestjs/common';
import { ClassifiedsController } from './classifieds.controller';
import { ClassifiedsService } from './classifieds.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ClassifiedsController],
  providers: [ClassifiedsService],
})
export class ClassifiedsModule {}
