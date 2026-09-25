import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import tailwindcss from "@tailwindcss/vite"
import Components from "unplugin-vue-components/vite"
import { NaiveUiResolver } from "unplugin-vue-components/resolvers"
import MotionResolver from "motion-v/resolver"

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    Components({
      dts: "src/components.d.ts",
      resolvers: [NaiveUiResolver(), MotionResolver()],
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})