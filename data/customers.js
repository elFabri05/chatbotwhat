// Fake database: a hard-coded list of customers plus a few lookup helpers.
// Phones are digits only, international format, no "+".

const customers = [
  {
    id: "C1001",
    name: "Ana Gómez",
    phone: "5492610000001",
    plan: "Fibra 300 Mbps",
    connectionStatus: "online",
    lastSeenOnline: "2026-11-10T09:15:00-03:00",
    paymentStatus: "up_to_date",
    amountDue: 0,
    dueDate: "2026-12-10",
  },
  {
    id: "C1002",
    name: "Luis Fernández",
    phone: "5492610000002",
    plan: "Fibra 100 Mbps",
    connectionStatus: "offline",
    lastSeenOnline: "2026-11-09T22:40:00-03:00",
    paymentStatus: "up_to_date",
    amountDue: 0,
    dueDate: "2026-12-10",
  },
  {
    id: "C1003",
    name: "María Rodríguez",
    phone: "5492610000003",
    plan: "Fibra 50 Mbps",
    connectionStatus: "degraded",
    lastSeenOnline: "2026-11-10T08:05:00-03:00",
    paymentStatus: "up_to_date",
    amountDue: 0,
    dueDate: "2026-12-10",
  },
  {
    id: "C1004",
    name: "Carlos Pérez",
    phone: "5492610000004",
    plan: "Fibra 100 Mbps",
    connectionStatus: "online",
    lastSeenOnline: "2026-11-10T09:10:00-03:00",
    paymentStatus: "overdue",
    amountDue: 18500,
    dueDate: "2026-10-10",
  },
  {
    id: "C1005",
    name: "Sofía Martínez",
    phone: "5492610000005",
    plan: "Fibra 300 Mbps",
    connectionStatus: "offline",
    lastSeenOnline: "2026-11-03T14:20:00-03:00",
    paymentStatus: "overdue",
    amountDue: 42000,
    dueDate: "2026-09-10",
  },
  {
    // This one is "you": set TEST_CUSTOMER_PHONE in .env to your own WhatsApp
    // number so the bot recognizes you when you message the test number.
    id: "C1006",
    name: "Cliente de Prueba",
    phone: process.env.TEST_CUSTOMER_PHONE || "5492610000006",
    plan: "Fibra 1000 Mbps",
    connectionStatus: "online",
    lastSeenOnline: "2026-11-10T09:20:00-03:00",
    paymentStatus: "up_to_date",
    amountDue: 0,
    dueDate: "2026-12-10",
  },
];

// Reduce a phone to a canonical form so different spellings compare equal.
// Argentine mobiles appear both as "549" + 10 digits (how WhatsApp reports
// them) and "54" + 10 digits, so the "9" after the country code is dropped.
function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (/^549\d{10}$/.test(digits)) return "54" + digits.slice(3);
  return digits;
}

function findCustomerByPhone(phone) {
  const wanted = normalizePhone(phone);
  if (!wanted) return null;
  return customers.find((c) => normalizePhone(c.phone) === wanted) || null;
}

// IDs are matched case-insensitively ("c1001" works).
function findCustomerById(id) {
  const wanted = String(id || "").trim().toUpperCase();
  if (!wanted) return null;
  return customers.find((c) => c.id === wanted) || null;
}

function getConnectivity(customer) {
  return {
    status: customer.connectionStatus,
    plan: customer.plan,
    lastSeenOnline: customer.lastSeenOnline,
  };
}

function getPaymentStatus(customer) {
  return {
    status: customer.paymentStatus,
    amountDue: customer.amountDue,
    dueDate: customer.dueDate,
  };
}

module.exports = {
  customers,
  normalizePhone,
  findCustomerByPhone,
  findCustomerById,
  getConnectivity,
  getPaymentStatus,
};
