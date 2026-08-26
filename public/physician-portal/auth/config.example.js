(function attachPortalAuthConfig(globalScope) {
  globalScope.KVI_PORTAL_AUTH = {
    bundleVersion: '20260701-public',

    region: 'us-east-1',
    /** CloudFormation PhysicianUserPoolId — only needed if gating enabled */
    userPoolId: 'us-east-1_REPLACE_ME',
    /** PhysicianUserPoolClientId — only if gating enabled */
    clientId: 'REPLACE_CLIENT_ID',

    apiBaseUrl: '/api/physician-portal',

    requirePortalSignIn: false,
    requireReferralSignIn: false,

    profileTitle: 'Dr.',
    personalizePortal: true,
    personalizedUrlHash: true,

    signInPath: '/Doctorportal/auth/sign-in.html',
    keepSessionTokensOnMe401: false,
  };
})(typeof window !== 'undefined' ? window : globalThis);
