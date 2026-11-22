import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shakh-push-auth",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");

  if (!supabaseUrl || !serviceKey || !publicKey || !privateKey || !subject) {
    return json({ error: "Push service is not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const suppliedWebhookSecret = req.headers.get("x-shakh-push-auth")?.trim() ?? "";
  let isTrustedWebhook = false;
  // Validate the webhook against the single source of truth in Supabase Vault.
  // This avoids drift between a duplicated Edge Function secret and the database secret.
  if (suppliedWebhookSecret) {
    const { data: secretValid, error: secretCheckError } = await supabase.rpc(
      "verify_push_webhook_secret",
      { p_candidate: suppliedWebhookSecret },
    );
    if (secretCheckError) {
      console.error("Push webhook Vault validation failed:", secretCheckError.message);
    } else {
      isTrustedWebhook = secretValid === true;
    }
  }

  let userId: string | null = null;
  if (!isTrustedWebhook) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);
    userId = userData.user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || profile.role !== "super_admin") {
      return json({ error: "Forbidden" }, 403);
    }
  }

  let payload: { title?: string; body?: string; url?: string; notification_id?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (typeof payload.notification_id !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.notification_id)) {
    return json({ error: "A valid notification_id is required" }, 400);
  }

  const rawUrl = typeof payload.url === "string" ? payload.url : "/";
  const safeUrl = rawUrl.startsWith("/") && !rawUrl.startsWith("//") ? rawUrl : "/";

  const { data: notification, error: notificationError } = await supabase
    .from("notifications")
    .select("id, user_id, title, body")
    .eq("id", payload.notification_id)
    .maybeSingle();

  if (notificationError || !notification) {
    return json({ error: "Notification not found" }, 404);
  }

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", notification.user_id);

  if (subscriptionError) return json({ error: "Could not load subscriptions" }, 500);
  if (!subscriptions?.length) return json({ sent: 0, reason: "No push subscription" });

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const message = JSON.stringify({
    title: notification.title || (typeof payload.title === "string" ? payload.title.slice(0, 100) : "شاخ"),
    body: notification.body || (typeof payload.body === "string" ? payload.body.slice(0, 240) : "ئاگادارکردنەوەیەکی نوێت هەیە"),
    url: safeUrl,
    notification_id: notification.id,
  });

  let sent = 0;
  let failed = 0;
  const expired: string[] = [];
  for (const item of subscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: item.endpoint,
        keys: { p256dh: item.p256dh, auth: item.auth },
      }, message);
      sent++;
    } catch (error) {
      failed++;
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) expired.push(item.id);
    }
  }

  if (expired.length) {
    await supabase.from("push_subscriptions").delete().in("id", expired);
  }

  return json({ sent, failed, expired_removed: expired.length });
});