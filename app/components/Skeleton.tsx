import { Box } from "@radix-ui/themes";
import type { CSSProperties } from "react";
import "./Skeleton.css";

interface SkeletonProps {
  readonly width?: string | number;
  readonly height?: string | number;
  readonly borderRadius?: string;
  readonly marginBottom?: string;
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  borderRadius = "var(--radius-2)",
  marginBottom,
}: SkeletonProps) {
  const style = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    "--skeleton-border-radius": borderRadius,
    "--skeleton-margin-bottom": marginBottom ?? "0px",
  } as CSSProperties;

  return <Box className="skeleton" style={style} />;
}

export function SkeletonText({ lines = 3 }: { readonly lines?: number }) {
  return (
    <Box className="skeleton-text">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i == lines - 1 ? "60%" : "100%"}
          height="0.875rem"
        />
      ))}
    </Box>
  );
}

export function SkeletonCard() {
  return (
    <Box className="skeleton-card">
      <Skeleton width="40%" height="1.5rem" marginBottom="1rem" />
      <SkeletonText lines={2} />
    </Box>
  );
}
