import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type {
  WorkflowDefinition,
  WorkflowTuning,
} from "../api/types";


type Props = {
  workflows: WorkflowDefinition[];
  workflow: WorkflowDefinition | null;
  value: WorkflowTuning | null;
  disabled?: boolean;
  onSelectWorkflow: (workflow: WorkflowDefinition) => void;
  onChange: (next: WorkflowTuning) => void;
};


export function WorkflowControls({
  workflows,
  workflow,
  value,
  disabled = false,
  onSelectWorkflow,
  onChange,
}: Props) {
  if (!workflow || !value) {
    return (
      <View style={styles.panel}>
        <Text style={styles.muted}>
          Loading Local Gen Studio workflows...
        </Text>
      </View>
    );
  }

  const patch = (
    update: Partial<WorkflowTuning>
  ) => {
    onChange({
      ...value,
      ...update,
    });
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.eyebrow}>
        WORKFLOW
      </Text>

      <View style={styles.wrapRow}>
        {workflows.map((item) => {
          const active = item.modelKey === value.modelKey;
          return (
            <Pressable
              key={item.modelKey}
              disabled={disabled}
              onPress={() => onSelectWorkflow(item)}
              style={[
                styles.choice,
                active && styles.choiceActive,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  active && styles.choiceTextActive,
                ]}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.description}>
        {workflow.description}
      </Text>

      {workflow.promptModes.length > 1 && (
        <>
          <Text style={styles.label}>Prompt mode</Text>
          <View style={styles.wrapRow}>
            {workflow.promptModes.map((mode) => {
              const active = mode === value.promptMode;
              return (
                <Pressable
                  key={mode}
                  disabled={disabled}
                  onPress={() => patch({ promptMode: mode })}
                  style={[
                    styles.choice,
                    active && styles.choiceActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      active && styles.choiceTextActive,
                    ]}
                  >
                    {mode === "wildcard" ? "Wildcard" : "Normal"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.grid}>
        <Field
          label="Batch"
          value={value.batchSize}
          onChangeText={(text) => patch({ batchSize: text })}
          keyboardType="number-pad"
          disabled={disabled}
        />
        <Field
          label="Steps"
          value={value.steps}
          onChangeText={(text) => patch({ steps: text })}
          keyboardType="number-pad"
          disabled={disabled}
        />
        <Field
          label="CFG"
          value={value.cfg}
          onChangeText={(text) => patch({ cfg: text })}
          keyboardType="decimal-pad"
          disabled={disabled}
        />
        <Field
          label="Sampler"
          value={value.sampler}
          onChangeText={(text) => patch({ sampler: text })}
          disabled={disabled}
        />
        {workflow.defaults.scheduler !== null && (
          <Field
            label="Scheduler"
            value={value.scheduler}
            onChangeText={(text) => patch({ scheduler: text })}
            disabled={disabled}
          />
        )}
        {workflow.capabilities.characterLora && (
          <Field
            label="Character LoRA"
            value={value.characterLoraStrength}
            onChangeText={(text) => patch({ characterLoraStrength: text })}
            keyboardType="decimal-pad"
            disabled={disabled}
          />
        )}
        {workflow.capabilities.mysticLora && (
          <Field
            label="Mystic LoRA"
            value={value.mysticLoraStrength}
            onChangeText={(text) => patch({ mysticLoraStrength: text })}
            keyboardType="decimal-pad"
            disabled={disabled}
          />
        )}
      </View>

      {workflow.capabilities.negativePrompt && (
        <>
          <Text style={styles.label}>Negative prompt</Text>
          <TextInput
            style={styles.wideInput}
            value={value.negativePrompt}
            editable={!disabled}
            onChangeText={(text) => patch({ negativePrompt: text })}
            placeholder="Optional negative guidance"
            placeholderTextColor="#626a78"
            multiline
          />
        </>
      )}
    </View>
  );
}


type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
  disabled?: boolean;
};


function Field({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  disabled = false,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        editable={!disabled}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor="#626a78"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
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
  eyebrow: {
    color: "#756be0",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  muted: {
    color: "#737c8b",
    fontSize: 12,
  },
  description: {
    color: "#777f8d",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    marginBottom: 10,
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  choice: {
    borderWidth: 1,
    borderColor: "#2a3240",
    backgroundColor: "#11161d",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  choiceActive: {
    borderColor: "#7368e8",
    backgroundColor: "#24204c",
  },
  choiceText: {
    color: "#a8afba",
    fontSize: 11,
    fontWeight: "700",
  },
  choiceTextActive: {
    color: "#f1efff",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 11,
  },
  field: {
    minWidth: 96,
    flexGrow: 1,
    flexBasis: "30%",
  },
  label: {
    color: "#cdd2db",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 5,
    marginTop: 8,
  },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#2a3240",
    backgroundColor: "#0a0d12",
    borderRadius: 9,
    color: "#f4f5f8",
    paddingHorizontal: 10,
    fontSize: 12,
  },
  wideInput: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: "#2a3240",
    backgroundColor: "#0a0d12",
    borderRadius: 9,
    color: "#f4f5f8",
    padding: 10,
    fontSize: 12,
    textAlignVertical: "top",
  },
});
