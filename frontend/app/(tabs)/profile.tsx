import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, LOGO_UPLOAD_URL, LOGO_URL, type Profile } from "@/src/api";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { uploadForm } from "@/src/utils/upload";

const FIELDS: { key: keyof Profile; label: string; placeholder: string; keyboard?: "email-address" | "phone-pad" }[] = [
  { key: "company", label: "Ragione sociale", placeholder: "Es. Rossi Impianti S.r.l." },
  { key: "full_name", label: "Tecnico / Installatore", placeholder: "Nome e cognome" },
  { key: "address", label: "Indirizzo", placeholder: "Via, CAP, città" },
  { key: "phone", label: "Telefono", placeholder: "+39 ...", keyboard: "phone-pad" },
  { key: "email", label: "Email", placeholder: "info@azienda.it", keyboard: "email-address" },
  { key: "vat", label: "Partita IVA", placeholder: "IT01234567890" },
  { key: "license", label: "Abilitazione / Iscrizione", placeholder: "Es. DM 37/08 lett. E, CCIAA ..." },
];

type PermState = "idle" | "explain" | "blocked";

export default function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const q = useQuery({ queryKey: ["profile"], queryFn: api.profile });
  const [form, setForm] = useState<Profile | null>(null);
  const [perm, setPerm] = useState<PermState>("idle");
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    if (q.data && !form) setForm(q.data);
  }, [q.data, form]);

  const save = useMutation({
    mutationFn: (p: Profile) => api.saveProfile(p),
    onSuccess: (p) => {
      qc.setQueryData(["profile"], p);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    },
  });

  const upload = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      const res = await uploadForm(LOGO_UPLOAD_URL, {
        files: { file: { uri: asset.uri, name: asset.fileName ?? "logo.jpg", mimeType: asset.mimeType ?? "image/jpeg" } },
      });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as Profile;
    },
    onSuccess: (p) => qc.setQueryData(["profile"], p),
  });

  const removeLogo = useMutation({ mutationFn: api.removeLogo, onSuccess: (p) => qc.setQueryData(["profile"], p) });

  const launchPicker = async () => {
    setPerm("idle");
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true });
    if (!r.canceled && r.assets[0]) upload.mutate(r.assets[0]);
  };

  const pickLogo = async () => {
    if (Platform.OS === "web") return launchPicker();
    const p = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (p.granted) return launchPicker();
    setPerm(p.canAskAgain ? "explain" : "blocked");
  };

  const requestPerm = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (p.granted) return launchPicker();
    setPerm(p.canAskAgain ? "explain" : "blocked");
  };

  const profile = q.data;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Profilo installatore</Text>
        <Text style={styles.sub}>Questi dati compaiono su ogni relazione PDF</Text>
      </View>

      {q.isLoading || !form ? (
        <View style={styles.center}>
          {q.isError ? (
            <Pressable style={styles.saveBtn} onPress={() => q.refetch()} testID="profile-retry">
              <Text style={styles.saveText}>Riprova</Text>
            </Pressable>
          ) : (
            <ActivityIndicator color={colors.brandPrimary} size="large" testID="profile-loading" />
          )}
        </View>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
          <View style={styles.card}>
            <Text style={styles.label}>Logo aziendale</Text>
            <View style={styles.logoRow}>
              <View style={styles.logoBox} testID="profile-logo-preview">
                {profile?.has_logo ? (
                  <Image
                    source={{ uri: `${LOGO_URL}?v=${profile.logo_version}` }}
                    style={styles.logo}
                    contentFit="contain"
                    transition={200}
                  />
                ) : (
                  <MaterialDesignIcons name="image-outline" size={32} color={colors.muted} />
                )}
              </View>
              <View style={styles.logoActions}>
                <Pressable style={styles.outlineBtn} onPress={pickLogo} disabled={upload.isPending} testID="profile-pick-logo">
                  {upload.isPending ? (
                    <ActivityIndicator color={colors.brandPrimary} />
                  ) : (
                    <Text style={styles.outlineText}>{profile?.has_logo ? "Cambia logo" : "Carica logo"}</Text>
                  )}
                </Pressable>
                {profile?.has_logo && (
                  <Pressable onPress={() => removeLogo.mutate()} testID="profile-remove-logo" style={styles.textBtn}>
                    <Text style={styles.removeText}>Rimuovi</Text>
                  </Pressable>
                )}
              </View>
            </View>
            {upload.isError && <Text style={styles.err}>Caricamento non riuscito, riprova.</Text>}
            {perm === "explain" && (
              <View style={styles.permCard} testID="perm-explain">
                <Text style={styles.permText}>
                  Per scegliere il logo serve l&apos;accesso alle foto. Lo useremo solo per stamparlo sulle relazioni.
                </Text>
                <Pressable style={styles.permBtn} onPress={requestPerm} testID="perm-allow">
                  <Text style={styles.saveText}>Consenti accesso</Text>
                </Pressable>
              </View>
            )}
            {perm === "blocked" && (
              <View style={styles.permCard} testID="perm-blocked">
                <Text style={styles.permText}>Accesso alle foto negato. Abilitalo dalle impostazioni per caricare il logo.</Text>
                <Pressable style={styles.permBtn} onPress={() => Linking.openSettings()} testID="perm-open-settings">
                  <Text style={styles.saveText}>Apri impostazioni</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.card}>
            {FIELDS.map((f) => (
              <View key={f.key} style={styles.field}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput
                  testID={`profile-${f.key}-input`}
                  maxLength={f.key === "address" ? 200 : f.key === "phone" || f.key === "vat" ? 40 : 100}
                  style={styles.input}
                  value={String(form[f.key] ?? "")}
                  onChangeText={(v) => setForm({ ...form, [f.key]: v })}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.muted}
                  keyboardType={f.keyboard ?? "default"}
                  autoCapitalize={f.keyboard === "email-address" ? "none" : "sentences"}
                />
              </View>
            ))}
          </View>

          <Pressable
            testID="profile-save-button"
            style={[styles.saveBtn, savedMsg && styles.saveDone, save.isPending && { opacity: 0.6 }]}
            disabled={save.isPending}
            onPress={() => {
              const { has_logo: _h, logo_version: _v, ...rest } = form;
              save.mutate(rest);
            }}
          >
            {save.isPending ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.saveText}>{savedMsg ? "Profilo salvato" : "Salva profilo"}</Text>
            )}
          </Pressable>
          {save.isError && <Text style={styles.err}>Salvataggio non riuscito.</Text>}
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
  title: { fontSize: 26, fontWeight: "800", color: c.onSurface },
  sub: { fontSize: 13, color: c.muted, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.lg },
  label: { fontSize: 13, fontWeight: "600", color: c.onSurfaceTertiary, marginBottom: spacing.sm },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: 96, height: 96 },
  logoActions: { flex: 1, gap: spacing.xs },
  outlineBtn: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: { color: c.brandPrimary, fontWeight: "700", fontSize: 15 },
  textBtn: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  removeText: { color: c.error, fontWeight: "600" },
  permCard: { marginTop: spacing.md, backgroundColor: c.brandTertiary, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  permText: { fontSize: 14, color: c.onSurfaceSecondary },
  permBtn: { minHeight: 44, borderRadius: radius.md, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  field: { marginBottom: spacing.md },
  input: {
    minHeight: 48,
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: c.onSurface,
  },
  saveBtn: { minHeight: 52, borderRadius: radius.md, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  saveDone: { backgroundColor: c.success },
  saveText: { color: c.onBrandPrimary, fontWeight: "700", fontSize: 16 },
  err: { color: c.error, fontSize: 13, marginTop: spacing.sm },
}));
