import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, GAS_LABELS, MATERIAL_LABELS, type CalcInput } from "@/src/api";
import { ResultView } from "@/src/components/result-view";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function ResultScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ input: string }>();
  const input = useMemo(() => JSON.parse(params.input) as CalcInput, [params.input]);
  const [name, setName] = useState(
    `${GAS_LABELS[input.gas]} · ${MATERIAL_LABELS[input.material]} · ${input.length_m} m`,
  );
  const [saved, setSaved] = useState(false);

  const q = useQuery({ queryKey: ["calculate", params.input], queryFn: () => api.calculate(input) });
  const save = useMutation({
    mutationFn: () => api.save(name.trim(), input),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["calculations"] });
    },
  });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="result-close" style={styles.iconBtn}>
          <MaterialDesignIcons name="chevron-down" size={28} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Risultato</Text>
        <View style={styles.iconBtn} />
      </View>

      {q.isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" testID="result-loading" />
        </View>
      )}
      {q.isError && (
        <View style={styles.center}>
          <Text style={styles.errText}>Errore nel calcolo</Text>
          <Pressable onPress={() => q.refetch()} style={styles.retry} testID="result-retry">
            <Text style={styles.retryText}>Riprova</Text>
          </Pressable>
        </View>
      )}
      {q.data && (
        <KeyboardAwareScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
          <ResultView input={input} result={q.data} />

          <View style={styles.saveCard}>
            <Text style={styles.saveLabel}>Nome del calcolo</Text>
            <TextInput
              testID="save-name-input"
              style={styles.input}
              value={name}
              onChangeText={setName}
              editable={!saved}
              placeholderTextColor={colors.muted}
              placeholder="Es. Appartamento Rossi"
            />
            <Pressable
              testID="save-button"
              disabled={saved || save.isPending || !name.trim()}
              onPress={() => save.mutate()}
              style={[styles.saveBtn, saved && styles.saveBtnDone, (!name.trim() || save.isPending) && { opacity: 0.5 }]}
            >
              {save.isPending ? (
                <ActivityIndicator color={colors.onBrandPrimary} />
              ) : (
                <>
                  <MaterialDesignIcons
                    name={saved ? "check" : "content-save-outline"}
                    size={20}
                    color={colors.onBrandPrimary}
                  />
                  <Text style={styles.saveText}>{saved ? "Salvato nello storico" : "Salva nello storico"}</Text>
                </>
              )}
            </Pressable>
            {save.isError && <Text style={styles.errText}>Salvataggio non riuscito, riprova.</Text>}
          </View>
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.surface,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "700", color: c.onSurface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  content: { padding: spacing.lg, gap: spacing.lg },
  errText: { color: c.error, fontSize: 14, marginTop: spacing.sm },
  retry: { paddingHorizontal: spacing.xl, minHeight: 44, justifyContent: "center", borderRadius: radius.md, backgroundColor: c.brandPrimary },
  retryText: { color: c.onBrandPrimary, fontWeight: "600" },
  saveCard: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.lg },
  saveLabel: { fontSize: 13, fontWeight: "600", color: c.onSurfaceTertiary, marginBottom: spacing.sm },
  input: {
    minHeight: 48,
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: c.onSurface,
    marginBottom: spacing.md,
  },
  saveBtn: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: c.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  saveBtnDone: { backgroundColor: c.success },
  saveText: { color: c.onBrandPrimary, fontSize: 16, fontWeight: "700" },
}));
