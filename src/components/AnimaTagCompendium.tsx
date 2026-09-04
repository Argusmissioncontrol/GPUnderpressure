import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  searchAnimaTags,
  type AnimaCategory,
  type AnimaTagResult,
} from "../api/animaTagClient";

type Props = {
  prompt: string;
  disabled?: boolean;
  onChangePrompt: (prompt: string) => void;
};

const PAGE_SIZE = 100;

function promptTags(prompt: string): string[] {
  return prompt.split(",").map((item) => item.trim()).filter(Boolean);
}

export function AnimaTagCompendium({ prompt, disabled = false, onChangePrompt }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<AnimaCategory[]>([]);
  const [results, setResults] = useState<AnimaTagResult[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const selected = useMemo(() => new Set(promptTags(prompt)), [prompt]);

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      searchAnimaTags(query, category, 0, PAGE_SIZE)
        .then((payload) => {
          if (disposed) return;
          setCategories(payload.categories);
          setResults(payload.results);
          setTotal(payload.total);
          setHasMore(payload.hasMore);
        })
        .catch((reason) => {
          if (!disposed) setError(reason instanceof Error ? reason.message : "Tag search failed.");
        })
        .finally(() => { if (!disposed) setLoading(false); });
    }, 180);
    return () => { disposed = true; clearTimeout(timer); };
  }, [open, query, category]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const payload = await searchAnimaTags(query, category, results.length, PAGE_SIZE);
      setResults((current) => [...current, ...payload.results]);
      setTotal(payload.total);
      setHasMore(payload.hasMore);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load more tags.");
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleTag = (tag: string) => {
    const tags = promptTags(prompt);
    const next = tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
    onChangePrompt(next.join(", "));
  };

  return (
    <View style={styles.panel}>
      <Pressable disabled={disabled} onPress={() => setOpen((value) => !value)} style={[styles.headerButton, open && styles.headerButtonActive]}>
        <Text style={styles.headerText}>{open ? "CLOSE TAG COMPENDIUM" : "ANIMA TAG COMPENDIUM"}</Text>
      </Pressable>
      {open && (
        <>
          <TextInput editable={!disabled} value={query} onChangeText={setQuery} placeholder="Search tags or browse a category" placeholderTextColor="#626a78" autoCapitalize="none" autoCorrect={false} style={styles.search} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryRow}>
            <Choice label="All" active={category === null} disabled={disabled} onPress={() => setCategory(null)} />
            {categories.map((item) => <Choice key={item.name} label={`${item.name} (${item.count})`} active={category === item.name} disabled={disabled} onPress={() => setCategory(item.name)} />)}
          </ScrollView>
          {!!category && <Text style={styles.summary}>{category}: showing {results.length} of {total} eligible tags. Scroll and load more until the category is exhausted.</Text>}
          {!category && !!query.trim() && <Text style={styles.summary}>Search: showing {results.length} of {total} matches.</Text>}
          {!category && !query.trim() && <Text style={styles.summary}>Choose a category to browse its complete eligible tag list.</Text>}
          {loading ? <ActivityIndicator color="#756be0" style={styles.loading} /> : (
            <ScrollView nestedScrollEnabled style={styles.resultsScroll} contentContainerStyle={styles.results}>
              {results.map((item) => {
                const active = selected.has(item.tag);
                return (
                  <Pressable key={item.tag} disabled={disabled} onPress={() => toggleTag(item.tag)} style={[styles.resultRow, active && styles.resultRowActive]}>
                    <View style={styles.resultTextBlock}>
                      <Text style={[styles.resultText, active && styles.resultTextActive]}>{item.tag.replace(/_/g, " ")}</Text>
                      {!!item.aliases && <Text numberOfLines={1} style={styles.aliases}>{item.aliases}</Text>}
                    </View>
                    <Text style={styles.count}>{item.usageCount}</Text>
                  </Pressable>
                );
              })}
              {hasMore && (
                <Pressable disabled={disabled || loadingMore} onPress={loadMore} style={styles.moreButton}>
                  {loadingMore ? <ActivityIndicator color="#edeaff" /> : <Text style={styles.moreText}>LOAD NEXT {Math.min(PAGE_SIZE, Math.max(0, total - results.length))}</Text>}
                </Pressable>
              )}
            </ScrollView>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
        </>
      )}
    </View>
  );
}

type ChoiceProps = { label: string; active: boolean; disabled: boolean; onPress: () => void };
function Choice({ label, active, disabled, onPress }: ChoiceProps) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: "#242b37", backgroundColor: "#0c1016", borderRadius: 13, padding: 12, marginBottom: 18 },
  headerButton: { minHeight: 42, borderWidth: 1, borderColor: "#4a457e", backgroundColor: "#17152c", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerButtonActive: { borderColor: "#756be0", backgroundColor: "#24204c" },
  headerText: { color: "#edeaff", fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  search: { minHeight: 42, borderWidth: 1, borderColor: "#2a3240", backgroundColor: "#090d12", borderRadius: 9, color: "#f4f5f8", paddingHorizontal: 11, marginTop: 12 },
  categoryScroll: { marginTop: 9, maxHeight: 44 },
  categoryRow: { gap: 6, paddingRight: 8 },
  choice: { borderWidth: 1, borderColor: "#2a3240", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, justifyContent: "center" },
  choiceActive: { borderColor: "#756be0", backgroundColor: "#24204c" },
  choiceText: { color: "#9fa7b3", fontSize: 10, fontWeight: "700" },
  choiceTextActive: { color: "#f1efff" },
  summary: { color: "#737c8b", fontSize: 10, lineHeight: 15, marginTop: 9 },
  loading: { marginTop: 16 },
  resultsScroll: { maxHeight: 420, marginTop: 10 },
  results: { gap: 6, paddingBottom: 8 },
  resultRow: { borderWidth: 1, borderColor: "#2d3542", backgroundColor: "#11161d", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 8 },
  resultRowActive: { borderColor: "#5d9d7b", backgroundColor: "#14251d" },
  resultTextBlock: { flex: 1 },
  resultText: { color: "#c3c9d2", fontSize: 11, fontWeight: "700" },
  resultTextActive: { color: "#dbffea" },
  aliases: { color: "#626b79", fontSize: 9, marginTop: 2 },
  count: { color: "#68717e", fontSize: 9 },
  moreButton: { minHeight: 42, borderWidth: 1, borderColor: "#4a457e", borderRadius: 9, alignItems: "center", justifyContent: "center", marginTop: 4 },
  moreText: { color: "#edeaff", fontSize: 10, fontWeight: "900" },
  error: { color: "#ef8c98", fontSize: 11, marginTop: 10 },
});
