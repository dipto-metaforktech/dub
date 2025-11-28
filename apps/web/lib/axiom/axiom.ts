// axiom.ts
import { Axiom } from "@axiomhq/js";

let client: Axiom | null = null;

export function getAxiomClient() {
  // Reuse previously created client
  if (client) return client;

  // If token not available (build time / local), disable Axiom
  if (!process.env.AXIOM_TOKEN) {
    return null;
  }

  // Create the client only when env variable exists
  client = new Axiom({
    token: process.env.AXIOM_TOKEN,
  });

  return client;
}
