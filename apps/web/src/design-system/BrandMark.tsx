import primaryMark from "./brand/open-core-primary.svg";
import reversedMark from "./brand/open-core-reversed.svg";

// The official Open Core 01 mark. The SVG files are copied byte-for-byte from the
// Open Core 03.1 registry (hashes in README.md); never redraw, recolour or invert them.
// "reversed" is for Deep Navy surfaces and "primary" for light surfaces.
export function BrandMark({
  variant,
  size = 48,
  label,
}: {
  variant: "primary" | "reversed";
  size?: number;
  label?: string;
}) {
  return (
    <img
      className="brand-mark"
      src={variant === "reversed" ? reversedMark : primaryMark}
      width={size}
      height={size}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
    />
  );
}
