import type { GlobalThemeOverrides } from "naive-ui"

/**
 * Paleta SuperPedido. Mismo patrón de armonía en ambos temas:
 * lienzo (canvas) → contenedor (surface) → tarjetas (surface2) → tiles (surface).
 * El lima (accent) solo rellena acciones primarias y estados activos, siempre con texto brand-deep.
 */
/**
 * Colores para distinguir los sugeridos del día en la barra de caja y en su tarjeta.
 * Claros para leerse sobre el verde profundo de la caja; el lima queda para lo ya pedido.
 */
export const SUGGESTION_COLORS = ["#8FD9B6", "#7CC4F2", "#F5C451", "#B9A3F0", "#4FD1C5", "#F49AC1", "#C9D86B"] as const
/** Tramo de la caja apartado para pagar lo que se debe (coral, distinto de los sugeridos). */
export const DEBT_COLOR = "#F28C7C"

export const palette = {
  brandDeep: "#013F32",
  brandDeep2: "#1E6B55",
  accent: "#E7FE25",
  accentHover: "#DDF51A",
  accentPressed: "#CBE20F",
  light: {
    canvas: "#013F32",
    surface: "#FDFDFD",
    surface2: "#F1F3EE",
    ink: "#161616",
    inkMuted: "#6E736F",
    line: "#E4E7E1",
    data: "#013F32",
    brandTint: "rgba(1,63,50,0.14)",
  },
  dark: {
    canvas: "#06120F",
    surface: "#0E1B17",
    surface2: "#15241F",
    ink: "#EEF2EC",
    inkMuted: "#95A19A",
    line: "#24352F",
    data: "#8FD9B6",
    brandTint: "rgba(143,217,182,0.18)",
  },
} as const

/** Alto de las opciones del sidebar; los buscadores y botones de las barras de herramientas lo igualan. */
export const SIDEBAR_ITEM_HEIGHT = "44px"
/** Para n-input / n-button size="large" que deben medir lo mismo que una opción del sidebar. */
export const toolbarControlOverrides = { heightLarge: SIDEBAR_ITEM_HEIGHT, fontSizeLarge: "15px" } as const
/** n-tag size="large" del mismo alto (el contador junto al buscador). */
export const toolbarTagOverrides = { heightLarge: SIDEBAR_ITEM_HEIGHT, fontSizeLarge: "15px", padding: "0 16px" } as const

export const radius = { xl: "32px", lg: "20px", md: "14px", sm: "10px", pill: "999px" } as const

const FONT_FAMILY = "Manrope, 'Segoe UI', system-ui, -apple-system, sans-serif"

const buildOverrides = (tone: typeof palette.light | typeof palette.dark): GlobalThemeOverrides => ({
  common: {
    fontFamily: FONT_FAMILY,
    primaryColor: tone.data,
    primaryColorHover: palette.brandDeep2,
    primaryColorPressed: tone.data,
    primaryColorSuppl: tone.data,
    successColor: palette.brandDeep2,
    successColorHover: palette.brandDeep2,
    successColorPressed: palette.brandDeep,
    infoColor: tone.data,
    infoColorHover: palette.brandDeep2,
    infoColorPressed: tone.data,
    warningColor: "#B7791F",
    warningColorHover: "#C98A2B",
    warningColorPressed: "#9A6414",
    errorColor: "#C2410C",
    errorColorHover: "#DD5A1F",
    errorColorPressed: "#A3360A",
    textColorBase: tone.ink,
    textColor1: tone.ink,
    textColor2: tone.ink,
    textColor3: tone.inkMuted,
    placeholderColor: tone.inkMuted,
    bodyColor: tone.surface,
    cardColor: tone.surface2,
    modalColor: tone.surface,
    popoverColor: tone.surface,
    tableColor: tone.surface,
    inputColor: tone.surface,
    dividerColor: tone.line,
    borderColor: tone.line,
    borderRadius: radius.sm,
    borderRadiusSmall: "8px",
  },
  Button: {
    borderRadiusTiny: radius.pill,
    borderRadiusSmall: radius.pill,
    borderRadiusMedium: radius.pill,
    borderRadiusLarge: radius.pill,
    fontWeight: "500",
    colorPrimary: palette.accent,
    colorHoverPrimary: palette.accentHover,
    colorPressedPrimary: palette.accentPressed,
    colorFocusPrimary: palette.accentHover,
    colorDisabledPrimary: palette.accent,
    textColorPrimary: palette.brandDeep,
    textColorHoverPrimary: palette.brandDeep,
    textColorPressedPrimary: palette.brandDeep,
    textColorFocusPrimary: palette.brandDeep,
    textColorDisabledPrimary: palette.brandDeep,
    borderPrimary: `1px solid ${palette.accent}`,
    borderHoverPrimary: `1px solid ${palette.accentHover}`,
    borderPressedPrimary: `1px solid ${palette.accentPressed}`,
    borderFocusPrimary: `1px solid ${palette.accentHover}`,
    borderDisabledPrimary: `1px solid ${palette.accent}`,
    rippleColorPrimary: palette.accent,
  },
  Card: {
    color: tone.surface2,
    colorEmbedded: tone.surface,
    borderColor: "transparent",
    borderRadius: radius.lg,
    paddingMedium: "20px 22px 22px",
    titleFontSizeMedium: "16px",
    titleFontWeight: "500",
    titleTextColor: tone.ink,
  },
  Layout: {
    color: tone.surface,
    siderColor: tone.surface,
    headerColor: tone.surface,
    siderBorderColor: "transparent",
    // Botón para contraer/expandir el sidebar: como un campo de búsqueda sin foco (mismo fondo y borde).
    siderToggleButtonColor: tone.surface,
    siderToggleButtonIconColor: tone.ink,
    siderToggleButtonBorder: `1px solid ${tone.line}`,
  },
  Menu: {
    borderRadius: radius.pill,
    itemHeight: SIDEBAR_ITEM_HEIGHT,
    fontSize: "14px",
    itemTextColor: tone.ink,
    itemIconColor: tone.ink,
    itemTextColorHover: tone.ink,
    itemIconColorHover: tone.ink,
    itemColorHover: tone.surface2,
    itemColorActive: palette.accent,
    itemColorActiveHover: palette.accent,
    itemColorActiveCollapsed: palette.accent,
    itemTextColorActive: palette.brandDeep,
    itemTextColorActiveHover: palette.brandDeep,
    itemIconColorActive: palette.brandDeep,
    itemIconColorActiveHover: palette.brandDeep,
    itemIconColorCollapsed: tone.ink,
    arrowColorActive: palette.brandDeep,
    arrowColorActiveHover: palette.brandDeep,
  },
  Radio: {
    buttonBorderRadius: radius.pill,
    buttonHeightMedium: "40px",
    buttonColor: "transparent",
    buttonColorActive: tone.ink,
    buttonTextColor: tone.ink,
    buttonTextColorActive: tone.surface,
    buttonTextColorHover: tone.ink,
    buttonBorderColor: "transparent",
    buttonBorderColorActive: tone.ink,
    buttonBorderColorHover: "transparent",
    buttonBoxShadow: "none",
    buttonBoxShadowHover: "none",
    buttonBoxShadowFocus: "none",
  },
  Tag: {
    borderRadius: radius.pill,
  },
  Badge: {
    color: palette.brandDeep,
    fontSize: "11px",
  },
  Input: {
    borderRadius: radius.sm,
    color: tone.surface,
    border: `1px solid ${tone.line}`,
    borderHover: `1px solid ${tone.data}`,
    borderFocus: `1px solid ${tone.data}`,
  },
  InternalSelection: {
    borderRadius: radius.sm,
    border: `1px solid ${tone.line}`,
  },
  DataTable: {
    borderRadius: radius.md,
    thColor: tone.surface2,
    tdColor: tone.surface,
    borderColor: tone.line,
    thFontWeight: "500",
  },
  Progress: {
    fillColor: tone.data,
    railColor: tone.line,
  },
  Timeline: {
    circleBorder: `2px solid ${tone.line}`,
    circleBorderInfo: `2px solid ${tone.data}`,
    circleBorderSuccess: `2px solid ${tone.line}`,
    titleTextColor: tone.ink,
    contentTextColor: tone.inkMuted,
    metaTextColor: tone.inkMuted,
    lineColor: tone.line,
  },
  Steps: {
    indicatorColorProcess: palette.accent,
    indicatorTextColorProcess: palette.brandDeep,
    indicatorBorderColorProcess: palette.accent,
    indicatorColorFinish: tone.data,
    indicatorBorderColorFinish: tone.data,
    splitorColorFinish: tone.data,
  },
  Alert: {
    borderRadius: radius.md,
  },
  Dialog: {
    borderRadius: radius.lg,
  },
})

export const lightOverrides: GlobalThemeOverrides = buildOverrides(palette.light)
export const darkOverrides: GlobalThemeOverrides = buildOverrides(palette.dark)
