
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface SocialAuthButtonsProps {
  disabled?: boolean
}

export const SocialAuthButtons = ({ disabled }: SocialAuthButtonsProps) => {
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        className="w-full"
        type="button"
        disabled={disabled}
      >
        <Image src="/logos/github.svg" alt="GitHub" width={18} height={18} />
        Continue with GitHub
      </Button>

      <Button
        variant="outline"
        className="w-full"
        type="button"
        disabled={disabled}
      >
        <Image src="/logos/google.svg" alt="Google" width={18} height={18} />
        Continue with Google
      </Button>

      <div className="relative">
        {/* <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div> */}
        <div className="relative">
            {/* <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div> */}
            <div className="relative flex justify-center text-xs uppercase">
              <span className=" px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>
      </div>
    </div>
  )
}
