import { z } from "zod";

const paginationSchema = z.object({
  page: z.number().optional(),
  pageSize: z.number().optional(),
  totalCount: z.number().optional(),
  totalPages: z.number().optional(),
  hasNextPage: z.boolean().optional(),
  hasPreviousPage: z.boolean().optional(),
});

const approvalSchema = z.object({
  approvalRequired: z.boolean().optional(),
  confirmationHash: z.string().optional(),
  instruction: z.string().optional(),
});

const validationSchema = z.object({
  valid: z.boolean().optional(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  missingFields: z.array(z.unknown()).optional(),
}).passthrough();

export const MCP_CONTRACT_OUTPUT_SCHEMAS = {
  apiKeyCreated: z.object({
    rawKey: z.string().optional(),
    key: z.unknown().optional(),
    record: z.unknown().optional(),
  }).passthrough(),
  apiKeyList: z.object({ apiKeys: z.array(z.unknown()).optional(), keys: z.array(z.unknown()).optional() }).passthrough(),
  credentialMetadata: z.object({ credential: z.unknown().optional() }).passthrough(),
  credentialList: z.object({ credentials: z.array(z.unknown()) }).merge(paginationSchema).passthrough(),
  executionList: z.object({ executions: z.array(z.unknown()) }).merge(paginationSchema).passthrough(),
  executionDetail: z.object({ execution: z.unknown().optional() }).passthrough(),
  executionTimeline: z.object({
    executionId: z.string().optional(),
    timeline: z.array(z.unknown()).optional(),
    outputSummary: z.unknown().optional(),
  }).passthrough(),
  executionDiagnosis: z.object({ diagnosis: z.unknown().optional(), validation: validationSchema.optional() }).passthrough(),
  workflowList: z.object({ workflows: z.array(z.unknown()) }).merge(paginationSchema).passthrough(),
  workflowGraph: z.object({ workflow: z.unknown().optional(), nodes: z.array(z.unknown()).optional(), connections: z.array(z.unknown()).optional() }).passthrough(),
  workflowMutation: z.object({ workflowId: z.string().optional(), workflow: z.unknown().optional() }).passthrough(),
  workflowDraft: z.object({ draftId: z.string().optional(), validation: validationSchema.optional() }).passthrough(),
  workflowDiff: z.object({ diff: z.unknown().optional(), validation: validationSchema.optional(), approval: z.unknown().optional() }).passthrough(),
  approvalResult: z.object({ applied: z.boolean().optional() }).merge(approvalSchema).passthrough(),
  integrationGuide: z.object({ service: z.string().optional(), guide: z.unknown().optional() }).passthrough(),
  setupChecklist: z.object({ ready: z.boolean().optional(), setupItems: z.array(z.unknown()).optional() }).passthrough(),
  webhookInfo: z.object({ workflowId: z.string().optional(), webhookUrl: z.string().optional() }).passthrough(),
  credentialTest: z.object({ credentialId: z.string().optional(), ok: z.boolean().optional(), checks: z.array(z.unknown()).optional() }).passthrough(),
  nodeCatalog: z.object({ nodes: z.array(z.unknown()).optional(), nodeTypes: z.array(z.unknown()).optional() }).passthrough(),
  systemInfo: z.object({ server: z.unknown().optional(), user: z.unknown().optional() }).passthrough(),
  securityStatus: z.object({ posture: z.unknown().optional(), webhooks: z.unknown().optional() }).passthrough(),
  renderWidget: z.object({
    kind: z.string(),
    resourceUri: z.string(),
    summary: z.unknown().optional(),
  }).passthrough(),
  textMessage: z.object({ message: z.string().optional() }).passthrough(),
  genericObject: z.object({}).passthrough(),
} as const;

export type McpContractOutputSchemaName = keyof typeof MCP_CONTRACT_OUTPUT_SCHEMAS;

export function isContractOutputSchemaName(
  value: string,
): value is McpContractOutputSchemaName {
  return value in MCP_CONTRACT_OUTPUT_SCHEMAS;
}
