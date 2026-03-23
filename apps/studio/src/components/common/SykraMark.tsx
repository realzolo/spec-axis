import { cn } from '@/lib/utils';

type SykraMarkProps = {
  className?: string;
  title?: string;
};

export default function SykraMark({ className, title = 'Sykra' }: SykraMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={cn('h-10 w-10', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sykra-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4CF4FF" />
          <stop offset="1" stopColor="#5B7CFF" />
        </linearGradient>
      </defs>
      <path
        d="M14 48V16H22L42 40V16H50V48H42L22 24V48H14Z"
        fill="url(#sykra-gradient)"
      />
    </svg>
  );
}
