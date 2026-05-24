import { realtimeMiddleware } from "@inngest/realtime/middleware";
import { Inngest } from "inngest";

export const inngest = new Inngest({ 
  id: "a8n",
  middleware: [realtimeMiddleware() as any],
});
