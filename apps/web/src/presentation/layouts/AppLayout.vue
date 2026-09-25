<script setup lang="ts">
import { computed, h, onMounted, watch, type Component } from "vue"
import { useRoute, useRouter } from "vue-router"
import { NIcon, type MenuOption } from "naive-ui"
import {
  CartOutline,
  ChevronForward,
  CubeOutline,
  GridOutline,
  LogOutOutline,
  NotificationsOutline,
  PeopleOutline,
  ReceiptOutline,
  SearchOutline,
  SettingsOutline,
  TimeOutline,
  WarningOutline,
} from "@vicons/ionicons5"
import { useSessionStore } from "../../stores/sessionStore"
import { useThemeStore } from "../../stores/themeStore"
import { useDashboardStore } from "../../stores/dashboardStore"
import { useStoreProfileStore } from "../../stores/storeProfileStore"
import { palette, radius } from "../../theme/naiveOverrides"
import { es } from "../../i18n/es"
import { useMediaQuery } from "../composables/useMediaQuery"

const isDesktop = useMediaQuery("(min-width: 768px)")
const router = useRouter()
const route = useRoute()
const session = useSessionStore()
const themeStore = useThemeStore()
const dashboard = useDashboardStore()
const storeProfile = useStoreProfileStore()

interface NavItem {
  key: string
  to: string
  label: string
  icon: Component
}

const navItems: NavItem[] = [
  { key: "home", to: "/inicio", label: es.nav.home, icon: GridOutline },
  { key: "order-wizard", to: "/pedido", label: es.nav.orderWizard, icon: CartOutline },
  { key: "suppliers", to: "/proveedores", label: es.nav.suppliers, icon: PeopleOutline },
  { key: "products", to: "/productos", label: es.nav.products, icon: CubeOutline },
  { key: "history", to: "/historial", label: es.nav.history, icon: TimeOutline },
  { key: "settings", to: "/configuracion", label: es.nav.settings, icon: SettingsOutline },
]

/** Calidad de datos no está en el menú; se abre con la campana del encabezado y se marca activa por su ruta. */
const hiddenRoutes: NavItem[] = [{ key: "data-quality", to: "/calidad", label: es.nav.dataQuality, icon: WarningOutline }]

const tone = computed(() => (themeStore.mode === "dark" ? palette.dark : palette.light))
const activeKey = computed(
  () => [...navItems, ...hiddenRoutes].find((item) => route.path.startsWith(item.to))?.key ?? "home",
)
const issueCount = computed(() => dashboard.summary?.issueCount ?? 0)
const pendingOrderCount = computed(() => dashboard.summary?.pendingOrderCount ?? 0)
const storeName = computed(() => storeProfile.profile?.name ?? session.store?.name ?? null)
const adminName = computed(() => storeProfile.profile?.adminName ?? null)
const logoUrl = computed(() => storeProfile.profile?.logoUrl ?? undefined)
const initials = computed(() =>
  (storeName.value ?? session.user?.email ?? "?")
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase(),
)

const renderIcon = (icon: Component) => () => h(NIcon, { component: icon, size: 18 })

const menuOptions = computed<MenuOption[]>(() =>
  navItems.map((item) => ({
    key: item.key,
    label: item.label,
    icon: renderIcon(item.icon),
    extra: () => {
      if (item.key === activeKey.value) return h(NIcon, { component: ChevronForward, size: 14 })
      return null
    },
  })),
)

function navigate(key: string): void {
  const target = navItems.find((item) => item.key === key)
  if (target !== undefined) void router.push(target.to)
}

async function handleSignOut(): Promise<void> {
  await session.signOut()
  await router.push({ name: "login" })
}

onMounted(() => {
  void dashboard.loadSummary()
  void storeProfile.load()
})

// Al volver de confirmar o recibir un pedido, el aviso del encabezado se actualiza.
watch(
  () => route.path,
  () => {
    void dashboard.loadSummary()
  },
)
</script>

<template>
  <!-- Alto fijo = alto del viewport: el sidebar no se mueve y solo el contenido hace scroll. -->
  <div :style="{ height: '100dvh', boxSizing: 'border-box', padding: isDesktop ? '20px' : '8px 8px 72px' }">
    <n-layout
      has-sider
      :style="{ borderRadius: isDesktop ? radius.xl : radius.lg, height: '100%' }"
    >
      <n-layout-sider
        v-if="isDesktop"
        :width="220"
        :native-scrollbar="false"
        :style="{ height: '100%' }"
        :content-style="{ height: '100%', boxSizing: 'border-box', padding: '27px 15px 27px 20px' }"
      >
        <n-flex vertical justify="space-between" :style="{ height: '100%' }" :wrap="false">
          <n-flex vertical :size="56">
            <!-- Logo: anillo verde profundo con núcleo lima -->
            <n-flex align="center" :size="10" :style="{ height: '56px' }">
              <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
                <circle cx="13" cy="13" r="10" :style="{ fill: 'none', stroke: tone.data, strokeWidth: 5 }" />
                <circle cx="13" cy="13" r="4.5" :style="{ fill: palette.accent }" />
              </svg>
              <n-text strong :style="{ fontSize: '18px', fontWeight: 600 }">{{ es.shell.brand }}</n-text>
            </n-flex>

            <n-menu :value="activeKey" :options="menuOptions" :indent="16" @update:value="navigate" />
          </n-flex>

          <n-flex vertical :size="20">
            <n-flex align="center" :size="12" :wrap="false">
              <n-badge dot :color="palette.accent" :offset="[-4, 36]">
                <n-avatar
                  round
                  :size="44"
                  :src="logoUrl"
                  object-fit="cover"
                  :style="{ background: palette.brandDeep, color: palette.accent, fontWeight: 600 }"
                >
                  <!-- Con v-if: si hubiera texto (aunque vacío) Naive pinta el slot y no la imagen -->
                  <template v-if="!logoUrl">{{ initials }}</template>
                </n-avatar>
              </n-badge>
              <n-flex vertical :size="0" :style="{ minWidth: 0, flex: 1 }">
                <n-ellipsis :style="{ fontSize: '14px', fontWeight: 600 }">{{ storeName ?? es.shell.storeOwner }}</n-ellipsis>
                <n-ellipsis :style="{ fontSize: '11px' }" depth="3">{{ adminName ?? session.user?.email ?? "" }}</n-ellipsis>
              </n-flex>
              <n-button quaternary circle size="small" :aria-label="es.auth.signOut" @click="handleSignOut">
                <template #icon><n-icon :component="LogOutOutline" /></template>
              </n-button>
            </n-flex>

            <n-radio-group
              v-model:value="themeStore.mode"
              :aria-label="es.shell.themeLabel"
              :style="{ background: tone.surface2, borderRadius: radius.pill, padding: '2px', display: 'flex' }"
            >
              <n-radio-button value="light" :style="{ flex: 1, textAlign: 'center' }">{{ es.shell.themeLight }}</n-radio-button>
              <n-radio-button value="dark" :style="{ flex: 1, textAlign: 'center' }">{{ es.shell.themeDark }}</n-radio-button>
            </n-radio-group>
          </n-flex>
        </n-flex>
      </n-layout-sider>

      <n-layout
        :style="{ height: '100%' }"
        :content-style="{ padding: '27px clamp(12px, 2.4vw, 34px) 34px clamp(12px, 1.4vw, 20px)' }"
        :native-scrollbar="false"
      >
        <n-flex vertical :size="32">
          <!-- Encabezado -->
          <n-flex justify="space-between" align="center" :size="16">
            <n-flex vertical :size="2">
              <n-text :style="{ fontSize: '22px', fontWeight: 500 }">
                {{ adminName ? es.shell.greeting(adminName) : storeName ? es.shell.greeting(storeName) : es.shell.greetingFallback }}
              </n-text>
              <n-text depth="3" :style="{ fontSize: '12px' }">{{ es.shell.pendingOrders(pendingOrderCount) }}</n-text>
            </n-flex>
            <n-flex align="center" :size="12">
              <n-badge :value="issueCount" :max="99" :show="issueCount > 0" :color="palette.accent" :style="{ '--n-font-color': palette.brandDeep }">
                <n-button circle :color="tone.ink" :text-color="tone.surface" :aria-label="es.shell.qualityAlerts" @click="router.push('/calidad')">
                  <template #icon><n-icon :component="NotificationsOutline" /></template>
                </n-button>
              </n-badge>
              <n-button circle :color="tone.ink" :text-color="tone.surface" :aria-label="es.shell.searchProducts" @click="router.push('/productos')">
                <template #icon><n-icon :component="SearchOutline" /></template>
              </n-button>
              <n-button circle :color="tone.ink" :text-color="tone.surface" :aria-label="es.shell.history" @click="router.push('/historial')">
                <template #icon><n-icon :component="ReceiptOutline" /></template>
              </n-button>
              <n-button type="primary" :style="{ minWidth: '160px' }" @click="router.push('/pedido')">
                {{ es.shell.createOrder }}
              </n-button>
            </n-flex>
          </n-flex>

          <router-view />
        </n-flex>
      </n-layout>
    </n-layout>

    <!-- < 768 px: la barra lateral pasa a una barra inferior de íconos -->
    <nav
      v-if="!isDesktop"
      class="fixed inset-x-0 bottom-0 z-10"
      :style="{ background: tone.surface, borderTop: `1px solid ${tone.line}`, padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))' }"
    >
      <n-flex justify="space-around" align="center">
        <n-button
          v-for="item in navItems"
          :key="item.key"
          circle
          :type="item.key === activeKey ? 'primary' : 'default'"
          :quaternary="item.key !== activeKey"
          :aria-label="item.label"
          @click="navigate(item.key)"
        >
          <template #icon><n-icon :component="item.icon" /></template>
        </n-button>
      </n-flex>
    </nav>
  </div>
</template>
