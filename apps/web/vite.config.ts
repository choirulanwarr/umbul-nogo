import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import adapter from "svelte-adapter-bun";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit({ adapter: adapter() })],
});
