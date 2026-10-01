<script setup lang="ts">
import { computed, h, onMounted, ref, watch, type Component } from "vue"
import { useRoute, useRouter } from "vue-router"
import { NIcon, type MenuOption } from "naive-ui"
import {
  CartOutline,
  ChevronForward,
  CubeOutline,
  GridOutline,
  LogOutOutline,
  MoonOutline,
  NotificationsOutline,
  PeopleOutline,
  ReceiptOutline,
  SearchOutline,
  SettingsOutline,
  SunnyOutline,
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
  /** Por ahora solo se muestran Hacer pedido y Configuración: el foco es tener los pedidos listos solos. */
  visible: boolean
}

const allNavItems: NavItem[] = [
  { key: "home", to: "/inicio", label: es.nav.home, icon: GridOutline, visible: false },
  { key: "order-wizard", to: "/pedido", label: es.nav.orderWizard, icon: CartOutline, visible: true },
  { key: "history", to: "/pedidos", label: es.nav.history, icon: ReceiptOutline, visible: true },
  { key: "suppliers", to: "/proveedores", label: es.nav.suppliers, icon: PeopleOutline, visible: true },
  { key: "products", to: "/productos", label: es.nav.products, icon: CubeOutline, visible: true },
  { key: "data-quality", to: "/calidad", label: es.nav.dataQuality, icon: WarningOutline, visible: false },
  { key: "settings", to: "/configuracion", label: es.nav.settings, icon: SettingsOutline, visible: true },
]

/** Opciones del menú (sidebar y barra inferior del celular). Las ocultas siguen existiendo por su ruta. */
const navItems = allNavItems.filter((item) => item.visible)

/** Botones del encabezado que llevan a secciones ocultas (Calidad, Productos, Historial). */
const showSecondaryShortcuts = false

const tone = computed(() => (themeStore.mode === "dark" ? palette.dark : palette.light))
const activeKey = computed(
  () => allNavItems.find((item) => route.path.startsWith(item.to))?.key ?? "order-wizard",
)
const issueCount = computed(() => dashboard.summary?.issueCount ?? 0)
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

// ── Sidebar contraíble (n-layout-sider): se recuerda entre visitas ──
const SIDER_WIDTH = 220
const SIDER_COLLAPSED_WIDTH = 80
/**
 * Menú contraído: Naive pinta el fondo de la opción con 8 px de margen a cada lado, así que con
 * 60 px el fondo mide 44 × 44 (el alto de la opción) y, con radio de píldora, queda circular.
 * El sider de 80 px deja 10 px de relleno por lado.
 */
const MENU_COLLAPSED_WIDTH = 60
const SIDER_COLLAPSED_PADDING = (SIDER_COLLAPSED_WIDTH - MENU_COLLAPSED_WIDTH) / 2
const COLLAPSED_KEY = "superpedido.sidebarCollapsed"

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1"
  } catch {
    return false
  }
}
const collapsed = ref(readCollapsed())
watch(collapsed, (value) => {
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0")
  } catch {
    // Sin almacenamiento: el menú vuelve a abrirse al recargar.
  }
})

/** Botón de contraer/expandir: un poco más grande que el de Naive (24 px), a la altura del logo. */
const siderTriggerStyle = { top: "55px", width: "28px", height: "28px", boxShadow: "0 2px 6px rgba(1, 63, 50, 0.18)" }

const nextThemeLabel = computed(() => es.shell.themeToggle(themeStore.mode === "dark" ? es.shell.themeLight : es.shell.themeDark))
const toggleTheme = (): void => {
  themeStore.mode = themeStore.mode === "dark" ? "light" : "dark"
}

const menuOptions = computed<MenuOption[]>(() =>
  navItems.map((item) => ({
    key: item.key,
    label: item.label,
    icon: renderIcon(item.icon),
    extra: () => {
      if (!collapsed.value && item.key === activeKey.value) return h(NIcon, { component: ChevronForward, size: 14 })
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
      <!--
        Sidebar contraíble de Naive: contraído quedan solo los íconos (con tooltip), el logo,
        y los botones de tema, salir y la tienda.
      -->
      <n-layout-sider
        v-if="isDesktop"
        v-model:collapsed="collapsed"
        collapse-mode="width"
        :width="SIDER_WIDTH"
        :collapsed-width="SIDER_COLLAPSED_WIDTH"
        show-trigger="arrow-circle"
        :native-scrollbar="false"
        :style="{ height: '100%' }"
        :content-style="{
          height: '100%',
          boxSizing: 'border-box',
          padding: collapsed ? `27px ${SIDER_COLLAPSED_PADDING}px` : '27px 15px 27px 20px',
          transition: 'padding .3s',
        }"
        :trigger-style="siderTriggerStyle"
        :collapsed-trigger-style="siderTriggerStyle"
      >
        <n-flex vertical justify="space-between" :style="{ height: '100%' }" :wrap="false">
          <n-flex vertical :size="56">
            <!-- Logo: anillo verde profundo con núcleo lima; contraído queda solo el anillo -->
            <n-flex align="center" :justify="collapsed ? 'center' : 'start'" :size="10" :wrap="false" :style="{ height: '56px' }">
              <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" :style="{ flexShrink: 0 }">
                <circle cx="13" cy="13" r="10" :style="{ fill: 'none', stroke: tone.data, strokeWidth: 5 }" />
                <circle cx="13" cy="13" r="4.5" :style="{ fill: palette.accent }" />
              </svg>
              <n-text v-if="!collapsed" strong :style="{ fontSize: '18px', fontWeight: 600, whiteSpace: 'nowrap' }">{{ es.shell.brand }}</n-text>
            </n-flex>

            <!-- Contraído, Naive muestra el nombre de cada opción en un tooltip al pasar el mouse -->
            <n-menu
              :value="activeKey"
              :options="menuOptions"
              :indent="16"
              :collapsed="collapsed"
              :collapsed-width="MENU_COLLAPSED_WIDTH"
              :collapsed-icon-size="20"
              @update:value="navigate"
            />
          </n-flex>

          <!-- Expandido: tienda, salir y tema -->
          <n-flex v-if="!collapsed" vertical :size="20">
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
              <n-tooltip placement="top">
                <template #trigger>
                  <n-button quaternary circle size="small" :aria-label="es.auth.signOut" @click="handleSignOut">
                    <template #icon><n-icon :component="LogOutOutline" /></template>
                  </n-button>
                </template>
                {{ es.auth.signOut }}
              </n-tooltip>
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

          <!-- Contraído: lo mismo en íconos apilados, cada uno con su tooltip -->
          <n-flex v-else vertical align="center" :size="14">
            <n-tooltip placement="right">
              <template #trigger>
                <n-button circle quaternary :aria-label="nextThemeLabel" @click="toggleTheme">
                  <template #icon><n-icon :component="themeStore.mode === 'dark' ? SunnyOutline : MoonOutline" /></template>
                </n-button>
              </template>
              {{ nextThemeLabel }}
            </n-tooltip>
            <n-tooltip placement="right">
              <template #trigger>
                <n-button circle quaternary :aria-label="es.auth.signOut" @click="handleSignOut">
                  <template #icon><n-icon :component="LogOutOutline" /></template>
                </n-button>
              </template>
              {{ es.auth.signOut }}
            </n-tooltip>
            <n-tooltip placement="right">
              <template #trigger>
                <n-badge dot :color="palette.accent" :offset="[-4, 36]">
                  <n-avatar
                    round
                    :size="44"
                    :src="logoUrl"
                    object-fit="cover"
                    :style="{ background: palette.brandDeep, color: palette.accent, fontWeight: 600 }"
                  >
                    <template v-if="!logoUrl">{{ initials }}</template>
                  </n-avatar>
                </n-badge>
              </template>
              <n-flex vertical :size="0">
                <n-text strong>{{ storeName ?? es.shell.storeOwner }}</n-text>
                <n-text depth="3" :style="{ fontSize: '12px' }">{{ adminName ?? session.user?.email ?? "" }}</n-text>
              </n-flex>
            </n-tooltip>
          </n-flex>
        </n-flex>
      </n-layout-sider>

      <n-layout
        :style="{ height: '100%' }"
        :content-style="{ padding: '27px clamp(12px, 2.4vw, 34px) 34px clamp(12px, 1.4vw, 20px)' }"
        :native-scrollbar="false"
      >
        <n-flex vertical :size="32">
          <!-- Encabezado: mismo relleno superior y mismo alto (56 px) que la fila del logo, así el saludo queda a su nivel -->
          <n-flex justify="space-between" align="center" :size="16" :style="{ minHeight: '56px' }">
            <n-flex vertical :size="2">
              <n-text :style="{ fontSize: '22px', fontWeight: 500 }">
                {{ adminName ? es.shell.greeting(adminName) : storeName ? es.shell.greeting(storeName) : es.shell.greetingFallback }}
              </n-text>
            </n-flex>
            <n-flex align="center" :size="12">
              <template v-if="showSecondaryShortcuts">
                <n-badge :value="issueCount" :max="99" :show="issueCount > 0" :color="palette.accent" :style="{ '--n-font-color': palette.brandDeep }">
                  <n-button circle :color="tone.ink" :text-color="tone.surface" :aria-label="es.shell.qualityAlerts" @click="router.push('/calidad')">
                    <template #icon><n-icon :component="NotificationsOutline" /></template>
                  </n-button>
                </n-badge>
                <n-button circle :color="tone.ink" :text-color="tone.surface" :aria-label="es.shell.searchProducts" @click="router.push('/productos')">
                  <template #icon><n-icon :component="SearchOutline" /></template>
                </n-button>
                <n-button circle :color="tone.ink" :text-color="tone.surface" :aria-label="es.shell.history" @click="router.push('/pedidos')">
                  <template #icon><n-icon :component="ReceiptOutline" /></template>
                </n-button>
              </template>
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
