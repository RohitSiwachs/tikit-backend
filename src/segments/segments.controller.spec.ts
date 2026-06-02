import { Test, TestingModule } from '@nestjs/testing';
import { SegmentsController } from './segments.controller';
import { SegmentsService } from './segments.service';

const mockSegmentsService = {
  create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), remove: jest.fn(),
};

describe('SegmentsController', () => {
  let controller: SegmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SegmentsController],
      providers: [{ provide: SegmentsService, useValue: mockSegmentsService }],
    }).compile();

    controller = module.get<SegmentsController>(SegmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
