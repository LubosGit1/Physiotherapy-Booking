import { cetInstant, SERVICES, THERAPISTS, TUESDAY } from "../support/clinic";

const slot = (idempotencyKey: string) => ({
  serviceId: SERVICES.massage.id,
  therapistId: THERAPISTS.emma,
  startsAt: cetInstant(TUESDAY, "09:00"),
  idempotencyKey,
});

const post = (url: string, body?: Cypress.RequestBody) => cy.request({ method: "POST", url, body, failOnStatusCode: false });

describe("REST API", () => {
  beforeEach(() => cy.resetClinic());

  it("lists services and availability", () => {
    cy.request("/api/services").its("body").should("have.length", 3);
    cy.request(`/api/availability?serviceId=${SERVICES.massage.id}&therapistId=${THERAPISTS.emma}&date=${TUESDAY}`).then(({ body }) => {
      expect(body.slots[0]).to.deep.eq({ startsAt: cetInstant(TUESDAY, "08:00"), therapistId: THERAPISTS.emma, therapistName: "Emma Hart" });
    });
  });

  it("answers bad queries with a status and a readable message", () => {
    const get = (query: string) => cy.request({ url: `/api/availability?${query}`, failOnStatusCode: false });
    get(`date=${TUESDAY}`).should((r) => {
      expect(r.status).to.eq(400);
      expect(r.body.error).to.eq("Invalid id.");
    });
    get(`serviceId=${SERVICES.massage.id}&date=2030-05-01`).its("body.error").should("eq", "Pick a date within the next 14 days.");
    get(`serviceId=${SERVICES.assessment.id}&therapistId=${THERAPISTS.mark}&date=${TUESDAY}`).its("status").should("eq", 404);
  });

  it("requires a client account to hold a slot", () => {
    post("/api/appointments", slot("anon-key-1")).its("status").should("eq", 401);
    cy.loginAs("emma");
    post("/api/appointments", slot("emma-key-01")).should((r) => {
      expect(r.status).to.eq(403);
      expect(r.body.error).to.eq("Appointments are booked from a client account.");
    });
  });

  it("treats a repeated idempotency key as the same request", () => {
    cy.loginAs("anna");
    post("/api/appointments", slot("anna-key-01")).then((first) => {
      expect(first.status).to.eq(201);
      post("/api/appointments", slot("anna-key-01")).should((again) => {
        expect(again.status).to.eq(200);
        expect(again.body.appointmentId).to.eq(first.body.appointmentId);
      });
    });
  });

  it("lets exactly one of two simultaneous clients win the same slot", () => {
    cy.sessionCookieFor("anna").then((anna) => {
      cy.sessionCookieFor("ben").then((ben) => {
        cy.task("race", {
          baseUrl: Cypress.config("baseUrl"),
          path: "/api/appointments",
          sessionCookies: [anna, ben],
          body: slot("race-key-01"),
        }).then((statuses) => {
          expect((statuses as number[]).slice().sort()).to.deep.eq([201, 409]);
        });
      });
    });
  });

  it("confirms through the API and lists the booking", () => {
    cy.loginAs("anna");
    post("/api/appointments", slot("anna-key-02")).then((hold) => {
      // The response body goes into the assertion message, so a failure shows what the server said.
      expect(hold.status, JSON.stringify(hold.body)).to.eq(201);
      const id = hold.body.appointmentId;

      post(`/api/appointments/${id}/confirm`).then((confirm) => {
        expect(confirm.status, JSON.stringify(confirm.body)).to.eq(200);
      });
      cy.request("/api/me/appointments").then(({ body }) => {
        expect(body.upcoming, JSON.stringify(body)).to.have.length(1);
        expect(body.upcoming[0]).to.include({ id, therapistName: "Emma Hart" });
      });
    });
  });

  it("hides the test endpoints without the secret", () => {
    post("/api/test/reset").its("status").should("eq", 404);
    cy.request({ url: "/api/test/emails", failOnStatusCode: false }).its("status").should("eq", 404);
  });
});
