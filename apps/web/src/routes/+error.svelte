<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
</script>

<svelte:head>
  <title>Informasi belum dapat dimuat</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="mx-auto max-w-xl px-6 py-24">
  <p class="text-sm font-medium text-water">{page.status}</p>
  <h1 class="mt-4 text-3xl font-semibold text-brand">Informasi belum dapat dimuat</h1>
  <p class="mt-4 text-text-muted">{page.error?.message}</p>
  <a href={resolve("/")} class="mt-8 inline-block rounded-full bg-brand px-6 py-3 text-white"
    >Coba kembali</a
  >
</main>
