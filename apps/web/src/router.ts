import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router"
import { useSessionStore } from "./stores/sessionStore"
import AppLayout from "./presentation/layouts/AppLayout.vue"

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "login",
    component: () => import("./presentation/views/LoginView.vue"),
  },
  {
    path: "/",
    component: AppLayout,
    children: [
      { path: "", redirect: "/pedido" },
      {
        path: "inicio",
        name: "home",
        component: () => import("./presentation/views/DashboardView.vue"),
      },
      {
        // Hacer pedido = bandeja del día: el pedido de cada vendedor que viene hoy ya viene listo.
        path: "pedido",
        name: "order-wizard",
        component: () => import("./presentation/views/OrderInboxView.vue"),
      },
      {
        path: "pedido/revisar/:supplierId",
        name: "order-review",
        component: () => import("./presentation/views/OrderReviewView.vue"),
      },
      {
        // Asistente anterior de 5 pasos (oculto; sigue disponible por su dirección).
        path: "pedido/asistente",
        name: "order-assistant",
        component: () => import("./presentation/views/OrderWizardView.vue"),
      },
      {
        path: "productos",
        name: "products",
        component: () => import("./presentation/views/ProductsView.vue"),
      },
      {
        path: "pedidos",
        name: "history",
        component: () => import("./presentation/views/HistoryView.vue"),
      },
      // Dirección anterior de la vista de pedidos.
      { path: "historial", redirect: "/pedidos" },
      {
        path: "calidad",
        name: "data-quality",
        component: () => import("./presentation/views/DataQualityView.vue"),
      },
      {
        path: "proveedores",
        name: "suppliers",
        component: () => import("./presentation/views/SuppliersView.vue"),
      },
      {
        path: "configuracion",
        name: "settings",
        component: () => import("./presentation/views/SettingsView.vue"),
      },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/pedido" },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const session = useSessionStore()
  if (!session.isReady) await session.initialize()

  if (to.name === "login") {
    return session.isAuthenticated ? { name: "order-wizard" } : true
  }
  return session.isAuthenticated ? true : { name: "login", query: { redirect: to.fullPath } }
})