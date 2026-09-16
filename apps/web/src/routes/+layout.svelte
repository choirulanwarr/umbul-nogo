<script lang="ts">
  import "../app.css";
  import type { Snippet } from "svelte";

  const props = $props<{ children: Snippet }>();
</script>

{@render props.children()}
