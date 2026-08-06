import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // touch-manipulation eliminates the 300ms double-tap delay on mobile browsers
  // so button presses feel immediate on touch screens.
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-surface-accent text-foreground hover:bg-surface-accent-hover",
        ghost:
          "text-text-secondary hover:bg-surface-soft hover:text-text-primary",
        outline:
          "border border-border text-text-secondary hover:bg-surface-soft",
      },
      size: {
        // 44px height satisfies the minimum touch-target requirement (WCAG 2.5.5)
        default: "h-11 px-4",
        sm: "h-11 rounded-md px-3 text-xs",
        // Icon-only buttons: 44×44 hit area, no padding gap compression
        icon: "h-11 w-11 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
