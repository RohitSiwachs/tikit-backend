const http = require('http');

const payload = JSON.stringify({
  title: "demo event 4",
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
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log("Sending local HTTP request to create event...");

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

req.write(payload);
req.end();
