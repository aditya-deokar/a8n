import { LoginForm } from "@/features/auth/components/login-form";
import { requireUnauth } from "@/lib/auth-utils";
import { safeCallbackPath } from "@/lib/safe-callback-url";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const Page = async ({ searchParams }: Props) => {
  const params = await searchParams;
  const callbackURL = safeCallbackPath(params.callbackURL);
  await requireUnauth(callbackURL);

  return <LoginForm callbackURL={callbackURL} />;
};

export default Page;
