/**
 * Quick standalone test — sends a real SMS via HelloSMS.se
 * Run: node scratch/test-hellosms.mjs
 */

const HELLOSMS_USERNAME = 't77ygpmez8O8l347489tv8p2';
const HELLOSMS_PASSWORD = 'Y7UpLJeRYGAjyVyjA5ys';
const TO = '+46735000551';
const MESSAGE = 'Hello! This is a test message from TiKit SMS API. 🎉';

const auth = Buffer.from(`${HELLOSMS_USERNAME}:${HELLOSMS_PASSWORD}`).toString('base64');

console.log('📤 Sending SMS via HelloSMS.se...');
console.log(`   To: ${TO}`);
console.log(`   Message: ${MESSAGE}`);
console.log('');

try {
  const response = await fetch('https://api.hellosms.se/v1/sms/send/', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TiKit',
      to: TO,
      message: MESSAGE,
    }),
  });

  const data = await response.json();

  if (response.ok && data.status === 'success') {
    console.log('✅ SMS sent successfully!');
    console.log('   Response:', JSON.stringify(data, null, 2));
  } else {
    console.error('❌ SMS send failed!');
    console.error(`   HTTP Status: ${response.status}`);
    console.error('   Response:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
} catch (err) {
  console.error('💥 Request error:', err.message);
  process.exit(1);
}
