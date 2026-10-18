// Test-only credentials for the dev user (AUTH_DEV_LOGIN=1, never production).
export const DEV_USER_EMAIL = "dev@sleevebook.local";
export const DEV_USER_PASSWORD = process.env.E2E_DEV_PASSWORD ?? "sleevebook-dev-e2e";
