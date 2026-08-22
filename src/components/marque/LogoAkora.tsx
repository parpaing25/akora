/** Marque Akora : le « A » posé sur un linteau. Latérite pleine, blanc dedans. */
export function LogoAkora({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Akora" focusable="false">
      <rect width="64" height="64" rx="14" fill="hsl(var(--primary))" />
      <path d="M20 46 32 18l12 28h-7l-2.2-5.4h-5.6L27 46z" fill="hsl(var(--primary-foreground))" />
      <rect x="26" y="30" width="12" height="4" rx="1" fill="hsl(var(--background))" opacity="0.55" />
    </svg>
  );
}
