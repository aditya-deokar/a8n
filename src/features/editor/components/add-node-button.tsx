"use client";

import { PlusIcon } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { NodeSelector } from "@/components/node-selector";

export const AddNodeButton = memo(() => {
  const [selectorOpen, setSelectorOpen] = useState(false);

  return (
    <NodeSelector open={selectorOpen} onOpenChange={setSelectorOpen}>
      <Button
        onClick={() => setSelectorOpen(true)}
        size="icon"
        className="h-14 w-14 rounded-full bg-white/80 hover:bg-white text-[#5c54a4] backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.16)] transition-all duration-300 hover:scale-105 group"
      >
        <PlusIcon className="size-6 transition-transform duration-300 group-hover:rotate-90" />
      </Button>
    </NodeSelector>
  )
});

AddNodeButton.displayName = "AddNodeButton";
