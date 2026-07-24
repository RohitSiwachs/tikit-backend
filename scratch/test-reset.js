async function testForgotPassword() {
  try {
    const res = await fetch('http://localhost:3000/v1/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'testshool2@yopmail.com' })
    });

    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testForgotPassword();
