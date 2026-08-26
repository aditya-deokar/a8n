import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime/middleware";

// The realtime middleware's published types lag behind inngest v4 generics,
// so the instance is registered through a targeted cast.
type InngestWithRealtime = {
  middleware?: unknown[];
} & ConstructorParameters<typeof Inngest>[0];

export const inngest = new Inngest({
  id: "a8n",
  middleware: [realtimeMiddleware()],
} as InngestWithRealtime);

