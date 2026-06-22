import Handlebars from "handlebars";
import { decode } from "html-entities";
import { NonRetriableError } from "inngest";
import { google } from "googleapis";
import type { NodeExecutor } from "@/features/executions/types";
import { googleSheetsChannel } from "@/inngest/channels/google-sheets";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";

Handlebars.registerHelper("json", (context) => {
  if (context === undefined) {
    return new Handlebars.SafeString("null");
  }
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type GoogleSheetsData = {
  variableName?: string;
  credentialId?: string;
  spreadsheetId?: string;
  sheetName?: string;
  rowJson?: string;
};

type GoogleServiceAccountCredential = {
  client_email: string;
  private_key: string;
};

function renderTemplate(template: string | undefined, context: Record<string, unknown>) {
  return decode(Handlebars.compile(template || "")(context)).trim();
}

function parseServiceAccountCredential(value: string): GoogleServiceAccountCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new NonRetriableError("Google Sheets node: Credential must be valid service-account JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new NonRetriableError("Google Sheets node: Credential must be a JSON object");
  }

  const credential = parsed as Partial<GoogleServiceAccountCredential>;
  if (!credential.client_email || !credential.private_key) {
    throw new NonRetriableError("Google Sheets node: Credential requires client_email and private_key");
  }

  return credential as GoogleServiceAccountCredential;
}

function parseRowJson(value: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new NonRetriableError("Google Sheets node: Row JSON must render to valid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new NonRetriableError("Google Sheets node: Row JSON must render to a JSON array");
  }

  return parsed.map((cell) => {
    if (cell === null || cell === undefined) return "";
    if (typeof cell === "object") return JSON.stringify(cell);
    return cell;
  });
}

export const googleSheetsExecutor: NodeExecutor<GoogleSheetsData> = async ({
  data,
  nodeId,
  userId,
  context,
  step,
  publish,
}) => {
  await publish(
    googleSheetsChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  const setError = () => publish(
    googleSheetsChannel().status({
      nodeId,
      status: "error",
    }),
  );

  if (!data.variableName) {
    await setError();
    throw new NonRetriableError("Google Sheets node: Variable name is missing");
  }

  if (!data.credentialId) {
    await setError();
    throw new NonRetriableError("Google Sheets node: Credential is required");
  }

  if (!data.spreadsheetId || !data.sheetName || !data.rowJson) {
    await setError();
    throw new NonRetriableError("Google Sheets node: Spreadsheet ID, sheet name, and row JSON are required");
  }

  const credential = await step.run("get-google-sheets-credential", () => {
    return prisma.credential.findUnique({
      where: {
        id: data.credentialId,
        userId,
      },
    });
  });

  if (!credential) {
    await setError();
    throw new NonRetriableError("Google Sheets node: Credential not found");
  }

  try {
    const serviceAccount = parseServiceAccountCredential(decrypt(credential.value));
    const spreadsheetId = renderTemplate(data.spreadsheetId, context);
    const sheetName = renderTemplate(data.sheetName, context);
    const renderedRowJson = decode(Handlebars.compile(data.rowJson)(context));
    const row = parseRowJson(renderedRowJson);

    const result = await step.run("google-sheets-append-row", async () => {
      const auth = new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      const sheets = google.sheets({ version: "v4", auth });
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [row],
        },
      });

      return {
        ...context,
        [data.variableName!]: {
          spreadsheetId,
          sheetName,
          updatedRange: response.data.updates?.updatedRange,
          updatedRows: response.data.updates?.updatedRows,
          updatedColumns: response.data.updates?.updatedColumns,
          updatedCells: response.data.updates?.updatedCells,
        },
      };
    });

    await publish(
      googleSheetsChannel().status({
        nodeId,
        status: "success",
      }),
    );

    return result;
  } catch (error) {
    await setError();
    throw error;
  }
};
