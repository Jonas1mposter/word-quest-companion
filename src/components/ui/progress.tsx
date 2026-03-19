import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const progressIndicatorVariants = cva("h-full w-full flex-1 transition-all", {
  variants: {
    variant: {
      default: "bg-primary",
      xp: "bg-gradient-to-r from-primary to-purple-500",
      energy: "bg-gradient-to-r from-cyan-500 to-blue-500",
      gold: "bg-gradient-to-r from-yellow-500 to-amber-500",
      success: "bg-gradient-to-r from-green-500 to-emerald-500",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressIndicatorVariants> {}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, variant, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(progressIndicatorVariants({ variant }))}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
