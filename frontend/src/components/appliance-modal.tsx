import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Appliance } from "@/src/api";
import { makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

const PRESETS: { name: string; power_kw: number; icon: string }[] = [
  { name: "Caldaia murale", power_kw: 24, icon: "water-boiler" },
  { name: "Caldaia combinata", power_kw: 28, icon: "water-boiler" },
  { name: "Piano cottura 4 fuochi", power_kw: 7.5, icon: "stove" },
  { name: "Forno a gas", power_kw: 3.5, icon: "toaster-oven" },
  { name: "Scaldabagno", power_kw: 19, icon: "water-thermometer" },
  { name: "Stufa a gas", power_kw: 4, icon: "radiator" },
];

type Props = { visible: boolean; onClose: () => void; onAdd: (a: Appliance) => void };

export function ApplianceModal({ visible, onClose, onAdd }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [kw, setKw] = useState("");

  const kwNum = parseFloat(kw.replace(",", "."));
  const customValid = name.trim().length > 0 && kwNum > 0;

  const add = (a: Appliance) => {
    onAdd(a);
    setName("");
    setKw("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} testID="appliance-modal-backdrop" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="appliance-modal">
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Aggiungi apparecchio</Text>
            <Pressable onPress={onClose} hitSlop={12} testID="appliance-modal-close">
              <MaterialDesignIcons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.section}>APPARECCHI COMUNI</Text>
            {PRESETS.map((p, i) => (
              <Pressable
                key={p.name}
                testID={`preset-${i}`}
                style={({ pressed }) => [styles.preset, pressed && styles.pressed]}
                onPress={() => add({ name: p.name, power_kw: p.power_kw })}
              >
                <View style={styles.iconBox}>
                  <MaterialDesignIcons name={p.icon as any} size={22} color={colors.brandPrimary} />
                </View>
                <Text style={styles.presetName}>{p.name}</Text>
                <Text style={styles.presetKw}>{p.power_kw} kW</Text>
              </Pressable>
            ))}
            <Text style={[styles.section, { marginTop: spacing.lg }]}>PERSONALIZZATO</Text>
            <TextInput
              testID="custom-name-input"
              style={styles.input}
              placeholder="Nome apparecchio"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
            />
            <View style={styles.row}>
              <TextInput
                testID="custom-kw-input"
                style={[styles.input, styles.flex]}
                placeholder="Portata termica (kW)"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                value={kw}
                onChangeText={setKw}
              />
              <Pressable
                testID="custom-add-button"
                disabled={!customValid}
                onPress={() => add({ name: name.trim(), power_kw: kwNum })}
                style={[styles.addBtn, !customValid && styles.disabled]}
              >
                <Text style={styles.addText}>Aggiungi</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: c.scrim },
  sheet: {
    backgroundColor: c.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: "85%",
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: c.borderStrong, marginTop: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  title: { fontSize: 20, fontWeight: "700", color: c.onSurface },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  section: { fontSize: 12, fontWeight: "600", color: c.muted, letterSpacing: 0.8, marginBottom: spacing.sm },
  preset: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
    gap: spacing.md,
  },
  pressed: { opacity: 0.6 },
  iconBox: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  presetName: { flex: 1, fontSize: 16, color: c.onSurface },
  presetKw: { fontFamily: mono, fontSize: 14, color: c.onSurfaceTertiary },
  input: {
    minHeight: 48,
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: c.onSurface,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: "row", gap: spacing.sm },
  addBtn: { minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: c.brandPrimary, justifyContent: "center" },
  disabled: { opacity: 0.4 },
  addText: { color: c.onBrandPrimary, fontWeight: "600", fontSize: 15 },
}));
