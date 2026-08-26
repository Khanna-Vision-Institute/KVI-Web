const path = require('path');
const dotenv = require('dotenv');
const zohoService = require('./services/zohoService');

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function setup() {
  console.log('\n=== Zoho CRM Setup Guide ===\n');

  if (!process.env.ZOHO_CLIENT_ID) {
    console.log('Add ZOHO_CLIENT_ID to your .env file before running this script.');
    return;
  }

  const authorizeUrl = `${process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com'}/oauth/v2/auth?scope=ZohoCRM.modules.ALL&client_id=${process.env.ZOHO_CLIENT_ID}&response_type=code&access_type=offline&redirect_uri=http://localhost:3000/api/vision-quest/oauth/callback`;

  console.log('Step 1: Visit this URL in your browser and authorize the application:\n');
  console.log(authorizeUrl + '\n');
  console.log('Step 2: After authorizing, copy the code parameter from the redirect URL.');
  console.log('Step 3: Paste the code into this script when prompted to generate the refresh token.\n');

  if (!process.stdin.isTTY) {
    console.log('Run this script from a terminal to finish generating the refresh token.');
    return;
  }

  process.stdout.write('Enter the authorization code: ');
  process.stdin.on('data', async (data) => {
    const grantToken = data.toString().trim();

    if (!grantToken) {
      console.log('No authorization code entered. Exiting.');
      process.exit(0);
    }

    try {
      await zohoService.generateRefreshToken(grantToken);
      console.log('\nRefresh token generated successfully. Update your .env file and restart the server.');
    } catch (error) {
      console.error('\nFailed to generate refresh token:', error.message);
    } finally {
      process.exit(0);
    }
  });
}

setup();
