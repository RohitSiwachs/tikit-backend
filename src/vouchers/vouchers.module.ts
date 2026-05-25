import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';

@Module({
  imports: [PrismaModule],
  providers: [VouchersService],
  controllers: [VouchersController],
})
export class VouchersModule {}
