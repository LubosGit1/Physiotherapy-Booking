export const AppointmentsPage = {
  visit: () => cy.visit("/appointments"),
  upcoming: () => cy.get("[data-cy=upcoming-appointment]"),
  history: () => cy.get("[data-cy=past-appointment]"),
  appointment: (text: string) => cy.contains("[data-cy=upcoming-appointment]", text),
  cancel(text: string) {
    AppointmentsPage.appointment(text).within(() => {
      cy.findByRole("button", { name: "Cancel appointment" }).click();
      cy.findByRole("button", { name: "Yes, cancel it" }).click();
    });
  },
};
