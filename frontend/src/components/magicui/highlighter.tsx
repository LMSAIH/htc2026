import { useEffect, useRef, useState, type ReactNode } from "react";
import { annotate, type RoughAnnotation } from "rough-notation";

interface HighlighterProps {
  children: ReactNode;
  /** RoughNotation type — "highlight", "underline", "circle", "box", etc. */
  action?: "highlight" | "underline" | "circle" | "box" | "strike-through";
  /** Highlight / annotation color */
  color?: string;
  /** Whether to animate the drawing */
  animate?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Only show when scrolled into view */
  inView?: boolean;
  className?: string;
}

export function Highlighter({
  children,
  action = "highlight",
  color = "#DBEAFE",
  animate = true,
  animationDuration = 1500,
  inView = true,
  className,
}: HighlighterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const annotationRef = useRef<RoughAnnotation | null>(null);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    // Create the annotation
    annotationRef.current = annotate(ref.current, {
      type: action,
      color,
      animate,
      animationDuration,
      multiline: true,
    });

    if (!inView) {
      // Show immediately if not using IntersectionObserver
      annotationRef.current.show();
      setHasShown(true);
    }

    return () => {
      annotationRef.current?.remove();
    };
  }, [action, color, animate, animationDuration, inView]);

  useEffect(() => {
    if (!inView || hasShown || !ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasShown) {
            annotationRef.current?.show();
            setHasShown(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 },
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [inView, hasShown]);

  return (
    <span ref={ref} className={className}>
      {children}
    </span>
  );
}
