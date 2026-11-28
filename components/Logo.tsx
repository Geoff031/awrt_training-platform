// The AWRT logo, drawn in the current text colour so it works in light and dark mode.
const FILES = { icon: "mask-icon", stacked: "mask-stacked", horizontal: "mask-horizontal" } as const;
const RATIO = { icon: 1.234, stacked: 1.555, horizontal: 2.928 } as const; // width / height of each cropped logo

export default function Logo({ variant = "icon", height = 32, className = "" }: { variant?: keyof typeof FILES; height?: number; className?: string }) {
  const url = `url(/brand/${FILES[variant]}.png)`;
  return (
    <span
      role="img"
      aria-label="AWRT, are we running today?"
      className={`inline-block shrink-0 ${className}`}
      style={{
        height,
        width: height * RATIO[variant],
        backgroundColor: "var(--foreground)",
        WebkitMask: `${url} center / contain no-repeat`,
        mask: `${url} center / contain no-repeat`,
      }}
    />
  );
}
