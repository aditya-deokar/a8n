import { CredentialType, NodeType } from "@/generated/prisma";

export type ExpectedGoalCoverage = {
  nodeTypes: NodeType[];
  credentialTypes: CredentialType[];
  integrations: string[];
  trigger: NodeType;
  externalSideEffects: NodeType[];
  mustAskAbout: string[];
};

export type NonTechnicalGoalEvalCase = {
  id: string;
  persona: string;
  goal: string;
  expected: ExpectedGoalCoverage;
};

const N = NodeType;
const C = CredentialType;

function c(
  id: string,
  persona: string,
  goal: string,
  nodeTypes: NodeType[],
  credentialTypes: CredentialType[],
  integrations: string[],
  trigger: NodeType,
  externalSideEffects: NodeType[],
  mustAskAbout: string[],
): NonTechnicalGoalEvalCase {
  return {
    id,
    persona,
    goal,
    expected: {
      nodeTypes,
      credentialTypes,
      integrations,
      trigger,
      externalSideEffects,
      mustAskAbout,
    },
  };
}

export const NON_TECHNICAL_GOAL_EVALS: NonTechnicalGoalEvalCase[] = [
  c("manual-ai-email-001", "school administrator", "When I click run, ask AI to write a short parent update email from my notes and send it to a parent.", [N.MANUAL_TRIGGER, N.OPENAI, N.EMAIL], [C.OPENAI, C.SMTP_EMAIL], ["openai", "email"], N.MANUAL_TRIGGER, [N.OPENAI, N.EMAIL], ["recipient", "email subject", "notes"]),
  c("manual-ai-slack-002", "team lead", "When I click a button, summarize my status notes with Claude and post the summary to Slack.", [N.MANUAL_TRIGGER, N.ANTHROPIC, N.SLACK], [C.ANTHROPIC], ["anthropic", "slack"], N.MANUAL_TRIGGER, [N.ANTHROPIC, N.SLACK], ["Slack webhook", "status notes"]),
  c("manual-ai-discord-003", "community moderator", "I want to click run, have AI draft a Discord announcement, and post it in my server.", [N.MANUAL_TRIGGER, N.OPENAI, N.DISCORD], [C.OPENAI], ["openai", "discord"], N.MANUAL_TRIGGER, [N.OPENAI, N.DISCORD], ["Discord webhook", "announcement topic"]),
  c("manual-gemini-sheets-004", "teacher", "When I manually run it, ask Gemini to make a lesson summary and save the result to Google Sheets.", [N.MANUAL_TRIGGER, N.GEMINI, N.GOOGLE_SHEETS], [C.GEMINI, C.GOOGLE_SHEETS], ["gemini", "google_sheets"], N.MANUAL_TRIGGER, [N.GEMINI, N.GOOGLE_SHEETS], ["spreadsheet", "sheet name", "lesson notes"]),
  c("manual-http-sheets-005", "operations assistant", "Click a button, call our customer API, and append the response into a spreadsheet.", [N.MANUAL_TRIGGER, N.HTTP_REQUEST, N.GOOGLE_SHEETS], [C.GOOGLE_SHEETS], ["http", "google_sheets"], N.MANUAL_TRIGGER, [N.HTTP_REQUEST, N.GOOGLE_SHEETS], ["API endpoint", "HTTP method", "spreadsheet"]),
  c("form-gemini-email-006", "exam coordinator", "When a student submits a Google Form, Gemini should grade the answer and email the result to the student.", [N.GOOGLE_FORM_TRIGGER, N.GEMINI, N.EMAIL], [C.GEMINI, C.SMTP_EMAIL], ["google_form", "gemini", "email"], N.GOOGLE_FORM_TRIGGER, [N.GEMINI, N.EMAIL], ["Google Form setup", "student email", "grading prompt"]),
  c("form-openai-slack-007", "support manager", "Every Google Form support request should be summarized by OpenAI and sent to Slack.", [N.GOOGLE_FORM_TRIGGER, N.OPENAI, N.SLACK], [C.OPENAI], ["google_form", "openai", "slack"], N.GOOGLE_FORM_TRIGGER, [N.OPENAI, N.SLACK], ["Slack webhook", "summary style"]),
  c("form-claude-discord-008", "club organizer", "When someone fills my event form, Claude should write a friendly recap and send it to Discord.", [N.GOOGLE_FORM_TRIGGER, N.ANTHROPIC, N.DISCORD], [C.ANTHROPIC], ["google_form", "anthropic", "discord"], N.GOOGLE_FORM_TRIGGER, [N.ANTHROPIC, N.DISCORD], ["Discord webhook", "event form fields"]),
  c("form-email-sheets-009", "admissions assistant", "After a Google Form application comes in, email the applicant and save their answers to Google Sheets.", [N.GOOGLE_FORM_TRIGGER, N.EMAIL, N.GOOGLE_SHEETS], [C.SMTP_EMAIL, C.GOOGLE_SHEETS], ["google_form", "email", "google_sheets"], N.GOOGLE_FORM_TRIGGER, [N.EMAIL, N.GOOGLE_SHEETS], ["email template", "spreadsheet", "sheet name"]),
  c("form-http-email-010", "sales coordinator", "When a lead form is submitted, send the answers to our CRM API and email the sales owner.", [N.GOOGLE_FORM_TRIGGER, N.HTTP_REQUEST, N.EMAIL], [C.SMTP_EMAIL], ["google_form", "http", "email"], N.GOOGLE_FORM_TRIGGER, [N.HTTP_REQUEST, N.EMAIL], ["CRM API endpoint", "sales owner email"]),
  c("stripe-slack-011", "founder", "When Stripe gets a successful payment, tell my team in Slack.", [N.STRIPE_TRIGGER, N.SLACK], [], ["stripe", "slack"], N.STRIPE_TRIGGER, [N.SLACK], ["Stripe event", "Slack webhook"]),
  c("stripe-discord-012", "creator", "Post a Discord message every time a Stripe checkout payment succeeds.", [N.STRIPE_TRIGGER, N.DISCORD], [], ["stripe", "discord"], N.STRIPE_TRIGGER, [N.DISCORD], ["Stripe event", "Discord webhook"]),
  c("stripe-email-013", "bookkeeper", "When Stripe sends a paid invoice event, email a receipt note to our finance inbox.", [N.STRIPE_TRIGGER, N.EMAIL], [C.SMTP_EMAIL], ["stripe", "email"], N.STRIPE_TRIGGER, [N.EMAIL], ["finance email", "email subject"]),
  c("stripe-sheets-014", "finance analyst", "Log every successful Stripe payment into Google Sheets.", [N.STRIPE_TRIGGER, N.GOOGLE_SHEETS], [C.GOOGLE_SHEETS], ["stripe", "google_sheets"], N.STRIPE_TRIGGER, [N.GOOGLE_SHEETS], ["spreadsheet", "sheet name"]),
  c("stripe-ai-slack-015", "support lead", "When a Stripe dispute happens, ask OpenAI to summarize it and post the summary to Slack.", [N.STRIPE_TRIGGER, N.OPENAI, N.SLACK], [C.OPENAI], ["stripe", "openai", "slack"], N.STRIPE_TRIGGER, [N.OPENAI, N.SLACK], ["Stripe event", "Slack webhook", "summary prompt"]),
  c("api-openai-email-016", "customer success rep", "Call our ticket API, have OpenAI turn the response into a customer update, and email it.", [N.MANUAL_TRIGGER, N.HTTP_REQUEST, N.OPENAI, N.EMAIL], [C.OPENAI, C.SMTP_EMAIL], ["http", "openai", "email"], N.MANUAL_TRIGGER, [N.HTTP_REQUEST, N.OPENAI, N.EMAIL], ["API endpoint", "recipient", "email subject"]),
  c("api-gemini-discord-017", "community manager", "Fetch new release info from an API, let Gemini make it friendly, then post it to Discord.", [N.MANUAL_TRIGGER, N.HTTP_REQUEST, N.GEMINI, N.DISCORD], [C.GEMINI], ["http", "gemini", "discord"], N.MANUAL_TRIGGER, [N.HTTP_REQUEST, N.GEMINI, N.DISCORD], ["API endpoint", "Discord webhook"]),
  c("api-claude-sheets-018", "research assistant", "Get data from an API, ask Claude to classify it, and store the result in a spreadsheet.", [N.MANUAL_TRIGGER, N.HTTP_REQUEST, N.ANTHROPIC, N.GOOGLE_SHEETS], [C.ANTHROPIC, C.GOOGLE_SHEETS], ["http", "anthropic", "google_sheets"], N.MANUAL_TRIGGER, [N.HTTP_REQUEST, N.ANTHROPIC, N.GOOGLE_SHEETS], ["API endpoint", "classification labels", "spreadsheet"]),
  c("api-slack-019", "ops manager", "Check an external API and post the returned status to Slack.", [N.MANUAL_TRIGGER, N.HTTP_REQUEST, N.SLACK], [], ["http", "slack"], N.MANUAL_TRIGGER, [N.HTTP_REQUEST, N.SLACK], ["API endpoint", "Slack webhook"]),
  c("api-email-020", "office assistant", "Run a web request and email me the response.", [N.MANUAL_TRIGGER, N.HTTP_REQUEST, N.EMAIL], [C.SMTP_EMAIL], ["http", "email"], N.MANUAL_TRIGGER, [N.HTTP_REQUEST, N.EMAIL], ["API endpoint", "recipient"]),
  c("form-openai-sheets-021", "market researcher", "For every survey response, use OpenAI to identify sentiment and save it in Google Sheets.", [N.GOOGLE_FORM_TRIGGER, N.OPENAI, N.GOOGLE_SHEETS], [C.OPENAI, C.GOOGLE_SHEETS], ["google_form", "openai", "google_sheets"], N.GOOGLE_FORM_TRIGGER, [N.OPENAI, N.GOOGLE_SHEETS], ["sentiment labels", "spreadsheet"]),
  c("form-gemini-slack-email-022", "principal", "When a school form is submitted, summarize it with Gemini, post a note to Slack, and email the parent.", [N.GOOGLE_FORM_TRIGGER, N.GEMINI, N.SLACK, N.EMAIL], [C.GEMINI, C.SMTP_EMAIL], ["google_form", "gemini", "slack", "email"], N.GOOGLE_FORM_TRIGGER, [N.GEMINI, N.SLACK, N.EMAIL], ["Slack webhook", "parent email", "email body"]),
  c("form-discord-sheets-023", "club secretary", "When someone joins from my Google Form, welcome them in Discord and record them in a sheet.", [N.GOOGLE_FORM_TRIGGER, N.DISCORD, N.GOOGLE_SHEETS], [C.GOOGLE_SHEETS], ["google_form", "discord", "google_sheets"], N.GOOGLE_FORM_TRIGGER, [N.DISCORD, N.GOOGLE_SHEETS], ["Discord webhook", "spreadsheet"]),
  c("manual-email-024", "assistant", "I want to manually send a prepared email when I click run.", [N.MANUAL_TRIGGER, N.EMAIL], [C.SMTP_EMAIL], ["email"], N.MANUAL_TRIGGER, [N.EMAIL], ["recipient", "subject", "body"]),
  c("manual-slack-025", "manager", "Create a workflow I can run by hand to post an update in Slack.", [N.MANUAL_TRIGGER, N.SLACK], [], ["slack"], N.MANUAL_TRIGGER, [N.SLACK], ["Slack webhook", "message"]),
  c("manual-discord-026", "event host", "Let me click run to send a reminder to a Discord channel.", [N.MANUAL_TRIGGER, N.DISCORD], [], ["discord"], N.MANUAL_TRIGGER, [N.DISCORD], ["Discord webhook", "message"]),
  c("manual-sheets-027", "admin", "When I click run, append a fixed row to Google Sheets.", [N.MANUAL_TRIGGER, N.GOOGLE_SHEETS], [C.GOOGLE_SHEETS], ["google_sheets"], N.MANUAL_TRIGGER, [N.GOOGLE_SHEETS], ["spreadsheet", "sheet name", "row values"]),
  c("manual-openai-028", "writer", "I want a button that asks ChatGPT to rewrite my draft.", [N.MANUAL_TRIGGER, N.OPENAI], [C.OPENAI], ["openai"], N.MANUAL_TRIGGER, [N.OPENAI], ["draft text", "rewrite style"]),
  c("manual-claude-029", "analyst", "Run Claude manually to turn messy notes into a concise action list.", [N.MANUAL_TRIGGER, N.ANTHROPIC], [C.ANTHROPIC], ["anthropic"], N.MANUAL_TRIGGER, [N.ANTHROPIC], ["notes", "action list format"]),
  c("manual-gemini-030", "student", "When I press run, Gemini should summarize my study notes.", [N.MANUAL_TRIGGER, N.GEMINI], [C.GEMINI], ["gemini"], N.MANUAL_TRIGGER, [N.GEMINI], ["study notes", "summary length"]),
  c("stripe-http-031", "developer-lite", "When Stripe reports a new payment, call my fulfillment API.", [N.STRIPE_TRIGGER, N.HTTP_REQUEST], [], ["stripe", "http"], N.STRIPE_TRIGGER, [N.HTTP_REQUEST], ["Stripe event", "API endpoint", "HTTP method"]),
  c("stripe-http-email-032", "store owner", "After a Stripe checkout succeeds, call my shipping API and email the customer.", [N.STRIPE_TRIGGER, N.HTTP_REQUEST, N.EMAIL], [C.SMTP_EMAIL], ["stripe", "http", "email"], N.STRIPE_TRIGGER, [N.HTTP_REQUEST, N.EMAIL], ["shipping API endpoint", "customer email", "email body"]),
  c("stripe-ai-email-033", "customer support", "When a Stripe subscription is cancelled, have AI draft a polite follow-up email.", [N.STRIPE_TRIGGER, N.OPENAI, N.EMAIL], [C.OPENAI, C.SMTP_EMAIL], ["stripe", "openai", "email"], N.STRIPE_TRIGGER, [N.OPENAI, N.EMAIL], ["Stripe event", "email recipient", "tone"]),
  c("stripe-ai-sheets-034", "finance analyst", "Summarize each Stripe invoice event with Claude and save it to Google Sheets.", [N.STRIPE_TRIGGER, N.ANTHROPIC, N.GOOGLE_SHEETS], [C.ANTHROPIC, C.GOOGLE_SHEETS], ["stripe", "anthropic", "google_sheets"], N.STRIPE_TRIGGER, [N.ANTHROPIC, N.GOOGLE_SHEETS], ["Stripe event", "spreadsheet", "summary format"]),
  c("form-http-sheets-035", "marketing ops", "When a lead form arrives, send it to an enrichment API and store the enriched lead in Sheets.", [N.GOOGLE_FORM_TRIGGER, N.HTTP_REQUEST, N.GOOGLE_SHEETS], [C.GOOGLE_SHEETS], ["google_form", "http", "google_sheets"], N.GOOGLE_FORM_TRIGGER, [N.HTTP_REQUEST, N.GOOGLE_SHEETS], ["API endpoint", "spreadsheet", "lead fields"]),
  c("form-http-slack-036", "sales lead", "When someone fills out the form, check their company with an API and alert Slack.", [N.GOOGLE_FORM_TRIGGER, N.HTTP_REQUEST, N.SLACK], [], ["google_form", "http", "slack"], N.GOOGLE_FORM_TRIGGER, [N.HTTP_REQUEST, N.SLACK], ["API endpoint", "Slack webhook"]),
  c("form-openai-email-sheets-037", "recruiter", "When a candidate submits a form, OpenAI should summarize it, email me, and log it in Sheets.", [N.GOOGLE_FORM_TRIGGER, N.OPENAI, N.EMAIL, N.GOOGLE_SHEETS], [C.OPENAI, C.SMTP_EMAIL, C.GOOGLE_SHEETS], ["google_form", "openai", "email", "google_sheets"], N.GOOGLE_FORM_TRIGGER, [N.OPENAI, N.EMAIL, N.GOOGLE_SHEETS], ["recipient", "spreadsheet", "summary prompt"]),
  c("manual-http-ai-slack-038", "incident manager", "Manually fetch incident data from an API, ask Gemini for a short update, and post it to Slack.", [N.MANUAL_TRIGGER, N.HTTP_REQUEST, N.GEMINI, N.SLACK], [C.GEMINI], ["http", "gemini", "slack"], N.MANUAL_TRIGGER, [N.HTTP_REQUEST, N.GEMINI, N.SLACK], ["API endpoint", "Slack webhook"]),
  c("manual-http-ai-discord-039", "gaming community manager", "Click run, get server status from an API, ask AI to explain it simply, and post to Discord.", [N.MANUAL_TRIGGER, N.HTTP_REQUEST, N.OPENAI, N.DISCORD], [C.OPENAI], ["http", "openai", "discord"], N.MANUAL_TRIGGER, [N.HTTP_REQUEST, N.OPENAI, N.DISCORD], ["API endpoint", "Discord webhook"]),
  c("manual-http-ai-email-sheets-040", "analyst", "Run it manually to fetch an API report, summarize with Claude, email the report, and save a row in Sheets.", [N.MANUAL_TRIGGER, N.HTTP_REQUEST, N.ANTHROPIC, N.EMAIL, N.GOOGLE_SHEETS], [C.ANTHROPIC, C.SMTP_EMAIL, C.GOOGLE_SHEETS], ["http", "anthropic", "email", "google_sheets"], N.MANUAL_TRIGGER, [N.HTTP_REQUEST, N.ANTHROPIC, N.EMAIL, N.GOOGLE_SHEETS], ["API endpoint", "recipient", "spreadsheet"]),
  c("form-gemini-discord-sheets-041", "course creator", "For each form response, Gemini should give feedback, post it to Discord, and save it in Sheets.", [N.GOOGLE_FORM_TRIGGER, N.GEMINI, N.DISCORD, N.GOOGLE_SHEETS], [C.GEMINI, C.GOOGLE_SHEETS], ["google_form", "gemini", "discord", "google_sheets"], N.GOOGLE_FORM_TRIGGER, [N.GEMINI, N.DISCORD, N.GOOGLE_SHEETS], ["Discord webhook", "spreadsheet", "feedback prompt"]),
  c("form-claude-email-sheets-042", "coach", "When a client fills out my form, Claude should write coaching feedback, email it, and save it to Sheets.", [N.GOOGLE_FORM_TRIGGER, N.ANTHROPIC, N.EMAIL, N.GOOGLE_SHEETS], [C.ANTHROPIC, C.SMTP_EMAIL, C.GOOGLE_SHEETS], ["google_form", "anthropic", "email", "google_sheets"], N.GOOGLE_FORM_TRIGGER, [N.ANTHROPIC, N.EMAIL, N.GOOGLE_SHEETS], ["recipient", "spreadsheet", "feedback style"]),
  c("stripe-openai-discord-sheets-043", "digital product seller", "For every successful Stripe payment, OpenAI should make a friendly sale note, post it to Discord, and log it in Sheets.", [N.STRIPE_TRIGGER, N.OPENAI, N.DISCORD, N.GOOGLE_SHEETS], [C.OPENAI, C.GOOGLE_SHEETS], ["stripe", "openai", "discord", "google_sheets"], N.STRIPE_TRIGGER, [N.OPENAI, N.DISCORD, N.GOOGLE_SHEETS], ["Stripe event", "Discord webhook", "spreadsheet"]),
  c("stripe-gemini-slack-email-044", "support manager", "When a Stripe refund happens, Gemini should summarize it, alert Slack, and email support.", [N.STRIPE_TRIGGER, N.GEMINI, N.SLACK, N.EMAIL], [C.GEMINI, C.SMTP_EMAIL], ["stripe", "gemini", "slack", "email"], N.STRIPE_TRIGGER, [N.GEMINI, N.SLACK, N.EMAIL], ["Stripe event", "Slack webhook", "support email"]),
  c("manual-openai-slack-email-045", "founder", "Click run to have OpenAI create a weekly update, post it to Slack, and email investors.", [N.MANUAL_TRIGGER, N.OPENAI, N.SLACK, N.EMAIL], [C.OPENAI, C.SMTP_EMAIL], ["openai", "slack", "email"], N.MANUAL_TRIGGER, [N.OPENAI, N.SLACK, N.EMAIL], ["Slack webhook", "investor email", "update notes"]),
  c("manual-gemini-discord-email-046", "nonprofit coordinator", "Manually generate a volunteer update with Gemini, send it to Discord, and email the volunteer list.", [N.MANUAL_TRIGGER, N.GEMINI, N.DISCORD, N.EMAIL], [C.GEMINI, C.SMTP_EMAIL], ["gemini", "discord", "email"], N.MANUAL_TRIGGER, [N.GEMINI, N.DISCORD, N.EMAIL], ["Discord webhook", "email list", "update content"]),
  c("form-openai-http-047", "support ops", "When a form arrives, OpenAI should classify the issue and send the classification to our helpdesk API.", [N.GOOGLE_FORM_TRIGGER, N.OPENAI, N.HTTP_REQUEST], [C.OPENAI], ["google_form", "openai", "http"], N.GOOGLE_FORM_TRIGGER, [N.OPENAI, N.HTTP_REQUEST], ["classification labels", "helpdesk API endpoint"]),
  c("form-gemini-http-email-048", "school office", "For each form response, Gemini should decide the category, send it to an API, and email the office.", [N.GOOGLE_FORM_TRIGGER, N.GEMINI, N.HTTP_REQUEST, N.EMAIL], [C.GEMINI, C.SMTP_EMAIL], ["google_form", "gemini", "http", "email"], N.GOOGLE_FORM_TRIGGER, [N.GEMINI, N.HTTP_REQUEST, N.EMAIL], ["API endpoint", "office email", "category rules"]),
  c("stripe-http-slack-sheets-049", "operations lead", "When Stripe payment succeeds, call our order API, notify Slack, and save the event to Google Sheets.", [N.STRIPE_TRIGGER, N.HTTP_REQUEST, N.SLACK, N.GOOGLE_SHEETS], [C.GOOGLE_SHEETS], ["stripe", "http", "slack", "google_sheets"], N.STRIPE_TRIGGER, [N.HTTP_REQUEST, N.SLACK, N.GOOGLE_SHEETS], ["order API endpoint", "Slack webhook", "spreadsheet"]),
  c("manual-http-openai-sheets-slack-050", "operations analyst", "When I click run, fetch metrics from an API, ask OpenAI to summarize them, save them to Sheets, and post the summary to Slack.", [N.MANUAL_TRIGGER, N.HTTP_REQUEST, N.OPENAI, N.GOOGLE_SHEETS, N.SLACK], [C.OPENAI, C.GOOGLE_SHEETS], ["http", "openai", "google_sheets", "slack"], N.MANUAL_TRIGGER, [N.HTTP_REQUEST, N.OPENAI, N.GOOGLE_SHEETS, N.SLACK], ["API endpoint", "spreadsheet", "Slack webhook"]),
];
