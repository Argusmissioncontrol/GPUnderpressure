import React, { useEffect, useRef, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  uris: string[];
  onClear: () => void;
};

const WIDTH = Math.max(280, Dimensions.get("window").width - 40);

export function MobileResultGallery({ uris, onClear }: Props) {
  const listRef = useRef<FlatList<string>>(null);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setIndex(0);
    setMessage("");
    if (uris.length) {
      setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }), 0);
    }
  }, [uris]);

  if (!uris.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>LATEST OUTPUT</Text>
        <Text style={styles.empty}>No result yet. Batch generations will appear here as a swipeable gallery.</Text>
      </View>
    );
  }

  const saveUris = async (targets: string[]) => {
    setSaving(true);
    setMessage("");
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) throw new Error("Photo/media permission is required to save results.");
      for (let position = 0; position < targets.length; position += 1) {
        const target = targets[position];
        const local = `${FileSystem.cacheDirectory}lgs-${Date.now()}-${position}.png`;
        const downloaded = await FileSystem.downloadAsync(target, local);
        await MediaLibrary.createAssetAsync(downloaded.uri);
      }
      setMessage(targets.length === 1 ? "Saved this result." : `Saved all ${targets.length} results.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <Text style={styles.eyebrow}>LATEST OUTPUT</Text>
        <Text style={styles.counter}>{index + 1} / {uris.length}</Text>
      </View>
      <FlatList
        ref={listRef}
        data={uris}
        keyExtractor={(item, position) => `${position}-${item}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / WIDTH);
          setIndex(Math.max(0, Math.min(uris.length - 1, next)));
        }}
        renderItem={({ item }) => (
          <View style={{ width: WIDTH }}>
            <Image source={{ uri: item }} style={styles.image} resizeMode="contain" />
          </View>
        )}
      />
      <Text style={styles.hint}>{uris.length > 1 ? "Swipe left or right through the batch." : "Single result."}</Text>
      <View style={styles.actions}>
        <Action label="SAVE THIS" disabled={saving} onPress={() => saveUris([uris[index]])} />
        {uris.length > 1 && <Action label="SAVE ALL" disabled={saving} onPress={() => saveUris(uris)} />}
        <Action label="CLEAR" disabled={saving} danger onPress={onClear} />
      </View>
      {saving && <ActivityIndicator color="#756be0" style={styles.spinner} />}
      {!!message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

type ActionProps = { label: string; disabled: boolean; danger?: boolean; onPress: () => void };
function Action({ label, disabled, danger = false, onPress }: ActionProps) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.action, danger && styles.danger]}><Text style={[styles.actionText, danger && styles.dangerText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: "#242b37", backgroundColor: "#0c1016", borderRadius: 13, padding: 12, marginBottom: 18 },
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  eyebrow: { color: "#756be0", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  counter: { color: "#9fa7b3", fontSize: 10, fontWeight: "800" },
  empty: { color: "#737c8b", fontSize: 12, lineHeight: 18 },
  image: { width: "100%", height: 430, backgroundColor: "#080b0f", borderRadius: 10 },
  hint: { color: "#737c8b", fontSize: 10, marginTop: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  action: { minHeight: 40, borderWidth: 1, borderColor: "#4a457e", backgroundColor: "#17152c", borderRadius: 9, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  danger: { borderColor: "#693f48", backgroundColor: "#241417" },
  actionText: { color: "#edeaff", fontSize: 10, fontWeight: "900" },
  dangerText: { color: "#f2b7bd" },
  spinner: { marginTop: 10 },
  message: { color: "#aab2bf", fontSize: 10, marginTop: 8 },
});
