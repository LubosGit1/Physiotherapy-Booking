import { cetInstant, SERVICES, THERAPISTS, TUESDAY, WEDNESDAY } from "../support/clinic";
import { AppointmentsPage } from "../support/pages/AppointmentsPage";

const book = (startsAt: string) =>
  cy.createAppointment({ client: "anna", therapistId: THERAPISTS.emma, serviceId: SERVICES.massage.id, startsAt });

describe("Cancelling", () => {
  beforeEach(() => cy.resetClinic());

  it("lets a client cancel more than 24 hours ahead", () => {
    book(cetInstant(WEDNESDAY, "09:00"));
    cy.loginAs("anna");
    AppointmentsPage.visit();

    AppointmentsPage.cancel("Wednesday 6 March");
    AppointmentsPage.upcoming().should("not.exist");
    cy.contains("You have nothing booked.");
    AppointmentsPage.history().should("contain", "Cancelled");

    cy.emailsTo("anna").then((emails) => {
      expect(emails.map((e) => e.kind)).to.deep.eq(["appointment-cancelled"]);
      expect(emails[0].body).to.contain("is cancelled");
    });
  });

  it("explains the 24-hour rule, and the clinic can still cancel", () => {
    book(cetInstant(TUESDAY, "08:00"));
    cy.setServerTime(cetInstant("2030-03-04", "08:30")); // 23½ hours before

    cy.loginAs("anna");
    AppointmentsPage.visit();
    AppointmentsPage.appointment("Tuesday 5 March").within(() => {
      cy.findByRole("button", { name: "Cancel appointment" })
        .should("be.disabled")
        .and("have.attr", "aria-describedby")
        .then((id) => cy.get(`[id="${id}"]`).should("contain", "Call the clinic"));
    });

    cy.loginAs("admin");
    cy.visit(`/admin?date=${TUESDAY}`);
    cy.contains("[data-cy=admin-appointment]", "Anna Brooks").within(() => {
      cy.findByRole("button", { name: "Cancel" }).click();
      cy.findByRole("button", { name: "Yes, cancel it" }).click();
    });
    cy.contains("No appointments on this day.");
    cy.emailsTo("anna").its("0.body").should("contain", "We had to cancel");
  });

  it("lets a therapist cancel a session from the schedule", () => {
    book(cetInstant(TUESDAY, "10:00"));
    cy.loginAs("emma");
    cy.visit("/schedule");

    cy.get(`[data-cy=schedule-day][data-date="${TUESDAY}"]`).within(() => {
      cy.contains("[data-cy=session]", "Anna Brooks").within(() => {
        cy.findByRole("button", { name: "Cancel session" }).click();
        cy.findByRole("button", { name: "Yes, cancel it" }).click();
      });
      cy.contains("No sessions.");
    });
  });
});
