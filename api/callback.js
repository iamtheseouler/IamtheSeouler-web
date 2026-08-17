/*  Step 2 of the /admin login.

    GitHub sends the visitor back here with a short-lived `code`. We swap that
    for an access token using the client secret — which only ever exists on the
    server — and hand the token to the CMS window that opened the popup.

    The token is never written to a cookie or a URL; it is passed once, by
    postMessage, to a window we have confirmed is on our own origin.          */

const ALLOWED_ORIGINS = [
  "https://iamtheseouler.com",
  "https://www.iamtheseouler.com"
];

function readCookie(header, name) {
  return (header || "")
    .split(";")
    .map((part) => part.trim().split("="))
    .filter(([key]) => key === name)
    .map(([, value]) => value)[0];
}

function page(script) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Signing in…</title></head><body><p style="font-family:system-ui;padding:2rem">${script.message}</p><script>${script.code}</script></body></html>`;
}

module.exports = async (req, res) => {
  const url = new URL(req.url, "https://placeholder.local");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(req.headers.cookie, "seouler_oauth_state");

  // Burn the state cookie whatever happens next.
  res.setHeader(
    "Set-Cookie",
    "seouler_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
  );
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const fail = (reason) => {
    res.status(400).send(
      page({
        message: `로그인에 실패했습니다: ${reason}`,
        code: `if (window.opener) { window.opener.postMessage('authorization:github:error:${JSON.stringify(
          { message: reason }
        ).replace(/'/g, "")}', '*'); }`
      })
    );
  };

  if (!code || !state) return fail("GitHub 응답에 필요한 값이 없습니다.");
  if (!expectedState || state !== expectedState)
    return fail("보안 확인에 실패했습니다. 다시 시도해 주세요.");

  let token;
  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      })
    });
    const data = await response.json();
    if (data.error || !data.access_token)
      return fail(data.error_description || data.error || "토큰을 받지 못했습니다.");
    token = data.access_token;
  } catch (error) {
    return fail("GitHub 에 연결하지 못했습니다.");
  }

  const payload = JSON.stringify({ token, provider: "github" });

  res.status(200).send(
    page({
      message: "로그인되었습니다. 이 창은 곧 닫힙니다.",
      code: `
(function () {
  var allowed = ${JSON.stringify(ALLOWED_ORIGINS)};
  var payload = 'authorization:github:success:' + ${JSON.stringify(payload)};
  function reply(event) {
    if (allowed.indexOf(event.origin) === -1) return;
    window.removeEventListener('message', reply, false);
    window.opener.postMessage(payload, event.origin);
    setTimeout(function () { window.close(); }, 500);
  }
  window.addEventListener('message', reply, false);
  if (window.opener) {
    allowed.forEach(function (origin) {
      window.opener.postMessage('authorizing:github', origin);
    });
  }
})();`
    })
  );
};
