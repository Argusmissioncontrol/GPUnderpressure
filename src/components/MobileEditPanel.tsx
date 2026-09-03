import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  loadEditWorkflows,
  submitEditGeneration,
  uploadEditReference,
  type EditWorkflowDefinition,
} from "../api/editClient";
import {
  RemoteApiError,
} from "../api/realClient";


type RunState =
  | "idle"
  | "submitting"
  | "queued"
  | "running"
  | "success"
  | "error";


type Props = {
  visible: boolean;
  disabled: boolean;
  runState: RunState;
  status: string;
  onRunState: (state: RunState) => void;
  onStatus: (status: string) => void;
  onRouteName: (name: string) => void;
  onResult: (uri: string) => void;
};


function friendlyError(error: unknown): string {
  if (error instanceof RemoteApiError) {
    if (error.status === 429) {
      return "Remote queue is busy. Let the active host job finish, then try again.";
    }
    if (error.status === 403) {
      return "Tailscale identity was rejected. Check Tailscale on both devices.";
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Klein edit failed for an unknown reason.";
}


export function MobileEditPanel({
  visible,
  disabled,
  runState,
  status,
  onRunState,
  onStatus,
  onRouteName,
  onResult,
}: Props) {
  const [workflows, setWorkflows] = useState<EditWorkflowDefinition[]>([]);
  const [modelKey, setModelKey] = useState("klein_9b");
  const [steps, setSteps] = useState("4");
  const [cfg, setCfg] = useState("1.0");
  const [prompt, setPrompt] = useState("");
  const [seedMode, setSeedMode] = useState<"random" | "fixed">("random");
  const [seed, setSeed] = useState("");
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const workflow = useMemo(
    () => workflows.find((item) => item.modelKey === modelKey) ?? workflows[0] ?? null,
    [workflows, modelKey]
  );

  useEffect(() => {
    if (!visible || workflows.length > 0) {
      return;
    }
    let disposed = false;
    loadEditWorkflows()
      .then((items) => {
        if (disposed) {
          return;
        }
        setWorkflows(items);
        const preferred =
          items.find((item) => item.modelKey === "klein_9b") ?? items[0];
        if (preferred) {
          setModelKey(preferred.modelKey);
          setSteps(String(preferred.defaults.steps));
          setCfg(String(preferred.defaults.cfg));
          onRouteName(preferred.name);
          onStatus(`Ready. ${preferred.name}.`);
        }
      })
      .catch((error) => {
        if (!disposed) {
          onRunState("error");
          onStatus(friendlyError(error));
        }
      });
    return () => {
      disposed = true;
    };
  }, [visible, workflows.length, onRouteName, onRunState, onStatus]);

  if (!visible) {
    return null;
  }

  const requestInFlight =
    disabled ||
    runState === "submitting" ||
    runState === "queued" ||
    runState === "running";

  const selectWorkflow = (next: EditWorkflowDefinition) => {
    setModelKey(next.modelKey);
    setSteps(String(next.defaults.steps));
    setCfg(String(next.defaults.cfg));
    onRouteName(next.name);
    onStatus(`Ready. ${next.name}.`);
  };

  const pickReference = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onRunState("error");
      onStatus("Photo permission is required to choose an edit source.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
      selectionLimit: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setAsset(result.assets[0]);
      onRunState("idle");
      onStatus("Reference selected. Describe the change you want.");
    }
  };

  const runEdit = async () => {
    if (requestInFlight) {
      return;
    }
    const cleanPrompt = prompt.trim();
    if (!asset) {
      onRunState("error");
      onStatus("Choose a source image first.");
      return;
    }
    if (!cleanPrompt) {
      onRunState("error");
      onStatus("Describe the edit first.");
      return;
    }

    const stepValue = Number(steps);
    const cfgValue = Number(cfg);
    if (!Number.isInteger(stepValue) || stepValue < 1 || stepValue > 50) {
      onRunState("error");
      onStatus("Steps must be a whole number from 1 to 50.");
      return;
    }
    if (!Number.isFinite(cfgValue) || cfgValue < 0 || cfgValue > 10) {
      onRunState("error");
      onStatus("CFG must be a number from 0 to 10.");
      return;
    }

    const cleanSeed = seed.trim();
    if (seedMode === "fixed" && !/^\d+$/.test(cleanSeed)) {
      onRunState("error");
      onStatus("Fixed seed must be a non-negative whole number.");
      return;
    }

    try {
      onRunState("submitting");
      onStatus("Uploading source image to Local Gen Studio...");

      const fileName = asset.fileName ?? `edit-source-${Date.now()}.jpg`;
      const mimeType =
        asset.mimeType ??
        (fileName.toLowerCase().endsWith(".png")
          ? "image/png"
          : fileName.toLowerCase().endsWith(".webp")
            ? "image/webp"
            : "image/jpeg");

      const referenceId = await uploadEditReference(
        asset.uri,
        mimeType,
        fileName
      );

      const result = await submitEditGeneration(
        {
          requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          prompt: cleanPrompt,
          modelKey: workflow?.modelKey ?? modelKey,
          referenceId,
          seed: seedMode === "random" ? "-1" : cleanSeed,
          steps: stepValue,
          cfg: cfgValue,
        },
        (phase) => {
          onRunState(phase);
          if (phase === "submitting") {
            onStatus("Submitting Klein edit to Local Gen Studio...");
          } else if (phase === "queued") {
            onStatus("Edit accepted. Waiting for the host queue.");
          } else {
            onStatus("Klein edit is running on the home GPU.");
          }
        }
      );

      if (result.resultUrl) {
        onResult(result.resultUrl);
      }
      onRunState("success");
      onStatus("Klein edit complete.");
    } catch (error) {
      console.error("GPUnder Pressure edit failed:", error);
      onRunState("error");
      onStatus(friendlyError(error));
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>KLEIN EDIT</Text>
      <Text style={styles.title}>Edit an image on the home GPU</Text>
      <Text style={styles.intro}>
        Pick one source image, choose Klein 9B or 4B, tune Steps and CFG, then send the edit through LGS.
      </Text>

      <Text style={styles.label}>Source image</Text>
      <Pressable
        disabled={requestInFlight}
        onPress={pickReference}
        style={styles.sourceButton}
      >
        <Text style={styles.sourceButtonText}>
          {asset ? "CHANGE SOURCE IMAGE" : "CHOOSE SOURCE IMAGE"}
        </Text>
      </Pressable>

      {asset && (
        <Image
          source={{ uri: asset.uri }}
          style={styles.preview}
          resizeMode="contain"
        />
      )}

      <Text style={styles.label}>Model</Text>
      <View style={styles.wrapRow}>
        {workflows.map((item) => {
          const selected = item.modelKey === (workflow?.modelKey ?? modelKey);
          return (
            <Pressable
              key={item.modelKey}
              disabled={requestInFlight}
              onPress={() => selectWorkflow(item)}
              style={[
                styles.choice,
                selected && styles.choiceActive,
              ]}
            >
              <Text style={[
                styles.choiceText,
                selected && styles.choiceTextActive,
              ]}>
                {item.modelKey === "klein_9b" ? "Klein 9B" : "Klein 4B"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.tuningRow}>
        <View style={styles.field}>
          <Text style={styles.label}>Steps</Text>
          <TextInput
            style={styles.input}
            editable={!requestInFlight}
            value={steps}
            onChangeText={setSteps}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>CFG</Text>
          <TextInput
            style={styles.input}
            editable={!requestInFlight}
            value={cfg}
            onChangeText={setCfg}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <Text style={styles.label}>Edit instruction</Text>
      <TextInput
        style={styles.prompt}
        editable={!requestInFlight}
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Describe what should change..."
        placeholderTextColor="#626a78"
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.label}>Seed</Text>
      <View style={styles.wrapRow}>
        {(["random", "fixed"] as const).map((mode) => {
          const selected = seedMode === mode;
          return (
            <Pressable
              key={mode}
              disabled={requestInFlight}
              onPress={() => setSeedMode(mode)}
              style={[
                styles.choice,
                selected && styles.choiceActive,
              ]}
            >
              <Text style={[
                styles.choiceText,
                selected && styles.choiceTextActive,
              ]}>
                {mode === "random" ? "Random" : "Fixed"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {seedMode === "fixed" && (
        <TextInput
          style={[styles.input, styles.seedInput]}
          editable={!requestInFlight}
          value={seed}
          onChangeText={setSeed}
          keyboardType="number-pad"
          placeholder="Enter seed"
          placeholderTextColor="#626a78"
        />
      )}

      <Pressable
        disabled={requestInFlight}
        onPress={runEdit}
        style={[
          styles.runButton,
          requestInFlight && styles.runButtonDisabled,
        ]}
      >
        {requestInFlight && (
          <ActivityIndicator color="#ffffff" size="small" />
        )}
        <Text style={styles.runButtonText}>
          {requestInFlight ? "EDITING" : "RUN KLEIN EDIT"}
        </Text>
      </Pressable>

      <View style={[
        styles.statusPanel,
        runState === "error" && styles.statusError,
        runState === "success" && styles.statusSuccess,
      ]}>
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  card: {
    backgroundColor: "#11141a",
    borderWidth: 1,
    borderColor: "#262d38",
    borderRadius: 18,
    padding: 17,
    marginBottom: 14,
  },
  eyebrow: {
    color: "#7c70d9",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    color: "#f4f5f8",
    fontSize: 19,
    fontWeight: "800",
    marginTop: 6,
  },
  intro: {
    color: "#767e8b",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 18,
  },
  label: {
    color: "#d2d6dd",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 7,
    marginTop: 12,
  },
  sourceButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#7368e8",
    backgroundColor: "#24204c",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceButtonText: {
    color: "#f1efff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  preview: {
    width: "100%",
    height: 240,
    borderRadius: 12,
    backgroundColor: "#090b0f",
    marginTop: 12,
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choice: {
    borderWidth: 1,
    borderColor: "#2a3240",
    backgroundColor: "#11161d",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
  tuningRow: {
    flexDirection: "row",
    gap: 10,
  },
  field: {
    flex: 1,
  },
  input: {
    minHeight: 42,
    backgroundColor: "#0b0e13",
    borderWidth: 1,
    borderColor: "#292f3b",
    borderRadius: 10,
    color: "#f4f5f8",
    paddingHorizontal: 12,
    fontSize: 14,
  },
  prompt: {
    minHeight: 120,
    backgroundColor: "#0b0e13",
    borderWidth: 1,
    borderColor: "#292f3b",
    borderRadius: 12,
    color: "#f4f5f8",
    padding: 13,
    fontSize: 14,
    lineHeight: 20,
  },
  seedInput: {
    marginTop: 9,
  },
  runButton: {
    minHeight: 50,
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: "#675ce0",
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  runButtonDisabled: {
    opacity: 0.65,
  },
  runButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  statusPanel: {
    marginTop: 12,
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2b3240",
    backgroundColor: "#0d1117",
  },
  statusError: {
    borderColor: "#7d3943",
    backgroundColor: "#241116",
  },
  statusSuccess: {
    borderColor: "#335f4a",
    backgroundColor: "#102019",
  },
  statusText: {
    color: "#c8ced8",
    fontSize: 11,
    lineHeight: 16,
  },
});
