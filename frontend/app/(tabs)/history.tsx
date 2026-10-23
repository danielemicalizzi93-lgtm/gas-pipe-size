import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, GAS_LABELS, MATERIAL_LABELS } from "@/src/api";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

const EMPTY_IMG = "https://images.pexels.com/photos/8947698/pexels-photo-8947698.jpeg?auto=compress&cs=tinysrgb&w=600";

export default function HistoryScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const q = useQuery({ queryKey: ["calculations"], queryFn: api.list });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Storico calcoli</Text>
        {q.data && <Text style={styles.count}>{q.data.length} salvati</Text>}
      </View>

      {q.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" testID="history-loading" />
        </View>
      ) : q.isError ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Impossibile caricare lo storico</Text>
          <Pressable style={styles.btn} onPress={() => q.refetch()} testID="history-retry">
            <Text style={styles.btnText}>Riprova</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + spacing.xl }]}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <View style={styles.empty} testID="history-empty">
              <Image source={{ uri: EMPTY_IMG }} style={styles.emptyImg} contentFit="cover" transition={300} />
              <Text style={styles.emptyTitle}>Nessun calcolo salvato</Text>
              <Text style={styles.muted}>I dimensionamenti salvati compariranno qui.</Text>
              <Pressable style={styles.btn} onPress={() => router.navigate("/")} testID="history-new-calc">
                <Text style={styles.btnText}>Nuovo calcolo</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40)}>
              <Pressable
                testID={`history-item-${index}`}
                onPress={() => router.push(`/history/${item.id}`)}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.diamBox}>
                  <Text style={styles.diam} numberOfLines={1} adjustsFontSizeToFit>
                    {item.result.recommended?.nominal ?? "—"}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.meta}>
                    {GAS_LABELS[item.input.gas]} · {MATERIAL_LABELS[item.input.material]} ·{" "}
                    {item.input.segments.length > 1
                      ? `${item.input.segments.length} tratti`
                      : `${item.input.segments[0].length_m} m`}{" "}
                    · {item.result.total_power_kw} kW
                  </Text>
                  {!!item.client_name && <Text style={styles.meta} numberOfLines={1}>Cliente: {item.client_name}</Text>}
                  <Text style={styles.date}>{new Date(item.created_at).toLocaleString("it-IT")}</Text>
                </View>
                <MaterialDesignIcons name="chevron-right" size={22} color={colors.muted} />
              </Pressable>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  title: { fontSize: 26, fontWeight: "800", color: c.onSurface },
  count: { fontSize: 13, color: c.muted },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
  },
  diamBox: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: c.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  diam: { fontFamily: mono, fontSize: 16, fontWeight: "800", color: c.brandPrimary },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "600", color: c.onSurface },
  meta: { fontSize: 13, color: c.onSurfaceTertiary },
  date: { fontSize: 12, color: c.muted },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyImg: { width: 160, height: 160, borderRadius: radius.lg, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: c.onSurface },
  muted: { fontSize: 14, color: c.muted, textAlign: "center" },
  btn: { marginTop: spacing.md, minHeight: 48, paddingHorizontal: spacing.xl, borderRadius: radius.md, backgroundColor: c.brandPrimary, justifyContent: "center" },
  btnText: { color: c.onBrandPrimary, fontWeight: "700", fontSize: 15 },
}));
