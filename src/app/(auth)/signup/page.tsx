import { RegisterForm } from "@/features/auth/components/register-form";
import { requireUnauth } from "@/lib/auth-utils";
import { safeCallbackPath } from "@/lib/safe-callback-url";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const Page = async ({ searchParams }: Props) => {
  const params = await searchParams;
  const callbackURL = safeCallbackPath(params.callbackURL);
  await requireUnauth(callbackURL);

  return <RegisterForm callbackURL={callbackURL} />;
};

export default Page;
