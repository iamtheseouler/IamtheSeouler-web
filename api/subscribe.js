/* Hand an email address to beehiiv.
 *
 * The browser never sees the API key. It talks to this function on our own
 * domain; the function is the only thing that knows the key, and it lives in
 * Vercel's environment variables, never in the repository.
 *
 * Env: BEEHIIV_API_KEY (secret), BEEHIIV_PUBLICATION_ID
 */

const PUB = process.env.BEEHIIV_PUBLICATION_ID;
const KEY = process.env.BEEHIIV_API_KEY;

// A deliberately plain check. The browser already refuses a malformed address;
// this is here so a hand-made request can't put junk in the list.
const looksLikeEmail = (s) =>
  typeof s === "string" && s.length < 255 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method" });
  }
  if (!PUB || !KEY) {
    console.error("subscribe: BEEHIIV_PUBLICATION_ID or BEEHIIV_API_KEY is missing");
    return res.status(500).json({ ok: false, error: "server" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const email = (body && body.email ? String(body.email) : "").trim().toLowerCase();

  if (!looksLikeEmail(email)) {
    return res.status(400).json({ ok: false, error: "email" });
  }

  try {
    const r = await fetch(
      `https://api.beehiiv.com/v2/publications/${PUB}/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          // Confirm by email before counting anyone. A smaller list that is
          // real, rather than a larger one full of typos and other people's
          // addresses — which is what gets a sender marked as spam.
          double_opt_override: "on",
          // Someone who unsubscribed once should not be pulled back in by
          // filling the form again; let them come back through beehiiv.
          reactivate_existing: false,
          send_welcome_email: false,
          utm_source: "iamtheseouler.com",
          utm_medium: "website",
          referring_site: "https://www.iamtheseouler.com"
        })
      }
    );

    const data = await r.json().catch(() => ({}));

    if (r.ok) {
      // status is "validating" until they click the link in the email.
      const status = data && data.data ? data.data.status : "";
      return res.status(200).json({ ok: true, status });
    }

    // Already on the list is not a failure the reader needs to see as one.
    const msg = JSON.stringify(data).toLowerCase();
    if (r.status === 400 && (msg.includes("already") || msg.includes("exists"))) {
      return res.status(200).json({ ok: true, status: "existing" });
    }

    console.error("subscribe: beehiiv responded", r.status, msg.slice(0, 300));
    return res.status(502).json({ ok: false, error: "upstream" });
  } catch (err) {
    console.error("subscribe: request failed", err && err.message);
    return res.status(502).json({ ok: false, error: "upstream" });
  }
};
