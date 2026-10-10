import { cetInstant, SATURDAY, SERVICES, THERAPISTS, TUESDAY } from "../support/clinic";
import { AppointmentsPage } from "../support/pages/AppointmentsPage";
import { BookingPage } from "../support/pages/BookingPage";
import { HoldPage } from "../support/pages/HoldPage";

const massageWithEva = { service: SERVICES.massage.id, therapist: THERAPISTS.emma, date: TUESDAY };

describe("Booking an appointment", () => {
  beforeEach(() => cy.resetClinic());

  it("takes a signed-out visitor from picking a time to a confirmed booking and email", () => {
    BookingPage.visit();
    BookingPage.chooseService("Sports massage");
    BookingPage.chooseTherapist("Mark Cole");
    BookingPage.chooseDay(TUESDAY);
    BookingPage.pickSlot("13:00");

    // Signing in keeps the choices: the booking state lives in the URL.
    cy.location("pathname").should("eq", "/login");
    cy.contains("Sign in to hold your time.");
    cy.loginThroughForm("anna");
    cy.location("pathname").should("eq", "/book");
    cy.get("[data-cy=therapist-option][aria-current=true]").should("contain", "Mark Cole");

    BookingPage.pickSlot("13:00");
    HoldPage.shouldBeHolding();
    HoldPage.countdown().should("contain", "10:00");
    HoldPage.summary()
      .should("contain", "Sports massage, 30 minutes")
      .and("contain", "Mark Cole")
      .and("contain", "Tuesday 5 March at 13:00")
      .and("contain", "€30");

    HoldPage.confirm();
    cy.location("pathname").should("eq", "/appointments");
    cy.findByRole("status").should("contain", "You're booked for Tuesday 5 March at 13:00");
    AppointmentsPage.appointment("Sports massage with Mark Cole").should("contain", "13:00–13:30");

    cy.emailsTo("anna").should((emails) => {
      expect(emails).to.have.length(1);
      expect(emails[0].subject).to.eq("Booked: Sports massage on Tuesday 5 March at 13:00");
      expect(emails[0].body).to.contain("Price: €30");
    });

    // The time is gone for everybody else.
    cy.loginAs("ben");
    BookingPage.visit({ service: SERVICES.massage.id, therapist: THERAPISTS.mark, date: TUESDAY });
    BookingPage.shouldNotOffer("13:00");
    BookingPage.shouldOffer("13:30");
  });

  it("merges therapists for 'any therapist' and explains closed days", () => {
    BookingPage.visit({ service: SERVICES.massage.id, date: TUESDAY });
    BookingPage.slot("13:00").should("contain", "Emma Hart");
    BookingPage.slot("19:30").should("contain", "Mark Cole");

    BookingPage.chooseDay(SATURDAY);
    BookingPage.noSlotsMessage().should("contain", "closed at weekends");
  });

  it("only offers times with enough notice and outside the lunch break", () => {
    BookingPage.visit({ service: SERVICES.assessment.id, therapist: THERAPISTS.emma, date: "2030-03-04" });
    BookingPage.firstSlotTime().should("eq", "10:00"); // it's 08:00, and the clinic needs 2 hours' notice
    BookingPage.shouldOffer("11:00");
    BookingPage.shouldNotOffer("11:30"); // a 60-minute session would run into lunch
    BookingPage.shouldOffer("12:30");
  });

  describe("holds", () => {
    beforeEach(() => cy.loginAs("anna"));

    it("expires after 10 minutes and gives the time back", () => {
      BookingPage.visit(massageWithEva);
      BookingPage.pickSlot("09:00");
      HoldPage.shouldBeHolding();

      // Move server and browser time on together; the countdown notices by itself.
      cy.advanceServerTime(11);
      HoldPage.shouldBeExpired();

      BookingPage.visit(massageWithEva);
      BookingPage.shouldOffer("09:00");
    });

    it("refuses to confirm once the hold has run out on the server", () => {
      BookingPage.visit(massageWithEva);
      BookingPage.pickSlot("09:00");
      HoldPage.shouldBeHolding();

      cy.setServerTime(cetInstant("2030-03-04", "08:11")); // server only, the page still shows the countdown
      HoldPage.confirm();
      cy.findByRole("alert").should("contain", "Your 10-minute hold ran out");
      cy.emailsTo("anna").should("have.length", 0);
    });

    it("releases the hold when the client chooses a different time", () => {
      BookingPage.visit(massageWithEva);
      BookingPage.pickSlot("09:00");
      HoldPage.chooseDifferentTime();

      cy.location("pathname").should("eq", "/book");
      BookingPage.visit(massageWithEva);
      BookingPage.shouldOffer("09:00");
    });

    it("tells the client when someone else got the time first, and refreshes the list", () => {
      BookingPage.visit(massageWithEva);
      BookingPage.shouldOffer("09:00");

      // Ben holds the same slot while Anna is still looking at the page.
      cy.createAppointment({
        client: "ben",
        therapistId: THERAPISTS.emma,
        serviceId: SERVICES.massage.id,
        startsAt: cetInstant(TUESDAY, "09:00"),
        status: "HELD",
      });

      BookingPage.pickSlot("09:00");
      cy.findByRole("alert").should("contain", "Someone has just booked that time");
      BookingPage.shouldNotOffer("09:00");
      cy.location("pathname").should("eq", "/book");
    });

    it("recovers from a dropped connection", () => {
      BookingPage.visit(massageWithEva);
      cy.intercept({ method: "POST", pathname: "/book" }, { forceNetworkError: true }).as("offline");

      BookingPage.pickSlot("09:00");
      cy.wait("@offline");
      cy.findByRole("alert").should("contain", "couldn't reach the clinic");

      // Newer intercepts win: let requests through again and retry.
      cy.intercept({ method: "POST", pathname: "/book" }, (req) => req.continue()).as("online");
      BookingPage.pickSlot("09:00");
      cy.wait("@online");
      HoldPage.shouldBeHolding();
    });
  });
});
