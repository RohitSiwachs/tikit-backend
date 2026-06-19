import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';
import s3Config from '../config/s3.config';

const mockS3Config = {
  region: 'auto',
  endpoint: 'https://test-account.r2.cloudflarestorage.com',
  accessKeyId: 'test-key',
  secretAccessKey: 'test-secret',
  bucket: 'tikit-media',
  publicUrl: 'https://media.example.com',
};

// Mock the entire AWS SDK presigner so tests don't make network calls
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue('https://r2.example.com/presigned-url'),
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

      expect(result.upload_url).toBe('https://r2.example.com/presigned-url');
      expect(result.file_url).toContain('media.example.com');
      expect(result.key).toMatch(/^avatars\/.+-photo\.jpg$/);
    });

    it('uses "uploads" as default folder when none is provided', async () => {
      const result = await service.generatePresignedUrl({
        filename: 'doc.pdf',
        content_type: 'application/pdf',
      });

      expect(result.key).toMatch(/^uploads\//);
    });

    it('falls back to endpoint-based URL when publicUrl is not set', async () => {
      // Create a service instance without publicUrl
      const moduleNoPublic: TestingModule = await Test.createTestingModule({
        providers: [
          UploadService,
          {
            provide: s3Config.KEY,
            useValue: { ...mockS3Config, publicUrl: '' },
          },
        ],
      }).compile();

      const svcNoPublic = moduleNoPublic.get<UploadService>(UploadService);
      const result = await svcNoPublic.generatePresignedUrl({
        filename: 'file.txt',
        content_type: 'text/plain',
      });

      expect(result.file_url).toContain('r2.cloudflarestorage.com');
      expect(result.file_url).toContain('tikit-media');
    });
  });
});
