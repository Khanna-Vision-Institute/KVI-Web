Physician portal Cognito helpers (not overwritten by npm run sync:physician-portal).

1. Copy config:
   cp config.example.js config.js
2. Fill Cognito + API values from CloudFormation outputs (see infra/physician-portal-auth/README.md).
3. Upload this entire auth/ directory with your EC2 static deploy.

sign-in.html uses ./config.js — keep them together.
