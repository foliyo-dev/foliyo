import { absoluteHttpUrl, looksLikeBareHost } from "../http-url.js";

/** Known social / presence providers for the content library. */
export type SocialProvider =
  | "github"
  | "linkedin"
  | "twitter"
  | "youtube"
  | "instagram"
  | "dribbble"
  | "behance"
  | "medium"
  | "bluesky"
  | "mastodon"
  | "website"
  | "other";

export type SocialProviderDef = {
  id: SocialProvider;
  label: string;
  /** true = username/handle; false = full URL */
  usernameBased: boolean;
  placeholder: string;
  /** Build absolute URL from username (ignored when usernameBased is false). */
  urlFromValue?: (value: string) => string;
};

export const SOCIAL_PROVIDERS: SocialProviderDef[] = [
  {
    id: "github",
    label: "GitHub",
    usernameBased: true,
    placeholder: "username",
    urlFromValue: (v) => `https://github.com/${v}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    usernameBased: true,
    placeholder: "username",
    urlFromValue: (v) => `https://linkedin.com/in/${v}`,
  },
  {
    id: "twitter",
    label: "X / Twitter",
    usernameBased: true,
    placeholder: "username",
    urlFromValue: (v) => `https://x.com/${v}`,
  },
  {
    id: "youtube",
    label: "YouTube",
    usernameBased: true,
    placeholder: "@channel or channel id",
    urlFromValue: (v) =>
      v.startsWith("@") ? `https://youtube.com/${v}` : `https://youtube.com/@${v}`,
  },
  {
    id: "instagram",
    label: "Instagram",
    usernameBased: true,
    placeholder: "username",
    urlFromValue: (v) => `https://instagram.com/${v}`,
  },
  {
    id: "dribbble",
    label: "Dribbble",
    usernameBased: true,
    placeholder: "username",
    urlFromValue: (v) => `https://dribbble.com/${v}`,
  },
  {
    id: "behance",
    label: "Behance",
    usernameBased: true,
    placeholder: "username",
    urlFromValue: (v) => `https://behance.net/${v}`,
  },
  {
    id: "medium",
    label: "Medium",
    usernameBased: true,
    placeholder: "username",
    urlFromValue: (v) => `https://medium.com/@${v.replace(/^@/, "")}`,
  },
  {
    id: "bluesky",
    label: "Bluesky",
    usernameBased: true,
    placeholder: "handle.bsky.social",
    urlFromValue: (v) => `https://bsky.app/profile/${v}`,
  },
  {
    id: "mastodon",
    label: "Mastodon",
    usernameBased: false,
    placeholder: "https://mastodon.social/@you",
  },
  {
    id: "website",
    label: "Website",
    usernameBased: false,
    placeholder: "https://yoursite.com",
  },
  {
    id: "other",
    label: "Other",
    usernameBased: false,
    placeholder: "https://…",
  },
];

const byId = new Map(SOCIAL_PROVIDERS.map((p) => [p.id, p]));

export function getSocialProvider(id: string): SocialProviderDef | undefined {
  return byId.get(id as SocialProvider);
}

export function isSocialProvider(id: string): id is SocialProvider {
  return byId.has(id as SocialProvider);
}

/** Resolve a clickable URL from provider + stored value. */
export function resolveSocialUrl(provider: string, value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  // Resume import often stores `linkedin.com/in/foo` without a scheme.
  if (looksLikeBareHost(v) && (v.includes("/") || v.toLowerCase().startsWith("www."))) {
    return absoluteHttpUrl(v);
  }
  const def = getSocialProvider(provider);
  if (def?.urlFromValue) return def.urlFromValue(v.replace(/^@/, ""));
  if (def && !def.usernameBased) return absoluteHttpUrl(v) || `https://${v}`;
  return absoluteHttpUrl(v) || v;
}

export function socialDisplayLabel(provider: string, label: string): string {
  const custom = label.trim();
  if (custom) return custom;
  return getSocialProvider(provider)?.label ?? "Link";
}

/** Compact SVG icons (24×24 viewBox) for public pages. */
export function socialIconSvg(provider: string): string {
  const common = `width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"`;
  switch (provider) {
    case "github":
      return `<svg ${common}><path d="M12 2C6.477 2 2 6.486 2 12.021c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.866-.013-1.7-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.622.069-.609.069-.609 1.003.071 1.531 1.033 1.531 1.033.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.339-2.22-.253-4.555-1.113-4.555-4.952 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.203 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.944.359.31.678.92.678 1.855 0 1.338-.012 2.419-.012 2.749 0 .268.18.58.688.481A10.02 10.02 0 0 0 22 12.021C22 6.486 17.523 2 12 2z"/></svg>`;
    case "linkedin":
      return `<svg ${common}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;
    case "twitter":
      return `<svg ${common}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>`;
    case "youtube":
      return `<svg ${common}><path d="M23.498 6.186a2.974 2.974 0 0 0-2.092-2.105C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.406.535A2.974 2.974 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a2.974 2.974 0 0 0 2.092 2.105c1.901.535 9.406.535 9.406.535s7.505 0 9.406-.535a2.974 2.974 0 0 0 2.092-2.105C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;
    case "instagram":
      return `<svg ${common}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`;
    case "dribbble":
      return `<svg ${common}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.51 0 10-4.48 10-10S17.51 2 12 2zm6.605 4.61a8.502 8.502 0 0 1 1.93 5.314c-.281-.054-3.101-.629-5.943-.271-.065-.141-.12-.293-.184-.434a34.76 34.76 0 0 0-1.15-2.436c3.06-1.25 4.467-3.038 5.347-2.173zM12 3.5c1.97 0 3.773.71 5.174 1.884-.72.78-1.89 2.31-4.64 3.31A53.86 53.86 0 0 0 9.36 4.39C10.2 3.81 11.07 3.5 12 3.5zM7.36 5.14c.42.42 2.48 2.56 3.7 5.03-2.93.79-5.53.84-5.81.84A8.52 8.52 0 0 1 7.36 5.14zM3.55 12.02c.03 0 3.23-.02 6.68-.98.18.44.36.88.52 1.33-.76.23-2.95.91-4.14 2.72A8.53 8.53 0 0 1 3.55 12.02zm3.27 5.4c.87-1.52 2.75-2.36 4.15-2.73.95 2.47 1.34 4.54 1.42 5.12A8.53 8.53 0 0 1 6.82 17.42zm7.01 2.19c-.06-.39-.4-2.32-1.29-4.75 2.72-.43 5.1.27 5.4.35a8.54 8.54 0 0 1-4.11 4.4z"/></svg>`;
    case "behance":
      return `<svg ${common}><path d="M8.228 15.01h-2.54v-1.63h2.48c.55 0 .89.28.89.76 0 .5-.36.87-.83.87zm-.11-5.14H5.69v1.45h2.28c.45 0 .77-.26.77-.72 0-.43-.31-.73-.72-.73zM16.98 12.6c-.1-.4-.5-.66-1.04-.66-.9 0-1.43.66-1.43 1.59 0 .96.54 1.6 1.44 1.6.53 0 .94-.24 1.11-.72h1.74c-.25 1.47-1.48 2.47-2.9 2.47-1.92 0-3.27-1.4-3.27-3.35 0-1.93 1.36-3.34 3.24-3.34 1.75 0 2.9 1.1 3.04 2.7l.07.71h-2zm-9.48 5.28c1.83 0 3.26-1.02 3.26-2.71 0-1.14-.7-1.92-1.74-2.2v-.05c.78-.34 1.32-1.01 1.32-1.9 0-1.43-1.21-2.4-2.96-2.4H3.5v9.26h3.99zm11.55-10.1h-4.27V6.3h4.27v1.48z"/></svg>`;
    case "medium":
      return `<svg ${common}><path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zm7.36 0c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/></svg>`;
    case "bluesky":
      return `<svg ${common}><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.03-.02.06-.04.09-.06A7.56 7.56 0 0 1 5.2 17.4c-.9 1.05-.6 2.1.15 2.85.9.9 2.4 1.05 3.75.6 1.8-.6 3.15-2.25 3.9-3.9.75 1.65 2.1 3.3 3.9 3.9 1.35.45 2.85.3 3.75-.6.75-.75 1.05-1.8.15-2.85a7.56 7.56 0 0 1-1.897-3.849c.03.02.06.04.09.06 2.67.296 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.298-1.664-.62-4.3 1.24C20.046 4.748 17.087 8.687 16 10.8z"/></svg>`;
    case "mastodon":
      return `<svg ${common}><path d="M23.268 8.28c-.198-4.142-3.155-5.66-6.39-5.867-.287-.016-.59-.02-.887-.02H7.999c-.297 0-.6.004-.887.02C3.877 2.62.92 4.138.722 8.28c-.1 2.09-.078 4.558.04 6.59.14 2.4.9 4.65 2.55 5.7 1.5.96 3.45.9 4.95.45V17.4c-.9.3-2.1.45-3.15.15-.9-.3-1.5-1.05-1.65-1.95-.15-.75-.15-1.5-.15-2.25h6.3v3.3c0 .9.15 1.8.6 2.55.75 1.2 2.1 1.95 3.6 1.95 1.05 0 2.1-.3 2.85-.9.75-.6 1.2-1.5 1.35-2.55.3-1.8.3-3.6.15-5.4z"/></svg>`;
    case "website":
      return `<svg ${common}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`;
    case "other":
    default:
      return `<svg ${common}><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`;
  }
}
