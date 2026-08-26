import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library/legacy";

import {
  ASPECT_RATIOS,
  type AspectRatio,
  type GenerationMode,
} from "./src/api/types";
import { realGenerationClient } from "./src/api/realClient";

import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";



export default function App() {
  const [mode, setMode] =
    useState<GenerationMode>("image");

  const [prompt, setPrompt] =
    useState("");

  const [aspectRatio, setAspectRatio] =
    useState<AspectRatio>("1:1");

  const [seed, setSeed] =
    useState("-1");

  const [referenceUri, setReferenceUri] =
    useState<string | null>(null);

  const [resultUri, setResultUri] =
    useState<string | null>(null);
  const [saveState, setSaveState] =
    useState<"idle" | "saving" | "saved">("idle");

  const [status, setStatus] =
    useState("Ready");

  const [requestInFlight, setRequestInFlight] =
    useState(false);

  const usingReference =
    mode === "reference";

  function changeMode(reference: boolean) {
    setMode(
      reference
        ? "reference"
        : "image"
    );

    setStatus(
      reference
        ? "Reference image mode"
        : "Image mode"
    );
  }

  async function chooseReferenceImage() {
    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

    if (result.canceled) {
      return;
    }

    setReferenceUri(
      result.assets[0].uri
    );

    setStatus(
      "Reference image selected ✓"
    );
  }
  async function saveResultImage() {
    if (!resultUri) {
      return;
    }
    if (saveState === "saving") {
      return;
    }

    setSaveState("saving");
    try {
      setStatus("Saving image...");

      const permission =
        await MediaLibrary.requestPermissionsAsync();

      if (!permission.granted) {
        setStatus("Photo permission denied.");
        setSaveState("idle");
        return;
      }

      if (!FileSystem.cacheDirectory) {
        throw new Error(
          "Temporary storage is unavailable."
        );
      }

      const destination =
        `${FileSystem.cacheDirectory}` +
        `gpunder-pressure-${Date.now()}.png`;

      const download =
        await FileSystem.downloadAsync(
          resultUri,
          destination
        );

      await MediaLibrary.saveToLibraryAsync(
        download.uri
      );

      setStatus("Saved to gallery ✓");
      setSaveState("saved");
    } catch (error) {
      console.error(
        "GPUnder Pressure save failed:",
        error
      );

      setStatus("Could not save image.");
      setSaveState("idle");
    }
  }

  async function handleGenerate() {
    if (requestInFlight) {
      return;
    }

    if (!prompt.trim()) {
      setStatus(
        "Enter a prompt first."
      );
      return;
    }

    if (
      usingReference &&
      !referenceUri
    ) {
      setStatus(
        "Reference Image mode requires an image."
      );
      return;
    }

    const request = {
      requestId:
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,

      generationType: mode,

      prompt:
        prompt.trim(),

      aspectRatio,

      seed:
        seed.trim() || "-1",

      referenceUri:
        usingReference
          ? referenceUri
          : null,
    };

    console.log(
      "GPUnder Pressure request:",
      request
    );

    setRequestInFlight(true);

   setStatus("Generating...");

    try {
      const result =
        await realGenerationClient.submit(request);

      console.log(
        "GPUnder Pressure result:",
        result
      );

      if (result.resultUrl) {
        setResultUri(result.resultUrl);
        setSaveState("idle");
      }

      setStatus("Ready");
    } catch (error) {
      console.error(
        "GPUnder Pressure generation failed:",
        error
      );

      setStatus("Generation failed.");
    } finally {
      setRequestInFlight(false);
    }
    }

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              GPUnder Pressure
            </Text>

            <Text style={styles.subtitle}>
              please be kind, my 3060 thanks you.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Image Generation
            </Text>

            <View style={styles.divider} />

            <Text style={styles.label}>
              Generation type
            </Text>

            <View style={styles.modeRow}>
              <Text
                style={[
                  styles.modeLabel,
                  !usingReference &&
                  styles.modeLabelActive,
                ]}
              >
                Image
              </Text>

              <Switch
                value={usingReference}
                onValueChange={changeMode}
              />

              <Text
                style={[
                  styles.modeLabel,
                  usingReference &&
                  styles.modeLabelActive,
                ]}
              >
                Reference
              </Text>
            </View>

            <Text style={styles.label}>
              Prompt
            </Text>

            <TextInput
              style={styles.promptInput}
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Describe what you want to generate..."
              placeholderTextColor="#717784"
              multiline
              textAlignVertical="top"
            />

            {usingReference && (
              <>
                <Text style={styles.label}>
                  Reference image
                </Text>

                <Pressable
                  style={styles.referenceBox}
                  onPress={
                    chooseReferenceImage
                  }
                >
                  {referenceUri ? (
                    <Image
                      source={{
                        uri: referenceUri,
                      }}
                      style={
                        styles.referenceImage
                      }
                      resizeMode="contain"
                    />
                  ) : (
                    <View
                      style={
                        styles.referenceEmpty
                      }
                    >
                      <Text
                        style={
                          styles.referenceTitle
                        }
                      >
                        Choose reference image
                      </Text>

                      <Text
                        style={
                          styles.referenceHint
                        }
                      >
                        Tap to select from your phone
                      </Text>
                    </View>
                  )}
                </Pressable>
              </>
            )}

            <Text style={styles.label}>
              Aspect ratio
            </Text>

            <View style={styles.ratioGrid}>
              {ASPECT_RATIOS.map(
                (ratio) => {
                  const selected =
                    ratio === aspectRatio;

                  return (
                    <Pressable
                      key={ratio}
                      onPress={() =>
                        setAspectRatio(
                          ratio
                        )
                      }
                      style={[
                        styles.ratioButton,
                        selected &&
                        styles.ratioButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ratioText,
                          selected &&
                          styles.ratioTextActive,
                        ]}
                      >
                        {ratio}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>

            <View style={styles.seedHeader}>
              <Text style={styles.label}>
                Seed
              </Text>

              <Text style={styles.hint}>
                -1 = random
              </Text>
            </View>

            <TextInput
              style={styles.seedInput}
              value={seed}
              onChangeText={setSeed}
              keyboardType="numbers-and-punctuation"
              placeholder="-1"
              placeholderTextColor="#717784"
            />

            <Pressable
              onPress={handleGenerate}
              disabled={requestInFlight}
              style={({ pressed }) => [
                styles.generateButton,

                requestInFlight &&
                styles.generateButtonDisabled,

                pressed &&
                !requestInFlight &&
                styles.generateButtonPressed,
              ]}
            >
              <Text
                style={
                  styles.generateButtonText
                }
              >
                {requestInFlight
                  ? "Queued..."
                  : "Generate"}
              </Text>
            </Pressable>

            <Text style={styles.status}>
              {status}
            </Text>
          </View>

          <View style={styles.outputCard}>
            <Text style={styles.sectionTitle}>
              Output
            </Text>

            <View style={styles.divider} />

            <View style={styles.output}>
              {resultUri ? (
                <>
                  <Image
                    source={{ uri: resultUri }}
                    style={{
                      width: "100%",
                      height: 320,
                      borderRadius: 10,
                    }}
                    resizeMode="contain"
                  />

                  <View
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    <Pressable
                      onPress={saveResultImage}
                      disabled={saveState === "saving"}
                      style={[
                        styles.generateButton,
                        { flex: 1 },
                        saveState === "saving" &&
                        styles.generateButtonDisabled,
                      ]}
                    >
                      <Text style={styles.generateButtonText}>
                        {saveState === "saving"
                          ? "Saving..."
                          : saveState === "saved"
                            ? "Saved ✓"
                            : "Save to Gallery"}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setResultUri(null);
                        setSaveState("idle");
                        setStatus("Output cleared.");
                      }}
                      style={[
                        styles.generateButton,
                        { flex: 1 },
                      ]}
                    >
                      <Text style={styles.generateButtonText}>
                        Clear Output
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.outputSymbol}>
                    ◇
                  </Text>

                  <Text style={styles.outputTitle}>
                    No generation yet
                  </Text>

                  <Text style={styles.outputHint}>
                    Your image will appear here.
                  </Text>
                </>
              )}
            </View>
          </View>

          <Text style={styles.safetyNote}>
            GPU-heavy settings are controlled
            by the host.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: "#090b0f",
    },

    scroll: {
      flex: 1,
    },

    content: {
      padding: 18,
      paddingBottom: 40,
    },

    header: {
      marginBottom: 22,
    },

    title: {
      color: "#f5f6f8",
      fontSize: 26,
      fontWeight: "800",
    },

    subtitle: {
      color: "#868d99",
      marginTop: 4,
      fontSize: 13,
    },

    card: {
      backgroundColor: "#12151b",
      borderWidth: 1,
      borderColor: "#292f3a",
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
    },

    outputCard: {
      backgroundColor: "#12151b",
      borderWidth: 1,
      borderColor: "#292f3a",
      borderRadius: 16,
      padding: 18,
    },

    sectionTitle: {
      color: "#f5f6f8",
      fontSize: 15,
      fontWeight: "700",
    },

    divider: {
      height: 1,
      backgroundColor: "#292f3a",
      marginTop: 14,
      marginBottom: 18,
    },

    label: {
      color: "#cdd3dc",
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 8,
    },

    modeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      marginBottom: 22,
    },

    modeLabel: {
      color: "#737b88",
      fontSize: 13,
      fontWeight: "700",
    },

    modeLabelActive: {
      color: "#f5f6f8",
    },

    promptInput: {
      minHeight: 130,
      backgroundColor: "#0d1015",
      borderWidth: 1,
      borderColor: "#292f3a",
      borderRadius: 10,
      color: "#f5f6f8",
      padding: 12,
      fontSize: 15,
      marginBottom: 20,
    },

    referenceBox: {
      minHeight: 150,
      backgroundColor: "#0d1015",
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: "#3a424f",
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 20,
      justifyContent: "center",
    },

    referenceEmpty: {
      alignItems: "center",
      padding: 20,
    },

    referenceTitle: {
      color: "#dfe3e8",
      fontWeight: "700",
      fontSize: 13,
    },

    referenceHint: {
      color: "#737b88",
      marginTop: 5,
      fontSize: 12,
    },

    referenceImage: {
      width: "100%",
      height: 220,
    },

    ratioGrid: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 22,
    },

    ratioButton: {
      flex: 1,
      minHeight: 43,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: "#292f3a",
      backgroundColor: "#171b22",
      alignItems: "center",
      justifyContent: "center",
    },

    ratioButtonActive: {
      borderColor: "#7c6cff",
      backgroundColor: "#26213e",
    },

    ratioText: {
      color: "#858d9a",
      fontWeight: "700",
      fontSize: 12,
    },

    ratioTextActive: {
      color: "#ffffff",
    },

    seedHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    hint: {
      color: "#737b88",
      fontSize: 11,
      marginBottom: 8,
    },

    seedInput: {
      height: 45,
      backgroundColor: "#0d1015",
      borderWidth: 1,
      borderColor: "#292f3a",
      borderRadius: 10,
      color: "#f5f6f8",
      paddingHorizontal: 12,
      fontSize: 15,
      marginBottom: 18,
    },

    generateButton: {
      height: 50,
      borderRadius: 10,
      backgroundColor: "#7c6cff",
      alignItems: "center",
      justifyContent: "center",
    },

    generateButtonPressed: {
      opacity: 0.85,
    },

    generateButtonDisabled: {
      opacity: 0.45,
    },

    generateButtonText: {
      color: "#ffffff",
      fontWeight: "800",
      fontSize: 15,
    },

    status: {
      color: "#858d9a",
      fontSize: 12,
      marginTop: 12,
      textAlign: "center",
    },

    output: {
      minHeight: 300,
      backgroundColor: "#0d1015",
      borderWidth: 1,
      borderColor: "#292f3a",
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },

    outputSymbol: {
      color: "#626b78",
      fontSize: 34,
      marginBottom: 12,
    },

    outputTitle: {
      color: "#cdd3dc",
      fontSize: 14,
      fontWeight: "700",
    },

    outputHint: {
      color: "#737b88",
      fontSize: 12,
      marginTop: 5,
    },

    safetyNote: {
      color: "#555d69",
      fontSize: 11,
      textAlign: "center",
      marginTop: 14,
    },
  });
