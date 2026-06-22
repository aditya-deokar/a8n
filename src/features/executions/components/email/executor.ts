import Handlebars from "handlebars";
import { decode } from "html-entities";
import { NonRetriableError } from "inngest";
import nodemailer from "nodemailer";
import type { SendMailOptions } from "nodemailer";
import type { NodeExecutor } from "@/features/executions/types";
import { emailChannel } from "@/inngest/channels/email";
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

type EmailData = {
  variableName?: string;
  credentialId?: string;
  to?: string;
  subject?: string;
  body?: string;
  from?: string;
  replyTo?: string;
};

type SmtpCredential = {
  host: string;
  port: number | string;
  secure?: boolean;
  user: string;
  pass: string;
  from?: string;
};

function renderTemplate(template: string | undefined, context: Record<string, unknown>) {
  return decode(Handlebars.compile(template || "")(context)).trim();
}

function parseSmtpCredential(value: string): SmtpCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new NonRetriableError("Email node: SMTP credential must be valid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new NonRetriableError("Email node: SMTP credential must be a JSON object");
  }

  const credential = parsed as Partial<SmtpCredential>;
  if (!credential.host || !credential.port || !credential.user || !credential.pass) {
    throw new NonRetriableError("Email node: SMTP credential requires host, port, user, and pass");
  }

  return credential as SmtpCredential;
}

export const emailExecutor: NodeExecutor<EmailData> = async ({
  data,
  nodeId,
  userId,
  context,
  step,
  publish,
}) => {
  await publish(
    emailChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  const setError = () => publish(
    emailChannel().status({
      nodeId,
      status: "error",
    }),
  );

  if (!data.variableName) {
    await setError();
    throw new NonRetriableError("Email node: Variable name is missing");
  }

  if (!data.credentialId) {
    await setError();
    throw new NonRetriableError("Email node: SMTP credential is required");
  }

  if (!data.to || !data.subject || !data.body) {
    await setError();
    throw new NonRetriableError("Email node: To, subject, and body are required");
  }

  const credential = await step.run("get-email-credential", () => {
    return prisma.credential.findUnique({
      where: {
        id: data.credentialId,
        userId,
      },
    });
  });

  if (!credential) {
    await setError();
    throw new NonRetriableError("Email node: Credential not found");
  }

  try {
    const smtp = parseSmtpCredential(decrypt(credential.value));
    const to = renderTemplate(data.to, context);
    const subject = renderTemplate(data.subject, context);
    const body = decode(Handlebars.compile(data.body)(context));
    const from = renderTemplate(data.from, context) || smtp.from || smtp.user;
    const replyTo = renderTemplate(data.replyTo, context) || undefined;

    const result = await step.run("email-send", async () => {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port),
        secure: smtp.secure ?? Number(smtp.port) === 465,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });

      const mailOptions: SendMailOptions = {
        from,
        to,
        subject,
        text: body,
        replyTo,
      };

      const info = await transporter.sendMail(mailOptions);

      return {
        ...context,
        [data.variableName!]: {
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
          envelope: info.envelope,
          to,
          subject,
        },
      };
    });

    await publish(
      emailChannel().status({
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
