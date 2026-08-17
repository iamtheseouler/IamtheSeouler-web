const crypto = require("crypto");

/*  Step 1 of the /admin login.

    The CMS opens this in a popup. We hand the visitor to GitHub with a random
    `state` value, and keep a copy of that value in a short-lived cookie so
    /api/callback can confirm the response came back from the same attempt.  */

module.exports = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    res.status(500).send("GITHUB_CLIENT_ID is not set on this deployment.");
    return;
  }

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const redirectUri = `${proto}://${host}/api/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  res.setHeader(
    "Set-Cookie",
    `seouler_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    // The repository is public, so the narrow scope is enough. `repo` would
    // also hand this token every private repository on the account.
    scope: "public_repo",
    state
  });

  res.writeHead(302, {
    Location: `https://github.com/login/oauth/authorize?${params}`
  });
  res.end();
};
