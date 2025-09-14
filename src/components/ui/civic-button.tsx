import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const civicButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-civic-blue text-white hover:bg-civic-blue-dark shadow-card",
        outline: "border border-civic-blue text-civic-blue hover:bg-civic-blue-light",
        secondary: "bg-civic-gray-light text-civic-gray hover:bg-civic-gray-light/80",
        ghost: "hover:bg-civic-blue-light hover:text-civic-blue",
        hero: "bg-gradient-civic text-white hover:shadow-elevated transform hover:scale-105 px-8 py-3 text-base font-semibold",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface CivicButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof civicButtonVariants> {
  asChild?: boolean
}

const CivicButton = React.forwardRef<HTMLButtonElement, CivicButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(civicButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
CivicButton.displayName = "CivicButton"

export { CivicButton, civicButtonVariants }