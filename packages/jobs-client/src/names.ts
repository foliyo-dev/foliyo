const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** e.g. `23rd Aug 2026` — stable across locales so resume names stay consistent. */
export function formatResumeDay(d = new Date()): string {
  return `${ordinal(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Default name for a tailored resume: Smart when JD parse used AI, dated otherwise. */
export function suggestedTailoredResumeName(opts: {
  usedAi: boolean;
  now?: Date;
}): string {
  const when = formatResumeDay(opts.now ?? new Date());
  return opts.usedAi ? `Smart resume — ${when}` : `Resume on ${when}`;
}
