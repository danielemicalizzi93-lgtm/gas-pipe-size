import { Pressable, Text, View } from "react-native";

import { makeStyles, radius } from "@/src/theme";

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testIDPrefix: string;
};

export function Segmented<T extends string>({ options, value, onChange, testIDPrefix }: Props<T>) {
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`${testIDPrefix}-${o.value}`}
            onPress={() => onChange(o.value)}
            style={[styles.item, active && styles.itemActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { flexDirection: "row", backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: 4 },
  item: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.sm + 2 },
  itemActive: {
    backgroundColor: c.surfaceSecondary,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  label: { fontSize: 14, fontWeight: "500", color: c.onSurfaceTertiary },
  labelActive: { color: c.brandPrimary, fontWeight: "500" },
}));
