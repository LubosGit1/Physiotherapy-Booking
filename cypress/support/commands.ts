import { FIXTURE_NOW, FIXTURE_PASSWORD, USERS, type FixtureUserKey } from "./clinic";

const secretHeader = () => ({ "x-e2e-secret": Cypress.env("e2eSecret") as string });

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Wipes the database, loads the fixture clinic and freezes server and browser time. */
      resetClinic(now?: string): Chainable<void>;
      setServerTime(now: string): Chainable<void>;
      advanceServerTime(minutes: number): Chainable<void>;
      /** Programmatic sign-in, cached per user with cy.session. */
      loginAs(user: FixtureUserKey): Chainable<void>;
      /** Signs in through the real form – for tests about the sign-in UI itself. */
      loginThroughForm(user: FixtureUserKey): Chainable<void>;
      sessionCookieFor(user: FixtureUserKey): Chainable<string>;
      createAppointment(appointment: {
        client: FixtureUserKey;
        therapistId: string;
        serviceId: string;
        startsAt: string;
        status?: "CONFIRMED" | "HELD";
      }): Chainable<string>;
      emailsTo(user: FixtureUserKey): Chainable<{ subject: string; body: string; kind: string }[]>;
      checkPageA11y(context?: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add("resetClinic", (now = FIXTURE_NOW) => {
  cy.request({ method: "POST", url: "/api/test/reset", headers: secretHeader() });
  cy.setServerTime(now);
  // Only Date is faked: timers keep running, so React and the countdown behave normally.
  cy.clock(new Date(now), ["Date"]).as("browserClock");
});

Cypress.Commands.add("setServerTime", (now) => {
  cy.request({ method: "POST", url: "/api/test/clock", headers: secretHeader(), body: { now } });
});

Cypress.Commands.add("advanceServerTime", (minutes) => {
  cy.request({ method: "POST", url: "/api/test/clock", headers: secretHeader(), body: { advanceMinutes: minutes } }).then(
    ({ body }) => {
      // Keep the browser's Date in step with the server.
      cy.get<Cypress.Clock>("@browserClock").then((clock) => clock.setSystemTime(new Date(body.now)));
    },
  );
});

function signInRequest(user: FixtureUserKey) {
  cy.request("/api/auth/csrf").then(({ body }) => {
    cy.request({
      method: "POST",
      url: "/api/auth/callback/credentials",
      form: true,
      followRedirect: false,
      body: { csrfToken: body.csrfToken, email: USERS[user].email, password: FIXTURE_PASSWORD },
    });
  });
}

Cypress.Commands.add("loginAs", (user) => {
  cy.session(
    ["api-login", user],
    () => signInRequest(user),
    {
      validate() {
        cy.request("/api/auth/session").its("body.user.email").should("eq", USERS[user].email);
      },
    },
  );
});

Cypress.Commands.add("loginThroughForm", (user) => {
  cy.findByLabelText("Email").clear().type(USERS[user].email);
  cy.findByLabelText("Password").clear().type(FIXTURE_PASSWORD, { log: false });
  cy.findByRole("button", { name: "Sign in" }).click();
});

Cypress.Commands.add("sessionCookieFor", (user) => {
  cy.clearCookies();
  signInRequest(user);
  return cy.getCookie("authjs.session-token").then((cookie) => {
    if (!cookie) throw new Error(`Signing in as ${user} didn't set a session cookie`);
    const header = `authjs.session-token=${cookie.value}`;
    // Chain the cleanup and yield the header from it, instead of returning a value next to a cy command.
    return cy.clearCookies().then(() => header);
  });
});

Cypress.Commands.add("createAppointment", ({ client, ...rest }) => {
  return cy
    .request({ method: "POST", url: "/api/test/appointments", headers: secretHeader(), body: { clientId: USERS[client].id, ...rest } })
    .its("body.id");
});

Cypress.Commands.add("emailsTo", (user) => {
  return cy
    .request({ url: `/api/test/emails?to=${encodeURIComponent(USERS[user].email)}`, headers: secretHeader() })
    .its("body");
});

Cypress.Commands.add("checkPageA11y", (context) => {
  cy.injectAxe();
  cy.checkA11y(
    context,
    { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } },
    (violations) => {
      violations.forEach((v) => Cypress.log({ name: "a11y", message: `${v.id}: ${v.help} (${v.nodes.length} elements)` }));
    },
  );
});
