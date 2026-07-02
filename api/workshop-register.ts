import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/workshop-register
 *
 * Body: { email: string, first_name?: string, phone?: string }
 *
 * Registers someone for the "Own a Machine, Not a Job" workshop:
 *   1. Subscribes them to the Margin Theory Beehiiv publication with
 *      utm_campaign = "own-a-machine-workshop" (no newsletter welcome email;
 *      the workshop automation sends the confirmation instead).
 *   2. If WORKSHOP_AUTOMATION_ID is set, force-enrolls them into that
 *      automation journey so EXISTING subscribers also get the confirmation
 *      (signup-triggered automations skip people already on the list).
 *
 * Required Vercel env vars (already set for /api/subscribe):
 *   BEEHIIV_API_KEY         - publication-scoped API key
 *   BEEHIIV_PUBLICATION_ID  - the pub_xxxxx id
 *
 * Optional:
 *   WORKSHOP_AUTOMATION_ID  - aut_xxxxx id of the registration-confirmation
 *                             automation. Set it once the automation exists.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;

  if (!apiKey || !pubId) {
    console.error('workshop-register: missing BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID');
    return res.status(500).json({ error: 'Registration is not configured.' });
  }

  let email: string | undefined;
  let firstName = '';
  let phone = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    email = body?.email?.trim().toLowerCase();
    firstName = (body?.first_name || '').trim().slice(0, 80);
    phone = (body?.phone || '').trim().slice(0, 32);
  } catch {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const customFields: { name: string; value: string }[] = [];
  if (firstName) customFields.push({ name: 'First Name', value: firstName });
  if (phone) customFields.push({ name: 'Phone', value: phone });

  try {
    const r = await fetch(
      `https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          email,
          reactivate_existing: true,
          send_welcome_email: false,
          utm_source: 'workshop-landing',
          utm_medium: 'landing-page',
          utm_campaign: 'own-a-machine-workshop',
          referring_site: 'https://margintheory.co/workshop',
          ...(customFields.length ? { custom_fields: customFields } : {}),
        }),
      }
    );

    if (!r.ok) {
      const detail = await r.text();
      console.error(`workshop-register: beehiiv ${r.status}: ${detail}`);
      return res.status(502).json({
        error: 'Something went wrong on our end. Try again or email jake@margintheory.co.',
      });
    }

    // Force-enroll into the confirmation automation so existing subscribers
    // get the confirmation too. Non-fatal if it fails.
    const automationId = process.env.WORKSHOP_AUTOMATION_ID;
    if (automationId) {
      try {
        const j = await fetch(
          `https://api.beehiiv.com/v2/publications/${pubId}/automations/${automationId}/journeys`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ email, double_opt_override: 'on' }),
          }
        );
        if (!j.ok) {
          console.error(`workshop-register: journey enroll ${j.status}: ${await j.text()}`);
        }
      } catch (err) {
        console.error('workshop-register: journey enroll network error', err);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('workshop-register: network error', err);
    return res.status(502).json({
      error: 'Something went wrong on our end. Try again or email jake@margintheory.co.',
    });
  }
}
