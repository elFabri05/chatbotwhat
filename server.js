// Express server: Meta webhook (GET verify + POST receive) and a local test page.

require("dotenv").config(); // must run before data/customers.js reads env vars

const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");

const { handleMessage } = require("./bot");
const { sendText, markAsRead } = require("./whatsapp");
const { customers } = require("./data/customers");

const app = express();

// Parse JSON but keep the raw bytes too: the webhook signature is computed
// over the exact body Meta sent, not over the re-serialized JSON.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ---------------------------------------------------------------------------
// Webhook verification: Meta calls this once when you register the webhook.
// ---------------------------------------------------------------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && process.env.VERIFY_TOKEN && token === process.env.VERIFY_TOKEN) {
    return res.status(200).type("text/plain").send(String(challenge));
  }
  res.sendStatus(403);
});

// ---------------------------------------------------------------------------
// Incoming messages
// ---------------------------------------------------------------------------

// True if X-Hub-Signature-256 matches HMAC-SHA256(APP_SECRET, raw body).
function isValidSignature(req) {
  const secret = process.env.APP_SECRET;
  const header = req.get("X-Hub-Signature-256") || "";
  if (!secret || !req.rawBody) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Meta can deliver the same webhook more than once, so remember the last
// message IDs we handled. A Set keeps insertion order, so the first item is
// always the oldest.
const seenMessageIds = new Set();
const MAX_SEEN_IDS = 1000;

function alreadySeen(messageId) {
  if (seenMessageIds.has(messageId)) return true;
  seenMessageIds.add(messageId);
  if (seenMessageIds.size > MAX_SEEN_IDS) {
    seenMessageIds.delete(seenMessageIds.values().next().value);
  }
  return false;
}

async function processWebhook(body) {
  // Status updates (sent/delivered/read) have no "messages" array: ignore them.
  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message || alreadySeen(message.id)) return;

  const from = message.from;
  console.log(`[webhook] ${message.type} message from ${from}`);

  // Nice to have, so a failure here must not stop the reply.
  markAsRead(message.id).catch(() => {});

  const reply =
    message.type === "text" && message.text?.body
      ? handleMessage(from, message.text.body)
      : "Por ahora solo puedo leer mensajes de texto 🙂. Escribí *menu* para ver las opciones.";

  await sendText(from, reply);
}

app.post("/webhook", (req, res) => {
  if (!isValidSignature(req)) {
    console.warn("[webhook] rejected: missing or invalid signature (check APP_SECRET)");
    return res.sendStatus(401);
  }

  // Answer right away (Meta retries slow webhooks), then do the work.
  res.sendStatus(200);
  processWebhook(req.body).catch((err) => {
    console.error("[webhook] failed to process message:", err.message);
  });
});

// ---------------------------------------------------------------------------
// Local test page. It shows customer data (including your own phone number),
// so it only answers requests made directly from this machine. Requests that
// arrive through ngrok carry an X-Forwarded-For header and get a 403.
// ---------------------------------------------------------------------------
function localOnly(req, res, next) {
  const ip = req.socket.remoteAddress || "";
  const isLoopback = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  if (!isLoopback || req.headers["x-forwarded-for"]) return res.sendStatus(403);
  next();
}

app.get("/", localOnly, (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/customers", localOnly, (_req, res) => {
  res.json(customers);
});

// Runs the same bot logic as WhatsApp, without sending anything to Meta.
app.post("/test", localOnly, (req, res) => {
  const { phone, text } = req.body || {};
  if (!phone || typeof text !== "string") {
    return res.status(400).json({ error: "phone and text are required" });
  }
  res.json({ reply: handleMessage(phone, text) });
});

// Start listening only when run directly (`node server.js`).
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running: http://localhost:${port}`);
    const required = ["WHATSAPP_TOKEN", "PHONE_NUMBER_ID", "VERIFY_TOKEN", "APP_SECRET", "GRAPH_API_VERSION"];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) {
      console.warn(`Missing in .env: ${missing.join(", ")}. The test page works, WhatsApp will not.`);
    }
  });
}

module.exports = app;
