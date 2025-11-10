"use client"

import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"


const loginSchema = z.object({
    email: z.email("Please enter a valid email"),
    password: z.string().min(1, "password is required"),

});

type LoginFormValues = z.infer<typeof loginSchema>

const LoginForm = () => {

    const router= useRouter();

    const form= useForm<LoginFormValues>({
        resolver:zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password:""
        },

    });


    const onSubmit = async (values: LoginFormValues)=>{
        // console.log(values);
        await authClient.signIn.email({
            email: values.email,
            password: values.password,
            callbackURL:"/",
        },{
            onSuccess: ()=>{
                router.push("/")
            },
            onError: (ctx)=>{
                toast.error(ctx.error.message);
            },
        })
    }

    const isPending= form.formState.isSubmitting
   

  return (
    <div className="flex flex-col gap-6">
        <Card>
            <CardHeader className="text-center">
                <CardTitle>
                    Welcome Back
                </CardTitle>
                <CardDescription>
                    Login to continue
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <div className="grid gap-6">
                            <div className="flex flex-col gap-4">
                                <Button
                                variant={"outline"}
                                className="w-full"
                                type="button"
                                disabled={isPending}
                                >
                                    Continue with GitHub
                                </Button>


                                <Button
                                variant={"outline"}
                                className="w-full"
                                type="button"
                                disabled={isPending}
                                >
                                    Continue with Google
                                </Button>
                            </div>

                            <div className="grid gap-6">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field })=> (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input
                                                type="email"
                                                placeholder="example@gmail.com"
                                                {...field}
                                                />
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )}
                                />

                                  <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field })=> (
                                        <FormItem>
                                            <FormLabel>Password</FormLabel>
                                            <FormControl>
                                                <Input
                                                type="password"
                                                placeholder="********"
                                                {...field}
                                                />
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" className="w-full" disabled={isPending}>
                                    Login
                                </Button>

                            </div>

                            <div className="text-center text-sm">
                                Don&apos;t have and account? {" "}
                                <Link className="underline underline-offset-4" href="/signup">Sign up</Link>
                            </div>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  )
}

export default LoginForm