<script setup lang="ts">
import { ref } from "vue"
import { useRouter, useRoute } from "vue-router"
import { useSessionStore } from "../../stores/sessionStore"
import { palette, radius } from "../../theme/naiveOverrides"
import { es } from "../../i18n/es"
import { motion } from "motion-v"

const router = useRouter()
const route = useRoute()
const session = useSessionStore()

const email = ref("")
const password = ref("")

async function handleSubmit(): Promise<void> {
  try {
    await session.signIn(email.value, password.value)
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/pedido"
    await router.push(redirect)
  } catch {
    // session.signInError ya contiene el mensaje.
  }
}
</script>

<template>
  <n-flex justify="center" align="center" :style="{ minHeight: '100vh', padding: '16px' }">
    <motion.div :initial="{ opacity: 0, y: 16 }" :animate="{ opacity: 1, y: 0 }" :transition="{ duration: 0.35 }" :style="{ width: '100%', maxWidth: '400px' }">
      <n-card :bordered="false" :style="{ borderRadius: radius.xl, background: 'var(--surface)' }" :content-style="{ padding: '36px 32px' }">
        <n-flex vertical :size="28">
          <n-flex vertical align="center" :size="12">
            <svg width="44" height="44" viewBox="0 0 26 26" aria-hidden="true">
              <circle cx="13" cy="13" r="10" style="fill: none; stroke: var(--data); stroke-width: 5" />
              <circle cx="13" cy="13" r="4.5" :style="{ fill: palette.accent }" />
            </svg>
            <n-flex vertical align="center" :size="2">
              <n-text :style="{ fontSize: '22px', fontWeight: 600 }">{{ es.shell.brand }}</n-text>
              <n-text depth="3" :style="{ fontSize: '13px' }">{{ es.app.tagline }}</n-text>
            </n-flex>
          </n-flex>

          <n-form @submit.prevent="handleSubmit">
            <n-form-item :label="es.auth.email" label-for="email">
              <n-input
                v-model:value="email"
                :placeholder="es.auth.emailPlaceholder"
                :input-props="{ id: 'email', autocomplete: 'email', type: 'email' }"
              />
            </n-form-item>
            <n-form-item :label="es.auth.password" label-for="password">
              <n-input
                v-model:value="password"
                type="password"
                show-password-on="click"
                :placeholder="es.auth.passwordPlaceholder"
                :input-props="{ id: 'password', autocomplete: 'current-password' }"
              />
            </n-form-item>

            <n-flex vertical :size="16">
              <n-alert v-if="session.signInError !== null" type="error" :bordered="false">
                {{ session.signInError }}
              </n-alert>
              <n-button type="primary" attr-type="submit" block size="large" :loading="session.isSigningIn">
                {{ session.isSigningIn ? es.auth.signingIn : es.auth.signIn }}
              </n-button>
            </n-flex>
          </n-form>
        </n-flex>
      </n-card>
    </motion.div>
  </n-flex>
</template>
