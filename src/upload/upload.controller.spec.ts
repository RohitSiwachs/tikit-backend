import { Test, TestingModule } from '@nestjs/testing';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

const mockUploadService = {
  generatePresignedUrl: jest.fn(),
};

describe('UploadController', () => {
  let controller: UploadController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [{ provide: UploadService, useValue: mockUploadService }],
    }).compile();

    controller = module.get<UploadController>(UploadController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getPresignedUrl should delegate to UploadService', async () => {
    const dto = { fileName: 'photo.jpg', fileType: 'image/jpeg', folder: 'avatars' };
    const response = { uploadUrl: 'https://s3.example.com/upload', fileUrl: 'https://s3.example.com/photo.jpg', key: 'avatars/uuid-photo.jpg' };
    mockUploadService.generatePresignedUrl.mockResolvedValue(response);

    const result = await controller.getPresignedUrl(dto as any);

    expect(mockUploadService.generatePresignedUrl).toHaveBeenCalledWith(dto);
    expect(result).toEqual(response);
  });
});
