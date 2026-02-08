"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedProgressProps {
  value: number;
  className?: string;
  barClassName?: string;
  duration?: number;
}

export function AnimatedProgress({
  value,
  className,
  barClassName,
  duration = 1.2,
}: AnimatedProgressProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const displayed = inView ? value : 0;

  return (
    <div
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/10",
        className,
      )}
    >
      <motion.div
        className={cn("h-full rounded-full bg-primary", barClassName)}
        initial={{ width: 0 }}
        animate={{ width: `${displayed}%` }}
        transition={{ duration, ease: "easeOut" }}
      />
    </div>
  );
}
