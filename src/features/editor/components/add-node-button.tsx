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
      className={cn(
        "h-10 text-white transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group border-0 px-4 gap-2 font-medium shadow-md overflow-hidden relative",
        selectorOpen 
          ? "bg-zinc-800 hover:bg-zinc-700 shadow-zinc-900/20" 
          : "bg-gradient-to-b from-[#5c54a4] to-[#9187ce] hover:opacity-90 shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset]"
      )}
    >
      <div className="flex items-center gap-2 relative z-10">
        {selectorOpen ? (
          <>
            <XIcon className="size-4 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] rotate-90 group-hover:rotate-180" />
            <span>Close Panel</span>
          </>
        ) : (
          <>
            <PlusIcon className="size-4 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] rotate-0 group-hover:rotate-90" />
            <span>Add Triggers & Actions</span>
          </>
        )}
      </div>
    </Button>
  )
});

AddNodeButton.displayName = "AddNodeButton";
