/**
 * Page objects keep selectors in one place and let specs read like the user's steps.
 * They prefer accessible queries (role + name) so the tests also guard accessibility.
 */
export const BookingPage = {
  visit(params: { service?: string; therapist?: string; date?: string } = {}) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    cy.visit(query ? `/book?${query}` : "/book");
  },

  chooseService(name: string) {
    cy.get("[data-cy=service-option]").contains(name).click();
    cy.get("[data-cy=service-option][aria-current=true]").should("contain", name);
  },

  chooseTherapist(name: string) {
    cy.get("[data-cy=therapist-option]").contains(name).click();
    cy.get("[data-cy=therapist-option][aria-current=true]").should("contain", name);
  },

  chooseDay(date: string) {
    cy.get(`[data-cy=day-option][data-date="${date}"]`).click();
    cy.get(`[data-cy=day-option][data-date="${date}"]`).should("have.attr", "aria-current", "date");
  },

  slots: () => cy.get("[data-cy=slot]"),

  slot: (time: string) => cy.findByRole("button", { name: new RegExp(`^${time} with `) }),

  pickSlot(time: string) {
    BookingPage.slot(time).click();
  },

  shouldOffer(time: string) {
    BookingPage.slot(time).should("be.visible");
  },

  shouldNotOffer(time: string) {
    cy.get("body").then(($body) => {
      if ($body.find("[data-cy=slot]").length === 0) return;
      cy.findByRole("button", { name: new RegExp(`^${time} with `) }).should("not.exist");
    });
  },

  firstSlotTime: () => BookingPage.slots().first().invoke("attr", "aria-label").then((label) => String(label).slice(0, 5)),

  noSlotsMessage: () => cy.get("[data-cy=no-slots]"),
};
