
"use client"

import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { AuthCardWrapper } from "./auth-card-wrapper"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email"),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

const ForgotPasswordForm = () => {
  const [isSubmitted, setIsSubmitted] = useState(false)

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ""
    },
  })

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    await authClient.forgetPassword({
      email: values.email,
      redirectTo: "/reset-password",
    }, {
      onSuccess: () => {
        setIsSubmitted(true)
        toast.success("Reset link sent to your email")
      },
      onError: (ctx) => {
        toast.error(ctx.error.message)
      },
    })
  }

  const isPending = form.formState.isSubmitting

  if (isSubmitted) {
    return (
      <AuthCardWrapper
        title="Check your email"
        description="We've sent you a password reset link"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            We sent a password reset link to <strong className="text-foreground">{form.getValues("email")}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Didn't receive the email? Check your spam folder or{" "}
            <button
              onClick={() => setIsSubmitted(false)}
              className="text-primary hover:underline underline-offset-4"
            >
              try again
            </button>
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full h-11">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to login
            </Button>
          </Link>
        </div>
      </AuthCardWrapper>
    )
  }

  return (
    <AuthCardWrapper
      title="Reset your password"
      description="Enter your email to receive a reset link"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    disabled={isPending}
                    className="h-11"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  We'll send you a link to reset your password
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full h-11" disabled={isPending}>
            {isPending ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending...
              </span>
            ) : "Send reset link"}
          </Button>

          <Link href="/login">
            <Button variant="ghost" className="w-full" type="button">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to login
            </Button>
          </Link>
        </form>
      </Form>
    </AuthCardWrapper>
  )
}

export default ForgotPasswordForm
