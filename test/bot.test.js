// Unit tests for the bot logic. Run with: npm test
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const { handleMessage, humanRequests, resetState } = require("../bot");
const { findCustomerByPhone } = require("../data/customers");

const ANA = "5492610000001"; // online, up to date
const LUIS = "5492610000002"; // offline
const MARIA = "5492610000003"; // degraded
const CARLOS = "5492610000004"; // online, overdue
const UNKNOWN = "5491100000000";

beforeEach(resetState);

test("online customer: status, plan and last time online, no tips", () => {
  const reply = handleMessage(ANA, "1");
  assert.match(reply, /funcionando bien/);
  assert.match(reply, /Fibra 300 Mbps/);
  assert.match(reply, /Última vez en línea/);
  assert.doesNotMatch(reply, /router/);
});

test("offline customer: tips and offer to talk to a human", () => {
  const reply = handleMessage(LUIS, "1");
  assert.match(reply, /sin servicio/);
  assert.match(reply, /Reiniciá el router/);
  assert.match(reply, /cables/);
  assert.match(reply, /respondé 3/);
});

test("degraded customer also gets tips", () => {
  const reply = handleMessage(MARIA, "internet");
  assert.match(reply, /con problemas/);
  assert.match(reply, /router/);
});

test("overdue payment: amount and due date", () => {
  const reply = handleMessage(CARLOS, "2");
  assert.match(reply, /vencido/);
  assert.match(reply, /\$18\.500/);
  assert.match(reply, /10\/10\/2026/);
});

test("up-to-date payment", () => {
  assert.match(handleMessage(ANA, "pago"), /al día/);
});

test("unknown phone is asked for an ID, then a valid ID starts a session", () => {
  assert.match(handleMessage(UNKNOWN, "hola"), /número de cliente/);
  assert.match(handleMessage(UNKNOWN, "X9999"), /número de cliente/); // invalid ID

  const welcome = handleMessage(UNKNOWN, "c1004");
  assert.match(welcome, /Carlos/);
  assert.match(welcome, /1 – Consultar mi conexión/);

  // The session sticks: next message is answered as Carlos.
  assert.match(handleMessage(UNKNOWN, "2"), /\$18\.500/);
});

test("unknown text and greetings show the menu", () => {
  for (const text of ["asdf qwerty", "hola", "menu", ""]) {
    const reply = handleMessage(ANA, text);
    assert.match(reply, /1 – Consultar mi conexión/);
    assert.match(reply, /2 – Consultar mis pagos/);
    assert.match(reply, /3 – Hablar con una persona/);
  }
});

test("Spanish and English keywords, with accents and capitals", () => {
  assert.match(handleMessage(ANA, "Mi CONEXIÓN anda mal"), /funcionando bien/);
  assert.match(handleMessage(ANA, "check my connection"), /funcionando bien/);
  assert.match(handleMessage(CARLOS, "payment"), /vencido/);
});

test("option 3 logs a human request", () => {
  const reply = handleMessage(ANA, "3");
  assert.match(reply, /agente/);
  assert.equal(humanRequests.length, 1);
  assert.equal(humanRequests[0].customerId, "C1001");
});

test("Argentine phones: 549XXXXXXXXXX and 54XXXXXXXXXX are the same customer", () => {
  assert.equal(findCustomerByPhone("5492610000001").id, "C1001");
  assert.equal(findCustomerByPhone("542610000001").id, "C1001");
  assert.equal(findCustomerByPhone("+54 9 261 000-0001").id, "C1001");

  // Through the bot: the "54" form is recognized, not asked for an ID.
  assert.match(handleMessage("542610000001", "1"), /Fibra 300 Mbps/);
});
