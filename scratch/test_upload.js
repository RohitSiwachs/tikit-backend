const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const region = process.env.AWS_REGION || 'eu-north-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';
const bucket = process.env.AWS_S3_BUCKET || 'tikit-uploads';

console.log('Using config:', { region, accessKeyId: accessKeyId ? 'EXISTS' : 'EMPTY', secretAccessKey: secretAccessKey ? 'EXISTS' : 'EMPTY', bucket });

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function run() {
  const key = `uploads/test-${Date.now()}.png`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: 'image/png',
  });

  try {
    const upload_url = await getSignedUrl(s3, command, { expiresIn: 600 });
    const file_url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    console.log('SUCCESS generating pre-signed URL!');
    console.log('Upload URL:', upload_url);
    console.log('File URL:', file_url);

    // Let's test the upload URL with a real HTTP request!
    console.log('\nTesting upload to S3 using the URL...');
    const response = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/png',
      },
      body: Buffer.from('dummy-image-content'),
    });

    console.log('HTTP Status:', response.status);
    const bodyText = await response.text();
    if (response.ok) {
      console.log('Upload to S3 succeeded!');
    } else {
      console.log('Upload to S3 failed!');
      console.log('S3 Error Response:', bodyText);
    }
  } catch (error) {
    console.error('FAILED!', error);
  }
}

run();
