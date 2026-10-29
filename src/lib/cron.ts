// Vercel sends "Authorization: Bearer <CRON_SECRET>" with each scheduled call. Anything else is refused.
export function authorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
