// Design tokens for this app (light only). Keys match /app/design_guidelines.json "color".
import { useMemo } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FAFAFA",
  onSurface: "#171717",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#262626",
  surfaceTertiary: "#F0F0F0",
  onSurfaceTertiary: "#404040",
  surfaceInverse: "#171717",
  onSurfaceInverse: "#FAFAFA",
  muted: "#737373",

  brand: "#C2410C",
  onBrand: "#FFFFFF",
  brandPrimary: "#C2410C",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FED7AA",
  onBrandSecondary: "#9A3412",
  brandTertiary: "#FFEDD5",
  onBrandTertiary: "#C2410C",

  success: "#15803D",
  onSuccess: "#FFFFFF",
  warning: "#B45309",
  onWarning: "#FFFFFF",
  error: "#B91C1C",
  onError: "#FFFFFF",
  info: "#0F766E",
  onInfo: "#FFFFFF",

  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  divider: "#F5F5F5",
  scrim: "rgba(0,0,0,0.4)",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
export const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
