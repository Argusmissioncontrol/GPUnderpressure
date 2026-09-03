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
  searchAnimaTags,
  type AnimaTagResult,
} from "../api/animaTagClient";

type Props = {
  prompt: string;
  disabled?: boolean;
  onChangePrompt: (prompt: string) => void;
};

function promptTags(prompt: string): string[] {
  return prompt
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AnimaTagCompendium({
  prompt,
  disabled = false,
  onChangePrompt,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [results, setResults] = useState<AnimaTagResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(() => new Set(promptTags(prompt)), [prompt]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let disposed = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      searchAnimaTags(query, category)
        .then((payload) => {
          if (disposed) {
            return;
          }
          setCategories(payload.categories);
          setResults(payload.results);
        })
        .catch((reason) => {
          if (!disposed) {
            setError(reason instanceof Error ? reason.message : "Tag search failed.");
          }
        })
        .finally(() => {
          if (!disposed) {
            setLoading(false);
          }
        });
    }, 180);

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [open, query, category]);

  const toggleTag = (tag: string) => {
    const tags = promptTags(prompt);
    const exists = tags.includes(tag);
    const next = exists
      ? tags.filter((item) => item !== tag)
      : [...tags, tag];
    onChangePrompt(next.join(", "));
  };

  return (
    <View style={styles.panel}>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen((value) => !value)}
        style={[styles.headerButton, open && styles.headerButtonActive]}
      >
        <Text style={styles.headerText}>
          {open ? "CLOSE TAG COMPENDIUM" : "ANIMA TAG COMPENDIUM"}
        </Text>
      </Pressable>

      {open && (
        <>
          <TextInput
            editable={!disabled}
            value={query}
            onChangeText={setQuery}
            placeholder="Search Danbooru tags..."
            placeholderTextColor="#626a78"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.search}
          />

          <View style={styles.wrapRow}>
            <TagChoice
              label="All"
              active={category === null}
              disabled={disabled}
              onPress={() => setCategory(null)}
            />
            {categories.map((item) => (
              <TagChoice
                key={item}
                label={item}
                active={category === item}
                disabled={disabled}
                onPress={() => setCategory(item)}
              />
            ))}
          </View>

          {loading && <ActivityIndicator color="#756be0" style={styles.loading} />}
          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.results}>
            {results.map((item) => {
              const active = selected.has(item.tag);
              return (
                <Pressable
                  key={item.tag}
                  disabled={disabled}
                  onPress={() => toggleTag(item.tag)}
                  style={[styles.resultChip, active && styles.resultChipActive]}
                >
                  <Text style={[styles.resultText, active && styles.resultTextActive]}>
                    {item.tag.replace(/_/g, " ")}
                  </Text>
                  <Text style={styles.count}>{item.usageCount}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

type TagChoiceProps = {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
};

function TagChoice({ label, active, disabled, onPress }: TagChoiceProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, active && styles.choiceActive]}
    >
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: "#242b37",
    backgroundColor: "#0c1016",
    borderRadius: 13,
    padding: 12,
    marginBottom: 18,
  },
  headerButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#4a457e",
    backgroundColor: "#17152c",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonActive: {
    borderColor: "#756be0",
    backgroundColor: "#24204c",
  },
  headerText: {
    color: "#edeaff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  search: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#2a3240",
    backgroundColor: "#090d12",
    borderRadius: 9,
    color: "#f4f5f8",
    paddingHorizontal: 11,
    marginTop: 12,
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 9,
  },
  choice: {
    borderWidth: 1,
    borderColor: "#2a3240",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  choiceActive: {
    borderColor: "#756be0",
    backgroundColor: "#24204c",
  },
  choiceText: { color: "#9fa7b3", fontSize: 10, fontWeight: "700" },
  choiceTextActive: { color: "#f1efff" },
  loading: { marginTop: 12 },
  error: { color: "#ef8c98", fontSize: 11, marginTop: 10 },
  results: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },
  resultChip: {
    borderWidth: 1,
    borderColor: "#2d3542",
    backgroundColor: "#11161d",
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  resultChipActive: {
    borderColor: "#5d9d7b",
    backgroundColor: "#14251d",
  },
  resultText: { color: "#c3c9d2", fontSize: 10, fontWeight: "700" },
  resultTextActive: { color: "#dbffea" },
  count: { color: "#68717e", fontSize: 9 },
});
