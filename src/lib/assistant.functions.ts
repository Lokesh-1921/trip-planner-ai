import { createServerFn } from "@tanstack/react-start";

// Reports which backend pieces are configured. Values are read only inside the handler; nothing secret is returned.
export const getBackendStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    groq: Boolean(process.env["GROQ_API_KEY"]),
    supabase: Boolean(process.env["SUPABASE_URL"] && process.env["SUPABASE_PUBLISHABLE_KEY"]),
  };
});

export type { AssistantOutput } from "./trip.server";
