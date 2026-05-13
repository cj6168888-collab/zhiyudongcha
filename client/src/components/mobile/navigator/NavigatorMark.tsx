import { cn } from "@/lib/utils";

interface NavigatorMarkProps {
  className?: string;
  active?: boolean;
}

export function NavigatorMark({ className, active = false }: NavigatorMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
    >
      <circle
        cx="16"
        cy="16"
        r="12.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.35"
        className={active ? "opacity-95" : "opacity-70"}
      />
      <path
        d="M16 5.7 20.8 18 16 15.8 11.2 18 16 5.7Z"
        fill="currentColor"
        className={active ? "opacity-100" : "opacity-85"}
      />
      <path
        d="M16 26.3 11.2 14 16 16.2 20.8 14 16 26.3Z"
        fill="currentColor"
        className={active ? "opacity-62" : "opacity-42"}
      />
      <path
        d="M6.8 11.8c2.9-4.1 7.7-5.6 12-4.1M25.2 20.2c-2.8 4.1-7.5 5.7-11.8 4.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.85"
        className={active ? "opacity-70" : "opacity-38"}
      />
      <path
        d="M24.7 6.2v3.6M22.9 8h3.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.55"
        className="opacity-95"
      />
    </svg>
  );
}
