import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApplianceModal } from "@/src/components/appliance-modal";
import { SegmentCard } from "@/src/components/segment-card";
import { Segmented } from "@/src/components/segmented";
import { usesNativeTabs } from "@/src/navigation";
import { draftToInput, parseNum, useDraft } from "@/src/store/draft";
import { makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

const FITTINGS = [0, 10, 20, 30];

export default function CalculatorScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const d = useDraft();
  const { gas, material, fittings, segments, setGas, setMaterial, setFittings } = d;
  const [modalSeg, setModalSeg] = useState<string | null>(null);

  const total = segments.reduce((s, x) => s + x.appliances.reduce((a, b) => a + b.power_kw, 0), 0);
  const valid = segments.every((x) => parseNum(x.length) > 0 && parseNum(x.length) <= 500) && total > 0;

  const calc = () => {
    router.push({ pathname: "/result", params: { input: JSON.stringify(draftToInput(d)) } });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.overline}>UNI 7129 · BASSA PRESSIONE</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Dimensionamento gas</Text>
          <Pressable onPress={d.reset} hitSlop={10} testID="reset-button" style={styles.resetBtn}>
            <MaterialDesignIcons name="refresh" size={22} color={colors.muted} />
          </Pressable>
        </View>
        {d.editingId && (
          <View style={styles.editBanner} testID="editing-banner">
            <MaterialDesignIcons name="pencil" size={16} color={colors.onBrandTertiary} />
            <Text style={styles.editText} numberOfLines={1}>
              Modifica: {d.meta.name}
            </Text>
            <Pressable onPress={d.reset} hitSlop={10} testID="cancel-edit-button">
              <Text style={styles.editCancel}>Annulla</Text>
            </Pressable>
          </View>
        )}
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
          <Text style={styles.label}>Maggiorazione raccordi/curve</Text>
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

        <View style={styles.sectionRow}>
          <Text style={styles.section}>RETE · {segments.length} {segments.length === 1 ? "TRATTO" : "TRATTI"}</Text>
          <Text style={styles.total} testID="total-power">
            {total.toFixed(1)} kW
          </Text>
        </View>

        {segments.map((s, i) => (
          <SegmentCard
            key={s.id}
            segment={s}
            index={i}
            candidates={segments.slice(0, i)}
            onAddAppliance={() => setModalSeg(s.id)}
          />
        ))}

        <Pressable
          testID="add-segment-button"
          onPress={d.addSegment}
          style={({ pressed }) => [styles.addSegBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialDesignIcons name="source-branch-plus" size={20} color={colors.onSurface} />
          <Text style={styles.addSegText}>Aggiungi tratto / diramazione</Text>
        </Pressable>
        {!valid && (
          <Text style={styles.hint} testID="form-hint">
            Inserisci la lunghezza di ogni tratto (max 500 m) e almeno un apparecchio.
          </Text>
        )}
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

      <ApplianceModal
        visible={modalSeg !== null}
        onClose={() => setModalSeg(null)}
        onAdd={(a) => modalSeg && d.addAppliance(modalSeg, a)}
      />
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
  title: { fontSize: 26, fontWeight: "800", color: c.onSurface, marginTop: 2, flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center" },
  resetBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: c.brandTertiary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  editText: { flex: 1, color: c.onBrandTertiary, fontWeight: "600", fontSize: 13 },
  editCancel: { color: c.onBrandSecondary, fontWeight: "700", fontSize: 13 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: spacing.xs },
  section: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: c.muted },
  addSegBtn: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: c.surfaceSecondary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  addSegText: { color: c.onSurface, fontWeight: "600", fontSize: 15 },
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
