/** Realistic sample KPIs for demo until live APIs are wired */

function mockAnalyticsSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    searchConsole: {
      topQueries: [
        { query: 'smile lasik los angeles', clicks: 142, impressions: 4200, ctr: 0.034, position: 8.2 },
        { query: 'evo icl beverly hills', clicks: 89, impressions: 1900, ctr: 0.047, position: 6.1 },
        { query: 'keratoconus treatment', clicks: 76, impressions: 3100, ctr: 0.024, position: 11.4 },
        { query: 'lasik vs smile', clicks: 64, impressions: 2800, ctr: 0.023, position: 9.8 },
      ],
      lowCtrPages: [
        { page: '/procedures/laser-vision/smile-laser', ctr: 0.018, impressions: 5200 },
        { page: '/procedures/lens-solutions/evo-icl', ctr: 0.021, impressions: 3100 },
      ],
    },
    ga4: {
      landingPages: [
        { path: '/procedures/laser-vision/smile-laser', sessions: 1840, conversions: 42 },
        { path: '/vip-consult', sessions: 920, conversions: 38 },
        { path: '/procedures/lens-solutions/evo-icl', sessions: 610, conversions: 19 },
      ],
    },
    ads: {
      google: { spend: 4280, clicks: 612, leads: 28, cpl: 152.86 },
      meta: { spend: 2150, leads: 45, booked: 11, quality: 'mixed' },
    },
    zoho: {
      newLeads7d: 86,
      topSources: ['Website Booking', 'SMILE Landing', 'Physician Referral'],
      leadsByStatus: [
        { status: 'New Leads', count: 12 },
        { status: 'Consult Done', count: 48 },
      ],
      leadSources: [
        { source: 'Website Booking', count: 34 },
        { source: 'SMILE Landing', count: 28 },
      ],
    },
  };
}

module.exports = { mockAnalyticsSnapshot };
