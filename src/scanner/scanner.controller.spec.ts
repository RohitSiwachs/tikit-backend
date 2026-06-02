import { Test, TestingModule } from '@nestjs/testing';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';

const mockScannerService = { scan: jest.fn() };

describe('ScannerController', () => {
  let controller: ScannerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScannerController],
      providers: [{ provide: ScannerService, useValue: mockScannerService }],
    }).compile();

    controller = module.get<ScannerController>(ScannerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
