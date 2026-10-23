import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";

import { useDraft, type SegmentDraft } from "@/src/store/draft";
import { makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

type Props = {
  segment: SegmentDraft;
  index: number;
  candidates: SegmentDraft[]; // segments that can feed this one (earlier ones)
  onAddAppliance: () => void;
};

export function SegmentCard({ segment, index, candidates, onAddAppliance }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const updateSegment = useDraft((s) => s.updateSegment);
  const removeSegment = useDraft((s) => s.removeSegment);
  const removeAppliance = useDraft((s) => s.removeAppliance);
  const isRoot = segment.parent_id === null;
  const kw = segment.appliances.reduce((s, a) => s + a.power_kw, 0);

  return (
    <Animated.View entering={FadeInDown.duration(250)} exiting={FadeOut} layout={LinearTransition} style={styles.card} testID={`segment-card-${index}`}>
      <View style={styles.headRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{index + 1}</Text>
        </View>
        <TextInput
          testID={`segment-name-input-${index}`}
          maxLength={60}
          style={styles.nameInput}
          value={segment.name}
          onChangeText={(name) => updateSegment(segment.id, { name })}
          placeholder="Nome tratto"
          placeholderTextColor={colors.muted}
        />
        {!isRoot && (
          <Pressable hitSlop={10} onPress={() => removeSegment(segment.id)} testID={`segment-remove-${index}`} style={styles.iconBtn}>
            <MaterialDesignIcons name="trash-can-outline" size={22} color={colors.error} />
          </Pressable>
        )}
      </View>

      <Text style={styles.label}>Alimentato da</Text>
      {isRoot ? (
        <View style={styles.meterRow}>
          <MaterialDesignIcons name="gauge" size={18} color={colors.brandPrimary} />
          <Text style={styles.meterText}>Contatore</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {candidates.map((c) => {
            const active = c.id === segment.parent_id;
            return (
              <Pressable
                key={c.id}
                testID={`segment-${index}-parent-${c.id}`}
                onPress={() => updateSegment(segment.id, { parent_id: c.id })}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {c.name || "Tratto"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Text style={[styles.label, { marginTop: spacing.md }]}>Lunghezza</Text>
      <View style={styles.lengthRow}>
        <TextInput
          testID={index === 0 ? "length-input" : `segment-length-input-${index}`}
          style={styles.lengthInput}
          value={segment.length}
          onChangeText={(length) => updateSegment(segment.id, { length })}
          placeholder="0"
          placeholderTextColor={colors.borderStrong}
          keyboardType="decimal-pad"
        />
        <Text style={styles.unit}>m</Text>
      </View>

      <View style={styles.appHeader}>
        <Text style={styles.label}>Apparecchi a fine tratto</Text>
        <Text style={styles.kw} testID={`segment-power-${index}`}>
          {kw.toFixed(1)} kW
        </Text>
      </View>
      {segment.appliances.map((a, i) => (
        <View key={`${a.name}-${i}`} style={styles.appRow} testID={`segment-${index}-appliance-${i}`}>
          <MaterialDesignIcons name="fire" size={20} color={colors.brandPrimary} />
          <Text style={styles.appName} numberOfLines={1}>
            {a.name}
          </Text>
          <Text style={styles.appKw}>{a.power_kw} kW</Text>
          <Pressable
            hitSlop={10}
            testID={index === 0 ? `remove-appliance-${i}` : `segment-${index}-remove-appliance-${i}`}
            onPress={() => removeAppliance(segment.id, i)}
            style={styles.iconBtn}
          >
            <MaterialDesignIcons name="close-circle" size={22} color={colors.muted} />
          </Pressable>
        </View>
      ))}
      <Pressable
        testID={index === 0 ? "add-appliance-button" : `segment-add-appliance-${index}`}
        onPress={onAddAppliance}
        style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
      >
        <MaterialDesignIcons name="plus" size={20} color={colors.onBrandTertiary} />
        <Text style={styles.addText}>Aggiungi apparecchio</Text>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  badge: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  badgeText: { color: c.onBrandPrimary, fontWeight: "800", fontSize: 13, fontFamily: mono },
  nameInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: c.onSurface,
    minHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    paddingVertical: spacing.xs,
  },
  iconBtn: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, fontWeight: "600", color: c.onSurfaceTertiary, marginBottom: spacing.sm },
  meterRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, height: 36 },
  meterText: { fontSize: 15, fontWeight: "600", color: c.onSurface },
  chips: { gap: spacing.sm },
  chip: {
    flexShrink: 0,
    height: 36,
    maxWidth: 180,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: c.brandTertiary, borderColor: c.brandPrimary },
  chipText: { fontSize: 14, color: c.onSurfaceTertiary },
  chipTextActive: { color: c.brandPrimary },
  lengthRow: { flexDirection: "row", alignItems: "baseline", borderBottomWidth: 2, borderBottomColor: c.brandPrimary, marginBottom: spacing.lg },
  lengthInput: { flex: 1, fontFamily: mono, fontSize: 30, fontWeight: "700", color: c.onSurface, paddingVertical: spacing.xs },
  unit: { fontSize: 18, fontWeight: "600", color: c.muted },
  appHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  kw: { fontFamily: mono, fontSize: 15, fontWeight: "700", color: c.brandPrimary },
  appRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 48, borderBottomWidth: 1, borderBottomColor: c.divider },
  appName: { flex: 1, fontSize: 15, color: c.onSurface },
  appKw: { fontFamily: mono, fontSize: 14, color: c.onSurfaceSecondary },
  addBtn: {
    marginTop: spacing.md,
    minHeight: 44,
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
}));
