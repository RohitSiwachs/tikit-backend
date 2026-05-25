import { Injectable, Inject } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ConfigType } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import s3Config from '../config/s3.config';

@Injectable()
export class UploadService {
  private readonly s3: S3Client;

  constructor(
    @Inject(s3Config.KEY)
    private readonly s3Conf: ConfigType<typeof s3Config>,
  ) {
    this.s3 = new S3Client({
      region: s3Conf.region,
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
    const key = `${dto.folder || 'uploads'}/${uuid()}-${dto.filename}`;

    const command = new PutObjectCommand({
      Bucket: this.s3Conf.bucket,
      Key: key,
      ContentType: dto.content_type,
    });

    const upload_url = await getSignedUrl(this.s3, command, { expiresIn: 600 });
    const file_url = `https://${this.s3Conf.bucket}.s3.${this.s3Conf.region}.amazonaws.com/${key}`;

    return { upload_url, file_url, key };
  }
}
