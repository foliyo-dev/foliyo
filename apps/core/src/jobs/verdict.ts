import type { BaselineKind, Coverage, FitBand, ResumeBand, Verdict } from "./types.js";

export function fitBand(requiredTotal: number, requiredInLibrary: number): FitBand {
  if (requiredTotal <= 0) return "unknown";
  const ratio = requiredInLibrary / requiredTotal;
  if (ratio >= 0.7) return "strong";
  if (ratio >= 0.4) return "partial";
  return "weak";
}

export function resumeBand(
  requiredInLibrary: number,
  requiredOnResume: number,
  hasBaseline: boolean,
): ResumeBand {
  if (!hasBaseline) return "no_resume";
  if (requiredInLibrary > 0 && requiredOnResume < requiredInLibrary) return "underplays";
  return "shows_it";
}

function fitLabel(fit: FitBand): string {
  if (fit === "strong") return "Strong fit";
  if (fit === "partial") return "Partial fit";
  if (fit === "weak") return "Weak fit";
  return "Couldn’t extract JD skills";
}

/**
 * One sentence: how many extracted JD skills are in the library.
 * Folio/resume snapshot is not part of the headline — chips cover that.
 */
export function buildVerdict(
  coverage: Coverage,
  hasBaseline: boolean,
  _baselineKind?: BaselineKind,
  _baselineLabel?: string | null,
): Verdict {
  const fit = fitBand(coverage.required_total, coverage.required_in_library);
  const resume = resumeBand(coverage.required_in_library, coverage.required_on_resume, hasBaseline);

  if (fit === "unknown") {
    return {
      fit,
      resume,
      sentence: "Couldn’t extract JD skills — check the pasted JD.",
    };
  }

  const head = fitLabel(fit);
  const have = `${coverage.required_in_library} of ${coverage.required_total} JD skills`;
  return { fit, resume, sentence: `${head} — ${have} are in your library` };
}
