import { Test, TestingModule } from '@nestjs/testing';
import { VouchersController } from './vouchers.controller';
import { VouchersService } from './vouchers.service';

const mockVouchersService = {
  createVoucher: jest.fn(),
  redeemVoucher: jest.fn(),
  getVouchers: jest.fn(),
  getVoucher: jest.fn(),
};

describe('VouchersController', () => {
  let controller: VouchersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VouchersController],
      providers: [{ provide: VouchersService, useValue: mockVouchersService }],
    }).compile();

    controller = module.get<VouchersController>(VouchersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
