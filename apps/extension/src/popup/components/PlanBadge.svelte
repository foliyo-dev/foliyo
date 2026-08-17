<script lang="ts">
  import type { PlanInfo } from "../../api";
  import { formatPlanLabel, isProPlan } from "../../config";

  export let planInfo: PlanInfo | null;
</script>

{#if planInfo}
  <span class="plan-badge" class:pro={isProPlan(planInfo.plan)}>
    {formatPlanLabel(planInfo.plan, { onTrial: planInfo.on_trial })}
  </span>
{/if}
