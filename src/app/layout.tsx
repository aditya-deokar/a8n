import type { Metadata } from "next";
import { Provider } from 'jotai'
import { TRPCReactProvider } from "@/trpc/client";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { ThemeProvider } from "@/components/theme-provider"


import "./globals.css";

export const metadata: Metadata = {
  title: "a8n | Advanced Visual Workflow Automation",
  description: "Build, automate, and orchestrate complex workflows with our intuitive visual editor and powerful AI nodes. Connect your favorite tools seamlessly.",
  metadataBase: new URL("https://a8n.aditya-deokar.me"),
  openGraph: {
    title: "a8n | Advanced Visual Workflow Automation",
    description: "Build, automate, and orchestrate complex workflows with our intuitive visual editor and powerful AI nodes.",
    url: "https://a8n.aditya-deokar.me",
    siteName: "a8n",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "a8n | Advanced Visual Workflow Automation",
    description: "Build, automate, and orchestrate complex workflows with our intuitive visual editor and powerful AI nodes.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="font-sans antialiased"
        suppressHydrationWarning
      >
        <TRPCReactProvider>
          <NuqsAdapter>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <Provider>
                {children}
                <Toaster />
              </Provider>
            </ThemeProvider>
          </NuqsAdapter>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
