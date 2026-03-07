import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          // Animations
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          // Layout
          "z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-xl p-4 outline-hidden",
          // Dark mode glass
          "dark:bg-[rgba(28,28,30,0.88)] dark:border dark:border-white/10 dark:text-slate-100 dark:shadow-[0_2px_24px_rgba(0,0,0,0.5)] dark:[backdrop-filter:blur(32px)_saturate(160%)]",
          // Light mode glass
          "bg-white/85 border border-white/75 text-foreground shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_6px_32px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)] [backdrop-filter:blur(32px)_saturate(180%)]",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
