"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedCard({ children, className, ...props }: AnimatedCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
