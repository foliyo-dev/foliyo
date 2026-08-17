<script lang="ts">
  import { onMount } from "svelte";
  import { login, parseApiMessage, parseUpgradeError } from "../../api";
  import { loadSettings, saveSettings } from "../../storage";
  import { appUrl } from "../../config";

  export let onLogin: (email: string) => void | Promise<void>;
  export let initialError = "";

  let email = "";
  let password = "";
  let busy = false;
  let error = initialError;

  onMount(async () => {
    const s = await loadSettings();
    if (s.email) email = s.email;
  });

  async function submit() {
    error = "";
    if (!email.trim() || !password) {
      error = "Email and password are required.";
      return;
    }
    busy = true;
    try {
      const res = await login(email.trim(), password);
      await saveSettings({ token: res.token, email: res.user.email });
      await onLogin(res.user.email);
    } catch (err) {
      const upgrade = parseUpgradeError(err);
      error = upgrade?.message ?? parseApiMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="card">
  <h2 class="section-title">Sign in</h2>
  <p class="hint">Use your Foliyo account to analyze jobs and tailor resumes.</p>
  <div class="fields">
    <label class="field">
      <span class="label">Email</span>
      <input type="email" autocomplete="username" bind:value={email} />
    </label>
    <label class="field">
      <span class="label">Password</span>
      <input type="password" autocomplete="current-password" bind:value={password} />
    </label>
  </div>
  <div class="form-actions">
    <button type="button" class="btn" disabled={busy} on:click={submit}>
      {busy ? "Signing in…" : "Sign in"}
    </button>
    <a class="ghost-link" href={appUrl("/")} target="_blank" rel="noreferrer">Open Foliyo</a>
  </div>
  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>
