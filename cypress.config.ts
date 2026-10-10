import { defineConfig } from "cypress";

type RaceRequest = { baseUrl: string; path: string; sessionCookies: string[]; body: unknown };

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3100",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    viewportWidth: 1280,
    viewportHeight: 900,
    defaultCommandTimeout: 8000,
    retries: { runMode: 2, openMode: 0 },
    video: false,
    env: {
      e2eSecret: process.env.E2E_TEST_SECRET ?? "local-e2e-secret",
    },
    setupNodeEvents(on) {
      on("task", {
        /**
         * Fires the same request for several users at the same moment from Node.
         * Cypress commands run one after another, so a real race has to start here.
         */
        async race({ baseUrl, path, sessionCookies, body }: RaceRequest) {
          const responses = await Promise.all(
            sessionCookies.map((cookie) =>
              fetch(new URL(path, baseUrl), {
                method: "POST",
                headers: { "content-type": "application/json", cookie },
                body: JSON.stringify(body),
              }),
            ),
          );
          return responses.map((r) => r.status);
        },
      });
    },
  },
});
