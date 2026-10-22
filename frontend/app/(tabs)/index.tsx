import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Appliance, CalcInput, GasType, Material } from "@/src/api";
import { ApplianceModal } from "@/src/components/appliance-modal";
import { Segmented } from "@/src/components/segmented";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

const FITTINGS = [0, 10, 20, 30];

export default function CalculatorScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const [gas, setGas] = useState<GasType>("metano");
  const [material, setMaterial] = useState<Material>("acciaio");
  const [length, setLength] = useState("");
  const [fittings, setFittings] = useState(0);
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [modal, setModal] = useState(false);

  const lengthNum = parseFloat(length.replace(",", "."));
  const total = appliances.reduce((s, a) => s + a.power_kw, 0);
  const valid = lengthNum > 0 && appliances.length > 0;

  const calc = () => {
    const input: CalcInput = { gas, material, length_m: lengthNum, fittings_pct: fittings, appliances };
    router.push({ pathname: "/result", params: { input: JSON.stringify(input) } });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.overline}>UNI 7129 · BASSA PRESSIONE</Text>
        <Text style={styles.title}>Dimensionamento gas</Text>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + bottomChrome }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Animated.View entering={FadeInDown.duration(300)} style={styles.card}>
          <Text style={styles.label}>Tipo di gas</Text>
          <Segmented
            testIDPrefix="gas"
            value={gas}
            onChange={setGas}
            options={[
              { value: "metano", label: "Metano" },
              { value: "gpl", label: "GPL" },
            ]}
          />
          <Text style={styles.hint}>Caduta di pressione max: {gas === "metano" ? "1 mbar" : "2 mbar"}</Text>
          <Text style={[styles.label, { marginTop: spacing.lg }]}>Materiale tubazione</Text>
          <Segmented
            testIDPrefix="material"
            value={material}
            onChange={setMaterial}
            options={[
              { value: "acciaio", label: "Acciaio" },
              { value: "rame", label: "Rame" },
              { value: "multistrato", label: "Multistrato" },
            ]}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.card}>
          <Text style={styles.label}>Lunghezza tubazione</Text>
          <View style={styles.lengthRow}>
            <TextInput
              testID="length-input"
              style={styles.lengthInput}
              value={length}
              onChangeText={setLength}
              placeholder="0"
              placeholderTextColor={colors.borderStrong}
              keyboardType="decimal-pad"
            />
            <Text style={styles.unit}>m</Text>
          </View>
          <Text style={[styles.label, { marginTop: spacing.md }]}>Maggiorazione raccordi/curve</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FITTINGS.map((f) => {
              const active = f === fittings;
              return (
                <Pressable
                  key={f}
                  testID={`fittings-${f}`}
                  onPress={() => setFittings(f)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>+{f}%</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(300)} style={styles.card}>
          <View style={styles.appHeader}>
            <Text style={styles.label}>Apparecchi</Text>
            <Text style={styles.total} testID="total-power">
              {total.toFixed(1)} kW
            </Text>
          </View>
          {appliances.length === 0 && (
            <Text style={styles.empty} testID="appliances-empty">
              Nessun apparecchio. Aggiungi caldaia, piano cottura, ecc.
            </Text>
          )}
          {appliances.map((a, i) => (
            <Animated.View
              key={`${a.name}-${i}`}
              entering={FadeInDown}
              exiting={FadeOut}
              layout={LinearTransition}
              style={styles.appRow}
              testID={`appliance-row-${i}`}
            >
              <MaterialDesignIcons name="fire" size={20} color={colors.brandPrimary} />
              <Text style={styles.appName} numberOfLines={1}>
                {a.name}
              </Text>
              <Text style={styles.appKw}>{a.power_kw} kW</Text>
              <Pressable
                hitSlop={10}
                testID={`remove-appliance-${i}`}
                onPress={() => setAppliances((list) => list.filter((_, j) => j !== i))}
                style={styles.removeBtn}
              >
                <MaterialDesignIcons name="close-circle" size={22} color={colors.muted} />
              </Pressable>
            </Animated.View>
          ))}
          <Pressable
            testID="add-appliance-button"
            onPress={() => setModal(true)}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialDesignIcons name="plus" size={20} color={colors.onBrandTertiary} />
            <Text style={styles.addText}>Aggiungi apparecchio</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAwareScrollView>

      <View style={[styles.ctaWrap, { paddingBottom: bottomChrome + spacing.lg }]}>
        <Pressable
          testID="calculate-button"
          disabled={!valid}
          onPress={calc}
          style={({ pressed }) => [styles.cta, !valid && styles.ctaDisabled, pressed && { transform: [{ scale: 0.98 }] }]}
        >
          <MaterialDesignIcons name="pipe" size={22} color={colors.onBrandPrimary} />
          <Text style={styles.ctaText}>Calcola diametro</Text>
        </Pressable>
      </View>

      <ApplianceModal visible={modal} onClose={() => setModal(false)} onAdd={(a) => setAppliances((l) => [...l, a])} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  overline: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: c.brandPrimary },
  title: { fontSize: 26, fontWeight: "800", color: c.onSurface, marginTop: 2 },
  content: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  label: { fontSize: 13, fontWeight: "600", color: c.onSurfaceTertiary, marginBottom: spacing.sm },
  hint: { fontSize: 12, color: c.muted, marginTop: spacing.sm },
  lengthRow: { flexDirection: "row", alignItems: "baseline", borderBottomWidth: 2, borderBottomColor: c.brandPrimary },
  lengthInput: { flex: 1, fontFamily: mono, fontSize: 36, fontWeight: "700", color: c.onSurface, paddingVertical: spacing.sm },
  unit: { fontSize: 20, fontWeight: "600", color: c.muted },
  chips: { gap: spacing.sm },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: c.brandTertiary, borderColor: c.brandPrimary },
  chipText: { fontFamily: mono, fontSize: 14, color: c.onSurfaceTertiary },
  chipTextActive: { color: c.brandPrimary },
  appHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  total: { fontFamily: mono, fontSize: 18, fontWeight: "700", color: c.brandPrimary },
  empty: { fontSize: 14, color: c.muted, paddingVertical: spacing.sm },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  appName: { flex: 1, fontSize: 15, color: c.onSurface },
  appKw: { fontFamily: mono, fontSize: 14, color: c.onSurfaceSecondary },
  removeBtn: { padding: spacing.xs },
  addBtn: {
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.brandPrimary,
    backgroundColor: c.brandTertiary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  addText: { color: c.onBrandTertiary, fontWeight: "600", fontSize: 15 },
  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: "rgba(250,250,250,0.94)",
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  cta: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: c.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: c.onBrandPrimary, fontSize: 17, fontWeight: "700" },
}));
