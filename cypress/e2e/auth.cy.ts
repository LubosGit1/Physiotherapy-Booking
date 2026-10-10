import { FIXTURE_PASSWORD, USERS } from "../support/clinic";

describe("Accounts and access", () => {
  beforeEach(() => cy.resetClinic());

  it("registers a new client with clear validation messages", () => {
    cy.visit("/register");
    cy.findByRole("button", { name: "Create account" }).click();
    cy.findByRole("alert").should("have.text", "Enter your full name.");

    cy.findByLabelText("Full name").type("Petra Lane");
    cy.findByLabelText("Email").type("petra@example.com");
    cy.findByLabelText("Password").type("short");
    cy.findByRole("button", { name: "Create account" }).click();
    cy.findByRole("alert").should("have.text", "Use at least 8 characters for your password.");
    // What the user typed survives the failed submit.
    cy.findByLabelText("Full name").should("have.value", "Petra Lane");

    cy.findByLabelText("Password").clear().type("a-long-password");
    cy.findByRole("button", { name: "Create account" }).click();
    cy.location("pathname").should("eq", "/book");
    cy.get("[data-cy=signed-in-as]").should("have.text", "Petra Lane");
  });

  it("won't register an email twice", () => {
    cy.visit("/register");
    cy.findByLabelText("Full name").type("Anna Again");
    cy.findByLabelText("Email").type(USERS.anna.email.toUpperCase());
    cy.findByLabelText("Password").type("another-password");
    cy.findByRole("button", { name: "Create account" }).click();
    cy.findByRole("alert").should("contain", "already exists");
  });

  it("sends each role to its own home and keeps them out of other areas", () => {
    const homes = { anna: "/appointments", emma: "/schedule", admin: "/admin" } as const;
    (Object.keys(homes) as (keyof typeof homes)[]).forEach((user) => {
      cy.clearCookies();
      cy.visit("/login");
      cy.loginThroughForm(user);
      cy.location("pathname").should("eq", homes[user]);
    });

    cy.visit("/appointments"); // signed in as admin
    cy.location("pathname").should("eq", "/forbidden");
    cy.findByRole("heading", { name: "This page is for clinic staff" });
  });

  it("returns to the requested page after signing in", () => {
    cy.visit("/appointments");
    cy.location("pathname").should("eq", "/login");
    cy.loginThroughForm("anna");
    cy.location("pathname").should("eq", "/appointments");
  });

  it("ignores callback URLs that point to other sites", () => {
    cy.visit("/login?callbackUrl=https://evil.example/steal");
    cy.loginThroughForm("anna");
    cy.location("origin").should("eq", Cypress.config("baseUrl"));
    cy.location("pathname").should("eq", "/appointments");
  });

  it("locks sign-in after 5 failed attempts until 15 minutes have passed", () => {
    cy.visit("/login");
    const attempt = (password: string) => {
      cy.findByLabelText("Email").clear().type(USERS.anna.email);
      cy.findByLabelText("Password").clear().type(password, { log: false });
      cy.findByRole("button", { name: "Sign in" }).click();
    };

    for (let i = 1; i <= 4; i++) {
      attempt(`wrong-${i}`);
      cy.findByRole("alert").should("have.text", "That email and password don't match.");
    }
    attempt("wrong-5");
    cy.findByRole("alert").should("have.text", "Too many sign-in attempts. Try again in 15 minutes.");

    // Even the right password is refused while locked.
    attempt(FIXTURE_PASSWORD);
    cy.findByRole("alert").should("contain", "Too many sign-in attempts");
    cy.location("pathname").should("eq", "/login");

    cy.advanceServerTime(15);
    attempt(FIXTURE_PASSWORD);
    cy.location("pathname").should("eq", "/appointments");
  });
});
