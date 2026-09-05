import { cn } from "@/lib/utils";

/**
 * Un anneau qui se remplit : « 2/3 ». Pour dire où on en est sans une ligne
 * de texte. Le remplissage s'anime à l'arrivée, puis reste.
 */
export function AnneauProgression({
  fait,
  total,
  taille = 84,
  className,
}: {
  fait: number;
  total: number;
  taille?: number;
  className?: string;
}) {
  const rayon = 36;
  const circonference = 2 * Math.PI * rayon;
  const part = total > 0 ? Math.min(1, Math.max(0, fait / total)) : 0;
  const reste = circonference * (1 - part);
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: taille, height: taille }}>
      <svg viewBox="0 0 84 84" width={taille} height={taille} aria-hidden="true">
        <circle cx="42" cy="42" r={rayon} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          className="anneau-progres"
          cx="42"
          cy="42"
          r={rayon}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circonference}
          strokeDashoffset={reste}
          transform="rotate(-90 42 42)"
          style={{ ["--circ" as string]: `${circonference}`, ["--reste" as string]: `${reste}` }}
        />
      </svg>
      <span className="nombres absolute inset-0 flex items-center justify-center text-[1.0625rem] font-extrabold">
        {`${fait}/${total}`}
      </span>
      <span className="sr-only">{`${fait} étapes sur ${total}`}</span>
    </div>
  );
}
