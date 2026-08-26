#!/usr/bin/env node
/**
 * Lists Zoho Bookings workspace + service IDs for .env setup.
 *
 *   node scripts/zoho-bookings-list-ids.js
 *   ZOHO_BOOKINGS_WORKSPACE_ID=4942730000000040008 node scripts/zoho-bookings-list-ids.js
 *
 * Requires ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN with scope:
 *   zohobookings.data.READ (and CREATE for live bookings)
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const zohoBookings = require('../services/zohoBookingsService');

async function main() {
  const workspaceId = String(process.env.ZOHO_BOOKINGS_WORKSPACE_ID || '').trim();

  console.log('--- Zoho Bookings workspaces ---');
  const ws = await zohoBookings.fetchWorkspaces();
  console.log(JSON.stringify(ws, null, 2));

  const data =
    ws &&
    ws.response &&
    ws.response.returnvalue &&
    ws.response.returnvalue.data;
  const firstId =
    workspaceId ||
    (Array.isArray(data) && data[0] && data[0].id ? data[0].id : '');

  if (!firstId) {
    console.log('\nNo workspace_id found. Set ZOHO_BOOKINGS_WORKSPACE_ID in .env and re-run.');
    process.exit(1);
  }

  console.log('\n--- Services for workspace', firstId, '---');
  const services = await zohoBookings.fetchServices(firstId);
  console.log(JSON.stringify(services, null, 2));

  console.log('\n--- Example ZOHO_BOOKINGS_SERVICE_MAP ---');
  const example = {
    sources: {
      main: { service_id: 'PASTE_SERVICE_ID', staff_id: 'PASTE_STAFF_ID' },
      widget: { service_id: 'PASTE_SERVICE_ID', staff_id: 'PASTE_STAFF_ID' },
      smile: { service_id: 'PASTE_SERVICE_ID', staff_id: 'PASTE_STAFF_ID' },
      'doctor-portal': { service_id: 'PASTE_SERVICE_ID', staff_id: 'PASTE_STAFF_ID' }
    },
    locations: {
      'Beverly Hills': { service_id: 'PASTE_SERVICE_ID', staff_id: 'PASTE_STAFF_ID' },
      'Westlake Village': { service_id: 'PASTE_SERVICE_ID', staff_id: 'PASTE_STAFF_ID' },
      default: { service_id: 'PASTE_SERVICE_ID', staff_id: 'PASTE_STAFF_ID' }
    }
  };
  console.log(JSON.stringify(example, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
