const BASE_URL = 'https://tikit-backend.onrender.com';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ZDc5NjcwNC1jODVkLTRkN2YtOGM1MS05OTFmNWIzMmVjZjkiLCJlbWFpbCI6InRlbXBhZG1pbjJAdGlraXQuc2UiLCJyb2xlIjoiVElLSVRfQURNSU4iLCJzY2hvb2xJZCI6IjIzOTY1YjdjLTU1OTYtNGM1NC1hMjM3LWI0Y2JiMTAzMTdjYSIsImlhdCI6MTc4MDY4Mzc0MCwiZXhwIjoxNzgzMjc1NzQwfQ.RHfQIQlNmkWU_HeTYud0qpW881Ajv3kHBej7zR-6KMsTU2WSqCJCi5hUbqVpn06-G2dc0NSHCjXlNjeQ1X6aMArJcMsijCs_M2pCcjMFbPspIItrXECdvPS6zrQN8YD23CeApdNGePl4u_R7NlM0iXfqOrmLCi_6piE9rXJwTWT90ADDO3snho8fMmSQgXV0eVTRF9M35j9EAVt0lMgTrVwDKlyJ6gfjXPSEYHWoyjlDMi7ajLk-VGgYrlPRmXikPc5l037CExs7_R3AyhuR6SKrQjq8KGDT1MzlItg43-UrK1-1OHFnWsxYn8HBlCn6GrGwTAIUbRpM-EdO8wY60w';

async function main() {
  // 1. Fetch all schools
  const res = await fetch(`${BASE_URL}/v1/schools?limit=50`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const { data: schools } = await res.json();

  console.log(`Found ${schools.length} schools. Updating deep links...\n`);

  for (const school of schools) {
    const deepLink = `${BASE_URL}/v1/join/${school.schoolCode}`;

    const updateRes = await fetch(`${BASE_URL}/v1/schools/${school.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ deepLink }),
    });

    if (updateRes.ok) {
      console.log(`✅ ${school.name} (${school.schoolCode})`);
      console.log(`   Deep Link: ${deepLink}\n`);
    } else {
      const err = await updateRes.text();
      console.log(`❌ ${school.name}: ${err}\n`);
    }
  }

  console.log('Done!');
}

main().catch(console.error);
