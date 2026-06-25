import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support | a8n",
  description: "Support and contact information for a8n.",
};

const supportItems = [
  {
    title: "Account and billing",
    body: "Use this path for sign-in problems, subscription questions, or account deletion requests.",
  },
  {
    title: "ChatGPT app connection",
    body: "Send OAuth connection issues, missing permissions, app install problems, or connector errors.",
  },
  {
    title: "Workflow execution",
    body: "Include the workflow name, execution time, and the error shown in the execution timeline.",
  },
];

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto grid w-full max-w-3xl gap-10">
        <header className="grid gap-3 border-b pb-8">
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            a8n
          </Link>
          <h1 className="text-4xl font-semibold tracking-normal">Support</h1>
          <p className="max-w-2xl leading-7 text-muted-foreground">
            For help with a8n, workflow automation, or the a8n ChatGPT app, contact
            the support team with the details needed to reproduce the issue.
          </p>
        </header>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-normal">Contact</h2>
          <p className="leading-7 text-muted-foreground">
            Email{" "}
            <a className="font-medium text-foreground underline underline-offset-4" href="mailto:support@flownode.com">
              support@flownode.com
            </a>{" "}
            from the email address associated with your a8n account.
          </p>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-normal">What To Include</h2>
          <div className="grid gap-3">
            {supportItems.map((item) => (
              <div key={item.title} className="border-b pb-4 last:border-b-0">
                <h3 className="font-medium tracking-normal">{item.title}</h3>
                <p className="mt-1 leading-7 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-normal">Security Issues</h2>
          <p className="leading-7 text-muted-foreground">
            If you believe you found a security issue, do not include secrets,
            credential values, or private workflow payloads in the first message. Share
            a short description and a safe reproduction path, and the team will follow
            up.
          </p>
        </section>
      </div>
    </main>
  );
}
