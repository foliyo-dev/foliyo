<script lang="ts">
  export let projects: Array<{ id: string; title: string }> = [];
  export let experiences: Array<{ id: string; company: string; role: string }> = [];
  export let educations: Array<{ id: string; institution: string; degree: string }> = [];
  export let certifications: Array<{ id: string; name: string; issuer: string }> = [];
  export let languages: Array<{ id: string; name: string; proficiency: string }> = [];

  export let selectedProjects: Set<string>;
  export let selectedExperience: Set<string>;
  export let selectedEducation: Set<string>;
  export let selectedCertifications: Set<string>;
  export let selectedLanguages: Set<string>;

  export let onProjectsChange: (s: Set<string>) => void;
  export let onExperienceChange: (s: Set<string>) => void;
  export let onEducationChange: (s: Set<string>) => void;
  export let onCertificationsChange: (s: Set<string>) => void;
  export let onLanguagesChange: (s: Set<string>) => void;

  function toggle(set: Set<string>, id: string, onChange: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }
</script>

<details class="expand-section">
  <summary>More library items</summary>

  {#if projects.length}
    <div class="library-group">
      <h4>Projects ({selectedProjects.size})</h4>
      <div class="library-checks">
        {#each projects as p (p.id)}
          <label class="library-check">
            <input
              type="checkbox"
              checked={selectedProjects.has(p.id)}
              on:change={() => toggle(selectedProjects, p.id, onProjectsChange)}
            />
            <span>{p.title}</span>
          </label>
        {/each}
      </div>
    </div>
  {/if}

  {#if experiences.length}
    <div class="library-group">
      <h4>Experience ({selectedExperience.size})</h4>
      <div class="library-checks">
        {#each experiences as e (e.id)}
          <label class="library-check">
            <input
              type="checkbox"
              checked={selectedExperience.has(e.id)}
              on:change={() => toggle(selectedExperience, e.id, onExperienceChange)}
            />
            <span>{e.role} · {e.company}</span>
          </label>
        {/each}
      </div>
    </div>
  {/if}

  {#if educations.length}
    <div class="library-group">
      <h4>Education ({selectedEducation.size})</h4>
      <div class="library-checks">
        {#each educations as ed (ed.id)}
          <label class="library-check">
            <input
              type="checkbox"
              checked={selectedEducation.has(ed.id)}
              on:change={() => toggle(selectedEducation, ed.id, onEducationChange)}
            />
            <span>{ed.degree} · {ed.institution}</span>
          </label>
        {/each}
      </div>
    </div>
  {/if}

  {#if certifications.length}
    <div class="library-group">
      <h4>Certifications ({selectedCertifications.size})</h4>
      <div class="library-checks">
        {#each certifications as c (c.id)}
          <label class="library-check">
            <input
              type="checkbox"
              checked={selectedCertifications.has(c.id)}
              on:change={() => toggle(selectedCertifications, c.id, onCertificationsChange)}
            />
            <span>{c.name} · {c.issuer}</span>
          </label>
        {/each}
      </div>
    </div>
  {/if}

  {#if languages.length}
    <div class="library-group">
      <h4>Languages ({selectedLanguages.size})</h4>
      <div class="library-checks">
        {#each languages as lang (lang.id)}
          <label class="library-check">
            <input
              type="checkbox"
              checked={selectedLanguages.has(lang.id)}
              on:change={() => toggle(selectedLanguages, lang.id, onLanguagesChange)}
            />
            <span>{lang.name} · {lang.proficiency}</span>
          </label>
        {/each}
      </div>
    </div>
  {/if}
</details>
