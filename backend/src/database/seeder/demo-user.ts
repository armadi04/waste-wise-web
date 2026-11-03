const DEFAULT_DEMO_EMAIL = 'user@smart-waste.local';
const DEFAULT_DEMO_PASSWORD = 'DemoUser123!';

/**
 * Demo credentials are dev/test only. Staging and production must opt in
 * explicitly with DEMO_USER_EMAIL and DEMO_USER_PASSWORD.
 */
export function resolveDemoUser(
  env: Record<string, string | undefined>,
): { email: string; password: string } | null {
  const email = env.DEMO_USER_EMAIL;
  const password = env.DEMO_USER_PASSWORD;
  if (email && password) return { email, password };

  const allowDefaults =
    env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
  if (!allowDefaults) return null;

  return {
    email: email || DEFAULT_DEMO_EMAIL,
    password: password || DEFAULT_DEMO_PASSWORD,
  };
}
