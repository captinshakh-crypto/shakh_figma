import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const SITE_URL = "https://daim-post.online";
const DEFAULT_FROM = "SHAKH <notifications@daim-post.online>";

type AuthUser = {
  email?: string | null;
  new_email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type AuthEmailData = {
  token?: string;
  token_hash?: string;
  redirect_to?: string;
  email_action_type?: string;
  site_url?: string;
  token_new?: string;
  token_hash_new?: string;
};

type AuthHookPayload = {
  user: AuthUser;
  email_data: AuthEmailData;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

function userName(user: AuthUser) {
  const metadata = user.user_metadata ?? {};
  const candidate = metadata.full_name ?? metadata.name ?? metadata.display_name;
  if (typeof candidate !== "string") return "هاوڕێی خۆشەویست";
  const normalized = candidate.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80);
  return normalized ? escapeHtml(normalized) : "هاوڕێی خۆشەویست";
}

function safeNextPath(redirectTo: string | undefined) {
  if (!redirectTo) return "/dashboard";
  try {
    const redirect = new URL(redirectTo);
    if (!["daim-post.online", "www.daim-post.online"].includes(redirect.hostname)) {
      return "/dashboard";
    }
    const next = redirect.searchParams.get("next");
    return next === "/cart" ? "/cart" : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function authConfirmUrl(tokenHash: string, type: "email" | "invite" | "magiclink", next: string) {
  const url = new URL("/auth/confirm", SITE_URL);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  url.searchParams.set("next", next);
  return url.toString();
}

function recoveryUrl(tokenHash: string) {
  const url = new URL("/auth/recovery", SITE_URL);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", "recovery");
  return url.toString();
}

async function sendTemplate(args: {
  apiKey: string;
  from: string;
  to: string;
  templateId: string;
  variables: Record<string, string>;
  idempotencyKey?: string;
}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${args.apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "SHAKH-Auth-Email-Hook/1.0",
  };
  if (args.idempotencyKey) headers["Idempotency-Key"] = args.idempotencyKey;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      template: {
        id: args.templateId,
        variables: args.variables,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[send-auth-email] Resend rejected email", {
      status: response.status,
      template: args.templateId,
      response: body.slice(0, 500),
    });
    throw new Error("The email provider could not send the authentication email.");
  }
}

const securityMessages: Record<string, { title: string; message: string }> = {
  email_changed_notification: {
    title: "ئیمەیڵی هەژمارەکەت گۆڕدرا",
    message: "ناونیشانی ئیمەیڵی هەژماری شاخت گۆڕدرا.",
  },
  phone_changed_notification: {
    title: "ژمارەی مۆبایل گۆڕدرا",
    message: "ژمارەی مۆبایلی پەیوەست بە هەژماری شاخت گۆڕدرا.",
  },
  identity_linked_notification: {
    title: "ڕێگایەکی نوێی چوونەژوورەوە پەیوەست کرا",
    message: "ڕێگایەکی نوێی چوونەژوورەوە بە هەژماری شاخت زیاد کرا.",
  },
  identity_unlinked_notification: {
    title: "ڕێگای چوونەژوورەوە لابرا",
    message: "یەکێک لە ڕێگاکانی چوونەژوورەوە لە هەژماری شاخت لابرا.",
  },
  mfa_factor_enrolled_notification: {
    title: "پاراستنی دوو هەنگاوی چالاک کرا",
    message: "ڕێگایەکی نوێی پاراستنی دوو هەنگاوی بۆ هەژماری شاخت زیاد کرا.",
  },
  mfa_factor_unenrolled_notification: {
    title: "پاراستنی دوو هەنگاوی ناچالاک کرا",
    message: "یەکێک لە ڕێگاکانی پاراستنی دوو هەنگاوی لە هەژماری شاخت لابرا.",
  },
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL") || DEFAULT_FROM;
  const configuredSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  if (!apiKey || !configuredSecret) {
    console.error("[send-auth-email] Required email hook secrets are missing.");
    return json({ error: "Authentication email provider is not configured." }, 503);
  }

  let event: AuthHookPayload;
  try {
    const rawPayload = await request.text();
    const secret = configuredSecret.replace(/^v1,whsec_/, "");
    const webhook = new Webhook(secret);
    event = webhook.verify(rawPayload, Object.fromEntries(request.headers.entries())) as AuthHookPayload;
  } catch {
    return json({ error: "Invalid authentication hook signature." }, 401);
  }

  const recipient = event.user?.email?.trim().toLowerCase();
  const action = event.email_data?.email_action_type ?? "";
  const name = userName(event.user ?? {});
  const webhookId = request.headers.get("webhook-id") ?? undefined;

  if (!recipient || !recipient.includes("@")) {
    return json({ error: "Authentication event did not include a valid recipient." }, 400);
  }

  try {
    if (action === "signup" || action === "invite" || action === "magiclink") {
      const tokenHash = event.email_data?.token_hash;
      if (!tokenHash) return json({ error: "Confirmation token is missing." }, 400);
      const verifyType = action === "signup" ? "email" : action;
      await sendTemplate({
        apiKey,
        from,
        to: recipient,
        templateId: "shakh-confirm-email",
        variables: {
          USER_NAME: name,
          CONFIRMATION_URL: authConfirmUrl(tokenHash, verifyType, safeNextPath(event.email_data?.redirect_to)),
        },
        idempotencyKey: webhookId,
      });
    } else if (action === "recovery") {
      const tokenHash = event.email_data?.token_hash;
      if (!tokenHash) return json({ error: "Recovery token is missing." }, 400);
      await sendTemplate({
        apiKey,
        from,
        to: recipient,
        templateId: "shakh-password-recovery",
        variables: {
          USER_NAME: name,
          RESET_URL: recoveryUrl(tokenHash),
        },
        idempotencyKey: webhookId,
      });
    } else if (action === "password_changed_notification") {
      await sendTemplate({
        apiKey,
        from,
        to: recipient,
        templateId: "shakh-password-changed",
        variables: { USER_NAME: name },
        idempotencyKey: webhookId,
      });
    } else if (securityMessages[action]) {
      const notice = securityMessages[action];
      await sendTemplate({
        apiKey,
        from,
        to: recipient,
        templateId: "shakh-security-notice",
        variables: {
          USER_NAME: name,
          SECURITY_TITLE: escapeHtml(notice.title),
          SECURITY_MESSAGE: escapeHtml(notice.message),
        },
        idempotencyKey: webhookId,
      });
    } else {
      console.error("[send-auth-email] Unsupported auth email action.", { action });
      return json({ error: "This authentication email action is not configured yet." }, 400);
    }

    return json({}, 200);
  } catch {
    return json({ error: "Authentication email could not be sent." }, 502);
  }
});
