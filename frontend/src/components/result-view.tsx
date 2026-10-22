import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { Text, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import type { CalcInput, CalcResult } from "@/src/api";
import { makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

export function ResultView({ input, result }: { input: CalcInput; result: CalcResult }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const rec = result.recommended;

  return (
    <View style={styles.wrap}>
      {rec ? (
        <Animated.View entering={ZoomIn.duration(350)} style={styles.hero} testID="result-recommended">
          <Text style={styles.heroLabel}>DIAMETRO CONSIGLIATO</Text>
          <Text style={styles.heroValue} testID="result-diameter">
            {rec.nominal}
          </Text>
          <Text style={styles.heroSub}>
            {result.material_label} · Ø interno {rec.internal_mm} mm
          </Text>
          <View style={styles.badge}>
            <MaterialDesignIcons name="check-circle" size={16} color={colors.success} />
            <Text style={styles.badgeText} testID="result-drop">
              Δp {rec.pressure_drop_mbar.toFixed(2)} mbar ≤ {result.max_drop_mbar} mbar
            </Text>
          </View>
        </Animated.View>
      ) : (
        <View style={[styles.hero, styles.heroError]} testID="result-error">
          <MaterialDesignIcons name="alert-circle" size={36} color={colors.error} />
          <Text style={styles.errorTitle}>Oltre i limiti tabellari</Text>
          <Text style={styles.heroSub}>
            Nessun diametro disponibile rispetta la caduta di {result.max_drop_mbar} mbar. Riduci la lunghezza, la potenza o
            cambia materiale.
          </Text>
        </View>
      )}

      <Animated.View entering={FadeInDown.delay(100)} style={styles.metrics}>
        <Metric label="Potenza totale" value={`${result.total_power_kw} kW`} testID="metric-power" />
        <Metric label="Portata gas" value={`${result.flow_m3h} m³/h`} testID="metric-flow" />
        <Metric label="Lungh. equivalente" value={`${result.equivalent_length_m} m`} testID="metric-length" />
        <Metric label="Gas" value={result.gas_label} testID="metric-gas" />
        {rec && <Metric label="Velocità" value={`${rec.velocity_ms} m/s`} testID="metric-velocity" />}
        <Metric label="Raccordi" value={`+${input.fittings_pct}%`} testID="metric-fittings" />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180)} style={styles.card}>
        <Text style={styles.cardTitle}>Verifica per diametro</Text>
        <View style={[styles.tr, styles.thRow]}>
          <Text style={[styles.th, styles.c1]}>Misura</Text>
          <Text style={[styles.th, styles.c2]}>Ø int.</Text>
          <Text style={[styles.th, styles.c3]}>Δp mbar</Text>
          <Text style={[styles.th, styles.c4]} />
        </View>
        {result.options.map((o) => {
          const isRec = rec?.nominal === o.nominal;
          return (
            <View key={o.nominal} style={[styles.tr, isRec && styles.trRec]} testID={`option-row-${o.nominal}`}>
              <Text style={[styles.td, styles.c1, isRec && styles.tdRec]}>{o.nominal}</Text>
              <Text style={[styles.td, styles.c2]}>{o.internal_mm}</Text>
              <Text style={[styles.td, styles.c3, { color: o.ok ? colors.success : colors.error }]}>
                {o.pressure_drop_mbar >= 100 ? ">99" : o.pressure_drop_mbar.toFixed(2)}
              </Text>
              <View style={styles.c4}>
                <MaterialDesignIcons
                  name={o.ok ? "check" : "close"}
                  size={18}
                  color={o.ok ? colors.success : colors.error}
                />
              </View>
            </View>
          );
        })}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240)} style={styles.card}>
        <Text style={styles.cardTitle}>Apparecchi ({input.appliances.length})</Text>
        {input.appliances.map((a, i) => (
          <View key={i} style={styles.appRow}>
            <Text style={styles.appName}>{a.name}</Text>
            <Text style={styles.appKw}>{a.power_kw} kW</Text>
          </View>
        ))}
      </Animated.View>

      <Text style={styles.note}>
        Calcolo secondo il metodo delle tabelle UNI 7129 (formula di Renouard, bassa pressione). Valori indicativi: la
        progettazione va verificata da un tecnico abilitato.
      </Text>
    </View>
  );
}

function Metric({ label, value, testID }: { label: string; value: string; testID: string }) {
  const styles = useStyles();
  return (
    <View style={styles.metric} testID={testID}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.lg },
  hero: {
    backgroundColor: c.surfaceInverse,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  heroError: { backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.error },
  heroLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1.4, color: c.brandSecondary },
  heroValue: { fontFamily: mono, fontSize: 56, fontWeight: "800", color: c.onSurfaceInverse },
  heroSub: { fontSize: 14, color: c.muted, textAlign: "center" },
  errorTitle: { fontSize: 20, fontWeight: "700", color: c.error },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: c.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
  },
  badgeText: { fontFamily: mono, fontSize: 13, color: c.success, fontWeight: "700" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: {
    width: "48.5%",
    flexGrow: 1,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  metricLabel: { fontSize: 12, color: c.muted },
  metricValue: { fontFamily: mono, fontSize: 16, fontWeight: "700", color: c.onSurface, marginTop: 2 },
  card: { backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.lg },
  cardTitle: { fontSize: 15, fontWeight: "700", color: c.onSurface, marginBottom: spacing.sm },
  tr: { flexDirection: "row", alignItems: "center", minHeight: 40, borderBottomWidth: 1, borderBottomColor: c.divider, paddingHorizontal: spacing.xs },
  thRow: { minHeight: 32 },
  trRec: { backgroundColor: c.brandTertiary, borderRadius: radius.sm },
  th: { fontSize: 12, fontWeight: "600", color: c.muted },
  td: { fontFamily: mono, fontSize: 14, color: c.onSurfaceSecondary },
  tdRec: { color: c.brandPrimary, fontWeight: "800" },
  c1: { flex: 1.3 },
  c2: { flex: 1 },
  c3: { flex: 1.2 },
  c4: { width: 24, alignItems: "flex-end" },
  appRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.divider },
  appName: { fontSize: 14, color: c.onSurface, flex: 1 },
  appKw: { fontFamily: mono, fontSize: 14, color: c.onSurfaceSecondary },
  note: { fontSize: 12, color: c.muted, lineHeight: 18 },
}));
