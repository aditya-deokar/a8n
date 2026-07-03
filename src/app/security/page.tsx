import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security | a8n",
  description: "Security contact and disclosure information for a8n.",
};

const updatedAt = "July 2, 2026";

const severityRows = [
  {
    severity: "Critical",
    examples: "Secret leakage, cross-tenant access, OAuth token bypass, unauthenticated destructive action.",
  },
  {
    severity: "High",
    examples: "Approval bypass, forbidden ChatGPT tool exposure, persistent widget injection.",
  },
  {
    severity: "Medium",
    examples: "Safety regression without unsafe execution, staging-only hardening gap.",
  },
  {
    severity: "Low",
    examples: "Documentation issue or low-impact metadata exposure.",
  },
];

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto grid w-full max-w-3xl gap-10">
        <header className="grid gap-3 border-b pb-8">
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            a8n
          </Link>
          <h1 className="text-4xl font-semibold tracking-normal">Security</h1>
          <p className="text-sm text-muted-foreground">Last updated: {updatedAt}</p>
        </header>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-normal">Report A Vulnerability</h2>
          <p className="leading-7 text-muted-foreground">
            Email{" "}
            <a className="font-medium text-foreground underline underline-offset-4" href="mailto:security@flownode.com">
              security@flownode.com
            </a>{" "}
            with a concise description, affected surface, safe reproduction path, and impact.
          </p>
          <p className="leading-7 text-muted-foreground">
            Do not include live credentials, raw API keys, OAuth tokens, private workflow payloads, or customer data in the first report.
          </p>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-normal">Severity Matrix</h2>
          <div className="grid gap-3">
            {severityRows.map((row) => (
              <div key={row.severity} className="border-b pb-4 last:border-b-0">
                <h3 className="font-medium tracking-normal">{row.severity}</h3>
                <p className="mt-1 leading-7 text-muted-foreground">{row.examples}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-normal">Safe Harbor</h2>
          <p className="leading-7 text-muted-foreground">
            Good-faith testing is welcome when it avoids privacy harm, service disruption,
            data destruction, spam, social engineering, and access to accounts or data
            that are not yours.
          </p>
        </section>
      </div>
    </main>
  );
}
