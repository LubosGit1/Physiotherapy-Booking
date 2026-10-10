import { SERVICES, THERAPISTS, TUESDAY } from "../support/clinic";
import { BookingPage } from "../support/pages/BookingPage";
import { HoldPage } from "../support/pages/HoldPage";

const bookingUrl = `/book?service=${SERVICES.massage.id}&therapist=${THERAPISTS.emma}&date=${TUESDAY}`;

describe("Accessibility (axe, WCAG 2.1 AA)", () => {
  beforeEach(() => cy.resetClinic());

  ["/", "/login", "/register", bookingUrl].forEach((url) => {
    it(`public page ${url}`, () => {
      cy.visit(url);
      cy.checkPageA11y();
    });
  });

  it("client pages: hold and appointments", () => {
    cy.loginAs("anna");
    cy.visit(bookingUrl);
    BookingPage.pickSlot("09:00");
    HoldPage.shouldBeHolding();
    cy.checkPageA11y();

    HoldPage.confirm();
    cy.location("pathname").should("eq", "/appointments");
    cy.checkPageA11y();
  });

  it("staff pages: schedule and admin", () => {
    cy.loginAs("emma");
    cy.visit("/schedule");
    cy.checkPageA11y();

    cy.loginAs("admin");
    cy.visit("/admin");
    cy.checkPageA11y();
  });

  it("offers a skip link to the main content", () => {
    cy.visit("/book");
    cy.findByRole("link", { name: "Skip to content" }).should("have.attr", "href", "#main");
    cy.get("main#main").should("exist");
  });
});

describe("Phone layout", () => {
  beforeEach(() => {
    cy.resetClinic();
    cy.viewport("iphone-x");
  });

  it("books on a small screen", () => {
    cy.loginAs("anna");
    BookingPage.visit();
    BookingPage.chooseService("Follow-up treatment");
    BookingPage.chooseTherapist("Emma Hart");

    // The day strip scrolls sideways instead of widening the page.
    cy.get("[data-cy=day-list]").then(($list) => expect($list[0].scrollWidth).to.be.greaterThan($list[0].clientWidth));
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth));

    BookingPage.chooseDay(TUESDAY);
    BookingPage.slot("08:00").scrollIntoView().should("be.visible").click();
    HoldPage.shouldBeHolding();
    HoldPage.confirm();
    cy.findByRole("status").should("contain", "You're booked");
  });
});
