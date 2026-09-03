import { StatusBar } from "expo-status-bar";

import React, {
  useEffect,
  useState,
} from "react";

import * as FileSystem
  from "expo-file-system/legacy";

import * as MediaLibrary
  from "expo-media-library/legacy";

import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  ASPECT_RATIOS,
  type AspectRatio,
  type GenerationRequest,
  type WorkflowDefinition,
  type WorkflowGenerationRequest,
  type WorkflowTuning,
} from "./src/api/types";

import {
  realGenerationClient,
  RemoteApiError,
} from "./src/api/realClient";
import {
  loadWorkflowCatalog,
  submitWorkflowGeneration,
} from "./src/api/workflowClient";
import {
  WorkflowControls,
} from "./src/components/WorkflowControls";
import {
  MobileEditPanel,
} from "./src/components/MobileEditPanel";
import {
  AnimaTagCompendium,
} from "./src/components/AnimaTagCompendium";

// LGS_MOBILE_STUDIO_V3


type RunState =
  | "idle"
  | "submitting"
  | "queued"
  | "running"
  | "success"
  | "error";


const RATIO_LABELS: Record<
  AspectRatio,
  string
> = {
  "1:1": "Square",
  "16:9": "Wide",
  "4:3": "Classic",
  "9:16": "Portrait",
};


function tuningForWorkflow(
  workflow: WorkflowDefinition
): WorkflowTuning {
  return {
    modelKey: workflow.modelKey,
    promptMode: workflow.promptModes[0] ?? "normal",
    batchSize: String(workflow.defaults.batchSize),
    steps: String(workflow.defaults.steps),
    cfg: String(workflow.defaults.cfg),
    sampler: workflow.defaults.sampler,
    scheduler: workflow.defaults.scheduler ?? "",
    negativePrompt: workflow.defaults.negativePrompt ?? "",
    mysticLoraStrength:
      workflow.defaults.mysticLoraStrength === null
        ? ""
        : String(workflow.defaults.mysticLoraStrength),
    characterLoraStrength:
      workflow.defaults.characterLoraStrength === null
        ? ""
        : String(workflow.defaults.characterLoraStrength),
  };
}



function friendlyGenerationError(
  error: unknown
): string {
  if (
    error instanceof RemoteApiError
  ) {
    if (error.status === 429) {
      return (
        "Remote queue is busy. Let the active host job finish, then try again."
      );
    }

    if (error.status === 403) {
      return (
        "Tailscale identity was rejected. Check Tailscale on both devices."
      );
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return (
    "Generation failed for an unknown reason."
  );
}


export default function App() {
  const [
    prompt,
    setPrompt,
  ] = useState("");

  const [
    mobileMode,
    setMobileMode,
  ] = useState<"generate" | "edit">("generate");

  const [
    editRouteName,
    setEditRouteName,
  ] = useState("Klein 9B â€” Reference Edit");

  const [
    aspectRatio,
    setAspectRatio,
  ] = useState<AspectRatio>("1:1");

  const [
    seedMode,
    setSeedMode,
  ] = useState<
    "random" | "fixed"
  >("random");

  const [
    seed,
    setSeed,
  ] = useState("");

  const [
    workflows,
    setWorkflows,
  ] = useState<WorkflowDefinition[]>([]);

  const [
    workflowTuning,
    setWorkflowTuning,
  ] = useState<WorkflowTuning | null>(null);


  const [
    resultUri,
    setResultUri,
  ] = useState<string | null>(
    null
  );

  const [
    saveState,
    setSaveState,
  ] = useState<
    "idle" | "saving" | "saved"
  >("idle");

  const [
    runState,
    setRunState,
  ] = useState<RunState>(
    "idle"
  );

  const [
    status,
    setStatus,
  ] = useState(
    "Ready. Host-controlled Z-Turbo route."
  );


  useEffect(() => {
    let disposed = false;

    loadWorkflowCatalog()
      .then((catalog) => {
        if (disposed) {
          return;
        }

        setWorkflows(catalog.workflows);

        const preferred =
          catalog.workflows.find(
            (item) => item.modelKey === "z_turbo"
          ) ?? catalog.workflows[0];

        if (preferred) {
          setWorkflowTuning(
            tuningForWorkflow(preferred)
          );
          setStatus(
            `Ready. ${preferred.name}.`
          );
        }
      })
      .catch((error) => {
        console.warn(
          "Workflow discovery unavailable; legacy route remains usable:",
          error
        );
      });

    return () => {
      disposed = true;
    };
  }, []);

  const selectedWorkflow =
    workflows.find(
      (item) =>
        item.modelKey === workflowTuning?.modelKey
    ) ?? null;

  const requestInFlight =
    runState === "submitting" ||
    runState === "queued" ||
    runState === "running";


  function setProgress(
    phase:
      | "submitting"
      | "queued"
      | "running"
  ) {
    setRunState(
      phase
    );

    if (
      phase === "submitting"
    ) {
      setStatus(
        "Contacting Local Gen Studio..."
      );
      return;
    }

    if (
      phase === "queued"
    ) {
      setStatus(
        "Accepted by LGS. Waiting for the host queue."
      );
      return;
    }

    setStatus(
      "Generation is running on the home GPU."
    );
  }


  async function saveResultImage() {
    if (
      !resultUri ||
      saveState === "saving"
    ) {
      return;
    }

    setSaveState(
      "saving"
    );

    try {
      setStatus(
        "Saving image..."
      );

      const permission =
        await MediaLibrary
          .requestPermissionsAsync();

      if (
        !permission.granted
      ) {
        setStatus(
          "Photo permission denied."
        );

        setSaveState(
          "idle"
        );

        return;
      }

      if (
        !FileSystem.cacheDirectory
      ) {
        throw new Error(
          "Temporary storage is unavailable."
        );
      }

      const destination =
        `${FileSystem.cacheDirectory}` +
        `gpunder-pressure-${Date.now()}.png`;

      const download =
        await FileSystem
          .downloadAsync(
            resultUri,
            destination
          );

      await MediaLibrary
        .saveToLibraryAsync(
          download.uri
        );

      setStatus(
        "Saved to gallery."
      );

      setSaveState(
        "saved"
      );
    } catch (error) {
      console.error(
        "GPUnder Pressure save failed:",
        error
      );

      setStatus(
        "Could not save image."
      );

      setSaveState(
        "idle"
      );
    }
  }


  async function handleGenerate() {
    if (
      requestInFlight
    ) {
      return;
    }

    const cleanPrompt =
      prompt.trim();

    if (
      !cleanPrompt &&
      workflowTuning?.promptMode !== "wildcard"
    ) {
      setRunState(
        "error"
      );

      setStatus(
        "Enter a prompt first."
      );

      return;
    }

    const cleanSeed =
      seed.trim();

    if (
      seedMode === "fixed" &&
      !/^\d+$/.test(
        cleanSeed
      )
    ) {
      setRunState(
        "error"
      );

      setStatus(
        "Fixed seed must be a non-negative whole number."
      );

      return;
    }

    const requestId =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

    const seedValue =
      seedMode === "random"
        ? "-1"
        : cleanSeed;

    const request: GenerationRequest = {
      requestId,
      generationType: "image",
      prompt: cleanPrompt,
      aspectRatio,
      seed: seedValue,
      referenceUri: null,
    };

    let workflowRequest:
      WorkflowGenerationRequest | null = null;

    if (
      selectedWorkflow &&
      workflowTuning
    ) {
      const batchSize = Number(workflowTuning.batchSize);
      const steps = Number(workflowTuning.steps);
      const cfg = Number(workflowTuning.cfg);

      if (
        !Number.isInteger(batchSize) ||
        !Number.isInteger(steps) ||
        !Number.isFinite(cfg)
      ) {
        setRunState("error");
        setStatus(
          "Batch and Steps must be whole numbers; CFG must be numeric."
        );
        return;
      }

      workflowRequest = {
        requestId,
        generationType: "image",
        modelKey: workflowTuning.modelKey,
        promptMode: workflowTuning.promptMode,
        prompt: cleanPrompt,
        aspectRatio,
        seed: seedValue,
        batchSize,
        steps,
        cfg,
        sampler: workflowTuning.sampler.trim(),
        scheduler:
          selectedWorkflow.defaults.scheduler === null
            ? null
            : workflowTuning.scheduler.trim(),
        referenceUri: null,
      };

      if (selectedWorkflow.capabilities.negativePrompt) {
        workflowRequest.negativePrompt =
          workflowTuning.negativePrompt;
      }

      if (selectedWorkflow.capabilities.mysticLora) {
        workflowRequest.mysticLoraStrength =
          Number(workflowTuning.mysticLoraStrength);
      }

      if (selectedWorkflow.capabilities.characterLora) {
        workflowRequest.characterLoraStrength =
          Number(workflowTuning.characterLoraStrength);
      }
    }

    console.log(
      "GPUnder Pressure request:",
      request
    );

    setRunState(
      "submitting"
    );

    setStatus(
      "Contacting Local Gen Studio..."
    );

    try {
      const result = workflowRequest
        ? await submitWorkflowGeneration(
            workflowRequest,
            setProgress
          )
        : await realGenerationClient.submit(
            request,
            setProgress
          );

      if (
        result.resultUrl
      ) {
        setResultUri(
          result.resultUrl
        );

        setSaveState(
          "idle"
        );
      }

      setRunState(
        "success"
      );

      setStatus(
        "Generation complete."
      );
    } catch (error) {
      console.error(
        "GPUnder Pressure generation failed:",
        error
      );

      setRunState(
        "error"
      );

      setStatus(
        friendlyGenerationError(
          error
        )
      );
    }
  }


  const statusHint =
    runState === "submitting"
      ? "Sending the request over Tailscale."
      : runState === "queued"
        ? "The host accepted it. ComfyUI still owns execution order."
        : runState === "running"
          ? "The host reports an active generation job."
          : runState === "success"
            ? "The result returned from Local Gen Studio."
            : runState === "error"
              ? "This is the actual client/API failure."
              : "Workflow controls mirror Local Gen Studio's loaded recipes.";


  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <StatusBar
        style="light"
      />

      <ScrollView
        style={
          styles.scroll
        }
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={
            styles.header
          }
        >
          <View
            style={
              styles.headerTop
            }
          >
            <View>
              <Text
                style={
                  styles.title
                }
              >
                GPUnder Pressure
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                please be kind, my 3060 thanks you.
              </Text>
            </View>

            <View
              style={
                styles.routeBadge
              }
            >
              <View
                style={
                  styles.routeDot
                }
              />

              <Text
                style={
                  styles.routeText
                }
              >
                REMOTE
              </Text>
            </View>
          </View>

          <View
            style={
              styles.engineBar
            }
          >
            <Text
              style={
                styles.engineEyebrow
              }
            >
              ACTIVE ROUTE
            </Text>

            <Text
              style={
                styles.engineName
              }
            >
              {mobileMode === "edit"
                ? editRouteName
                : selectedWorkflow?.name ?? "Z-Turbo"}
            </Text>

            <Text
              style={
                styles.engineMeta
              }
            >
              {mobileMode === "edit"
                ? "Reference edit"
                : workflowTuning
                  ? "Workflow controlled"
                  : "Legacy route"}
            </Text>
          </View>
        </View>


        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {(["generate", "edit"] as const).map((mode) => {
            const active = mobileMode === mode;
            return (
              <Pressable
                key={mode}
                disabled={requestInFlight}
                onPress={() => {
                  setMobileMode(mode);
                  setRunState("idle");
                  setStatus(
                    mode === "edit"
                      ? `Ready. ${editRouteName}.`
                      : `Ready. ${selectedWorkflow?.name ?? "Generate"}.`
                  );
                }}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: active ? "#756be0" : "#2a3240",
                  backgroundColor: active ? "#24204c" : "#11161d",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: active ? "#f1efff" : "#9fa7b3",
                    fontWeight: "900",
                  }}
                >
                  {mode === "generate" ? "Generate" : "Edit"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.card,
            mobileMode === "edit" && { display: "none" },
          ]}
        >
          <Text
            style={
              styles.eyebrow
            }
          >
            IMAGE GENERATION
          </Text>

          <Text
            style={
              styles.cardTitle
            }
          >
            Create on the home GPU
          </Text>

          <Text
            style={
              styles.cardIntro
            }
          >
            Choose the real LGS workflow, tune it, and send it to the home GPU.
          </Text>


          <Text
            style={
              styles.label
            }
          >
            Prompt
          </Text>

          <TextInput
            style={
              styles.promptInput
            }
            value={
              prompt
            }
            onChangeText={
              setPrompt
            }
            placeholder="Describe what you want to generate..."
            placeholderTextColor="#626a78"
            multiline
            textAlignVertical="top"
          />

          <WorkflowControls
            workflows={workflows}
            workflow={selectedWorkflow}
            value={workflowTuning}
            disabled={requestInFlight}
            onSelectWorkflow={(workflow) => {
              setWorkflowTuning(
                tuningForWorkflow(workflow)
              );
              setStatus(
                `Ready. ${workflow.name}.`
              );
            }}
            onChange={setWorkflowTuning}
          />

          {selectedWorkflow?.modelKey === "anima_turbo" && (
            <AnimaTagCompendium
              prompt={prompt}
              disabled={requestInFlight}
              onChangePrompt={setPrompt}
            />
          )}


          <Text
            style={
              styles.label
            }
          >
            Aspect ratio
          </Text>

          <View
            style={
              styles.ratioGrid
            }
          >
            {ASPECT_RATIOS.map(
              (ratio) => {
                const selected =
                  ratio ===
                  aspectRatio;

                return (
                  <Pressable
                    key={
                      ratio
                    }
                    onPress={() =>
                      setAspectRatio(
                        ratio
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.ratioButton,
                      selected &&
                        styles.ratioButtonActive,
                      pressed &&
                        styles.controlPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ratioValue,
                        selected &&
                          styles.ratioValueActive,
                      ]}
                    >
                      {ratio}
                    </Text>

                    <Text
                      style={[
                        styles.ratioLabel,
                        selected &&
                          styles.ratioLabelActive,
                      ]}
                    >
                      {
                        RATIO_LABELS[
                          ratio
                        ]
                      }
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>


          <Text
            style={
              styles.label
            }
          >
            Seed
          </Text>

          <View
            style={
              styles.segmented
            }
          >
            {[
              "random",
              "fixed",
            ].map(
              (mode) => {
                const selected =
                  seedMode ===
                  mode;

                return (
                  <Pressable
                    key={
                      mode
                    }
                    onPress={() =>
                      setSeedMode(
                        mode as
                          | "random"
                          | "fixed"
                      )
                    }
                    style={[
                      styles.segmentButton,
                      selected &&
                        styles.segmentButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        selected &&
                          styles.segmentTextActive,
                      ]}
                    >
                      {mode ===
                      "random"
                        ? "Random"
                        : "Fixed"}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>

          {seedMode ===
            "fixed" && (
            <TextInput
              style={
                styles.seedInput
              }
              value={
                seed
              }
              onChangeText={
                setSeed
              }
              keyboardType="number-pad"
              placeholder="Enter seed"
              placeholderTextColor="#626a78"
            />
          )}


          <Pressable
            onPress={
              handleGenerate
            }
            disabled={
              requestInFlight
            }
            style={({
              pressed,
            }) => [
              styles.generateButton,
              requestInFlight &&
                styles.generateButtonDisabled,
              pressed &&
                !requestInFlight &&
                styles.generateButtonPressed,
            ]}
          >
            {requestInFlight ? (
              <ActivityIndicator
                color="#ffffff"
                size="small"
              />
            ) : (
              <View
                style={
                  styles.generateDot
                }
              />
            )}

            <Text
              style={
                styles.generateButtonText
              }
            >
              {
                runState ===
                "submitting"
                  ? "SUBMITTING"
                  : runState ===
                      "queued"
                    ? "QUEUED"
                    : runState ===
                        "running"
                      ? "GENERATING"
                      : "GENERATE IMAGE"
              }
            </Text>
          </Pressable>


          <View
            style={[
              styles.statusPanel,
              runState ===
                "error" &&
                styles.statusPanelError,
              runState ===
                "success" &&
                styles.statusPanelSuccess,
              requestInFlight &&
                styles.statusPanelWorking,
            ]}
          >
            <View
              style={
                styles.statusHeader
              }
            >
              <View
                style={[
                  styles.statusIndicator,
                  runState ===
                    "error" &&
                    styles.statusIndicatorError,
                  runState ===
                    "success" &&
                    styles.statusIndicatorSuccess,
                  requestInFlight &&
                    styles.statusIndicatorWorking,
                ]}
              />

              <Text
                style={
                  styles.statusText
                }
              >
                {status}
              </Text>
            </View>

            <Text
              style={
                styles.statusHint
              }
            >
              {statusHint}
            </Text>
          </View>
        </View>


        <MobileEditPanel
          visible={mobileMode === "edit"}
          disabled={requestInFlight}
          runState={runState}
          status={status}
          onRunState={setRunState}
          onStatus={setStatus}
          onRouteName={setEditRouteName}
          onResult={(uri) => {
            setResultUri(uri);
            setSaveState("idle");
          }}
        />

        <View
          style={
            styles.outputCard
          }
        >
          <View
            style={
              styles.outputHeader
            }
          >
            <View>
              <Text
                style={
                  styles.eyebrow
                }
              >
                RESULT
              </Text>

              <Text
                style={
                  styles.outputHeading
                }
              >
                Latest output
              </Text>
            </View>

            {resultUri && (
              <View
                style={
                  styles.readyBadge
                }
              >
                <Text
                  style={
                    styles.readyText
                  }
                >
                  READY
                </Text>
              </View>
            )}
          </View>

          <View
            style={
              styles.output
            }
          >
            {resultUri ? (
              <>
                <Image
                  source={{
                    uri:
                      resultUri,
                  }}
                  style={
                    styles.resultImage
                  }
                  resizeMode="contain"
                />

                <View
                  style={
                    styles.outputActions
                  }
                >
                  <Pressable
                    onPress={
                      saveResultImage
                    }
                    disabled={
                      saveState ===
                      "saving"
                    }
                    style={
                      styles.secondaryButton
                    }
                  >
                    <Text
                      style={
                        styles.secondaryButtonText
                      }
                    >
                      {saveState ===
                      "saving"
                        ? "Saving..."
                        : saveState ===
                            "saved"
                          ? "Saved"
                          : "Save to Gallery"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setResultUri(
                        null
                      );

                      setSaveState(
                        "idle"
                      );

                      setRunState(
                        "idle"
                      );

                      setStatus(
                        "Output cleared."
                      );
                    }}
                    style={
                      styles.ghostButton
                    }
                  >
                    <Text
                      style={
                        styles.ghostButtonText
                      }
                    >
                      Clear
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View
                style={
                  styles.emptyOutput
                }
              >
                <Text
                  style={
                    styles.outputSymbol
                  }
                >
                  ◇
                </Text>

                <Text
                  style={
                    styles.outputTitle
                  }
                >
                  No image yet
                </Text>

                <Text
                  style={
                    styles.outputHint
                  }
                >
                  The latest remote result will land here.
                </Text>
              </View>
            )}
          </View>
        </View>


        <Text
          style={
            styles.footer
          }
        >
          Tailscale → Local Gen Studio → ComfyUI → RTX 3060
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#080a0e",
    },

    scroll: {
      flex: 1,
    },

    content: {
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 44,
    },

    header: {
      marginBottom: 18,
    },

    headerTop: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "flex-start",
    },

    title: {
      color:
        "#f4f5f8",
      fontSize: 27,
      fontWeight:
        "900",
    },

    subtitle: {
      color:
        "#727a88",
      marginTop: 4,
      fontSize: 12,
    },

    routeBadge: {
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 6,
      borderWidth: 1,
      borderColor:
        "#2b3240",
      backgroundColor:
        "#11151c",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },

    routeDot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor:
        "#8a7cff",
    },

    routeText: {
      color:
        "#a9afbb",
      fontSize: 10,
      fontWeight:
        "800",
      letterSpacing: 1.1,
    },

    engineBar: {
      marginTop: 18,
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 9,
      backgroundColor:
        "#0e1117",
      borderWidth: 1,
      borderColor:
        "#222936",
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },

    engineEyebrow: {
      color:
        "#636b79",
      fontSize: 9,
      fontWeight:
        "800",
      letterSpacing: 1,
    },

    engineName: {
      color:
        "#ddd9ff",
      fontSize: 13,
      fontWeight:
        "800",
    },

    engineMeta: {
      color:
        "#626a78",
      fontSize: 11,
      marginLeft:
        "auto",
    },

    card: {
      backgroundColor:
        "#11141a",
      borderWidth: 1,
      borderColor:
        "#262d38",
      borderRadius: 18,
      padding: 17,
      marginBottom: 14,
    },

    eyebrow: {
      color:
        "#7c70d9",
      fontSize: 10,
      fontWeight:
        "900",
      letterSpacing: 1.4,
    },

    cardTitle: {
      color:
        "#f4f5f8",
      fontSize: 19,
      fontWeight:
        "800",
      marginTop: 6,
    },

    cardIntro: {
      color:
        "#767e8b",
      fontSize: 12,
      lineHeight: 18,
      marginTop: 5,
      marginBottom: 22,
    },

    label: {
      color:
        "#d2d6dd",
      fontSize: 12,
      fontWeight:
        "800",
      marginBottom: 8,
    },

    promptInput: {
      minHeight: 145,
      backgroundColor:
        "#0b0e13",
      borderWidth: 1,
      borderColor:
        "#292f3b",
      borderRadius: 12,
      color:
        "#f4f5f8",
      padding: 13,
      fontSize: 15,
      lineHeight: 21,
      marginBottom: 20,
    },

    ratioGrid: {
      flexDirection:
        "row",
      gap: 7,
      marginBottom: 22,
    },

    ratioButton: {
      flex: 1,
      minHeight: 58,
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        "#292f3b",
      backgroundColor:
        "#151920",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    ratioButtonActive: {
      borderColor:
        "#8275ff",
      backgroundColor:
        "#211d35",
    },

    ratioValue: {
      color:
        "#b0b6c0",
      fontWeight:
        "800",
      fontSize: 12,
    },

    ratioValueActive: {
      color:
        "#ffffff",
    },

    ratioLabel: {
      color:
        "#626a78",
      fontSize: 9,
      marginTop: 3,
    },

    ratioLabelActive: {
      color:
        "#a9a0e8",
    },

    segmented: {
      flexDirection:
        "row",
      padding: 3,
      borderRadius: 11,
      backgroundColor:
        "#0b0e13",
      borderWidth: 1,
      borderColor:
        "#292f3b",
      marginBottom: 12,
    },

    segmentButton: {
      flex: 1,
      height: 38,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 8,
    },

    segmentButtonActive: {
      backgroundColor:
        "#25203c",
    },

    segmentText: {
      color:
        "#737b88",
      fontSize: 12,
      fontWeight:
        "700",
    },

    segmentTextActive: {
      color:
        "#f4f2ff",
    },

    seedInput: {
      height: 45,
      backgroundColor:
        "#0b0e13",
      borderWidth: 1,
      borderColor:
        "#292f3b",
      borderRadius: 10,
      color:
        "#f4f5f8",
      paddingHorizontal: 12,
      fontSize: 14,
      marginBottom: 14,
    },

    generateButton: {
      marginTop: 7,
      height: 52,
      flexDirection:
        "row",
      gap: 10,
      borderRadius: 11,
      backgroundColor:
        "#7667f4",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    generateButtonPressed: {
      transform: [
        {
          scale: 0.985,
        },
      ],
      opacity: 0.9,
    },

    generateButtonDisabled: {
      opacity: 0.58,
    },

    generateDot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor:
        "#ffffff",
    },

    generateButtonText: {
      color:
        "#ffffff",
      fontWeight:
        "900",
      fontSize: 13,
      letterSpacing: 0.7,
    },

    statusPanel: {
      marginTop: 12,
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        "#282e39",
      backgroundColor:
        "#0c0f14",
      padding: 12,
    },

    statusPanelWorking: {
      borderColor:
        "#433c78",
      backgroundColor:
        "#111020",
    },

    statusPanelSuccess: {
      borderColor:
        "#274738",
      backgroundColor:
        "#0c1712",
    },

    statusPanelError: {
      borderColor:
        "#60343a",
      backgroundColor:
        "#1a0e10",
    },

    statusHeader: {
      flexDirection:
        "row",
      alignItems:
        "flex-start",
      gap: 9,
    },

    statusIndicator: {
      width: 7,
      height: 7,
      borderRadius: 999,
      marginTop: 5,
      backgroundColor:
        "#6b7380",
    },

    statusIndicatorWorking: {
      backgroundColor:
        "#8b7fff",
    },

    statusIndicatorSuccess: {
      backgroundColor:
        "#62c98f",
    },

    statusIndicatorError: {
      backgroundColor:
        "#ef727d",
    },

    statusText: {
      flex: 1,
      color:
        "#d5d9df",
      fontSize: 12,
      fontWeight:
        "700",
      lineHeight: 17,
    },

    statusHint: {
      color:
        "#626a77",
      fontSize: 10,
      lineHeight: 15,
      marginTop: 7,
      marginLeft: 16,
    },

    outputCard: {
      backgroundColor:
        "#11141a",
      borderWidth: 1,
      borderColor:
        "#262d38",
      borderRadius: 18,
      padding: 17,
    },

    outputHeader: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "center",
      marginBottom: 14,
    },

    outputHeading: {
      color:
        "#e9ebef",
      fontWeight:
        "800",
      fontSize: 15,
      marginTop: 4,
    },

    readyBadge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor:
        "#13241b",
      borderWidth: 1,
      borderColor:
        "#28513a",
    },

    readyText: {
      color:
        "#72d39d",
      fontSize: 9,
      fontWeight:
        "900",
      letterSpacing: 0.8,
    },

    output: {
      minHeight: 260,
      backgroundColor:
        "#0b0e13",
      borderWidth: 1,
      borderColor:
        "#292f3b",
      borderRadius: 13,
      overflow:
        "hidden",
    },

    emptyOutput: {
      minHeight: 260,
      justifyContent:
        "center",
      alignItems:
        "center",
      padding: 20,
    },

    resultImage: {
      width:
        "100%",
      height: 350,
      backgroundColor:
        "#07090c",
    },

    outputActions: {
      flexDirection:
        "row",
      gap: 9,
      padding: 11,
    },

    secondaryButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 9,
      backgroundColor:
        "#25203c",
      borderWidth: 1,
      borderColor:
        "#413872",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    secondaryButtonText: {
      color:
        "#e7e3ff",
      fontWeight:
        "800",
      fontSize: 12,
    },

    ghostButton: {
      minWidth: 86,
      minHeight: 44,
      borderRadius: 9,
      borderWidth: 1,
      borderColor:
        "#303744",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    ghostButtonText: {
      color:
        "#a3aab5",
      fontWeight:
        "700",
      fontSize: 12,
    },

    controlPressed: {
      opacity: 0.78,
    },

    outputSymbol: {
      color:
        "#565e6b",
      fontSize: 31,
      marginBottom: 10,
    },

    outputTitle: {
      color:
        "#cdd2da",
      fontSize: 13,
      fontWeight:
        "700",
    },

    outputHint: {
      color:
        "#626a78",
      fontSize: 11,
      marginTop: 5,
      textAlign:
        "center",
    },

    footer: {
      color:
        "#464d58",
      fontSize: 9,
      textAlign:
        "center",
      marginTop: 15,
      letterSpacing: 0.4,
    },
  });