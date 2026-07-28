const crypto = require('crypto');

async function testMasterOtp() {
  try {
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const email = `testuser_${randomSuffix}@example.com`;
    const username = `testuser_${randomSuffix}`;

    console.log(`1. Registering new user: ${email}...`);
    const regRes = await fetch('http://localhost:3000/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        username,
        password: 'Password123!',
        displayName: 'Test User',
        firstName: 'Test',
        lastName: 'User'
      })
    });
    const regData = await regRes.json();
    if (!regRes.ok) {
      console.error('Registration failed:', regData);
      return;
    }
    const userId = regData.id;
    console.log(`User created with ID: ${userId}`);

    console.log(`\n2. Sending OTP for user...`);
    const sendOtpRes = await fetch('http://localhost:3000/v1/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, phone: '+1234567890' })
    });
    const sendOtpData = await sendOtpRes.json();
    console.log('Send OTP Response:', sendOtpData);

    console.log(`\n3. Verifying OTP with Master OTP '12345'...`);
    const verifyOtpRes = await fetch('http://localhost:3000/v1/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, otpCode: '12345' })
    });
    const verifyOtpData = await verifyOtpRes.json();
    
    if (verifyOtpRes.ok) {
      console.log('✅ OTP Verification SUCCESS! Response:', verifyOtpData);
    } else {
      console.error('❌ OTP Verification FAILED:', verifyOtpData);
    }

  } catch (error) {
    console.error('Test error:', error);
  }
}

testMasterOtp();
