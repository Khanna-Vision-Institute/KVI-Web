/**
 * Physician portal — Cognito/sign-in DISABLED (`requirePortalSignIn` + `requireReferralSignIn` false).
 * Auth snippets are removed from hub / referral / scheduler HTML by default (see npm sync script).
 *
 * Optional: legacy Cognito gated mode — restore auth scripts + set both flags appropriately.
 */
(function attachPortalAuthConfig(globalScope) {
  globalScope.KVI_PORTAL_AUTH = {
    bundleVersion: '20260701-public',
    region: 'us-east-1',

    /** Ignored while login is disabled */
    userPoolId: '',
    clientId: 'DISABLED',

    /** `/me` not used — leave empty unless re-enabling Cognito */
    apiBaseUrl: '',

    /** Public portal — no overlays, no session checks */
    requirePortalSignIn: false,
    requireReferralSignIn: false,

    profileTitle: 'Dr.',
    personalizePortal: false,
    personalizedUrlHash: false,

    signInPath: '/Doctorportal/auth/sign-in.html',

    /** Only used if Cognito is re-enabled and `/me` returns 401 */
    keepSessionTokensOnMe401: false,
  };
})(typeof window !== 'undefined' ? window : globalThis);
