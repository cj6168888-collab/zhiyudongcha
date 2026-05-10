import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center p-8 rounded-xl",
          "bg-gradient-to-b from-[#13131f] to-[#0a0a0f]",
          "border border-[#27273a]",
          className
        )}
      >
        {icon && (
          <div className="mb-4 p-4 rounded-full bg-[#1a1a2e] border border-[#27273a]">
            {icon}
          </div>
        )}
        
        <h3 className="text-lg font-semibold text-[#fafafa] mb-2">
          {title}
        </h3>
        
        {description && (
          <p className="text-sm text-[#a1a1aa] max-w-sm mb-6">
            {description}
          </p>
        )}
        
        {action && (
          <div className="mt-2">
            {action}
          </div>
        )}
      </div>
    )
  }
)
EmptyState.displayName = "EmptyState"

export { EmptyState }
