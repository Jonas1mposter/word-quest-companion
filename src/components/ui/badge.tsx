import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        xp: "border-transparent bg-gradient-to-r from-primary to-purple-500 text-white",
        energy: "border-transparent bg-gradient-to-r from-cyan-500 to-blue-500 text-white",
        success: "border-transparent bg-gradient-to-r from-green-500 to-emerald-500 text-white",
        bronze: "border-amber-700/30 bg-amber-700/20 text-amber-700",
        silver: "border-gray-400/30 bg-gray-400/20 text-gray-400",
        gold: "border-yellow-500/30 bg-yellow-500/20 text-yellow-500",
        platinum: "border-cyan-400/30 bg-cyan-400/20 text-cyan-400",
        diamond: "border-blue-400/30 bg-blue-400/20 text-blue-400",
        champion: "border-purple-400/30 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
