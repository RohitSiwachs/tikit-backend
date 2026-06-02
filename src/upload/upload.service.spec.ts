import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';
import s3Config from '../config/s3.config';

const mockS3Config = {
  region: 'eu-north-1',
  accessKeyId: 'test-key',
  secretAccessKey: 'test-secret',
  bucket: 'test-bucket',
};

// Mock the entire AWS SDK presigner so tests don't make network calls
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
}));

describe('UploadService', () => {
  let service: UploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: s3Config.KEY, useValue: mockS3Config },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generatePresignedUrl', () => {
    it('returns upload_url, file_url, and key', async () => {
      const result = await service.generatePresignedUrl({
        filename: 'photo.jpg',
        content_type: 'image/jpeg',
        folder: 'avatars',
      });

      expect(result.upload_url).toBe('https://s3.example.com/presigned-url');
      expect(result.file_url).toContain('test-bucket');
      expect(result.file_url).toContain('eu-north-1');
      expect(result.key).toMatch(/^avatars\/.+-photo\.jpg$/);
    });

    it('uses "uploads" as default folder when none is provided', async () => {
      const result = await service.generatePresignedUrl({
        filename: 'doc.pdf',
        content_type: 'application/pdf',
      });

      expect(result.key).toMatch(/^uploads\//);
    });
  });
});
