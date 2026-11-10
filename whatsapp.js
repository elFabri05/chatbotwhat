// Thin wrapper around the WhatsApp Cloud API "messages" endpoint.
// Config is read at call time so dotenv only has to be loaded before the
// first message is sent.

async function callMessagesApi(payload) {
  const { GRAPH_API_VERSION, PHONE_NUMBER_ID, WHATSAPP_TOKEN } = process.env;
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Log Meta's whole error object: the code says what went wrong
    // (190 = token expired, 131030 = recipient not in the allowed list, ...).
    console.error(
      `[whatsapp] API error (HTTP ${response.status}):`,
      JSON.stringify(data, null, 2)
    );
    const error = new Error(data?.error?.message || `WhatsApp API error ${response.status}`);
    error.meta = data?.error;
    throw error;
  }
  return data;
}

// Send a plain text message. `to` is digits only, international format.
function sendText(to, body) {
  return callMessagesApi({ to, type: "text", text: { body } });
}

// Show the blue "read" ticks on the customer's message.
function markAsRead(messageId) {
  return callMessagesApi({ status: "read", message_id: messageId });
}

module.exports = { sendText, markAsRead };
