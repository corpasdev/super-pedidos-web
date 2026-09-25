<script setup lang="ts">
import { computed, h, onMounted } from "vue"
import { NButton, NFlex, NIcon, NTag, NText, type DataTableColumns } from "naive-ui"
import type { OrderListItem, SupplierListItem } from "../../infrastructure/apiTypes"
import { tablePagination, totalLabel } from "../tables"
import { useRouter } from "vue-router"
import {
  ArrowForward,
  BusOutline,
  CartOutline,
  ChevronForward,
  GiftOutline,
  PeopleOutline,
} from "@vicons/ionicons5"
import { useDashboardStore } from "../../stores/dashboardStore"
import { useWizardStore } from "../../stores/wizardStore"
import { useThemeStore } from "../../stores/themeStore"
import {
  averageOrderCost,
  inTransitOrder,
  nextSupplier,
  ordersByMonth,
  percentChange,
  shortMoney,
  visitsByWeekday,
  weeklyOrderRanges,
} from "../../stores/dashboardModel"
import { palette, radius } from "../../theme/naiveOverrides"
import { es } from "../../i18n/es"
import { formatDate, formatMoney, shortId } from "../../i18n/format"
import KpiCard from "../components/dashboard/KpiCard.vue"
import MiniBars from "../components/dashboard/MiniBars.vue"
import MiniRanges from "../components/dashboard/MiniRanges.vue"
import MiniDots from "../components/dashboard/MiniDots.vue"
import SegmentedGauge from "../components/dashboard/SegmentedGauge.vue"

const dashboard = useDashboardStore()
const wizard = useWizardStore()
const themeStore = useThemeStore()
const router = useRouter()

const now = new Date()
const tone = computed(() => (themeStore.mode === "dark" ? palette.dark : palette.light))
const TIME_FORMAT = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" })

onMounted(() => {
  void dashboard.loadAll()
})

const formatVariation = (percent: number | null): string | null => {
  if (percent === null) return es.dashboard.variationNone
  return percent >= 0 ? es.dashboard.variationUp(percent) : es.dashboard.variationDown(percent)
}

// KPI 1: pedidos del mes
const monthCounts = computed(() => ordersByMonth(dashboard.orders, now, 4))
const thisMonthCount = computed(() => monthCounts.value.at(-1)?.count ?? 0)
const monthVariation = computed(() => formatVariation(percentChange(thisMonthCount.value, monthCounts.value.at(-2)?.count ?? 0)))
const monthBars = computed(() => monthCounts.value.map((month) => ({ label: month.label, value: month.count, highlight: month.isCurrent })))

// KPI 2: gasto promedio por pedido
const averageCost = computed(() => averageOrderCost(dashboard.orders, now))
const averageVariation = computed(() => formatVariation(percentChange(averageCost.value.current, averageCost.value.previous)))
const weekRanges = computed(() =>
  weeklyOrderRanges(dashboard.orders, now, 6).map((week) => ({ label: week.label, min: week.min, max: week.max, highlight: week.isCurrent })),
)

// KPI 3: vendedores que vienen hoy
const visitingTodayCount = computed(() => dashboard.suppliers.filter((supplier) => supplier.isVisitingToday).length)
const visitDots = computed(() =>
  visitsByWeekday(dashboard.suppliers, now).map((day) => ({
    label: es.dashboard.weekdaysShort[day.weekday] ?? "",
    value: day.count,
    highlight: day.isToday,
  })),
)

// Próximo vendedor
const upcomingSupplier = computed(() => nextSupplier(dashboard.suppliers))
const supplierInitials = computed(() =>
  (upcomingSupplier.value?.name ?? "?")
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase(),
)
const weekdayName = (weekday: number | null): string =>
  weekday === null ? "" : (es.dashboard.weekdays[weekday] ?? "").toLowerCase()

function makeOrder(supplierId: string): void {
  wizard.reset()
  wizard.selectedSupplierId = supplierId
  void router.push("/pedido")
}

// Pedido en camino
const transit = computed(() => inTransitOrder(dashboard.orders, dashboard.suppliers, now))
const transitPercent = computed(() => Math.round((transit.value?.progress ?? 0) * 100))
const weekdayAbbr = (date: Date | null): string =>
  date === null ? "—" : (es.dashboard.weekdaysAbbr[date.getDay() === 0 ? 7 : date.getDay()] ?? "")
const transitConfirmedAt = computed(() => (transit.value === null ? null : new Date(transit.value.order.createdAt)))
const transitStage = computed(() => {
  const progress = transit.value?.progress ?? 0
  if (progress >= 1) return 2
  if (progress > 0) return 1
  return 0
})

// Caja del día
const cash = computed(() => dashboard.dailyCash)
const hasCash = computed(() => cash.value?.openingAmount !== null && cash.value?.openingAmount !== undefined)
const cashOpening = computed(() => cash.value?.openingAmount ?? 0)
const spentFraction = computed(() => (cashOpening.value === 0 ? 0 : (cash.value?.spentAmount ?? 0) / cashOpening.value))
const remainingFraction = computed(() => (cashOpening.value === 0 ? 0 : (cash.value?.remainingAmount ?? 0) / cashOpening.value))

// Reporte de ventas
const report = computed(() => dashboard.summary?.latestReport ?? null)

const cardTitleStyle = { fontSize: "16px", fontWeight: 500 }

// Vendedores de hoy: los que según su calendario pasan hoy a tomar el pedido.
interface TodaySupplierRow {
  supplier: SupplierListItem
  /** Pedido confirmado hoy a este proveedor, si ya se hizo. */
  orderToday: OrderListItem | null
  /** Lo que se le debe de todos sus pedidos. */
  owed: number
}

const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()

const todayRows = computed<TodaySupplierRow[]>(() =>
  dashboard.suppliers
    .filter((supplier) => supplier.isVisitingToday)
    .map((supplier) => {
      const supplierOrders = dashboard.orders.filter((order) => order.supplierId === supplier.id)
      return {
        supplier,
        orderToday: supplierOrders.find((order) => isSameDay(new Date(order.createdAt), now)) ?? null,
        owed: supplierOrders.reduce((total, order) => total + order.pendingAmount, 0),
      }
    })
    // Primero los que faltan por pedir.
    .sort((left, right) => Number(left.orderToday !== null) - Number(right.orderToday !== null) || left.supplier.name.localeCompare(right.supplier.name, "es")),
)
const todayOrderedCount = computed(() => todayRows.value.filter((row) => row.orderToday !== null).length)
const todayWeekdayName = computed(() => (es.dashboard.weekdays[now.getDay() === 0 ? 7 : now.getDay()] ?? "").toLowerCase())
const todayPagination = tablePagination()

const todayColumns: DataTableColumns<TodaySupplierRow> = [
  {
    key: "supplier",
    title: es.dashboard.todayColumns.supplier,
    minWidth: 200,
    render: (row) =>
      h(NFlex, { vertical: true, size: 0 }, () => [
        h(NText, { style: { fontWeight: 500 } }, () => row.supplier.name),
        row.supplier.taxId ? h(NText, { depth: 3, style: { fontSize: "11px" } }, () => es.suppliersView.taxId(row.supplier.taxId!)) : null,
      ]),
  },
  {
    key: "status",
    title: es.dashboard.todayColumns.status,
    render: (row) =>
      row.orderToday !== null
        ? h(NTag, { round: true, size: "small", type: "success", bordered: false }, () => es.dashboard.todayOrdered(formatMoney(row.orderToday!.totalCost)))
        : h(NTag, { round: true, size: "small", bordered: false, color: { color: palette.accent, textColor: palette.brandDeep } }, () => es.dashboard.todayPending),
  },
  {
    key: "delivery",
    title: es.dashboard.todayColumns.delivery,
    render: (row) => es.dashboard.todayDelivery(weekdayName(row.supplier.deliveryWeekday), row.supplier.deliveryLeadDays),
  },
  {
    key: "range",
    title: es.dashboard.todayColumns.range,
    render: (row) =>
      row.supplier.maximumOrderAmount === null
        ? es.dashboard.todayNoMax(formatMoney(row.supplier.minimumOrderAmount))
        : es.dashboard.todayRange(formatMoney(row.supplier.minimumOrderAmount), formatMoney(row.supplier.maximumOrderAmount)),
  },
  { key: "products", title: es.dashboard.todayColumns.products, align: "right", render: (row) => row.supplier.productCount },
  {
    key: "lastOrder",
    title: es.dashboard.todayColumns.lastOrder,
    render: (row) => (row.supplier.lastOrderAt ? formatDate(row.supplier.lastOrderAt) : es.suppliersView.never),
  },
  {
    key: "owed",
    title: es.dashboard.todayColumns.owed,
    align: "right",
    render: (row) =>
      row.owed > 0
        ? h(NText, { type: "warning", class: "tabular-nums", style: { fontWeight: 500 } }, () => formatMoney(row.owed))
        : h(NText, { depth: 3 }, () => es.dashboard.todayNothingOwed),
  },
  {
    key: "actions",
    title: es.dashboard.todayColumns.actions,
    align: "right",
    render: (row) =>
      row.orderToday !== null
        ? h(NButton, { size: "small", secondary: true, onClick: () => router.push("/historial") }, () => es.dashboard.todayViewButton)
        : h(
            NButton,
            { size: "small", type: "primary", onClick: () => makeOrder(row.supplier.id) },
            { default: () => es.dashboard.todayOrderButton, icon: () => h(NIcon, { component: CartOutline }) },
          ),
  },
]
</script>

<template>
  <n-flex vertical :size="24">
    <n-alert v-if="dashboard.error !== null" type="error" :bordered="false">{{ es.dashboard.loadError }} {{ dashboard.error }}</n-alert>

    <!-- R2: KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <KpiCard :title="es.dashboard.kpiOrders" :icon="GiftOutline" :value="String(thisMonthCount)" :variation="monthVariation">
        <MiniBars :items="monthBars" :label="es.dashboard.kpiOrders" />
      </KpiCard>
      <KpiCard :title="es.dashboard.kpiAverage" :icon="CartOutline" :value="shortMoney(averageCost.current)" :variation="averageVariation">
        <MiniRanges :items="weekRanges" :label="es.dashboard.kpiAverage" />
      </KpiCard>
      <KpiCard
        :title="es.dashboard.kpiVisits"
        :icon="PeopleOutline"
        :value="String(visitingTodayCount)"
        :variation="es.dashboard.kpiVisitsHint(dashboard.suppliers.length)"
      >
        <MiniDots :items="visitDots" :label="es.dashboard.kpiVisits" />
      </KpiCard>
    </div>

    <!-- Vendedores de hoy: debajo de las tarjetas, los proveedores que hoy pasan a tomar el pedido -->
    <n-card :bordered="false">
      <template #header>
        <n-flex vertical :size="2">
          <n-text :style="cardTitleStyle">{{ es.dashboard.todayTitle }}</n-text>
          <n-text depth="3" :style="{ fontSize: '11px' }">{{ es.dashboard.todaySubtitle(todayWeekdayName) }}</n-text>
        </n-flex>
      </template>
      <template #header-extra>
        <n-flex align="center" :size="8">
          <n-tag v-if="todayRows.length > 0" round :bordered="false" :type="todayOrderedCount === todayRows.length ? 'success' : 'warning'">
            {{ es.dashboard.todayOrderedCount(todayOrderedCount, todayRows.length) }}
          </n-tag>
          <n-tag round :bordered="false">{{ totalLabel(todayRows.length, "supplier") }}</n-tag>
        </n-flex>
      </template>
      <n-data-table
        :columns="todayColumns"
        :data="todayRows"
        :loading="dashboard.loading"
        :pagination="todayPagination"
        :row-key="(row: TodaySupplierRow) => row.supplier.id"
        :scroll-x="980"
        :bordered="false"
        size="small"
      >
        <template #empty>
          <n-empty :description="es.dashboard.todayEmpty" />
        </template>
      </n-data-table>
    </n-card>

    <!-- R3–R5: bloques escalonados en Z, dos columnas -->

    <div
      class="grid gap-6 grid-cols-1 min-[1200px]:grid-cols-2 min-[1200px]:grid-rows-[minmax(254px,auto)_minmax(86px,auto)_minmax(254px,auto)]"
    >
      <!-- Próximo vendedor (C1, R3) -->
      <n-card :bordered="false" class="min-[1200px]:col-start-1 min-[1200px]:row-start-1">
        <n-flex v-if="upcomingSupplier !== null" vertical :size="14">
          <n-flex vertical :size="2">
            <n-text :style="cardTitleStyle">{{ es.dashboard.nextSupplierTitle }}</n-text>
            <n-text depth="3" :style="{ fontSize: '11px' }">
              {{ upcomingSupplier.name }} |
              {{
                upcomingSupplier.isVisitingToday
                  ? es.dashboard.nextSupplierToday
                  : es.dashboard.nextSupplierOn(upcomingSupplier.nextOrderDate ? formatDate(upcomingSupplier.nextOrderDate) : "")
              }}
            </n-text>
          </n-flex>

          <n-grid :cols="3" :x-gap="8">
            <n-gi v-for="tile in [
              { label: es.dashboard.tileMinimum, value: formatMoney(upcomingSupplier.minimumOrderAmount) },
              { label: es.dashboard.tileMaximum, value: upcomingSupplier.maximumOrderAmount === null ? es.dashboard.noMaximum : formatMoney(upcomingSupplier.maximumOrderAmount) },
              { label: es.dashboard.tileProducts, value: String(upcomingSupplier.productCount) },
            ]" :key="tile.label">
              <n-card embedded :bordered="false" size="small" :style="{ borderRadius: radius.sm }" :content-style="{ padding: '8px 6px', textAlign: 'center' }">
                <n-text class="tabular-nums" :style="{ fontSize: '13px', fontWeight: 500, display: 'block' }">{{ tile.value }}</n-text>
                <n-text depth="3" :style="{ fontSize: '10px' }">{{ tile.label }}</n-text>
              </n-card>
            </n-gi>
          </n-grid>

          <n-text :style="{ fontSize: '12px', fontWeight: 500 }">{{ es.dashboard.lastOrder }}</n-text>
          <n-flex align="center" justify="space-between" :wrap="false" :size="12">
            <n-flex align="center" :size="10" :wrap="false" :style="{ minWidth: 0 }">
              <n-avatar round :size="36" :style="{ background: tone.data, color: palette.accent, fontWeight: 600, flexShrink: 0 }">
                {{ supplierInitials }}
              </n-avatar>
              <n-flex vertical :size="0" :style="{ minWidth: 0 }">
                <n-ellipsis :style="{ fontSize: '13px', fontWeight: 500 }">
                  {{ es.dashboard.nextSupplierSchedule(weekdayName(upcomingSupplier.orderWeekday), weekdayName(upcomingSupplier.deliveryWeekday)) }}
                </n-ellipsis>
                <n-text depth="3" :style="{ fontSize: '11px' }">
                  {{ upcomingSupplier.lastOrderAt ? es.dashboard.lastOrderAt(formatDate(upcomingSupplier.lastOrderAt)) : es.dashboard.noLastOrder }}
                </n-text>
              </n-flex>
            </n-flex>
            <n-button type="primary" circle :aria-label="es.dashboard.makeOrder(upcomingSupplier.name)" @click="makeOrder(upcomingSupplier.id)">
              <template #icon><n-icon :component="CartOutline" /></template>
            </n-button>
          </n-flex>
        </n-flex>
        <n-empty v-else :description="es.dashboard.noSupplier" />
      </n-card>

      <!-- Caja del día (C1, R4–R5) -->
      <n-card :bordered="false" class="min-[1200px]:col-start-1 min-[1200px]:row-start-2 min-[1200px]:row-span-2">
        <n-flex vertical :size="12">
          <n-text :style="cardTitleStyle">{{ es.dashboard.cashTitle }}</n-text>
          <n-flex :size="16" align="center">
            <n-flex align="center" :size="6">
              <svg width="8" height="8" aria-hidden="true"><circle cx="4" cy="4" r="4" style="fill: var(--ink)" /></svg>
              <n-text :style="{ fontSize: '11px' }">{{ es.dashboard.cashRemaining }}</n-text>
            </n-flex>
            <n-flex align="center" :size="6">
              <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" style="fill: var(--accent); stroke: var(--data); stroke-width: 1" /></svg>
              <n-text :style="{ fontSize: '11px' }">{{ es.dashboard.cashSpent }}</n-text>
            </n-flex>
          </n-flex>
          <template v-if="hasCash">
            <SegmentedGauge
              :outer-fraction="spentFraction"
              :inner-fraction="remainingFraction"
              :value="shortMoney(cash?.remainingAmount ?? 0)"
              :hint="es.dashboard.cashCenterHint"
              :label="es.dashboard.cashTitle"
            />
            <n-text depth="3" :style="{ fontSize: '12px', textAlign: 'center' }">{{ es.dashboard.cashOf(formatMoney(cashOpening)) }}</n-text>
          </template>
          <n-empty v-else :description="es.dashboard.cashMissing" :style="{ paddingBlock: '32px' }">
            <template #extra>
              <n-button type="primary" size="small" @click="router.push('/pedido')">{{ es.dashboard.cashOpen }}</n-button>
            </template>
          </n-empty>
        </n-flex>
      </n-card>

      <!-- Pedido en camino (C2, R3–R4) -->
      <n-card :bordered="false" class="min-[1200px]:col-start-2 min-[1200px]:row-start-1 min-[1200px]:row-span-2">
        <n-flex vertical :size="14" :style="{ height: '100%' }">
          <n-flex justify="space-between" align="center">
            <n-text :style="cardTitleStyle">{{ es.dashboard.transitTitle }}</n-text>
            <n-button text size="tiny" icon-placement="right" @click="router.push('/historial')">
              {{ es.dashboard.viewHistory }}
              <template #icon><n-icon :component="ChevronForward" /></template>
            </n-button>
          </n-flex>

          <template v-if="transit !== null">
            <n-grid :cols="2" :x-gap="10">
              <!-- a) Ruta: degradado verde profundo, texto claro, trazos lima -->
              <n-gi>
                <n-card
                  :bordered="false"
                  :style="{ background: `linear-gradient(180deg, ${palette.brandDeep}, ${palette.brandDeep2})`, borderRadius: radius.md, height: '100%' }"
                  :content-style="{ padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px', color: '#FDFDFD' }"
                >
                  <n-flex justify="space-between" :style="{ color: '#FDFDFD', fontSize: '16px', fontWeight: 500 }">
                    <span>{{ weekdayAbbr(transitConfirmedAt) }}</span>
                    <span>{{ weekdayAbbr(transit.expectedDeliveryAt) }}</span>
                  </n-flex>
                  <n-flex vertical align="center" :size="4">
                    <n-icon :component="BusOutline" :size="40" :color="palette.accent" />
                    <span :style="{ fontSize: '12px', color: '#FDFDFD' }">{{ transit.supplier?.name ?? "" }}</span>
                  </n-flex>
                  <svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true" style="width: 100%; height: 12px">
                    <line x1="0" x2="100" y1="6" y2="6" style="stroke: rgba(253,253,253,0.35); stroke-width: 2" />
                    <line x1="0" :x2="Math.max(2, transitPercent)" y1="6" y2="6" :style="{ stroke: palette.accent, strokeWidth: 2 }" />
                  </svg>
                  <n-flex justify="space-between" align="center" :wrap="false" :size="4">
                    <n-flex vertical :size="2" align="center">
                      <span :style="{ fontSize: '9px', color: 'rgba(253,253,253,0.7)' }">{{ es.dashboard.transitConfirmed }}</span>
                      <n-tag round size="small" :bordered="false" :color="{ color: 'rgba(253,253,253,0.12)', textColor: '#FDFDFD' }">
                        {{ transitConfirmedAt ? TIME_FORMAT.format(transitConfirmedAt) : "" }}
                      </n-tag>
                    </n-flex>
                    <n-icon :component="ArrowForward" :size="14" color="#FDFDFD" />
                    <n-flex vertical :size="2" align="center">
                      <span :style="{ fontSize: '9px', color: 'rgba(253,253,253,0.7)' }">{{ es.dashboard.transitExpected }}</span>
                      <n-tag round size="small" :bordered="false" :color="{ color: 'rgba(253,253,253,0.12)', textColor: '#FDFDFD' }">
                        {{ transit.expectedDeliveryAt ? formatDate(transit.expectedDeliveryAt.toISOString()) : "" }}
                      </n-tag>
                    </n-flex>
                  </n-flex>
                </n-card>
              </n-gi>

              <!-- b) Seguimiento -->
              <n-gi>
                <n-card embedded :bordered="false" :style="{ borderRadius: radius.md, height: '100%' }" :content-style="{ padding: '14px' }">
                  <n-flex vertical :size="12">
                    <n-text class="tabular-nums" :style="{ fontSize: '18px', fontWeight: 500 }">#{{ shortId(transit.order.id).toUpperCase() }}</n-text>
                    <n-timeline size="medium">
                      <n-timeline-item
                        type="success"
                        :title="es.dashboard.transitSteps.confirmed"
                        :time="transitConfirmedAt ? TIME_FORMAT.format(transitConfirmedAt) : ''"
                      />
                      <n-timeline-item :type="transitStage === 1 ? 'info' : transitStage > 1 ? 'success' : 'default'" :title="es.dashboard.transitSteps.inTransit" />
                      <n-timeline-item
                        :type="transitStage === 2 ? 'info' : 'default'"
                        :title="es.dashboard.transitSteps.truck"
                        :time="transit.expectedDeliveryAt ? formatDate(transit.expectedDeliveryAt.toISOString()) : ''"
                      />
                      <n-timeline-item type="default" :title="es.dashboard.transitSteps.received" />
                    </n-timeline>
                  </n-flex>
                </n-card>
              </n-gi>
            </n-grid>

            <!-- c) Avance del pedido -->
            <n-card embedded :bordered="false" size="small" :style="{ borderRadius: radius.pill }" :content-style="{ padding: '8px 16px' }">
              <n-flex align="center" :size="10" :wrap="false">
                <n-progress type="circle" :percentage="transitPercent" :show-indicator="false" :stroke-width="14" :style="{ width: '20px' }" />
                <n-text :style="{ fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }">{{ es.dashboard.transitProgress(transitPercent) }}</n-text>
                <n-divider vertical />
                <n-text depth="3" :style="{ fontSize: '11px' }">{{ es.dashboard.transitTotal }}</n-text>
                <n-text class="tabular-nums" :style="{ fontSize: '12px', fontWeight: 500, marginLeft: 'auto' }">{{ formatMoney(transit.order.totalCost) }}</n-text>
              </n-flex>
            </n-card>
          </template>
          <n-empty v-else :description="es.dashboard.transitEmpty" :style="{ margin: 'auto' }" />
        </n-flex>
      </n-card>

      <!-- Reporte de ventas (C2, R5) -->
      <n-card :bordered="false" class="min-[1200px]:col-start-2 min-[1200px]:row-start-3" :content-style="{ overflow: 'hidden' }">
        <n-flex v-if="report !== null" :wrap="false" :size="12" :style="{ height: '100%' }">
          <n-flex vertical :size="10" :style="{ flex: '0 0 50%', minWidth: 0 }">
            <n-flex vertical :size="2">
              <n-text :style="cardTitleStyle">{{ es.dashboard.reportTitle }}</n-text>
              <n-ellipsis depth="3" :style="{ fontSize: '10px' }">{{ report.fileName }}</n-ellipsis>
            </n-flex>
            <n-grid :cols="2" :x-gap="12" :y-gap="10">
              <n-gi v-for="spec in [
                { label: es.dashboard.reportPeriod, value: `${formatDate(report.period.startsAt)}` },
                { label: es.dashboard.reportDays, value: String(report.period.coveredDays) },
                { label: es.dashboard.reportLines, value: report.lineCount.toLocaleString('es-CO') },
                { label: es.dashboard.reportUnits, value: report.totalUnits.toLocaleString('es-CO') },
              ]" :key="spec.label">
                <n-text class="tabular-nums" :style="{ fontSize: '13px', fontWeight: 500, display: 'block' }">{{ spec.value }}</n-text>
                <n-text depth="3" :style="{ fontSize: '10px' }">{{ spec.label }}</n-text>
              </n-gi>
            </n-grid>
          </n-flex>
          <!-- Ilustración: hoja del Excel con barras de venta -->
          <svg viewBox="0 0 150 130" aria-hidden="true" style="flex: 1; min-width: 0; height: auto; align-self: center">
            <rect x="10" y="118" width="130" height="8" rx="4" style="fill: var(--brand-tint)" />
            <rect x="24" y="8" width="104" height="108" rx="10" style="fill: var(--surface); stroke: var(--line); stroke-width: 1.5" />
            <rect x="24" y="8" width="104" height="22" rx="10" style="fill: var(--data)" />
            <rect x="24" y="20" width="104" height="10" style="fill: var(--data)" />
            <rect x="36" y="16" width="36" height="6" rx="3" style="fill: var(--accent)" />
            <line v-for="row in 4" :key="row" x1="36" x2="116" :y1="40 + row * 14" :y2="40 + row * 14" style="stroke: var(--line); stroke-width: 1.5" />
            <rect x="40" y="82" width="12" height="24" rx="3" style="fill: var(--brand-tint)" />
            <rect x="58" y="70" width="12" height="36" rx="3" style="fill: var(--brand-tint)" />
            <rect x="76" y="60" width="12" height="46" rx="3" style="fill: var(--brand-tint)" />
            <rect x="94" y="46" width="12" height="60" rx="3" style="fill: var(--data)" />
            <circle cx="100" cy="40" r="5" style="fill: var(--accent); stroke: var(--data); stroke-width: 1.5" />
          </svg>
        </n-flex>
        <n-empty v-else :description="es.dashboard.reportEmpty">
          <template #extra>
            <n-button size="small" type="primary" @click="router.push('/pedido')">{{ es.dashboard.reportUpload }}</n-button>
          </template>
        </n-empty>
      </n-card>
    </div>
  </n-flex>
</template>
