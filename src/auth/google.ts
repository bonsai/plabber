const CREDENTIALS_PATH = "credentials.json";
const TOKEN_PATH = "token.json";
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const TOKEN_URI = "https://oauth2.googleapis.com/token";

interface Credentials {
  installed?: { client_id: string; client_secret: string; redirect_uris: string[] };
  web?: { client_id: string; client_secret: string; redirect_uris: string[] };
}

interface Token {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
}

function getClientInfo(credentials: Credentials) {
  const info = credentials.installed ?? credentials.web;
  if (!info) throw new Error("No installed or web client in credentials.json");
  return info;
}

export async function loadCredentials(path = CREDENTIALS_PATH): Promise<Credentials> {
  const text = await Bun.file(path).text();
  return JSON.parse(text) as Credentials;
}

export async function loadToken(path = TOKEN_PATH): Promise<Token | null> {
  try {
    const text = await Bun.file(path).text();
    return JSON.parse(text) as Token;
  } catch {
    return null;
  }
}

export async function saveToken(token: Token, path = TOKEN_PATH): Promise<void> {
  const dir = path.substring(0, path.lastIndexOf("/"));
  if (dir) {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
  }
  await Bun.write(path, JSON.stringify(token, null, 2));
}

export function getAuthUrl(credentials: Credentials): string {
  const { client_id, redirect_uris } = getClientInfo(credentials);
  const redirectUri = redirect_uris?.[0] ?? "http://localhost";
  const params = new URLSearchParams({
    client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/auth?${params}`;
}

export async function exchangeCode(credentials: Credentials, code: string, redirectUri?: string): Promise<Token> {
  const { client_id, client_secret, redirect_uris } = getClientInfo(credentials);
  const uri = redirectUri ?? redirect_uris?.[0] ?? "http://localhost";

  const body = new URLSearchParams({
    code,
    client_id,
    client_secret,
    redirect_uri: uri,
    grant_type: "authorization_code",
  });

  const res = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const data = await res.json() as Record<string, unknown>;

  return {
    access_token: data.access_token as string,
    refresh_token: data.refresh_token as string,
    expiry_date: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
}

export async function refreshAccessToken(credentials: Credentials, token: Token): Promise<Token> {
  const { client_id, client_secret } = getClientInfo(credentials);

  const body = new URLSearchParams({
    client_id,
    client_secret,
    refresh_token: token.refresh_token!,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const data = await res.json() as Record<string, unknown>;

  return {
    ...token,
    access_token: data.access_token as string,
    expiry_date: Date.now() + (data.expires_in as number) * 1000,
  };
}

export async function getValidToken(credentials: Credentials, token: Token): Promise<string> {
  if (token.expiry_date && Date.now() < token.expiry_date - 60000 && token.access_token) {
    return token.access_token;
  }
  const refreshed = await refreshAccessToken(credentials, token);
  await saveToken(refreshed);
  return refreshed.access_token!;
}

export async function promptForCode(): Promise<string> {
  console.log("Paste the authorization code: ");
  const buffer = new Uint8Array(4096);
  const n = await Bun.stdin.read(buffer);
  return new TextDecoder().decode(buffer.subarray(0, n ?? 0)).trim();
}

export async function authenticate(
  credentialsPath = CREDENTIALS_PATH,
  tokenPath = TOKEN_PATH,
): Promise<string> {
  const credentials = await loadCredentials(credentialsPath);
  let token = await loadToken(tokenPath);

  if (!token?.refresh_token) {
    const url = getAuthUrl(credentials);
    console.log("\nOpen this URL in your browser:");
    console.log(url);
    console.log();

    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        if (code) {
          server.stop();
          return new Response("Authorized! Close this tab.");
        }
        return new Response("Not found", { status: 404 });
      },
    });
    console.log(`Or use: http://localhost:${server.port}`);

    const code = await promptForCode();
    server.stop();

    token = await exchangeCode(credentials, code);
    await saveToken(token!, tokenPath);
    console.log("Token saved.");
  }

  return await getValidToken(credentials, token!);
}

export async function downloadDriveFile(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive API error ${res.status}: ${await res.text()}`);
  return await res.text();
}
