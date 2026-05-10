import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 touch-manipulation",
  {
    variants: {
      variant: {
        default:
          "bg-[#6366f1] text-white border border-[#6366f1] hover:bg-[#5558e0] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] active:scale-[0.98]",
        destructive:
          "bg-red-500 text-white border border-red-500 hover:bg-red-600 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-[0.98]",
        outline:
          "border border-[#27273a] bg-transparent text-[#fafafa] hover:bg-[#1a1a2e] hover:border-[#6366f1] active:scale-[0.98]",
        secondary:
          "bg-[#1a1a2e] text-[#fafafa] border border-[#27273a] hover:bg-[#27273a] active:scale-[0.98]",
        ghost: "bg-transparent text-[#fafafa] hover:bg-[#1a1a2e] active:scale-[0.98]",
        link: "text-[#6366f1] underline-offset-4 hover:underline hover:text-[#818cf8]",
        gradient:
          "bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#d946ef] text-white border-0 hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:scale-[1.02] active:scale-[0.98]",
        glow:
          "bg-[#6366f1] text-white border border-[#6366f1] shadow-[0_0_20px_rgba(99,102,241,0.5)] hover:shadow-[0_0_30px_rgba(99,102,241,0.7)] hover:scale-[1.02] active:scale-[0.98]",
      },
      size: {
        default: "h-10 min-h-[44px] px-5 py-2",
        sm: "h-8 min-h-[32px] rounded-md px-3 text-xs",
        lg: "h-12 min-h-[44px] rounded-lg px-8 text-base",
        icon: "h-10 w-10 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  ariaLabel?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ariaLabel, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const generatedAriaLabel = ariaLabel || (typeof props.children === 'string' ? props.children : undefined);
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-label={generatedAriaLabel}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
