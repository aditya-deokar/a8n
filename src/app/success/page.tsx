import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function SuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-accent/20 p-4">
      <Card className="w-full max-w-md border-none shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3 ring-8 ring-primary/5">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">Payment Successful!</CardTitle>
          <p className="text-muted-foreground mt-2">
            Thank you for upgrading to FlowNode Pro.
          </p>
        </CardHeader>
        <CardContent className="text-center space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Your account has been upgraded and your Pro features are now available. 
            A confirmation email has been sent to your inbox.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-4">
          <Button asChild className="w-full h-11 text-base font-medium shadow-lg hover:shadow-xl transition-all active:scale-[0.98]">
            <Link href="/">Back to Dashboard</Link>
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Need help? <Link href="mailto:support@flownode.com" className="text-primary hover:underline underline-offset-4">Contact support</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
