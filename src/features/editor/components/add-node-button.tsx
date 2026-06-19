"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { useAtom } from "jotai";
import { nodeSelectorOpenAtom } from "../store/atoms";
import { cn } from "@/lib/utils";

export const AddNodeButton = memo(() => {
  const [selectorOpen, setSelectorOpen] = useAtom(nodeSelectorOpenAtom);

  return (
    <Button
      onClick={() => setSelectorOpen(!selectorOpen)}
      size="icon"
      className={cn(
        "size-10 text-white rounded-xl shadow-md transition-all duration-300 group",
        selectorOpen 
          ? "bg-zinc-700 hover:bg-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 shadow-zinc-900/20" 
          : "bg-[#5c54a4] hover:bg-[#4b448a] shadow-[#5c54a4]/20"
      )}
    >
      {selectorOpen ? (
        <XIcon className="size-5 transition-transform duration-300 rotate-0 group-hover:rotate-90" />
      ) : (
        <PlusIcon className="size-5 transition-transform duration-300 rotate-0 group-hover:rotate-90" />
      )}
    </Button>
  )
});

AddNodeButton.displayName = "AddNodeButton";
