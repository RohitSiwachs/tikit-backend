const crypto = require('crypto');

// Load environment variables from .env
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let value = trimmed.substring(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

// Convert escaped \n characters back to actual newlines
const privateKey = process.env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
const publicKey = process.env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');

console.log("Private Key Length:", privateKey.length);
console.log("Public Key Length:", publicKey.length);

// Generate RS256 JWT
function signToken(payload, privateKey) {
  const header = { alg: "RS256", typ: "JWT" };
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const sign = crypto.createSign('SHA256');
  sign.update(`${base64Header}.${base64Payload}`);
  const signature = sign.sign(privateKey, 'base64url');
  
  return `${base64Header}.${base64Payload}.${signature}`;
}

const payload = {
  sub: "test-user-id-123",
  email: "admin@tikit.app",
  role: "TIKIT_ADMIN",
  schoolId: "1d138eb6-bafe-4a86-bfb6-98e57d9a12c9",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiration
};

const token = signToken(payload, privateKey);
console.log("\n🔑 GENERATED AUTH TOKEN:");
console.log(token);

// Test HTTP Post with token
const http = require('http');
const requestPayload = JSON.stringify({
  title: "demo event 4 (local auth test)",
  description: "demo description",
  eventType: "INTERNAL",
  schoolId: "1d138eb6-bafe-4a86-bfb6-98e57d9a12c9",
  startsAt: "2026-07-21T20:00:00.000Z",
  endsAt: "2026-07-21T22:00:00.000Z",
  externalBuyUrl: "demo event 4",
  ticketTypes: [
    {
      name: "demo_tikit-4",
      description: "demo_tikit-4 is the tikit for the demo event",
      price: 7000,
      quantityTotal: 15
    }
  ]
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/v1/events',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Content-Length': Buffer.byteLength(requestPayload)
  }
};

console.log("\nSending authenticated HTTP request to local server...");

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`\nResponse Status: ${res.statusCode}`);
    console.log("Response Body:", data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(requestPayload);
req.end();
