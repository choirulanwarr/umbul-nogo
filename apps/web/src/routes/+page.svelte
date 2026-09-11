<script lang="ts">
  import { bootstrapSiteSchema } from "@umbul-nogo/contracts/bootstrap";
  import type { PageData } from "./$types";

  const props = $props<{ data: PageData }>();
  const site = $derived(bootstrapSiteSchema.parse(props.data.site));
  let showVisitDetails = $state(false);
</script>

<svelte:head>
  <title>{site.name} — Informasi wisata segera hadir</title>
  <meta
    name="description"
    content={`Informasi wisata dan tiket masuk ${site.name} di ${site.region}.`}
  />
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-6xl flex-col px-6 sm:px-10">
  <header class="flex items-center justify-between border-b border-divider py-7">
    <a href="#beranda" class="text-lg font-bold tracking-[0.14em] text-brand">{site.name}</a>
    <span class="rounded-full border border-divider px-3 py-1 text-xs text-text-muted"
      >Segera hadir</span
    >
  </header>

  <main id="beranda" class="flex-1 py-20 sm:py-28">
    <p class="mb-6 text-sm font-medium tracking-[0.2em] text-water uppercase">{site.region}</p>
    <h1
      class="max-w-3xl text-5xl leading-[1.08] font-semibold tracking-tight text-brand sm:text-7xl"
    >
      Selamat datang di<br />{site.name}.
    </h1>
    <p class="mt-8 max-w-xl text-lg leading-8 text-text-muted">
      Informasi wisata dan kunjungan sedang kami siapkan. Nantikan cerita, foto, dan informasi
      terbaru dari destinasi kami.
    </p>
    <a
      href="#tiket"
      class="mt-9 inline-flex min-h-12 items-center rounded-full bg-brand px-6 py-3 font-medium text-white hover:bg-brand-hover"
    >
      Lihat informasi tiket <span aria-hidden="true" class="ml-4">↗</span>
    </a>

    <section
      id="tiket"
      aria-labelledby="ticket-title"
      class="mt-20 max-w-2xl rounded-3xl border border-divider bg-surface p-7 sm:p-9"
    >
      <p class="mb-3 text-xs font-semibold tracking-[0.18em] text-water uppercase">
        Rencanakan kunjungan
      </p>
      <h2 id="ticket-title" class="text-2xl font-semibold text-brand">Tiket masuk</h2>
      <p class="mt-3 leading-7 text-text-muted">Informasi harga tiket belum tersedia.</p>
      <button
        type="button"
        aria-expanded={showVisitDetails}
        aria-controls="visit-details"
        onclick={() => (showVisitDetails = !showVisitDetails)}
        class="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-water"
      >
        Informasi kunjungan <span aria-hidden="true">{showVisitDetails ? "−" : "+"}</span>
      </button>
      <p
        id="visit-details"
        hidden={!showVisitDetails}
        class="mt-2 text-sm leading-7 text-text-muted"
      >
        Jadwal operasional, alamat lengkap, dan kontak pengelola akan dilengkapi sebelum peluncuran.
      </p>
    </section>
  </main>

  <footer class="border-t border-divider py-6 text-sm text-text-muted">
    {site.name} <span aria-hidden="true">·</span>
    {site.region}
  </footer>
</div>
