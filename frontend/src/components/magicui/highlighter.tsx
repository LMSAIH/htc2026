import { useEffect, useRef, useState, type ReactNode } from "react";
import { annotate } from "rough-notation";

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
  const annotationRef = useRef<ReturnType<typeof annotate> | null>(null);
  const [hasShown, setHasShown] = useState(false);
  // Track the initial color so re-renders from theme changes don't kill the animation
  const initialColorRef = useRef(color);

  // Create + optionally show the annotation (runs once per action/animate/duration change)
  useEffect(() => {
    if (!ref.current) return;

    annotationRef.current = annotate(ref.current, {
      type: action,
      color: initialColorRef.current,
      animate,
      animationDuration,
      multiline: true,
    });

    if (!inView) {
      annotationRef.current.show();
      setHasShown(true);
    }

    return () => {
      annotationRef.current?.remove();
    };
    // intentionally exclude `color` — handled separately below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, animate, animationDuration, inView]);

  // When color changes *after* the annotation is already visible, update in-place
  useEffect(() => {
    if (!annotationRef.current || !hasShown) return;
    // Update the color on the existing annotation without recreating
    annotationRef.current.color = color;
    // Re-show instantly (no animation) so the SVG redraws with the new color
    annotationRef.current.hide();
    annotationRef.current.show();
  }, [color, hasShown]);

  // IntersectionObserver — trigger the initial animated show
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
