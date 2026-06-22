import * as React from "react"
import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("block text-[13px] font-medium text-[#374151] mb-1.5", className)}
      {...props}
    />
  )
}

export { Label }
