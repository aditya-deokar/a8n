import { CredentialType, NodeType } from "@/generated/prisma";
import { z } from "zod";

export type NodeCategory = "system" | "trigger" | "action" | "ai";
export type NodeRiskLevel = "low" | "medium" | "high";

export interface NodeFieldManifest {
  name: string;
  label: string;
  type: "string" | "enum" | "json" | "url";
  required: boolean;
  description: string;
  example?: string;
}

export interface NodeOutputManifest {
  variablePath: string;
  description: string;
  example?: string;
}

export interface NodeManifest {
  type: NodeType;
  label: string;
  category: NodeCategory;
  description: string;
  beginnerDescription: string;
  aliases: string[];
  requiredFields: NodeFieldManifest[];
  optionalFields: NodeFieldManifest[];
  credentialType?: CredentialType;
  sideEffect: boolean;
  riskLevel: NodeRiskLevel;
  setup: string[];
  outputs: NodeOutputManifest[];
  outputSchema: z.ZodTypeAny;
  examples: string[];
  configSchema: z.ZodTypeAny;
}

export interface CredentialTypeManifest {
  type: CredentialType;
  label: string;
  description: string;
  usedBy: NodeType[];
  valueFormat: string;
  setup: string[];
  sensitive: boolean;
}

export interface WorkflowTemplateManifest {
  id: string;
  label: string;
  description: string;
  nodeTypes: NodeType[];
  requiredCredentialTypes: CredentialType[];
  aliases: string[];
}

const variableNameSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/);

const aiNodeSchema = z.object({
  variableName: variableNameSchema,
  credentialId: z.string().min(1),
  systemPrompt: z.string().optional(),
  userPrompt: z.string().min(1),
});

const emptyOutputSchema = z.object({});
const aiOutputSchema = z.object({ text: z.string() });
const httpOutputSchema = z.object({
  httpResponse: z.object({
    status: z.number(),
    statusText: z.string(),
    data: z.unknown(),
  }),
});
const messageOutputSchema = z.object({
  messageContent: z.string(),
});
const emailOutputSchema = z.object({
  messageId: z.string().optional(),
  accepted: z.array(z.unknown()).optional(),
  rejected: z.array(z.unknown()).optional(),
  response: z.string().optional(),
  envelope: z.unknown().optional(),
  to: z.string(),
  subject: z.string(),
});
const googleSheetsOutputSchema = z.object({
  spreadsheetId: z.string(),
  sheetName: z.string(),
  updatedRange: z.string().optional(),
  updatedRows: z.number().optional(),
  updatedColumns: z.number().optional(),
  updatedCells: z.number().optional(),
});
const googleFormOutputSchema = z.object({
  googleForm: z.object({
    formId: z.unknown().optional(),
    formTitle: z.unknown().optional(),
    responseId: z.unknown().optional(),
    timestamp: z.unknown().optional(),
    respondentEmail: z.unknown().optional(),
    responses: z.unknown().optional(),
    raw: z.unknown(),
  }),
});
const stripeOutputSchema = z.object({
  stripe: z.object({
    eventId: z.unknown().optional(),
    eventType: z.unknown().optional(),
    timestamp: z.unknown().optional(),
    livemode: z.unknown().optional(),
    raw: z.unknown().optional(),
  }),
});

const aiRequiredFields: NodeFieldManifest[] = [
  {
    name: "variableName",
    label: "Result name",
    type: "string",
    required: true,
    description: "A short name used by later steps to reference the AI response.",
    example: "aiSummary",
  },
  {
    name: "credentialId",
    label: "AI credential",
    type: "string",
    required: true,
    description: "The saved credential for this AI provider.",
  },
  {
    name: "userPrompt",
    label: "Prompt",
    type: "string",
    required: true,
    description: "The instruction sent to the AI model. Template variables are supported.",
    example: "Summarize this: {{json googleForm.responses}}",
  },
];

const aiOptionalFields: NodeFieldManifest[] = [
  {
    name: "systemPrompt",
    label: "Assistant behavior",
    type: "string",
    required: false,
    description: "Optional behavior instructions for the AI model.",
    example: "You are a concise customer support assistant.",
  },
];

export const NODE_MANIFESTS: NodeManifest[] = [
  {
    type: NodeType.INITIAL,
    label: "Initial placeholder",
    category: "system",
    description: "Internal placeholder node created with a new workflow.",
    beginnerDescription: "A temporary starting point that is replaced when the first real step is added.",
    aliases: ["start placeholder", "empty workflow"],
    requiredFields: [],
    optionalFields: [],
    sideEffect: false,
    riskLevel: "low",
    setup: [],
    outputs: [],
    outputSchema: emptyOutputSchema,
    examples: [],
    configSchema: z.object({}),
  },
  {
    type: NodeType.MANUAL_TRIGGER,
    label: "Manual trigger",
    category: "trigger",
    description: "Starts a workflow when the user clicks the run button.",
    beginnerDescription: "Use this when you want to test or run the workflow yourself.",
    aliases: ["manual", "button", "run by hand", "start manually"],
    requiredFields: [],
    optionalFields: [],
    sideEffect: false,
    riskLevel: "low",
    setup: ["No setup is required."],
    outputs: [],
    outputSchema: emptyOutputSchema,
    examples: ["Run an AI summary workflow only when I click a button."],
    configSchema: z.object({}),
  },
  {
    type: NodeType.GOOGLE_FORM_TRIGGER,
    label: "Google Form trigger",
    category: "trigger",
    description: "Starts a workflow when a Google Form submission reaches the webhook endpoint.",
    beginnerDescription: "Use this when every new form response should start the automation.",
    aliases: ["google forms", "form response", "survey", "quiz", "submission"],
    requiredFields: [],
    optionalFields: [],
    sideEffect: false,
    riskLevel: "medium",
    setup: [
      "Create or open a Google Form.",
      "Copy the generated Apps Script from a8n.",
      "Add an On form submit trigger in Google Apps Script.",
      "Submit a sample form response to test the workflow.",
    ],
    outputs: [
      {
        variablePath: "googleForm.respondentEmail",
        description: "The respondent email when the form collects email addresses.",
        example: "{{googleForm.respondentEmail}}",
      },
      {
        variablePath: "googleForm.responses",
        description: "All answers keyed by question title.",
        example: "{{json googleForm.responses}}",
      },
    ],
    outputSchema: googleFormOutputSchema,
    examples: ["When someone submits my Google Form, summarize the answer and email them."],
    configSchema: z.object({}),
  },
  {
    type: NodeType.STRIPE_TRIGGER,
    label: "Stripe event trigger",
    category: "trigger",
    description: "Starts a workflow when Stripe sends an event to the webhook endpoint.",
    beginnerDescription: "Use this for payment or subscription alerts from Stripe.",
    aliases: ["stripe", "payment", "checkout", "subscription", "invoice"],
    requiredFields: [],
    optionalFields: [],
    sideEffect: false,
    riskLevel: "medium",
    setup: [
      "Copy the Stripe webhook URL from a8n.",
      "Add it as an endpoint in Stripe Dashboard > Developers > Webhooks.",
      "Select the Stripe events that should start the workflow.",
      "Send a test event from Stripe.",
    ],
    outputs: [
      {
        variablePath: "stripe.eventType",
        description: "The Stripe event type.",
        example: "{{stripe.eventType}}",
      },
      {
        variablePath: "stripe.raw",
        description: "The raw Stripe object from the event payload.",
        example: "{{json stripe.raw}}",
      },
    ],
    outputSchema: stripeOutputSchema,
    examples: ["When a payment succeeds in Stripe, post a message to Slack."],
    configSchema: z.object({}),
  },
  {
    type: NodeType.HTTP_REQUEST,
    label: "HTTP request",
    category: "action",
    description: "Calls an external API endpoint.",
    beginnerDescription: "Use this when you need to fetch or send data to another app that has an API.",
    aliases: ["api", "web request", "fetch", "rest", "webhook call"],
    requiredFields: [
      {
        name: "variableName",
        label: "Result name",
        type: "string",
        required: true,
        description: "A short name used by later steps to reference the API response.",
        example: "apiResult",
      },
      {
        name: "endpoint",
        label: "Endpoint URL",
        type: "url",
        required: true,
        description: "The API URL to call. Template variables are supported.",
        example: "https://api.example.com/users/{{user.id}}",
      },
      {
        name: "method",
        label: "Method",
        type: "enum",
        required: true,
        description: "The HTTP method to use.",
        example: "GET",
      },
    ],
    optionalFields: [
      {
        name: "body",
        label: "Request body",
        type: "json",
        required: false,
        description: "JSON body for POST, PUT, and PATCH requests.",
        example: "{\"name\":\"{{googleForm.responses.Name}}\"}",
      },
    ],
    sideEffect: true,
    riskLevel: "medium",
    setup: ["Confirm the API endpoint, method, and any required JSON body."],
    outputs: [
      {
        variablePath: "<variableName>.httpResponse.data",
        description: "The API response body.",
        example: "{{json apiResult.httpResponse.data}}",
      },
    ],
    outputSchema: httpOutputSchema,
    examples: ["Call an API and save the response to Google Sheets."],
    configSchema: z.object({
      variableName: variableNameSchema,
      endpoint: z.string().min(1),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
      body: z.string().optional(),
    }),
  },
  {
    type: NodeType.OPENAI,
    label: "OpenAI",
    category: "ai",
    description: "Generates text using an OpenAI model.",
    beginnerDescription: "Use this to summarize, classify, rewrite, or generate text with OpenAI.",
    aliases: ["openai", "gpt", "chatgpt", "ai summary", "ai writing"],
    requiredFields: aiRequiredFields,
    optionalFields: aiOptionalFields,
    credentialType: CredentialType.OPENAI,
    sideEffect: true,
    riskLevel: "medium",
    setup: ["Add an OpenAI API key as an OPENAI credential."],
    outputs: [{ variablePath: "<variableName>.text", description: "Generated text.", example: "{{aiSummary.text}}" }],
    outputSchema: aiOutputSchema,
    examples: ["Use OpenAI to summarize a Google Form response."],
    configSchema: aiNodeSchema,
  },
  {
    type: NodeType.ANTHROPIC,
    label: "Anthropic",
    category: "ai",
    description: "Generates text using an Anthropic Claude model.",
    beginnerDescription: "Use this to summarize, classify, rewrite, or generate text with Anthropic Claude.",
    aliases: ["anthropic", "claude", "ai summary", "ai writing"],
    requiredFields: aiRequiredFields,
    optionalFields: aiOptionalFields,
    credentialType: CredentialType.ANTHROPIC,
    sideEffect: true,
    riskLevel: "medium",
    setup: ["Add an Anthropic API key as an ANTHROPIC credential."],
    outputs: [{ variablePath: "<variableName>.text", description: "Generated text.", example: "{{aiSummary.text}}" }],
    outputSchema: aiOutputSchema,
    examples: ["Use Claude to draft a support reply from form details."],
    configSchema: aiNodeSchema,
  },
  {
    type: NodeType.GEMINI,
    label: "Gemini",
    category: "ai",
    description: "Generates text using a Google Gemini model.",
    beginnerDescription: "Use this to summarize, classify, rewrite, or generate text with Gemini.",
    aliases: ["gemini", "google ai", "ai summary", "ai writing"],
    requiredFields: aiRequiredFields,
    optionalFields: aiOptionalFields,
    credentialType: CredentialType.GEMINI,
    sideEffect: true,
    riskLevel: "medium",
    setup: ["Add a Google AI API key as a GEMINI credential."],
    outputs: [{ variablePath: "<variableName>.text", description: "Generated text.", example: "{{aiSummary.text}}" }],
    outputSchema: aiOutputSchema,
    examples: ["Use Gemini to grade a quiz answer from Google Forms."],
    configSchema: aiNodeSchema,
  },
  {
    type: NodeType.DISCORD,
    label: "Discord",
    category: "action",
    description: "Sends a message to Discord through a webhook URL.",
    beginnerDescription: "Use this to post workflow results into a Discord channel.",
    aliases: ["discord", "discord webhook", "post to discord", "channel message"],
    requiredFields: [
      { name: "variableName", label: "Result name", type: "string", required: true, description: "Name for this message result.", example: "discordMessage" },
      { name: "webhookUrl", label: "Webhook URL", type: "url", required: true, description: "Discord webhook URL from channel integrations." },
      { name: "content", label: "Message", type: "string", required: true, description: "Message content. Template variables are supported.", example: "Summary: {{aiSummary.text}}" },
    ],
    optionalFields: [
      { name: "username", label: "Bot username", type: "string", required: false, description: "Optional webhook username override.", example: "Workflow Bot" },
    ],
    sideEffect: true,
    riskLevel: "medium",
    setup: ["Create a Discord webhook in the target channel and paste the webhook URL."],
    outputs: [{ variablePath: "<variableName>.messageContent", description: "The sent message content." }],
    outputSchema: messageOutputSchema,
    examples: ["Post a payment alert to Discord."],
    configSchema: z.object({
      variableName: variableNameSchema,
      webhookUrl: z.string().min(1),
      content: z.string().min(1).max(2000),
      username: z.string().optional(),
    }),
  },
  {
    type: NodeType.SLACK,
    label: "Slack",
    category: "action",
    description: "Sends a message to Slack through a webhook URL.",
    beginnerDescription: "Use this to post workflow results into a Slack channel.",
    aliases: ["slack", "slack webhook", "post to slack", "team message"],
    requiredFields: [
      { name: "variableName", label: "Result name", type: "string", required: true, description: "Name for this message result.", example: "slackMessage" },
      { name: "webhookUrl", label: "Webhook URL", type: "url", required: true, description: "Slack workflow or incoming webhook URL." },
      { name: "content", label: "Message", type: "string", required: true, description: "Message content. Template variables are supported.", example: "Summary: {{aiSummary.text}}" },
    ],
    optionalFields: [],
    sideEffect: true,
    riskLevel: "medium",
    setup: ["Create a Slack workflow/webhook and paste the webhook URL."],
    outputs: [{ variablePath: "<variableName>.messageContent", description: "The sent message content." }],
    outputSchema: messageOutputSchema,
    examples: ["Post new Stripe payments to Slack."],
    configSchema: z.object({
      variableName: variableNameSchema,
      webhookUrl: z.string().min(1),
      content: z.string().min(1),
    }),
  },
  {
    type: NodeType.EMAIL,
    label: "Email",
    category: "action",
    description: "Sends an email through an SMTP credential.",
    beginnerDescription: "Use this to send a personalized email from workflow data.",
    aliases: ["email", "smtp", "send email", "mail", "notify by email"],
    requiredFields: [
      { name: "variableName", label: "Result name", type: "string", required: true, description: "Name for this email result.", example: "emailResult" },
      { name: "credentialId", label: "SMTP credential", type: "string", required: true, description: "Saved SMTP_EMAIL credential." },
      { name: "to", label: "Recipient", type: "string", required: true, description: "Recipient email address. Template variables are supported.", example: "{{googleForm.respondentEmail}}" },
      { name: "subject", label: "Subject", type: "string", required: true, description: "Email subject." },
      { name: "body", label: "Body", type: "string", required: true, description: "Email body. Template variables are supported." },
    ],
    optionalFields: [
      { name: "from", label: "From override", type: "string", required: false, description: "Optional sender override." },
      { name: "replyTo", label: "Reply-to", type: "string", required: false, description: "Optional reply-to address." },
    ],
    credentialType: CredentialType.SMTP_EMAIL,
    sideEffect: true,
    riskLevel: "high",
    setup: ["Add an SMTP_EMAIL credential as JSON with host, port, user, and pass."],
    outputs: [{ variablePath: "<variableName>.messageId", description: "The provider message ID after sending." }],
    outputSchema: emailOutputSchema,
    examples: ["Email a Google Form respondent with an AI-generated summary."],
    configSchema: z.object({
      variableName: variableNameSchema,
      credentialId: z.string().min(1),
      to: z.string().min(1),
      subject: z.string().min(1),
      body: z.string().min(1),
      from: z.string().optional(),
      replyTo: z.string().optional(),
    }),
  },
  {
    type: NodeType.GOOGLE_SHEETS,
    label: "Google Sheets",
    category: "action",
    description: "Appends a row to a Google Sheet using a service account credential.",
    beginnerDescription: "Use this to save workflow results into a spreadsheet row.",
    aliases: ["google sheets", "spreadsheet", "sheet", "append row", "save row"],
    requiredFields: [
      { name: "variableName", label: "Result name", type: "string", required: true, description: "Name for this sheet result.", example: "sheetResult" },
      { name: "credentialId", label: "Google Sheets credential", type: "string", required: true, description: "Saved GOOGLE_SHEETS service account credential." },
      { name: "spreadsheetId", label: "Spreadsheet ID", type: "string", required: true, description: "The ID from the Google Sheet URL." },
      { name: "sheetName", label: "Sheet name", type: "string", required: true, description: "The tab name to append into.", example: "Results" },
      { name: "rowJson", label: "Row JSON", type: "json", required: true, description: "A JSON array that renders to one row.", example: "[\"{{googleForm.respondentEmail}}\", \"{{aiSummary.text}}\"]" },
    ],
    optionalFields: [],
    credentialType: CredentialType.GOOGLE_SHEETS,
    sideEffect: true,
    riskLevel: "medium",
    setup: [
      "Add a GOOGLE_SHEETS service account credential.",
      "Share the target Google Sheet with the service account client_email.",
    ],
    outputs: [{ variablePath: "<variableName>.updatedRange", description: "The updated sheet range." }],
    outputSchema: googleSheetsOutputSchema,
    examples: ["Append each form response and AI summary to Google Sheets."],
    configSchema: z.object({
      variableName: variableNameSchema,
      credentialId: z.string().min(1),
      spreadsheetId: z.string().min(1),
      sheetName: z.string().min(1),
      rowJson: z.string().min(1),
    }),
  },
];

export const CREDENTIAL_TYPE_MANIFESTS: CredentialTypeManifest[] = [
  {
    type: CredentialType.OPENAI,
    label: "OpenAI API key",
    description: "Lets OpenAI nodes generate text.",
    usedBy: [NodeType.OPENAI],
    valueFormat: "OpenAI API key, usually starting with sk-",
    setup: ["Create an API key in the OpenAI dashboard and store it as an OPENAI credential."],
    sensitive: true,
  },
  {
    type: CredentialType.ANTHROPIC,
    label: "Anthropic API key",
    description: "Lets Anthropic nodes generate text with Claude.",
    usedBy: [NodeType.ANTHROPIC],
    valueFormat: "Anthropic API key, usually starting with sk-ant-",
    setup: ["Create an API key in Anthropic Console and store it as an ANTHROPIC credential."],
    sensitive: true,
  },
  {
    type: CredentialType.GEMINI,
    label: "Gemini API key",
    description: "Lets Gemini nodes generate text.",
    usedBy: [NodeType.GEMINI],
    valueFormat: "Google AI Studio API key",
    setup: ["Create an API key in Google AI Studio and store it as a GEMINI credential."],
    sensitive: true,
  },
  {
    type: CredentialType.SMTP_EMAIL,
    label: "SMTP email credential",
    description: "Lets Email nodes send messages through an SMTP server.",
    usedBy: [NodeType.EMAIL],
    valueFormat: "JSON object with host, port, user, pass, optional secure/from",
    setup: ["Create SMTP credentials with your email provider and store them as SMTP_EMAIL JSON."],
    sensitive: true,
  },
  {
    type: CredentialType.GOOGLE_SHEETS,
    label: "Google Sheets service account",
    description: "Lets Google Sheets nodes append rows to spreadsheets.",
    usedBy: [NodeType.GOOGLE_SHEETS],
    valueFormat: "Google service-account JSON with client_email and private_key",
    setup: ["Create a Google Cloud service account key, then share the target sheet with client_email."],
    sensitive: true,
  },
];

export const WORKFLOW_TEMPLATE_MANIFESTS: WorkflowTemplateManifest[] = [
  {
    id: "google-form-ai-email",
    label: "Summarize a Google Form response and email the respondent",
    description: "Google Form submission -> AI summary -> Email reply.",
    nodeTypes: [NodeType.GOOGLE_FORM_TRIGGER, NodeType.GEMINI, NodeType.EMAIL],
    requiredCredentialTypes: [CredentialType.GEMINI, CredentialType.SMTP_EMAIL],
    aliases: ["form summary email", "quiz feedback", "respond to form"],
  },
  {
    id: "stripe-slack-alert",
    label: "Post Stripe payment alerts to Slack",
    description: "Stripe event -> Slack message.",
    nodeTypes: [NodeType.STRIPE_TRIGGER, NodeType.SLACK],
    requiredCredentialTypes: [],
    aliases: ["payment alert", "stripe notification", "slack alert"],
  },
  {
    id: "http-to-sheets",
    label: "Call an API and save the result to Google Sheets",
    description: "Manual trigger -> HTTP request -> Google Sheets row.",
    nodeTypes: [NodeType.MANUAL_TRIGGER, NodeType.HTTP_REQUEST, NodeType.GOOGLE_SHEETS],
    requiredCredentialTypes: [CredentialType.GOOGLE_SHEETS],
    aliases: ["api to spreadsheet", "save api response", "append row"],
  },
  {
    id: "ai-to-discord",
    label: "Generate an AI message and post it to Discord",
    description: "Manual trigger -> AI text -> Discord message.",
    nodeTypes: [NodeType.MANUAL_TRIGGER, NodeType.OPENAI, NodeType.DISCORD],
    requiredCredentialTypes: [CredentialType.OPENAI],
    aliases: ["ai discord", "post to channel", "generate message"],
  },
];

export function getNodeManifest(type: NodeType): NodeManifest {
  const manifest = NODE_MANIFESTS.find((entry) => entry.type === type);
  if (!manifest) {
    throw new Error(`No node manifest found for node type: ${type}`);
  }

  return manifest;
}

export function getCredentialTypeManifest(
  type: CredentialType,
): CredentialTypeManifest {
  const manifest = CREDENTIAL_TYPE_MANIFESTS.find((entry) => entry.type === type);
  if (!manifest) {
    throw new Error(`No credential manifest found for credential type: ${type}`);
  }

  return manifest;
}

export function getNodeCatalog() {
  return NODE_MANIFESTS.map(({
    configSchema: _configSchema,
    outputSchema: _outputSchema,
    ...entry
  }) => entry);
}

export function getCredentialCatalog() {
  return CREDENTIAL_TYPE_MANIFESTS;
}

export const INTEGRATION_SERVICE_KEYS = [
  "openai",
  "anthropic",
  "gemini",
  "slack",
  "discord",
  "http",
  "email",
  "google_sheets",
  "google_form",
  "stripe",
] as const;

export type IntegrationServiceKey = (typeof INTEGRATION_SERVICE_KEYS)[number];

export function getIntegrationSetupGuide(service: IntegrationServiceKey): string {
  const byService: Record<IntegrationServiceKey, string> = {
    openai: [
      "# OpenAI setup",
      "",
      "1. Create an OpenAI API key.",
      "2. Save it as an OPENAI credential in a8n.",
      "3. Add an OpenAI node with a result name and prompt.",
      "4. Reference its output later as `{{openAiResult.text}}`.",
    ].join("\n"),
    anthropic: [
      "# Anthropic setup",
      "",
      "1. Create an Anthropic API key.",
      "2. Save it as an ANTHROPIC credential in a8n.",
      "3. Add an Anthropic node with a result name and prompt.",
      "4. Reference its output later as `{{anthropicResult.text}}`.",
    ].join("\n"),
    gemini: [
      "# Gemini setup",
      "",
      "1. Create a Google AI Studio API key.",
      "2. Save it as a GEMINI credential in a8n.",
      "3. Add a Gemini node with a result name and prompt.",
      "4. Reference its output later as `{{geminiResult.text}}`.",
    ].join("\n"),
    slack: [
      "# Slack setup",
      "",
      "1. Create a Slack workflow or incoming webhook URL.",
      "2. Add a Slack node and paste the webhook URL.",
      "3. Write the message content, using variables such as `{{geminiResult.text}}`.",
      "4. Run a test before enabling the workflow.",
    ].join("\n"),
    discord: [
      "# Discord setup",
      "",
      "1. In Discord, open channel settings and create a webhook.",
      "2. Add a Discord node and paste the webhook URL.",
      "3. Write the message content, using variables such as `{{geminiResult.text}}`.",
      "4. Run a test before enabling the workflow.",
    ].join("\n"),
    http: [
      "# HTTP request setup",
      "",
      "1. Confirm the API endpoint URL and HTTP method.",
      "2. Add a body only for POST, PUT, or PATCH requests.",
      "3. Use template variables when the URL or body needs data from earlier steps.",
      "4. Run a test and inspect `<variableName>.httpResponse.data`.",
    ].join("\n"),
    email: [
      "# Email setup",
      "",
      "1. Create an SMTP credential as JSON with `host`, `port`, `user`, and `pass`.",
      "2. Add an Email node and select that SMTP credential.",
      "3. Fill recipient, subject, and body.",
      "4. Preview the message and run a test before sending to real users.",
    ].join("\n"),
    google_sheets: [
      "# Google Sheets setup",
      "",
      "1. Create a Google service-account JSON key.",
      "2. Save it as a GOOGLE_SHEETS credential.",
      "3. Share the target spreadsheet with the service account `client_email`.",
      "4. Add a Google Sheets node with spreadsheet ID, sheet name, and row JSON.",
    ].join("\n"),
    google_form: [
      "# Google Form setup",
      "",
      "1. Add a Google Form trigger node to a workflow.",
      "2. Copy the generated webhook URL and Apps Script.",
      "3. In Google Forms, open Apps Script and add the script.",
      "4. Add an `On form submit` trigger and submit a test response.",
    ].join("\n"),
    stripe: [
      "# Stripe setup",
      "",
      "1. Add a Stripe trigger node to a workflow.",
      "2. Copy the generated webhook URL.",
      "3. In Stripe Dashboard > Developers > Webhooks, add the endpoint.",
      "4. Select events such as `payment_intent.succeeded` and send a test event.",
    ].join("\n"),
  };

  return byService[service];
}
