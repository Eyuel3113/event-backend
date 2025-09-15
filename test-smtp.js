 // test-smtp.js
const nodemailer = require('nodemailer');
const config = require('./config/env');

async function testSMTP() {
  console.log('Testing SMTP configuration...');
  console.log('Host:', config.smtp.host);
  console.log('Port:', config.smtp.port);
  console.log('User:', config.smtp.user);
  console.log('Using secure connection:', config.smtp.port === 465 || config.smtp.port === 587);

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465, // true for 465, false for other ports
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,   // 10 seconds
      socketTimeout: 10000      // 10 seconds
    });

    console.log('\n1. Testing connection verification...');
    await transporter.verify();
    console.log('✓ SMTP connection verified successfully!');

    console.log('\n2. Testing email sending...');
    const info = await transporter.sendMail({
      from: `"Test" <${config.smtp.user}>`,
      to: 'test@example.com',
      subject: 'SMTP Configuration Test',
      text: 'This is a test email to verify your SMTP configuration is working correctly.',
      html: '<p>This is a test email to verify your SMTP configuration is working correctly.</p>'
    });

    console.log('✓ Test email sent successfully!');
    console.log('Message ID:', info.messageId);

  } catch (error) {
    console.error('\n✗ SMTP test failed:');
    console.error('Error:', error.message);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    if (error.command) {
      console.error('Failed command:', error.command);
    }
    
    // Provide specific troubleshooting advice based on the error
    provideTroubleshootingTips(error);
  }
}

function provideTroubleshootingTips(error) {
  console.log('\n=== TROUBLESHOOTING TIPS ===');
  
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
    console.log('1. Check your SMTP host and port are correct');
    console.log('2. Verify your firewall allows outbound connections on port', config.smtp.port);
    console.log('3. Try telnet to test connectivity:');
    console.log(`   telnet ${config.smtp.host} ${config.smtp.port}`);
    console.log('4. Check if your network allows SMTP connections');
  }
  
  if (error.code === 'EAUTH') {
    console.log('1. Verify your username and password are correct');
    console.log('2. For Gmail, make sure you enabled 2FA and use an app password');
    console.log('3. Check if your account allows less secure apps (if using Gmail)');
  }
  
  console.log('5. Try different SMTP ports: 465 (SSL), 587 (TLS), or 25');
  console.log('6. Consider using a different SMTP service like:');
  console.log('   - Mailgun (smtp.mailgun.org:587)');
  console.log('   - SendGrid (smtp.sendgrid.net:587)');
  console.log('   - Amazon SES');
  console.log('7. For development, you can use Ethereal.email for testing:');
  console.log('   https://ethereal.email/');
}

testSMTP();