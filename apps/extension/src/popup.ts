import {
  clearSession,
  loadSettings,
  saveSettings,
} from "./storage";
import {
  downloadFio,
  ExtApiError,
  listPortfolios,
  listSkills,
  login,
  me,
  tailorResume,
} from "./api";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const viewLogin = $("view-login");
const viewApp = $("view-app");
const sessionBar = $("sessionBar");
const apiBaseInput = $<HTMLInputElement>("apiBase");
const emailInput = $<HTMLInputElement>("email");
const passwordInput = $<HTMLInputElement>("password");
const loginBtn = $<HTMLButtonElement>("loginBtn");
const loginError = $("loginError");
const sessionEmail = $("sessionEmail");
const logoutBtn = $<HTMLButtonElement>("logoutBtn");
const resumeName = $<HTMLInputElement>("resumeName");
const portfolioSelect = $<HTMLSelectElement>("portfolio");
const themeSelect = $<HTMLSelectElement>("theme");
const jdWrap = $("jdWrap");
const jd = $<HTMLTextAreaElement>("jd");
const skillsList = $("skills");
const skillsHint = $("skillsHint");
const skillsMeta = $("skillsMeta");
const skillsEmpty = $("skillsEmpty");
const skillFilter = $<HTMLInputElement>("skillFilter");
const selectAllSkills = $<HTMLButtonElement>("selectAllSkills");
const clearSkills = $<HTMLButtonElement>("clearSkills");
const includeMatching = $<HTMLInputElement>("includeMatching");
const createBtn = $<HTMLButtonElement>("createBtn");
const appError = $("appError");
const appOk = $("appOk");
const result = $("result");
const downloadBtn = $<HTMLButtonElement>("downloadBtn");
const dashboardLink = $<HTMLAnchorElement>("dashboardLink");

type SkillRow = { id: string; name: string; level: string };

let lastResume: { id: string; name: string } | null = null;
let allSkills: SkillRow[] = [];
let selectedIds = new Set<string>();

function mode(): "jd" | "skills" {
  const checked = document.querySelector<HTMLInputElement>('input[name="mode"]:checked');
  return checked?.value === "skills" ? "skills" : "jd";
}

function syncModeUi() {
  jdWrap.classList.toggle("hidden", mode() === "skills");
  updateSkillsChrome();
}

function updateSkillsChrome() {
  const total = allSkills.length;
  skillsMeta.textContent = total ? `${selectedIds.size} selected` : "";
  skillsHint.textContent = mode() === "jd" ? "(optional extras)" : "";
  selectAllSkills.textContent = skillFilter.value.trim() ? "Select filtered" : "Select all";
}

function filteredSkills(): SkillRow[] {
  const q = skillFilter.value.trim().toLowerCase();
  if (!q) return allSkills;
  return allSkills.filter((sk) => `${sk.name} ${sk.level}`.toLowerCase().includes(q));
}

function renderSkills() {
  const visible = filteredSkills();

  skillsList.innerHTML = visible
    .map((sk) => {
      const on = selectedIds.has(sk.id);
      return `<li><label class="chip${on ? " on" : ""}"><input type="checkbox" value="${sk.id}"${on ? " checked" : ""} /><span class="chip-text">${escapeHtml(sk.name)}<span class="meta">${escapeHtml(sk.level)}</span></span></label></li>`;
    })
    .join("");

  if (allSkills.length === 0) {
    skillsEmpty.textContent = "No confirmed skills yet — add some in Foliyo.";
    skillsEmpty.classList.remove("hidden");
  } else if (visible.length === 0) {
    skillsEmpty.textContent = "No skills match.";
    skillsEmpty.classList.remove("hidden");
  } else {
    skillsEmpty.classList.add("hidden");
  }

  updateSkillsChrome();
}

function setDashboardLink(apiBase: string) {
  if (apiBase.includes("localhost:8080") || apiBase.includes("127.0.0.1:8080")) {
    dashboardLink.href = "http://localhost:5173/resume";
  } else if (apiBase.includes("foliyo.dev")) {
    dashboardLink.href = "https://app.foliyo.dev/resume";
  } else {
    dashboardLink.href = `${apiBase.replace(/\/$/, "").replace(/:\d+$/, ":5173")}/resume`;
  }
}

async function showLoggedOut() {
  const s = await loadSettings();
  apiBaseInput.value = s.apiBase;
  if (s.email && !emailInput.value) emailInput.value = s.email;
  viewLogin.classList.remove("hidden");
  viewApp.classList.add("hidden");
  sessionBar.classList.add("hidden");
}

function showAppShell(email: string | null, apiBase: string) {
  sessionEmail.textContent = email ?? "";
  sessionBar.classList.remove("hidden");
  setDashboardLink(apiBase);
  viewLogin.classList.add("hidden");
  viewApp.classList.remove("hidden");
  syncModeUi();
}

async function loadAppData() {
  const s = await loadSettings();
  showAppShell(s.email, s.apiBase);
  appError.textContent = "";
  result.classList.add("hidden");

  const [portfolios, skills] = await Promise.all([listPortfolios(s), listSkills(s)]);
  if (portfolios.length === 0) {
    portfolioSelect.innerHTML = "";
    appError.textContent = "Create a portfolio in Foliyo first, then come back.";
  } else {
    portfolioSelect.innerHTML = portfolios
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
      .join("");
  }

  allSkills = skills.map((sk) => ({ id: sk.id, name: sk.name, level: sk.level }));
  selectedIds = new Set();
  skillFilter.value = "";
  renderSkills();
}

function isUnauthorized(err: unknown): boolean {
  return err instanceof ExtApiError && err.status === 401;
}

async function restoreSession() {
  const s = await loadSettings();
  if (!s.token) {
    await showLoggedOut();
    return;
  }

  try {
    const profile = await me(s);
    if (profile.user.email && profile.user.email !== s.email) {
      await saveSettings({ email: profile.user.email });
    }
    await loadAppData();
  } catch (err) {
    if (isUnauthorized(err)) {
      await clearSession();
      await showLoggedOut();
      loginError.textContent = "Session expired — sign in again";
      return;
    }
    showAppShell(s.email, s.apiBase);
    appError.textContent = `${parseErr(err)} — still signed in; try again when the API is up.`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseErr(err: unknown): string {
  if (err instanceof ExtApiError) {
    try {
      const body = JSON.parse(err.message) as { message?: string; error?: string };
      return body.message ?? body.error ?? err.message;
    } catch {
      return err.message;
    }
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

loginBtn.addEventListener("click", async () => {
  loginError.textContent = "";
  const apiBase = apiBaseInput.value.trim() || "http://localhost:8080";
  await saveSettings({ apiBase });
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";
  try {
    const res = await login(emailInput.value.trim(), passwordInput.value, {
      apiBase,
      token: null,
      email: null,
    });
    await saveSettings({ token: res.token, email: res.user.email, apiBase });
    passwordInput.value = "";
    await loadAppData();
  } catch (err) {
    loginError.textContent = parseErr(err);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in";
  }
});

logoutBtn.addEventListener("click", async () => {
  await clearSession();
  await showLoggedOut();
});

document.querySelectorAll('input[name="mode"]').forEach((el) => {
  el.addEventListener("change", syncModeUi);
});

skillFilter.addEventListener("input", () => {
  renderSkills();
});

skillsList.addEventListener("change", (ev) => {
  const input = ev.target as HTMLInputElement;
  if (input.type !== "checkbox") return;
  if (input.checked) selectedIds.add(input.value);
  else selectedIds.delete(input.value);
  input.closest(".chip")?.classList.toggle("on", input.checked);
  updateSkillsChrome();
});

selectAllSkills.addEventListener("click", () => {
  for (const sk of filteredSkills()) selectedIds.add(sk.id);
  renderSkills();
});

clearSkills.addEventListener("click", () => {
  const q = skillFilter.value.trim();
  if (!q) {
    selectedIds = new Set();
  } else {
    for (const sk of filteredSkills()) selectedIds.delete(sk.id);
  }
  renderSkills();
});

createBtn.addEventListener("click", async () => {
  appError.textContent = "";
  result.classList.add("hidden");
  lastResume = null;

  const name = resumeName.value.trim();
  const portfolio_id = portfolioSelect.value;
  if (!name || !portfolio_id) {
    appError.textContent = "Name and portfolio are required";
    return;
  }

  const m = mode();
  const skill_ids = [...selectedIds];
  const jd_text = jd.value.trim();
  if (m === "jd" && !jd_text && skill_ids.length === 0) {
    appError.textContent = "Paste a JD or pick at least one skill";
    return;
  }
  if (m === "skills" && skill_ids.length === 0) {
    appError.textContent = "Pick at least one skill";
    return;
  }

  createBtn.disabled = true;
  createBtn.textContent = "Creating…";
  try {
    const out = await tailorResume({
      name,
      portfolio_id,
      skill_ids,
      jd_text: m === "jd" ? jd_text : undefined,
      include_matching: includeMatching.checked,
      theme_slug: themeSelect.value || "classic",
    });
    lastResume = { id: out.resume.id, name: out.resume.name };
    appOk.innerHTML = `<strong>${escapeHtml(out.resume.name)}</strong> — created with ${out.matched_skill_ids.length} skill(s)`;
    result.classList.remove("hidden");
    result.scrollIntoView({ block: "nearest" });
  } catch (err) {
    if (isUnauthorized(err)) {
      await clearSession();
      await showLoggedOut();
      loginError.textContent = "Session expired — sign in again";
    } else {
      appError.textContent = parseErr(err);
    }
  } finally {
    createBtn.disabled = false;
    createBtn.textContent = "Create resume";
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!lastResume) return;
  downloadBtn.disabled = true;
  try {
    await downloadFio(lastResume.id, lastResume.name);
  } catch (err) {
    appError.textContent = parseErr(err);
  } finally {
    downloadBtn.disabled = false;
  }
});

void restoreSession();
