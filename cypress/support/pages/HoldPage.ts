export const HoldPage = {
  shouldBeHolding() {
    cy.location("pathname").should("match", /^\/book\/hold\/[0-9a-f-]{36}$/);
    cy.findByRole("heading", { name: "We're holding this time for you" }).should("be.visible");
  },
  countdown: () => cy.findByRole("timer"),
  summary: () => cy.get("[data-cy=hold-summary]"),
  confirm: () => cy.findByRole("button", { name: "Confirm booking" }).click(),
  chooseDifferentTime: () => cy.findByRole("button", { name: "Choose a different time" }).click(),
  shouldBeExpired: () => cy.findByRole("heading", { name: "Your hold has run out" }).should("be.visible"),
};
