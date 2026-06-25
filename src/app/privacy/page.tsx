import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy | a8n",
  description: "Privacy information for a8n and the a8n ChatGPT app.",
};

const updatedAt = "June 25, 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto grid w-full max-w-3xl gap-10">
        <header className="grid gap-3 border-b pb-8">
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            a8n
          </Link>
          <h1 className="text-4xl font-semibold tracking-normal">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {updatedAt}</p>
        </header>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-normal">What a8n Collects</h2>
          <p className="leading-7 text-muted-foreground">
            a8n collects account information, workflow metadata, execution records, OAuth
            connection records, audit events, and the workflow data you choose to create
            or run. When you connect a8n to ChatGPT, a8n also stores the OAuth grant
            needed to let ChatGPT call the scoped a8n MCP endpoint on your behalf.
          </p>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-normal">How Data Is Used</h2>
          <p className="leading-7 text-muted-foreground">
            Data is used to authenticate your account, operate workflows, display
            execution status, diagnose failures, protect the service, and provide the
            app experience you request from ChatGPT. a8n does not return raw credential
            secrets through MCP tools, and credential values are handled as sensitive
            server-side data.
          </p>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-normal">ChatGPT App Permissions</h2>
          <p className="leading-7 text-muted-foreground">
            The a8n ChatGPT app uses scoped access for workflows, executions,
            credentials metadata, and setup guidance. Write actions that apply changes
            to workflows require explicit approval data such as a confirmation hash.
            Destructive admin operations are not exposed in the ChatGPT app profile.
          </p>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-normal">Retention And Deletion</h2>
          <p className="leading-7 text-muted-foreground">
            You can revoke ChatGPT access by disconnecting the app or removing the
            OAuth connection. To request account or data deletion, contact support with
            the email address associated with your a8n account.
          </p>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-normal">Contact</h2>
          <p className="leading-7 text-muted-foreground">
            For privacy questions or deletion requests, email{" "}
            <a className="font-medium text-foreground underline underline-offset-4" href="mailto:support@flownode.com">
              support@flownode.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
