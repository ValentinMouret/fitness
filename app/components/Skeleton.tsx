import { Box } from "@radix-ui/themes";

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
  return (
    <Box
      width={typeof width === "string" ? width : undefined}
      height={typeof height === "string" ? height : undefined}
      style={{
        width: typeof width === "number" ? width : undefined,
        height: typeof height === "number" ? height : undefined,
        borderRadius,
        marginBottom,
        background:
          "linear-gradient(90deg, var(--gray-3) 25%, var(--gray-4) 50%, var(--gray-3) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
      }}
    />
  );
}

export function SkeletonText({ lines = 3 }: { readonly lines?: number }) {
  return (
    <Box style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={`skeleton-line-${i}`}
          width={i === lines - 1 ? "60%" : "100%"}
          height="0.875rem"
        />
      ))}
    </Box>
  );
}

export function SkeletonCard() {
  return (
    <Box
      style={{
        padding: "1.5rem",
        borderRadius: "var(--radius-3)",
        background: "var(--color-panel-solid)",
        boxShadow: "var(--shadow-warm)",
      }}
    >
      <Skeleton width="40%" height="1.5rem" marginBottom="1rem" />
      <SkeletonText lines={2} />
    </Box>
  );
}
