// Bot logic. handleMessage(phone, text) returns the reply string and never
// touches the network, so the webhook, the test page and the unit tests can
// all share it.

const {
  normalizePhone,
  findCustomerByPhone,
  findCustomerById,
  getConnectivity,
  getPaymentStatus,
} = require("./data/customers");

// Unknown phone -> customer ID they identified with. In memory only, so it is
// lost on restart (fine for a demo).
const sessions = new Map();

// "Talk to a human" requests. A real system would open a ticket instead.
const humanRequests = [];

const MENU = [
  "¿En qué te puedo ayudar? Respondé con un número:",
  "1 – Consultar mi conexión",
  "2 – Consultar mis pagos",
  "3 – Hablar con una persona",
].join("\n");

// Keywords in Spanish and English. Input is lower-cased and accent-free
// before matching, so "Conexión" matches "conexion".
const KEYWORDS = {
  connection: /\b(internet|conexion|connection|wifi)\b/,
  payment: /\b(pagos?|pagar|payments?|factura|bill|deuda)\b/,
  human: /\b(humano|human|persona|agente|agent|asesor)\b/,
};

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9 ]/g, " ") // strip punctuation ("1." -> "1")
    .replace(/\s+/g, " ")
    .trim();
}

const firstName = (customer) => customer.name.split(" ")[0];

// "2026-11-09T22:40:00-03:00" -> "9/11/26, 22:40" (Argentina time)
function formatDateTime(iso) {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  });
}

// "2026-10-10" -> "10/10/2026" (done by hand to avoid timezone shifts)
function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

const formatMoney = (amount) => "$" + amount.toLocaleString("es-AR");

function connectionReply(customer) {
  const { status, plan, lastSeenOnline } = getConnectivity(customer);

  if (status === "online") {
    return `✅ Tu conexión está funcionando bien.\nPlan: ${plan}\nÚltima vez en línea: ${formatDateTime(lastSeenOnline)}`;
  }

  const headline =
    status === "offline"
      ? "🔴 Tu conexión figura sin servicio."
      : "🟡 Tu conexión está funcionando con problemas.";

  return [
    headline,
    `Plan: ${plan}`,
    `Última vez en línea: ${formatDateTime(lastSeenOnline)}`,
    "",
    "Probá lo siguiente:",
    "• Reiniciá el router (desenchufalo 30 segundos y volvé a enchufarlo).",
    "• Revisá que los cables estén bien conectados.",
    "",
    "Si sigue igual, respondé 3 para hablar con una persona.",
  ].join("\n");
}

function paymentReply(customer) {
  const { status, amountDue, dueDate } = getPaymentStatus(customer);

  if (status === "overdue") {
    return `⚠️ Tenés un pago vencido de ${formatMoney(amountDue)}, con vencimiento el ${formatDate(dueDate)}.\nSi ya pagaste, respondé 3 y lo revisamos.`;
  }
  return `✅ Tus pagos están al día. Tu próximo vencimiento es el ${formatDate(dueDate)}.`;
}

function humanReply(customer, phone) {
  const request = { customerId: customer.id, phone, at: new Date().toISOString() };
  humanRequests.push(request);
  console.log("[human request]", request);
  return "👤 Listo, un agente se va a comunicar con vos a la brevedad.";
}

function handleMessage(phone, text) {
  const input = normalizeText(text);
  const sessionKey = normalizePhone(phone);

  // 1. Who is writing? Known phone first, then a previously given ID.
  let customer =
    findCustomerByPhone(phone) || findCustomerById(sessions.get(sessionKey));

  // 2. Unknown phone: the only thing we accept is a valid customer ID.
  if (!customer) {
    customer = findCustomerById(input);
    if (!customer) {
      return "¡Hola! 👋 No encuentro este número en nuestro sistema. Por favor, enviame tu número de cliente (por ejemplo: C1001).";
    }
    sessions.set(sessionKey, customer.id);
    return `¡Gracias, ${firstName(customer)}! Ya te identifiqué.\n${MENU}`;
  }

  // 3. Menu options, by number or keyword.
  if (input === "1" || KEYWORDS.connection.test(input)) return connectionReply(customer);
  if (input === "2" || KEYWORDS.payment.test(input)) return paymentReply(customer);
  if (input === "3" || KEYWORDS.human.test(input)) return humanReply(customer, phone);

  // 4. Greeting, "menu" or anything we don't understand -> show the menu.
  return `¡Hola, ${firstName(customer)}! 👋\n${MENU}`;
}

// Test helper: forget sessions and logged requests.
function resetState() {
  sessions.clear();
  humanRequests.length = 0;
}

module.exports = { handleMessage, humanRequests, resetState };
