import * as React from "react";

type Variant = "default" | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const base =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium tracking-wide";

const variants: Record<Variant, string> = {
  default: "border-indigo-400/40 bg-indigo-500/15 text-indigo-200",
  outline: "border-slate-600 text-slate-300",
};

export const Badge: React.FC<BadgeProps> = ({
  className = "",
  variant = "default",
  ...props
}) => {
  return (
    <span className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
};

export default Badge;