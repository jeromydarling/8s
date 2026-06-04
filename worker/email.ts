import { EmailMessage } from "cloudflare:email";
import type { Env } from "./index";

// Outbound transactional email. Targets Cloudflare Email Service (the EMAIL
// send_email binding). Falls back to logging when the binding/DNS aren't live
// yet, so nothing breaks before email is fully enabled. One adapter — swap the
// provider here only.

const FROM = "8 Seconds <noreply@8s.rodeo>";
const FROM_ADDR = "noreply@8s.rodeo";
const REPLY_TO = "gardener@thecros.app";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Attempt a send and report exactly what happened (for the debug endpoint).
export async function sendMailDebug(env: Env, mail: Mail): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { hasBinding: !!env.EMAIL, hasResend: !!env.RESEND_API_KEY };
  if (env.EMAIL) {
    try {
      const msg = new EmailMessage(FROM_ADDR, mail.to, buildMime(mail));
      await env.EMAIL.send(msg);
      out.via = "cloudflare-email-service";
      out.ok = true;
      return out;
    } catch (err) {
      out.cfError = String(err instanceof Error ? err.message : err);
    }
  }
  out.ok = await sendMail(env, mail);
  out.via = out.via ?? (out.ok ? "fallback" : "logged");
  return out;
}

export async function sendMail(env: Env, mail: Mail): Promise<boolean> {
  // 1) Cloudflare Email Service binding (preferred).
  if (env.EMAIL) {
    try {
      const msg = new EmailMessage(FROM_ADDR, mail.to, buildMime(mail));
      await env.EMAIL.send(msg);
      return true;
    } catch (err) {
      console.error("[email] CF Email Service send failed", err);
    }
  }

  // 2) Resend fallback (if a key is present) — useful before CF Email Service is live.
  if (env.RESEND_API_KEY) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: mail.to,
          reply_to: REPLY_TO,
          subject: mail.subject,
          text: mail.text,
          html: mail.html ?? undefined,
        }),
      });
      if (r.ok) return true;
      console.error("[email] resend failed", r.status, await r.text().catch(() => ""));
    } catch (err) {
      console.error("[email] resend error", err);
    }
  }

  // 3) Not configured yet — log so the flow still completes end to end.
  console.log(`[email:would-send] to=${mail.to} :: ${mail.subject}`);
  return false;
}

// Minimal RFC 5322 / multipart MIME builder (text + optional HTML).
function buildMime(mail: Mail): string {
  const date = new Date().toUTCString();
  const headers = [
    `From: ${FROM}`,
    `To: ${mail.to}`,
    `Reply-To: ${REPLY_TO}`,
    `Subject: ${mail.subject}`,
    `Date: ${date}`,
    `Message-ID: <${crypto.randomUUID()}@8s.rodeo>`,
    "MIME-Version: 1.0",
  ];

  if (!mail.html) {
    return [...headers, 'Content-Type: text/plain; charset="utf-8"', "", mail.text].join("\r\n");
  }

  const boundary = `b_${crypto.randomUUID().replace(/-/g, "")}`;
  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "",
    mail.text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    "",
    mail.html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/* ---------------- Brand-voiced templates ---------------- */
const SITE = "https://8s.rodeo";

function shell(heading: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#faf4e8;font-family:Georgia,serif;color:#2b1d12">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-family:'Arial Narrow',sans-serif;font-weight:700;letter-spacing:1px;font-size:22px;color:#b8502b">8&nbsp;SECONDS</div>
    <div style="height:3px;width:48px;background:#e0a458;margin:10px 0 24px"></div>
    <h1 style="font-family:'Arial Narrow',sans-serif;font-size:26px;line-height:1.1;margin:0 0 14px">${heading}</h1>
    <div style="font-size:16px;line-height:1.6;color:#3a2818">${bodyHtml}</div>
    ${
      cta
        ? `<a href="${cta.url}" style="display:inline-block;margin-top:22px;background:#b8502b;color:#faf4e8;text-decoration:none;font-family:'Arial Narrow',sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:13px 26px;border-radius:999px">${cta.label}</a>
    <p style="font-size:12px;color:#8a5a3b;margin-top:16px">Or paste this link: <br>${cta.url}</p>`
        : ""
    }
    <hr style="border:none;border-top:1px solid #d9b98c;margin:28px 0 14px">
    <p style="font-size:12px;color:#8a5a3b">8 Seconds · the hub built by a rodeo family, for rodeo families · <a href="${SITE}" style="color:#8a5a3b">8s.rodeo</a></p>
  </div></body></html>`;
}

// Single welcome-with-verify email sent on signup (one email, not two).
export function welcomeVerifyEmail(name: string, url: string): Mail {
  const n = name ? `, ${name}` : "";
  return {
    to: "",
    subject: "Welcome to 8 Seconds — confirm your email",
    text: `Glad you're here${n}.\n\nEvery event, every qualifying ladder, every horse — and every arena worth fighting for, all in one place. Follow the rodeos you're chasing and we'll make sure you never miss a draw.\n\nConfirm your email to turn on deadline alerts (link expires in 24 hours):\n${url}\n\nIf you didn't sign up, you can ignore this.\n\n— 8 Seconds · 8s.rodeo`,
    html: shell(
      `Glad you're here${n}.`,
      `<p>Every event, every qualifying ladder, every horse — and every arena worth fighting for, in one place. Follow the rodeos you're chasing and we'll make sure you never miss a draw.</p><p>Confirm your email to turn on deadline alerts.</p><p style="color:#8a5a3b">This link expires in 24 hours.</p>`,
      { label: "Confirm email", url },
    ),
  };
}

export function verifyEmail(url: string): Mail {
  return {
    to: "",
    subject: "Confirm your email — 8 Seconds",
    text: `Welcome to 8 Seconds.\n\nConfirm your email to turn on deadline alerts and save your barn:\n${url}\n\nThis link expires in 24 hours. If you didn't sign up, you can ignore this.\n\n— 8 Seconds · 8s.rodeo`,
    html: shell(
      "Confirm your email",
      `<p>Welcome to the hub. Confirm your email to turn on deadline alerts and keep your barn saved.</p><p style="color:#8a5a3b">This link expires in 24 hours.</p>`,
      { label: "Confirm email", url },
    ),
  };
}

export function welcomeEmail(name: string): Mail {
  const n = name ? `, ${name}` : "";
  return {
    to: "",
    subject: "Welcome to 8 Seconds",
    text: `Glad you're here${n}.\n\nEvery event, every qualifying ladder, every horse — and every arena worth fighting for, all in one place. Follow the rodeos you're chasing and we'll make sure you never miss a draw.\n\nSee the map: ${SITE}/app\n\n— 8 Seconds`,
    html: shell(
      `Glad you're here${n}.`,
      `<p>Every event, every qualifying ladder, every horse — and every arena worth fighting for, in one place. Follow the rodeos you're chasing and we'll make sure you never miss a draw.</p>`,
      { label: "Open the map", url: `${SITE}/app` },
    ),
  };
}

export function resetEmail(url: string): Mail {
  return {
    to: "",
    subject: "Reset your 8 Seconds password",
    text: `Someone asked to reset the password for this 8 Seconds account.\n\nReset it here (expires in 1 hour):\n${url}\n\nIf this wasn't you, ignore this email — your password won't change.\n\n— 8 Seconds`,
    html: shell(
      "Reset your password",
      `<p>Someone asked to reset the password for this account. This link expires in 1 hour.</p><p style="color:#8a5a3b">If this wasn't you, ignore this email — nothing changes.</p>`,
      { label: "Reset password", url },
    ),
  };
}
