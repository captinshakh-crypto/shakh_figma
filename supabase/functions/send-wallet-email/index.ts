import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("SHAKH_ALLOWED_ORIGIN") ?? "https://daim-post.online",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function esc(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Supabase function environment is incomplete" }, 500);
  if (!resendKey || !fromEmail) return json({ error: "Email provider secrets are not configured" }, 503);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Invalid session" }, 401);

  let payload: { request_id?: string; event?: string };
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (!payload.request_id || !["topup_requested", "topup_reviewed"].includes(payload.event ?? "")) {
    return json({ error: "Invalid notification request" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: request, error: requestError } = await admin
    .from("wallet_topup_requests")
    .select("id,user_id,amount_iqd,status")
    .eq("id", payload.request_id)
    .maybeSingle();
  if (requestError || !request) return json({ error: "Wallet request not found" }, 404);

  let recipient = "";
  let subject = "";
  let html = "";
  if (payload.event === "topup_requested") {
    if (request.user_id !== user.id || request.status !== "pending") return json({ error: "Not allowed" }, 403);
    recipient = Deno.env.get("SHAKH_ADMIN_EMAIL") ?? "sardar.xano59@gmail.com";
    subject = "SHAKH: new wallet top-up request";
    html = `<h2>Wallet top-up request</h2><p>Amount: <strong>${Number(request.amount_iqd).toLocaleString("en-US")} IQD</strong></p><p>Request ID: ${esc(request.id)}</p><p>Review this request in the SHAKH admin dashboard.</p>`;
  } else {
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "super_admin" || !["approved", "rejected"].includes(request.status)) return json({ error: "Not allowed" }, 403);
    const { data: owner } = await admin.from("profiles").select("email").eq("id", request.user_id).maybeSingle();
    if (!owner?.email) return json({ error: "Recipient email not found" }, 404);
    recipient = owner.email;
    subject = request.status === "approved" ? "SHAKH: wallet top-up approved" : "SHAKH: wallet top-up rejected";
    html = `<h2>${request.status === "approved" ? "Wallet top-up approved" : "Wallet top-up rejected"}</h2><p>Requested amount: <strong>${Number(request.amount_iqd).toLocaleString("en-US")} IQD</strong></p><p>Sign in to SHAKH to view your wallet.</p>`;
  }

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: [recipient], subject, html }),
  });
  if (!sent.ok) return json({ error: "Email provider rejected the message", provider_status: sent.status }, 502);
  return json({ success: true });
});
