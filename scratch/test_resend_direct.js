const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder_key');

async function sendTestEmail() {
  console.log('Sending test Card Assignment email to rohitsiwachs1999@gmail.com...');
  
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eaeaea;border-radius:5px;">
      <h2 style="color:#6c5ce7;">Hej Rohit Siwach! ðŸ’³</h2>
      <p>You have been assigned the <strong>Premium Student Pass</strong>.</p>
      <div style="background:#f9f9f9;padding:15px;border-radius:5px;margin:20px 0;border-left:4px solid #6c5ce7;">
        <p style="margin:0;font-size:14px;color:#555;">Your Card Code:</p>
        <h3 style="margin:8px 0 0;color:#333;letter-spacing:2px;">X9F2</h3>
      </div>
      <p>You can claim this card inside the TiKit app by entering the code in your Wallet.</p>
      <hr style="border:0;border-top:1px solid #eaeaea;margin:20px 0;"/>
      <p style="font-size:12px;color:#999;">The TiKit Team</p>
    </div>
  `;

  try {
    const result = await resend.emails.send({
      from: 'TiKit <onboarding@tikit.se>',
      to: 'gouravbishnoi429@gmail.com',
      subject: 'You received a new card: Premium Student Pass ðŸ’³',
      html,
    });
    
    if (result.error) {
      console.error('Error sending email:', result.error);
    } else {
      console.log('âœ… Email sent successfully! ID:', result.data.id);
    }
  } catch (error) {
    console.error('Crash while sending email:', error);
  }
}

sendTestEmail();

