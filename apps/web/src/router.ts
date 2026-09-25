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
      { path: "", redirect: "/inicio" },
      {
        path: "inicio",
        name: "home",
        component: () => import("./presentation/views/DashboardView.vue"),
      },
      {
        path: "pedido",
        name: "order-wizard",
        component: () => import("./presentation/views/OrderWizardView.vue"),
      },
      {
        path: "productos",
        name: "products",
        component: () => import("./presentation/views/ProductsView.vue"),
      },
      {
        path: "historial",
        name: "history",
        component: () => import("./presentation/views/HistoryView.vue"),
      },
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
  { path: "/:pathMatch(.*)*", redirect: "/inicio" },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const session = useSessionStore()
  if (!session.isReady) await session.initialize()

  if (to.name === "login") {
    return session.isAuthenticated ? { name: "home" } : true
  }
  return session.isAuthenticated ? true : { name: "login", query: { redirect: to.fullPath } }
})