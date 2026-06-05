/**
 * Test script: uploads a sample image (PNG) and a sample PDF to Cloudflare R2.
 * Uses credentials from .env via dotenv.
 */

require('dotenv').config();
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  ListBucketsCommand,
} = require('@aws-sdk/client-s3');

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ENDPOINT =
  process.env.R2_ENDPOINT ||
  `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const BUCKET = process.env.R2_BUCKET_NAME || 'tikit-media';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

const s3 = new S3Client({
  region: 'auto',
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// ── helpers ────────────────────────────────────────────────────
/** Create a tiny 1×1 red PNG (67 bytes) */
function createTinyPng() {
  // Minimal valid PNG: 1×1 pixel, RGBA red
  const hex =
    '89504e470d0a1a0a' + // PNG signature
    '0000000d49484452' + // IHDR chunk length + type
    '00000001000000010802000000907753de' + // 1x1 RGB
    '0000000c4944415408d76360f8cf0000000201014898c4ee' + // IDAT
    '0000000049454e44ae426082'; // IEND
  return Buffer.from(hex, 'hex');
}

/** Create a minimal valid PDF (~200 bytes) */
function createTinyPdf() {
  const content = `%PDF-1.0
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj

xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 

trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF`;
  return Buffer.from(content, 'utf-8');
}

// ── main ───────────────────────────────────────────────────────
async function main() {
  console.log('=== R2 Upload Test ===');
  console.log('Endpoint :', ENDPOINT);
  console.log('Bucket   :', BUCKET);
  console.log('Public   :', PUBLIC_URL || '(not set)');
  console.log();

  // 1. Verify connectivity
  console.log('1) Listing buckets...');
  const { Buckets } = await s3.send(new ListBucketsCommand({}));
  console.log(
    '   Buckets found:',
    (Buckets || []).map((b) => b.Name).join(', ') || '(none)',
  );
  console.log();

  // 2. Upload image
  const imageKey = `test-uploads/test-image-${Date.now()}.png`;
  const imageBody = createTinyPng();
  console.log(`2) Uploading PNG image → ${imageKey}  (${imageBody.length} bytes)`);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: imageKey,
      Body: imageBody,
      ContentType: 'image/png',
    }),
  );
  console.log('   ✅ Image uploaded successfully!');

  // Verify it exists
  const imgHead = await s3.send(
    new HeadObjectCommand({ Bucket: BUCKET, Key: imageKey }),
  );
  console.log(
    `   Verified: size=${imgHead.ContentLength}, type=${imgHead.ContentType}`,
  );
  const imageUrl = PUBLIC_URL
    ? `${PUBLIC_URL}/${imageKey}`
    : `${ENDPOINT}/${BUCKET}/${imageKey}`;
  console.log('   Public URL:', imageUrl);
  console.log();

  // 3. Upload PDF
  const pdfKey = `test-uploads/test-document-${Date.now()}.pdf`;
  const pdfBody = createTinyPdf();
  console.log(`3) Uploading PDF → ${pdfKey}  (${pdfBody.length} bytes)`);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: pdfKey,
      Body: pdfBody,
      ContentType: 'application/pdf',
    }),
  );
  console.log('   ✅ PDF uploaded successfully!');

  // Verify it exists
  const pdfHead = await s3.send(
    new HeadObjectCommand({ Bucket: BUCKET, Key: pdfKey }),
  );
  console.log(
    `   Verified: size=${pdfHead.ContentLength}, type=${pdfHead.ContentType}`,
  );
  const pdfUrl = PUBLIC_URL
    ? `${PUBLIC_URL}/${pdfKey}`
    : `${ENDPOINT}/${BUCKET}/${pdfKey}`;
  console.log('   Public URL:', pdfUrl);
  console.log();

  // Summary
  console.log('=== SUMMARY ===');
  console.log('Image key :', imageKey);
  console.log('Image URL :', imageUrl);
  console.log('PDF key   :', pdfKey);
  console.log('PDF URL   :', pdfUrl);
  console.log();
  console.log('Both files uploaded and verified on Cloudflare R2! 🎉');
}

main().catch((err) => {
  console.error('❌ Upload failed:', err.message);
  if (err.$metadata) console.error('   HTTP status:', err.$metadata.httpStatusCode);
  process.exit(1);
});
