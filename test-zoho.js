const path = require('path');
const dotenv = require('dotenv');
const zohoService = require('./services/zohoService');

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function testZohoIntegration() {
  console.log('\n🧪 Testing Zoho CRM Integration...\n');

  try {
    console.log('Test 1: Retrieving access token...');
    const token = await zohoService.getAccessToken();
    console.log('✅ Access token obtained. Sample:', token ? `${token.substring(0, 20)}...` : 'N/A');

    console.log('\nTest 2: Creating test lead...');
    const testLead = {
      firstName: 'Test',
      lastName: 'User',
      email: `test_${Date.now()}@example.com`,
      phone: '555-0123',
      visionType: 'Nearsighted',
      selectedDate: new Date().toDateString(),
      selectedTime: '10:00 AM',
      totalXP: 575,
      tier: 'Gold',
      walletAmount: 500,
      completionTime: '180 seconds',
      company: 'Vision Quest Test'
    };

    const result = await zohoService.createLead(testLead);
    const leadId = result?.data?.[0]?.details?.id;

    if (leadId) {
      console.log('✅ Test lead created. Lead ID:', leadId);
    } else {
      console.warn('⚠️ Lead creation response did not include an ID. Inspect full response:', result);
    }

    console.log('\nTest 3: Searching for the test lead by email...');
    const foundLeads = await zohoService.searchLeadByEmail(testLead.email);
    console.log(`✅ Leads found: ${foundLeads.length}`);
    if (foundLeads.length > 0) {
      console.log('Lead Name:', `${foundLeads[0].First_Name || ''} ${foundLeads[0].Last_Name || ''}`.trim());
    }

    console.log('\n🎉 All tests completed. Check your Zoho CRM Leads module to confirm the records.\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nTroubleshooting tips:');
    console.error('1. Verify ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN are set correctly.');
    console.error('2. Confirm the refresh token is active and not revoked.');
    console.error('3. Ensure the API domain matches your Zoho data center.');
    console.error('4. Check whether the OAuth scopes include ZohoCRM.modules.ALL.');
  }
}

testZohoIntegration();
