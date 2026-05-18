import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ScannerService } from './scanner.service';
import { ScannerController } from './scanner.controller';

@Module({
  imports: [PrismaModule],
  providers: [ScannerService],
  controllers: [ScannerController]
})
export class ScannerModule {}
