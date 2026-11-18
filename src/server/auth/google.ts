import "server-only";

const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

export const googleProvider =
  clientId && clientSecret
    ? { clientId, clientSecret, prompt: "select_account" as const }
    : undefined;

export const googleSignInEnabled = Boolean(googleProvider);
