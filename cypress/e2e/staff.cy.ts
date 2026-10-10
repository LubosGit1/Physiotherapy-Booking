import { cetInstant, SERVICES, THERAPISTS, TUESDAY } from "../support/clinic";
import { BookingPage } from "../support/pages/BookingPage";

describe("Therapist schedule", () => {
  beforeEach(() => {
    cy.resetClinic();
    cy.createAppointment({ client: "anna", therapistId: THERAPISTS.emma, serviceId: SERVICES.massage.id, startsAt: cetInstant(TUESDAY, "09:00") });
    cy.createAppointment({ client: "ben", therapistId: THERAPISTS.mark, serviceId: SERVICES.massage.id, startsAt: cetInstant(TUESDAY, "13:00") });
    cy.loginAs("emma");
    cy.visit("/schedule");
  });

  it("shows only the therapist's own sessions", () => {
    cy.get("[data-cy=week-label]").should("contain", "Monday 4 March");
    cy.get("[data-cy=session]").should("have.length", 1).and("contain", "09:00–09:30").and("contain", "Anna Brooks");
    cy.contains("Ben Walker").should("not.exist");
  });

  it("adds time off that disappears from online booking", () => {
    cy.findByLabelText("From").type(`${TUESDAY}T12:30`);
    cy.findByLabelText("Until").type(`${TUESDAY}T16:00`);
    cy.findByLabelText(/Reason/).type("Training course");
    cy.findByRole("button", { name: "Add time off" }).click();

    cy.findByRole("status").should("contain", "Time off added");
    cy.get("[data-cy=time-off]").should("contain", "Training course");

    BookingPage.visit({ service: SERVICES.massage.id, therapist: THERAPISTS.emma, date: TUESDAY });
    BookingPage.shouldOffer("11:30");
    BookingPage.slots().last().should("have.attr", "aria-label", "11:30 with Emma Hart");
  });

  it("refuses time off over a booked session", () => {
    cy.findByLabelText("From").type(`${TUESDAY}T08:30`);
    cy.findByLabelText("Until").type(`${TUESDAY}T10:00`);
    cy.findByRole("button", { name: "Add time off" }).click();
    cy.findByRole("alert").should("have.text", "You have 1 booked session during that time. Cancel or move them first.");
    cy.get("[data-cy=time-off]").should("not.exist");
  });
});

describe("Clinic admin", () => {
  beforeEach(() => {
    cy.resetClinic();
    cy.loginAs("admin");
    cy.visit("/admin");
  });

  it("adds a service with validation, and it becomes bookable", () => {
    cy.findByRole("button", { name: "Add service" }).click();
    cy.findByRole("alert").should("contain", "Give the service a name.");

    cy.findByLabelText("Name").type("Dry needling");
    cy.findByLabelText("Length").select("30 minutes");
    cy.findByLabelText("Price in €").type("forty");
    cy.findByLabelText("Mark Cole").check();
    cy.findByRole("button", { name: "Add service" }).click();
    cy.findByRole("alert").should("contain", "Enter a price in euros");

    cy.findByLabelText("Price in €").clear().type("40,50");
    cy.findByRole("button", { name: "Add service" }).click();
    cy.findByRole("status").should("have.text", "Dry needling is now bookable.");
    cy.contains("[data-cy=admin-service]", "Dry needling").should("contain", "30 min, €40.50, Mark Cole");

    BookingPage.visit();
    BookingPage.chooseService("Dry needling");
    cy.get("[data-cy=therapist-option]").should("have.length", 2).and("contain", "Mark Cole").and("not.contain", "Emma");
  });

  it("stops offering a service", () => {
    cy.findByRole("button", { name: "Stop offering Sports massage" }).click();
    cy.contains("[data-cy=admin-service]", "Sports massage").should("contain", "(not offered)");

    BookingPage.visit();
    cy.get("[data-cy=service-option]").should("have.length", 2).and("not.contain", "Sports massage");
  });

  it("can't be reached by clients", () => {
    cy.loginAs("anna");
    cy.visit("/admin");
    cy.location("pathname").should("eq", "/forbidden");
  });
});
