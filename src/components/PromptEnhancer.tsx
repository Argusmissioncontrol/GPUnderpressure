import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  composeEnhancedPrompt,
  fetchPromptEnhancerCatalog,
  searchPromptEnhancerTags,
  type PromptEnhancerCatalog,
  type PromptEnhancerGroup,
  type PromptTag,
} from "../api/promptEnhancerClient";

type Props = {
  modelKey: string;
  prompt: string;
  disabled?: boolean;
  onChangePrompt: (prompt: string) => void;
};

export function PromptEnhancer({ modelKey, prompt, disabled = false, onChangePrompt }: Props) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<PromptEnhancerCatalog | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [tagResults, setTagResults] = useState<PromptTag[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [presetIds, setPresetIds] = useState<string[]>([]);
  const [promptFormat, setPromptFormat] = useState("auto");
  const [formatOpen, setFormatOpen] = useState(false);
  const [preview, setPreview] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || catalog) return;
    setLoading(true);
    fetchPromptEnhancerCatalog()
      .then(setCatalog)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Prompt Enhancer failed."))
      .finally(() => setLoading(false));
  }, [open, catalog]);

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    const timer = setTimeout(() => {
      searchPromptEnhancerTags(query, category)
        .then((payload) => {
          if (disposed) return;
          setCategories(payload.categories);
          setTagResults(payload.results);
        })
        .catch((reason) => {
          if (!disposed) setError(reason instanceof Error ? reason.message : "Tag search failed.");
        });
    }, 180);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [open, query, category]);

  useEffect(() => {
    if (!open || !catalog) return;
    let disposed = false;
    const timer = setTimeout(() => {
      composeEnhancedPrompt({
        modelKey,
        freeformPrompt: prompt,
        promptFormat,
        tags,
        presetIds,
      })
        .then((result) => {
          if (disposed) return;
          setPreview(result.effectivePrompt);
          setSummary(result.promptFormatSummary);
          setError("");
        })
        .catch((reason) => {
          if (!disposed) setError(reason instanceof Error ? reason.message : "Prompt preview failed.");
        });
    }, 120);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [open, catalog, modelKey, prompt, promptFormat, tags, presetIds]);

  useEffect(() => {
    setTags([]);
    setPresetIds([]);
    setPreview("");
  }, [modelKey]);

  const selectedTags = useMemo(() => new Set(tags), [tags]);
  const selectedPresets = useMemo(() => new Set(presetIds), [presetIds]);

  const toggleTag = (tag: string) => {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };

  const togglePreset = (group: PromptEnhancerGroup, id: string) => {
    setPresetIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (!group.exclusive) return [...current, id];
      const groupIds = new Set(group.options.map((item) => item.id));
      return [...current.filter((item) => !groupIds.has(item)), id];
    });
  };

  return (
    <View style={styles.panel}>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen((value) => !value)}
        style={[styles.headerButton, open && styles.headerButtonActive]}
      >
        <Text style={styles.headerText}>{open ? "CLOSE PROMPT ENHANCER" : "PROMPT ENHANCER"}</Text>
      </Pressable>

      {open && (
        <>
          <Text style={styles.description}>
            Shared LGS tag catalog and quick controls. Your freeform prompt stays primary until you tap Use Enhanced Prompt.
          </Text>

          {loading && <ActivityIndicator color="#756be0" style={styles.loading} />}
          {!!error && <Text style={styles.error}>{error}</Text>}

          {catalog && (
            <>
              <Text style={styles.label}>Prompt format</Text>
              <Pressable
                disabled={disabled}
                onPress={() => setFormatOpen((value) => !value)}
                style={styles.dropdownButton}
              >
                <Text style={styles.dropdownValue}>
                  {catalog.promptFormats.find((item) => item.key === promptFormat)?.label ?? promptFormat}
                </Text>
                <Text style={styles.dropdownArrow}>{formatOpen ? "\u25B2" : "\u25BC"}</Text>
              </Pressable>
              {formatOpen && (
                <View style={styles.dropdownMenu}>
                  {catalog.promptFormats.map((item) => (
                    <Pressable
                      key={item.key}
                      onPress={() => {
                        setPromptFormat(item.key);
                        setFormatOpen(false);
                      }}
                      style={[styles.dropdownOption, item.key === promptFormat && styles.dropdownOptionActive]}
                    >
                      <Text style={styles.choiceText}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.sectionTitle}>Quick Controls</Text>
              {catalog.groups.map((group) => (
                <View key={group.key} style={styles.groupBlock}>
                  <Text style={styles.groupLabel}>{group.label}</Text>
                  <View style={styles.wrapRow}>
                    {group.options.map((option) => {
                      const active = selectedPresets.has(option.id);
                      return (
                        <Pressable
                          key={option.id}
                          disabled={disabled}
                          onPress={() => togglePreset(group, option.id)}
                          style={[styles.choice, active && styles.choiceActive]}
                        >
                          <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              <Text style={styles.sectionTitle}>Browse Tags</Text>
              <TextInput
                editable={!disabled}
                value={query}
                onChangeText={setQuery}
                placeholder="Search canonical tags..."
                placeholderTextColor="#626a78"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.search}
              />

              <View style={styles.wrapRow}>
                <Choice label="All" active={category === null} onPress={() => setCategory(null)} />
                {categories.map((item) => (
                  <Choice key={item} label={item} active={category === item} onPress={() => setCategory(item)} />
                ))}
              </View>

              <View style={styles.wrapRow}>
                {tagResults.map((item) => {
                  const active = selectedTags.has(item.tag);
                  return (
                    <Pressable
                      key={item.tag}
                      disabled={disabled}
                      onPress={() => toggleTag(item.tag)}
                      style={[styles.choice, active && styles.tagActive]}
                    >
                      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{item.tag.replace(/_/g, " ")}</Text>
                      <Text style={styles.count}>{item.usageCount}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>Effective Prompt Preview</Text>
              <Text style={styles.summary}>{summary}</Text>
              <Text style={styles.preview}>{preview || prompt || "Prompt is empty."}</Text>

              <View style={styles.actionRow}>
                <Pressable
                  disabled={disabled || !preview}
                  onPress={() => onChangePrompt(preview)}
                  style={[styles.applyButton, (disabled || !preview) && styles.disabledButton]}
                >
                  <Text style={styles.applyText}>USE ENHANCED PROMPT</Text>
                </Pressable>
                <Pressable
                  disabled={disabled}
                  onPress={() => {
                    setTags([]);
                    setPresetIds([]);
                    setPromptFormat("auto");
                  }}
                  style={styles.resetButton}
                >
                  <Text style={styles.resetText}>RESET MODIFIERS</Text>
                </Pressable>
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

type ChoiceProps = { label: string; active: boolean; onPress: () => void };
function Choice({ label, active, onPress }: ChoiceProps) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: "#242b37", backgroundColor: "#0c1016", borderRadius: 13, padding: 12, marginBottom: 18 },
  headerButton: { minHeight: 42, borderWidth: 1, borderColor: "#4a457e", backgroundColor: "#17152c", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerButtonActive: { borderColor: "#756be0", backgroundColor: "#24204c" },
  headerText: { color: "#edeaff", fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  description: { color: "#818999", fontSize: 11, lineHeight: 16, marginTop: 10 },
  loading: { marginTop: 12 },
  error: { color: "#ef8c98", fontSize: 11, marginTop: 10 },
  label: { color: "#cdd2db", fontSize: 10, fontWeight: "800", marginTop: 12, marginBottom: 5 },
  sectionTitle: { color: "#dfe3ea", fontSize: 11, fontWeight: "900", marginTop: 16, marginBottom: 8, letterSpacing: 0.4 },
  groupBlock: { marginBottom: 9 },
  groupLabel: { color: "#9da6b4", fontSize: 10, fontWeight: "800", marginBottom: 5 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 5 },
  choice: { borderWidth: 1, borderColor: "#2a3240", backgroundColor: "#11161d", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 5 },
  choiceActive: { borderColor: "#756be0", backgroundColor: "#24204c" },
  tagActive: { borderColor: "#5d9d7b", backgroundColor: "#14251d" },
  choiceText: { color: "#a8afba", fontSize: 10, fontWeight: "700" },
  choiceTextActive: { color: "#f1efff" },
  count: { color: "#68717e", fontSize: 9 },
  search: { minHeight: 42, borderWidth: 1, borderColor: "#2a3240", backgroundColor: "#090d12", borderRadius: 9, color: "#f4f5f8", paddingHorizontal: 11, marginBottom: 9 },
  dropdownButton: { minHeight: 42, borderWidth: 1, borderColor: "#2a3240", backgroundColor: "#0a0d12", borderRadius: 9, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dropdownValue: { color: "#f4f5f8", fontSize: 12, fontWeight: "700" },
  dropdownArrow: { color: "#8d86e8", fontSize: 10 },
  dropdownMenu: { marginTop: 5, borderWidth: 1, borderColor: "#2a3240", backgroundColor: "#0a0d12", borderRadius: 9, overflow: "hidden" },
  dropdownOption: { paddingHorizontal: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1c222c" },
  dropdownOptionActive: { backgroundColor: "#24204c" },
  summary: { color: "#8881dc", fontSize: 10, marginBottom: 6 },
  preview: { color: "#c7cdd7", fontSize: 11, lineHeight: 16, borderWidth: 1, borderColor: "#242b37", backgroundColor: "#090d12", borderRadius: 9, padding: 10 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  applyButton: { flex: 1, minHeight: 42, backgroundColor: "#5e55d6", borderRadius: 9, alignItems: "center", justifyContent: "center" },
  disabledButton: { opacity: 0.45 },
  applyText: { color: "#ffffff", fontSize: 10, fontWeight: "900" },
  resetButton: { minHeight: 42, paddingHorizontal: 11, borderWidth: 1, borderColor: "#303846", borderRadius: 9, alignItems: "center", justifyContent: "center" },
  resetText: { color: "#aeb5c0", fontSize: 9, fontWeight: "800" },
});
