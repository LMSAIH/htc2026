import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ShineBorderProps {
  borderRadius?: number;
  borderWidth?: number;
  duration?: number;
  color?: string | string[];
  className?: string;
  children: ReactNode;
}

export function ShineBorder({
  borderRadius = 8,
  borderWidth = 1,
  duration = 14,
  color = "#000000",
  className,
  children,
}: ShineBorderProps) {
  return (
    <div
      style={
        {
          "--border-radius": `${borderRadius}px`,
          "--border-width": `${borderWidth}px`,
          "--shine-pulse-duration": `${duration}s`,
          "--mask-linear-gradient":
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          "--background-radial-gradient": `radial-gradient(transparent, transparent, ${
            Array.isArray(color) ? color.join(",") : color
          }, transparent, transparent)`,
        } as React.CSSProperties
      }
      className={cn(
        "relative rounded-[--border-radius] p-[--border-width]",
        "before:absolute before:inset-0 before:rounded-[--border-radius] before:p-[--border-width]",
        "before:will-change-[background-position] before:content-[''] before:![-webkit-mask-composite:xor]",
        "before:[background-image:--background-radial-gradient] before:[background-size:300%_300%]",
        "before:![mask-composite:exclude] before:[mask:--mask-linear-gradient]",
        "before:animate-[shine-pulse_var(--shine-pulse-duration)_infinite_linear]",
        className,
      )}
    >
      {children}
    </div>
  );
}
