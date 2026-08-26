import { NodeType } from "@/generated/prisma";
import { httpRequestChannel, HTTP_REQUEST_CHANNEL_NAME } from "./http-request";
import { manualTriggerChannel, MANUAL_TRIGGER_CHANNEL_NAME } from "./manual-trigger";
import { googleFormTriggerChannel, GOOGLE_FORM_TRIGGER_CHANNEL_NAME } from "./google-form-trigger";
import { stripeTriggerChannel, STRIPE_TRIGGER_CHANNEL_NAME } from "./stripe-trigger";
import { geminiChannel, GEMINI_CHANNEL_NAME } from "./gemini";
import { openAiChannel, OPENAI_CHANNEL_NAME } from "./openai";
import { anthropicChannel, ANTHROPIC_CHANNEL_NAME } from "./anthropic";
import { discordChannel, DISCORD_CHANNEL_NAME } from "./discord";
import { slackChannel, SLACK_CHANNEL_NAME } from "./slack";
import { emailChannel, EMAIL_CHANNEL_NAME } from "./email";
import { googleSheetsChannel, GOOGLE_SHEETS_CHANNEL_NAME } from "./google-sheets";

type StatusMessageInput = { nodeId: string; status: "loading" | "success" | "error" };

type ChannelFactory = () => {
  status: (input: StatusMessageInput) => unknown;
};

export const CHANNEL_BY_NODE_TYPE: Record<NodeType, ChannelFactory> = {
  [NodeType.INITIAL]: manualTriggerChannel,
  [NodeType.MANUAL_TRIGGER]: manualTriggerChannel,
  [NodeType.HTTP_REQUEST]: httpRequestChannel,
  [NodeType.GOOGLE_FORM_TRIGGER]: googleFormTriggerChannel,
  [NodeType.STRIPE_TRIGGER]: stripeTriggerChannel,
  [NodeType.GEMINI]: geminiChannel,
  [NodeType.OPENAI]: openAiChannel,
  [NodeType.ANTHROPIC]: anthropicChannel,
  [NodeType.DISCORD]: discordChannel,
  [NodeType.SLACK]: slackChannel,
  [NodeType.EMAIL]: emailChannel,
  [NodeType.GOOGLE_SHEETS]: googleSheetsChannel,
};

export {
  HTTP_REQUEST_CHANNEL_NAME,
  MANUAL_TRIGGER_CHANNEL_NAME,
  GOOGLE_FORM_TRIGGER_CHANNEL_NAME,
  STRIPE_TRIGGER_CHANNEL_NAME,
  GEMINI_CHANNEL_NAME,
  OPENAI_CHANNEL_NAME,
  ANTHROPIC_CHANNEL_NAME,
  DISCORD_CHANNEL_NAME,
  SLACK_CHANNEL_NAME,
  EMAIL_CHANNEL_NAME,
  GOOGLE_SHEETS_CHANNEL_NAME,
};
