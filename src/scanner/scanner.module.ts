import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';
import { ScannerService } from './scanner.service';
import { ScannerController } from './scanner.controller';

@Module({
  imports: [PrismaModule, GatewayModule],
  providers: [ScannerService],
  controllers: [ScannerController],
})
export class ScannerModule {}
