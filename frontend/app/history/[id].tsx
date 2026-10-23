import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { ResultView } from "@/src/components/result-view";
import { shareReport } from "@/src/pdf";
import { useDraft } from "@/src/store/draft";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function HistoryDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [confirm, setConfirm] = useState(false);
  const loadCalculation = useDraft((s) => s.loadCalculation);

  const q = useQuery({ queryKey: ["calculation", id], queryFn: () => api.get(id) });
  const pdf = useMutation({
    mutationFn: () => shareReport(
      { name: q.data!.name, client_name: q.data!.client_name, site_address: q.data!.site_address },
      q.data!.input,
      q.data!.result,
    ),
  });
  const openInCalculator = (mode: "edit" | "duplicate") => {
    loadCalculation(q.data!, mode);
    router.dismissTo("/");
  };
  const del = useMutation({
    mutationFn: () => api.remove(id),
    onSuccess: async () => {
      if (useDraft.getState().editingId === id) useDraft.getState().reset();
      await qc.invalidateQueries({ queryKey: ["calculations"] });
      setConfirm(false);
      router.back();
    },
  });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn} testID="detail-back">
          <MaterialDesignIcons name="chevron-left" size={28} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {q.data?.name ?? "Dettaglio"}
        </Text>
        <Pressable onPress={() => setConfirm(true)} hitSlop={12} style={styles.iconBtn} testID="detail-delete">
          <MaterialDesignIcons name="trash-can-outline" size={24} color={colors.error} />
        </Pressable>
      </View>

      {q.isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      )}
      {q.isError && (
        <View style={styles.center}>
          <Text style={styles.muted}>Calcolo non trovato</Text>
        </View>
      )}
      {q.data && (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Text style={styles.date}>Salvato il {new Date(q.data.created_at).toLocaleString("it-IT")}</Text>
          {(!!q.data.client_name || !!q.data.site_address) && (
            <View style={styles.clientCard} testID="detail-client">
              {!!q.data.client_name && <Text style={styles.clientName}>{q.data.client_name}</Text>}
              {!!q.data.site_address && <Text style={styles.muted}>{q.data.site_address}</Text>}
            </View>
          )}
          <View style={styles.actions}>
            <Pressable style={styles.action} onPress={() => openInCalculator("edit")} testID="detail-edit">
              <MaterialDesignIcons name="pencil-outline" size={20} color={colors.brandPrimary} />
              <Text style={styles.actionText}>Modifica</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => openInCalculator("duplicate")} testID="detail-duplicate">
              <MaterialDesignIcons name="content-copy" size={20} color={colors.brandPrimary} />
              <Text style={styles.actionText}>Duplica</Text>
            </Pressable>
            <Pressable style={[styles.action, styles.actionDark]} onPress={() => pdf.mutate()} testID="detail-pdf" disabled={pdf.isPending}>
              {pdf.isPending ? (
                <ActivityIndicator color={colors.onSurfaceInverse} />
              ) : (
                <>
                  <MaterialDesignIcons name="file-pdf-box" size={20} color={colors.onSurfaceInverse} />
                  <Text style={[styles.actionText, { color: colors.onSurfaceInverse }]}>PDF</Text>
                </>
              )}
            </Pressable>
          </View>
          {pdf.isError && <Text style={[styles.muted, { color: colors.error }]}>Impossibile generare il PDF.</Text>}
          <ResultView input={q.data.input} result={q.data.result} />
        </ScrollView>
      )}

      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => setConfirm(false)}>
        <Pressable style={styles.backdrop} onPress={() => setConfirm(false)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="delete-confirm-sheet">
            <Text style={styles.sheetTitle}>Eliminare questo calcolo?</Text>
            <Text style={styles.muted}>L&apos;operazione non può essere annullata.</Text>
            <Pressable style={styles.danger} onPress={() => del.mutate()} testID="delete-confirm-button">
              {del.isPending ? (
                <ActivityIndicator color={colors.onError} />
              ) : (
                <Text style={styles.dangerText}>Elimina</Text>
              )}
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setConfirm(false)} testID="delete-cancel-button">
              <Text style={styles.cancelText}>Annulla</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: c.onSurface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.md },
  date: { fontSize: 13, color: c.muted },
  muted: { fontSize: 14, color: c.muted },
  clientCard: { backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  clientName: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.brandPrimary,
    backgroundColor: c.brandTertiary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  actionDark: { backgroundColor: c.surfaceInverse, borderColor: c.surfaceInverse },
  actionText: { fontSize: 14, fontWeight: "700", color: c.brandPrimary },
  backdrop: { flex: 1, backgroundColor: c.scrim, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: c.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: c.onSurface },
  danger: { marginTop: spacing.md, minHeight: 50, borderRadius: radius.md, backgroundColor: c.error, alignItems: "center", justifyContent: "center" },
  dangerText: { color: c.onError, fontWeight: "700", fontSize: 16 },
  cancel: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  cancelText: { color: c.onSurfaceTertiary, fontWeight: "600", fontSize: 15 },
}));
