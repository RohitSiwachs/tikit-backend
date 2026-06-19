import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import s3Config from '../config/s3.config';
import { ALLOWED_MIME_TYPES } from './dto/upload.dto';

// Server-side Set for O(1) lookup — DTO @IsIn already rejects bad types at the
// controller boundary; this guard is defence-in-depth for direct service calls.
const ALLOWED_MIME_SET = new Set<string>(ALLOWED_MIME_TYPES);

@Injectable()
export class UploadService {
  private readonly s3: S3Client;

  constructor(
    @Inject(s3Config.KEY)
    private readonly s3Conf: ConfigType<typeof s3Config>,
  ) {
    this.s3 = new S3Client({
      region: s3Conf.region,
      endpoint: s3Conf.endpoint,
      credentials: {
        accessKeyId: s3Conf.accessKeyId,
        secretAccessKey: s3Conf.secretAccessKey,
      },
    });
  }

  async generatePresignedUrl(dto: {
    filename: string;
    content_type: string;
    folder?: string;
  }) {
    if (!ALLOWED_MIME_SET.has(dto.content_type)) {
      throw new BadRequestException(
        `Unsupported content_type "${dto.content_type}". Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    const key = `${dto.folder || 'uploads'}/${randomUUID()}-${dto.filename}`;

    const command = new PutObjectCommand({
      Bucket: this.s3Conf.bucket,
      Key: key,
      ContentType: dto.content_type,
    });

    const upload_url = await getSignedUrl(this.s3, command, { expiresIn: 600 });
    const file_url = this.s3Conf.publicUrl
      ? `${this.s3Conf.publicUrl}/${key}`
      : `${this.s3Conf.endpoint}/${this.s3Conf.bucket}/${key}`;

    return { upload_url, file_url, key };
  }
}
