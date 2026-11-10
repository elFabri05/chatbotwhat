# ISP WhatsApp support bot

A small customer-support chatbot for an internet service provider, built on
Node.js + Express and the official Meta WhatsApp Cloud API. Customer data is a
hard-coded JS object (no database).

Customers can check their connection, check their payments, or ask for a human.
Replies are in Spanish; keywords work in Spanish and English.

```
server.js           Express app: webhook (GET verify, POST receive) + test page routes
bot.js              handleMessage(phone, text) -> reply string (pure logic, no network)
whatsapp.js         sendText / markAsRead (calls to the Graph API)
data/customers.js   Fake database and lookup helpers
public/index.html   Local test page (customer list + test chat)
test/bot.test.js    Unit tests for the bot logic
```

## 1. Run it locally (no WhatsApp needed)

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env
npm start
```

Open <http://localhost:3000>. The page lists the fake customers and has a test
chat: pick a customer, type `hola`, `1`, `2` or `3`, and see the bot's reply.
Pick "Unknown number" to try the flow where the bot asks for a customer ID
(valid IDs are `C1001` to `C1006`).

Run the unit tests with:

```bash
npm test
```

`npm run dev` restarts the server whenever a file changes.

## 2. Meta setup

You need a Facebook account. Everything below is free with Meta's test number.

1. Go to <https://developers.facebook.com/apps> and click **Create app**.
   Choose the use case that connects to WhatsApp (shown as "Connect with
   customers through WhatsApp", or app type **Business** in older dashboards).
   Create or select a business portfolio when asked.
2. In the app dashboard, open **WhatsApp > API Setup** (add the WhatsApp
   product first if it is not listed). Meta creates a test phone number for you.
3. On that page, copy into `.env`:
   - **Access token** (click *Generate access token*) -> `WHATSAPP_TOKEN`.
     This temporary token expires after about 24 hours; generate a new one
     when you start getting error code 190.
   - **Phone number ID** (shown under the "From" test number; it is an ID, not
     the phone number) -> `PHONE_NUMBER_ID`.
   - The version in the sample `curl` command (for example `v23.0`) ->
     `GRAPH_API_VERSION`.
4. Still on API Setup, under **To**, click **Manage phone number list** and
   add your own WhatsApp number. Confirm it with the code WhatsApp sends you.
   The test number can only message numbers on this list (up to 5).
5. Open **App settings > Basic**, click **Show** next to **App secret** and
   copy it -> `APP_SECRET`.
6. Choose any random string for `VERIFY_TOKEN`, for example the output of
   `openssl rand -hex 16`.
7. Set `TEST_CUSTOMER_PHONE` to your own number: digits only, with country
   code, no `+` (for example `5492615551234`). This makes you customer `C1006`.
8. Restart the server (`npm start`) so it picks up the new `.env`.

## 3. Expose the server with ngrok

Meta has to reach your webhook over public HTTPS.

1. Install ngrok (<https://ngrok.com/download>) and create a free account.
2. Connect your account once (the token is in the ngrok dashboard):
   ```bash
   ngrok config add-authtoken <your-ngrok-authtoken>
   ```
3. With the server running, open a second terminal and start the tunnel:
   ```bash
   ngrok http 3000
   ```
4. Copy the `https://....ngrok-free.app` forwarding URL. On the free plan this
   URL changes every time you restart ngrok, unless you use the free static
   domain from the ngrok dashboard (`ngrok http --url=<your-domain> 3000`).

The test page and `/test` only answer requests made directly to `localhost`,
so they are not reachable through the ngrok URL. Only `/webhook` is.

## 4. Register the webhook

1. In the Meta app dashboard, open **WhatsApp > Configuration**.
2. Under **Webhook**, click **Edit** and enter:
   - **Callback URL**: `https://<your-ngrok-url>/webhook`
   - **Verify token**: the same value as `VERIFY_TOKEN` in `.env`
3. Click **Verify and save**. Meta calls `GET /webhook`; the server must be
   running and ngrok must be up.
4. Under **Webhook fields**, click **Manage** and subscribe to **messages**.

## 5. Try it

From your phone, send `hola` to the Meta test number (the "From" number on the
API Setup page). The bot should answer with the menu.

If you restart ngrok and the URL changes, repeat step 4.2 with the new URL.

## Troubleshooting

The server logs Meta's full error response when a send fails. Common codes:

| What you see | Meaning | Fix |
| --- | --- | --- |
| Error code `190` | Access token expired or invalid | Generate a new token in API Setup and update `WHATSAPP_TOKEN` |
| Error code `131030` | Recipient is not in the allowed list | Add the number in API Setup > To > Manage phone number list (see the note below for Argentine numbers) |
| Error code `100` | Bad parameter, often a wrong `PHONE_NUMBER_ID` or `GRAPH_API_VERSION` | Check both values against API Setup |
| `rejected: missing or invalid signature` in the log | `APP_SECRET` is wrong or missing | Copy it again from App settings > Basic |
| "Verify and save" fails in Meta | Server or ngrok not running, or `VERIFY_TOKEN` mismatch | Check both terminals and the token value |
| Nothing arrives at all | Not subscribed to the `messages` webhook field | See step 4.4 |

**Argentine numbers.** WhatsApp reports Argentine mobiles as `549` + area code
+ number, while other systems store them as `54` + area code + number. The
customer lookup treats both as the same number. If replies to your own number
fail with `131030` even though you added it, compare the number exactly as it
appears in the allowed list with the `from` value in the server log
(`[webhook] text message from ...`): Meta sometimes stores the allowed number
in a different format than the one it reports in the webhook.

## Notes and limits

- Sessions (unknown phone -> customer ID), the duplicate-message filter and
  the "talk to a human" log live in memory and are lost on restart.
- `POST /webhook` rejects any request without a valid `X-Hub-Signature-256`,
  so `APP_SECRET` must be set for WhatsApp messages to be processed.
- The test number can only reply inside the 24-hour window after a customer's
  last message, which is always the case for this bot since it only replies.
