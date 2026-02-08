import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  type Mission,
  type UserProfile,
  type LeaderboardEntry,
  type TrainedModel,
  type DataFile,
  type Annotation,
  type MissionTaskConfig,
  type Role,
  type ModelType,
} from "./mock-data";
import {
  apiLogin,
  apiSignup,
  apiGetMissions,
  apiGetMission,
  apiCreateMission,
  apiJoinMission,
  apiUploadFiles as apiUploadFilesRaw,
  apiGetFiles,
  apiReviewFile,
  apiAnnotateFile,
  apiUpdateMissionTasks,
  apiGetLeaderboard,
  apiGetModels,
  ApiError,
  type MissionResponse,
  type DatasetResponse,
  type ContributorResponse,
} from "./api";

// ─── Helpers ────────────────────────────────────────────────────────
let _nextId = 100;
function genId(prefix: string) {
  return `${prefix}${_nextId++}`;
}

/** Convert API MissionResponse → frontend Mission type */
function mapMission(m: MissionResponse): Mission {
  return {
    id: m.id,
    title: m.title,
    reason: m.reason || "",
    description: m.description,
    how_to_contribute: m.how_to_contribute || "",
    category: m.category || "",
    model_type: (m.model_type || "vision") as ModelType,
    status: m.status.toLowerCase() as Mission["status"],
    owner_id: m.owner_id || "",
    owner_name: m.owner_name || "",
    datasets: (m.datasets || []).map(mapDataset),
    accepted_types: m.accepted_types || [],
    target_contributions: m.target_contributions,
    current_contributions: m.current_contributions,
    contributors: (m.contributors || []).map(mapContributor),
    created_at: m.created_at,
    model_available: m.model_available,
    configuredTasks: m.configured_tasks as MissionTaskConfig[] | undefined,
  };
}

function mapDataset(d: DatasetResponse) {
  return {
    id: d.id,
    name: d.name,
    description: d.description || "",
    file_count: d.file_count,
    total_size_mb: d.total_size_mb,
    accepted_types: d.accepted_types || [],
    sample_files: [] as DataFile[],
    created_at: d.created_at,
  };
}

function mapContributor(c: ContributorResponse) {
  return {
    user_id: c.user_id,
    user_name: c.user_name,
    role: c.role.toLowerCase() as Role,
    approved_count: c.approved_count,
    total_count: c.total_count,
  };
}

/** Convert API model → frontend TrainedModel */
function mapModel(m: {
  id: string;
  mission_id: string;
  name: string;
  status: string;
  accuracy: number | null;
  epochs_completed: number;
  total_epochs: number;
  created_at: string;
}): TrainedModel {
  return {
    id: m.id,
    mission_id: m.mission_id,
    name: m.name,
    description: "",
    task: "",
    framework: "",
    accuracy: m.accuracy ?? 0,
    downloads: 0,
    version: "1.0",
    status: m.status.toLowerCase() as TrainedModel["status"],
    updated_at: m.created_at,
    input_example: "",
    output_example: "",
  };
}

// ─── State shape ────────────────────────────────────────────────────
interface AppState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  missions: Mission[];
  leaderboard: LeaderboardEntry[];
  models: TrainedModel[];
  likedMissions: Set<string>;
  loading: boolean;
  /** missionId → fileId → taskKey → serializable annotation value */
  annotationResponses: Record<string, Record<string, Record<string, unknown>>>;
}

// ─── Actions ────────────────────────────────────────────────────────
interface AppActions {
  // Auth
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;

  // Missions
  addMission: (data: {
    title: string;
    reason: string;
    description: string;
    how_to_contribute: string;
    category: string;
    model_type: ModelType;
    target_contributions: number;
    accepted_types: string[];
    datasets: { name: string; description: string }[];
    configuredTasks: MissionTaskConfig[];
  }) => Promise<string>;

  joinMission: (missionId: string) => void;

  // File management — accepts actual File objects for FormData upload
  uploadFiles: (missionId: string, datasetId: string, files: File[]) => Promise<void>;

  // Annotation (inline quick label)
  addAnnotation: (missionId: string, fileId: string, label: string, notes: string) => void;

  // Full annotation workspace responses (per-task values for a file)
  saveAnnotationResponses: (
    missionId: string,
    fileId: string,
    responses: Record<string, unknown>,
  ) => void;

  // Review
  approveFile: (missionId: string, fileId: string, note?: string) => void;
  rejectFile: (missionId: string, fileId: string, note?: string) => void;

  // Reviewer: configure annotation tasks for mission
  updateMissionTasks: (missionId: string, tasks: MissionTaskConfig[]) => void;

  // Like
  toggleLike: (missionId: string) => void;

  // Derived helpers
  getMission: (id: string) => Mission | undefined;
  fetchMission: (id: string) => Promise<Mission | undefined>;
  fetchMissionFiles: (missionId: string) => Promise<void>;
  getModels: (missionId: string) => TrainedModel[];
  getUserMissions: () => { mission: Mission; role: Role }[];
  getFilesNeedingAnnotation: (missionId: string) => DataFile[];
  getUserRole: (missionId: string) => Role | undefined;
  refreshMissions: () => Promise<void>;
}

type Store = AppState & AppActions;

const StoreContext = createContext<Store | null>(null);

// ─── Provider ───────────────────────────────────────────────────────
export function StoreProvider({ children }: { children: ReactNode }) {
  // Restore auth from localStorage
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      const raw = localStorage.getItem("dfa_auth");
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!parsed?.token;
    } catch {
      return false;
    }
  });
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem("dfa_user");
      return saved ? (JSON.parse(saved) as UserProfile) : null;
    } catch {
      return null;
    }
  });

  // Start empty — populated from API
  const [missions, setMissions] = useState<Mission[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [models, setModels] = useState<TrainedModel[]>([]);
  const [likedMissions, setLikedMissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [annotationResponses, setAnnotationResponses] = useState<
    Record<string, Record<string, Record<string, unknown>>>
  >({});

  // ─── Auth ─────────────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        const res = await apiLogin(email, password);
        const u: UserProfile = res.user;
        setUser(u);
        setIsAuthenticated(true);
        try {
          localStorage.setItem("dfa_auth", JSON.stringify({ token: res.token }));
          localStorage.setItem("dfa_user", JSON.stringify(u));
        } catch { /* quota error */ }
        toast.success(`Welcome back, ${u.name}!`);
        return true;
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Login failed. Please try again.";
        toast.error(msg);
        return false;
      }
    },
    [],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string): Promise<boolean> => {
      try {
        const res = await apiSignup(name, email, password);
        const u: UserProfile = res.user;
        setUser(u);
        setIsAuthenticated(true);
        try {
          localStorage.setItem("dfa_auth", JSON.stringify({ token: res.token }));
          localStorage.setItem("dfa_user", JSON.stringify(u));
        } catch { /* quota error */ }
        toast.success(`Welcome to DataForAll, ${name}!`);
        return true;
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Signup failed. Please try again.";
        toast.error(msg);
        return false;
      }
    },
    [],
  );

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    try {
      localStorage.removeItem("dfa_auth");
      localStorage.removeItem("dfa_user");
    } catch { /* ignore */ }
    toast("Logged out successfully");
  }, []);

  // ─── Data loading ─────────────────────────────────────────────────
  const refreshMissions = useCallback(async () => {
    try {
      const res = await apiGetMissions({ limit: 100 });
      if (res.missions.length > 0) {
        setMissions((prev) => {
          // Merge: keep existing files data for missions we already have
          const prevMap = new Map(prev.map((m) => [m.id, m]));
          return res.missions.map((apiM) => {
            const mapped = mapMission(apiM);
            const existing = prevMap.get(mapped.id);
            if (existing) {
              mapped.datasets = mapped.datasets.map((ds) => {
                const existingDs = existing.datasets.find((d) => d.id === ds.id);
                if (existingDs && existingDs.sample_files.length > 0) {
                  ds.sample_files = existingDs.sample_files;
                }
                return ds;
              });
            }
            return mapped;
          });
        });
      }
    } catch {
      /* keep current data on network failure */
    }
  }, []);

  // Fetch initial data from API on mount
  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      try {
        const [missionsRes, leaderboardRes, modelsRes] = await Promise.allSettled([
          apiGetMissions({ limit: 100 }),
          apiGetLeaderboard(),
          apiGetModels(),
        ]);

        if (cancelled) return;

        if (missionsRes.status === "fulfilled" && missionsRes.value.missions.length > 0) {
          setMissions(missionsRes.value.missions.map(mapMission));
        }
        if (leaderboardRes.status === "fulfilled" && leaderboardRes.value.entries.length > 0) {
          setLeaderboard(leaderboardRes.value.entries);
        }
        if (modelsRes.status === "fulfilled" && modelsRes.value.models.length > 0) {
          setModels(modelsRes.value.models.map(mapModel));
        }
      } catch {
        /* keep empty state */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Missions ─────────────────────────────────────────────────────
  const addMission = useCallback(
    async (data: {
      title: string;
      reason: string;
      description: string;
      how_to_contribute: string;
      category: string;
      model_type: ModelType;
      target_contributions: number;
      accepted_types: string[];
      datasets: { name: string; description: string }[];
      configuredTasks: MissionTaskConfig[];
    }): Promise<string> => {
      try {
        const res = await apiCreateMission({
          title: data.title,
          description: data.description,
          reason: data.reason,
          how_to_contribute: data.how_to_contribute,
          category: data.category,
          model_type: data.model_type,
          goal_count: data.target_contributions,
          accepted_types: data.accepted_types,
          configured_tasks: data.configuredTasks,
          datasets: data.datasets,
        });
        const apiMission = mapMission(res);
        setMissions((prev) => [apiMission, ...prev]);
        toast.success(`Mission "${data.title}" created!`);
        return apiMission.id;
      } catch {
        // Offline fallback: create locally
        const missionId = genId("m");
        const newMission: Mission = {
          id: missionId,
          title: data.title,
          reason: data.reason,
          description: data.description,
          how_to_contribute: data.how_to_contribute,
          category: data.category,
          model_type: data.model_type,
          status: "active",
          owner_id: user?.id ?? "",
          owner_name: user?.name ?? "Unknown",
          datasets: data.datasets.map((ds) => ({
            id: genId("d"),
            name: ds.name,
            description: ds.description,
            file_count: 0,
            total_size_mb: 0,
            accepted_types: data.accepted_types,
            sample_files: [],
            created_at: new Date().toISOString(),
          })),
          accepted_types: data.accepted_types,
          target_contributions: data.target_contributions,
          current_contributions: 0,
          contributors: user
            ? [
                {
                  user_id: user.id,
                  user_name: user.name,
                  role: "reviewer" as Role,
                  approved_count: 0,
                  total_count: 0,
                },
              ]
            : [],
          created_at: new Date().toISOString(),
          model_available: false,
          configuredTasks: data.configuredTasks,
        };
        setMissions((prev) => [newMission, ...prev]);
        toast.success(`Mission "${data.title}" created! (offline mode)`);
        return missionId;
      }
    },
    [user],
  );

  const joinMission = useCallback(
    (missionId: string) => {
      if (!user) return;
      apiJoinMission(missionId, "contributor").catch(() => {});
      setMissions((prev) =>
        prev.map((m) => {
          if (m.id !== missionId) return m;
          if (m.contributors.some((c) => c.user_id === user.id)) return m;
          return {
            ...m,
            contributors: [
              ...m.contributors,
              {
                user_id: user.id,
                user_name: user.name,
                role: "contributor" as Role,
                approved_count: 0,
                total_count: 0,
              },
            ],
          };
        }),
      );
      toast.success("Joined mission!");
    },
    [user],
  );

  // ─── File upload — calls the real API ─────────────────────────────
  const uploadFiles = useCallback(
    async (missionId: string, datasetId: string, files: File[]) => {
      if (!user) return;
      try {
        const res = await apiUploadFilesRaw(missionId, datasetId, files);
        const newFiles: DataFile[] = res.files.map((f) => ({
          id: f.id,
          filename: f.filename,
          size_kb: f.size_kb,
          type: f.filename.substring(f.filename.lastIndexOf(".")),
          status: f.status.toLowerCase() as DataFile["status"],
          contributor_id: user.id,
          contributor_name: user.name,
          uploaded_at: new Date().toISOString(),
        }));

        setMissions((prev) =>
          prev.map((m) => {
            if (m.id !== missionId) return m;
            const updatedDatasets = m.datasets.map((ds) => {
              if (ds.id !== datasetId) return ds;
              return {
                ...ds,
                sample_files: [...ds.sample_files, ...newFiles],
                file_count: ds.file_count + newFiles.length,
                total_size_mb:
                  ds.total_size_mb +
                  newFiles.reduce((s, f) => s + f.size_kb, 0) / 1024,
              };
            });
            let contributors = m.contributors;
            if (!contributors.some((c) => c.user_id === user.id)) {
              contributors = [
                ...contributors,
                {
                  user_id: user.id,
                  user_name: user.name,
                  role: "contributor" as Role,
                  approved_count: 0,
                  total_count: 0,
                },
              ];
            }
            contributors = contributors.map((c) =>
              c.user_id === user.id
                ? { ...c, total_count: c.total_count + newFiles.length }
                : c,
            );
            return {
              ...m,
              datasets: updatedDatasets,
              current_contributions: m.current_contributions + newFiles.length,
              contributors,
            };
          }),
        );

        setUser((prev) =>
          prev
            ? { ...prev, total_contributions: prev.total_contributions + files.length }
            : prev,
        );

        toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded!`);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Upload failed";
        toast.error(msg);
      }
    },
    [user],
  );

  // ─── Inline annotation ────────────────────────────────────────────
  const addAnnotation = useCallback(
    (missionId: string, fileId: string, label: string, notes: string) => {
      if (!user) return;
      // Auto-join mission if not already a member
      const mission = missions.find((m) => m.id === missionId);
      if (mission && !mission.contributors.some((c) => c.user_id === user.id)) {
        joinMission(missionId);
      }
      apiAnnotateFile(missionId, fileId, label, notes).catch(() => {});
      const ann: Annotation = {
        id: genId("a"),
        annotator_id: user.id,
        annotator_name: user.name,
        label,
        notes,
        created_at: new Date().toISOString(),
      };
      setMissions((prev) =>
        prev.map((m) => {
          if (m.id !== missionId) return m;
          return {
            ...m,
            datasets: m.datasets.map((ds) => ({
              ...ds,
              sample_files: ds.sample_files.map((f) => {
                if (f.id !== fileId) return f;
                return {
                  ...f,
                  annotations: [...(f.annotations ?? []), ann],
                  status:
                    f.status === "needs_annotation"
                      ? ("pending_review" as const)
                      : f.status,
                };
              }),
            })),
          };
        }),
      );
      setUser((prev) => (prev ? { ...prev, annotations: prev.annotations + 1 } : prev));
      toast.success("Annotation saved!");
    },
    [user, missions, joinMission],
  );

  // ─── Full annotation workspace save ───────────────────────────────
  const saveAnnotationResponses = useCallback(
    (missionId: string, fileId: string, responses: Record<string, unknown>) => {
      if (!user) return;
      // Auto-join mission if not already a member
      const mission = missions.find((m) => m.id === missionId);
      if (mission && !mission.contributors.some((c) => c.user_id === user.id)) {
        joinMission(missionId);
      }
      // Persist via API
      const label = `Annotated (${Object.keys(responses).length} tasks)`;
      apiAnnotateFile(missionId, fileId, label, JSON.stringify(responses)).catch(() => {});

      // Store locally
      setAnnotationResponses((prev) => ({
        ...prev,
        [missionId]: {
          ...(prev[missionId] ?? {}),
          [fileId]: responses,
        },
      }));

      setMissions((prev) =>
        prev.map((m) => {
          if (m.id !== missionId) return m;
          return {
            ...m,
            datasets: m.datasets.map((ds) => ({
              ...ds,
              sample_files: ds.sample_files.map((f) => {
                if (f.id !== fileId) return f;
                return {
                  ...f,
                  status:
                    f.status === "needs_annotation"
                      ? ("pending_review" as const)
                      : f.status,
                  annotations: [
                    ...(f.annotations ?? []),
                    {
                      id: genId("a"),
                      annotator_id: user.id,
                      annotator_name: user.name,
                      label,
                      notes: "Via annotation workspace",
                      created_at: new Date().toISOString(),
                    },
                  ],
                };
              }),
            })),
          };
        }),
      );

      setUser((prev) => (prev ? { ...prev, annotations: prev.annotations + 1 } : prev));
    },
    [user, missions, joinMission],
  );

  // ─── Review ───────────────────────────────────────────────────────
  const approveFile = useCallback(
    (missionId: string, fileId: string, _note?: string) => {
      if (!user) return;
      apiReviewFile(missionId, fileId, "approve").catch(() => {});
      setMissions((prev) =>
        prev.map((m) => {
          if (m.id !== missionId) return m;
          const file = m.datasets
            .flatMap((d) => d.sample_files)
            .find((ff) => ff.id === fileId);
          if (!file) return m;

          const nextStatus: DataFile["status"] =
            file.status === "pending" ? "needs_annotation" : "approved";
          const isIntegrated = nextStatus === "approved";

          return {
            ...m,
            datasets: m.datasets.map((ds) => ({
              ...ds,
              sample_files: ds.sample_files.map((f) =>
                f.id === fileId ? { ...f, status: nextStatus } : f,
              ),
            })),
            contributors: isIntegrated
              ? m.contributors.map((c) =>
                  c.user_id === file.contributor_id
                    ? { ...c, approved_count: c.approved_count + 1 }
                    : c,
                )
              : m.contributors,
          };
        }),
      );
      setUser((prev) => (prev ? { ...prev, reviews: prev.reviews + 1 } : prev));
      if (user) {
        setLeaderboard((prev) =>
          prev
            .map((e) =>
              e.user_id === user.id
                ? { ...e, reviews: e.reviews + 1, score: e.score + 5 }
                : e,
            )
            .sort((a, b) => b.score - a.score)
            .map((e, i) => ({ ...e, rank: i + 1 })),
        );
      }
      const fileForToast = missions
        .find((m) => m.id === missionId)
        ?.datasets.flatMap((d) => d.sample_files)
        .find((f) => f.id === fileId);
      if (fileForToast?.status === "pending") {
        toast.success("Upload approved!", { description: "File queued for annotation" });
      } else {
        toast.success("Annotation approved!", {
          description: "File integrated into dataset",
        });
      }
    },
    [user, missions],
  );

  const rejectFile = useCallback(
    (missionId: string, fileId: string, _note?: string) => {
      if (!user) return;
      apiReviewFile(missionId, fileId, "reject").catch(() => {});
      setMissions((prev) =>
        prev.map((m) => {
          if (m.id !== missionId) return m;
          const file = m.datasets
            .flatMap((d) => d.sample_files)
            .find((ff) => ff.id === fileId);
          if (!file) return m;

          const nextStatus: DataFile["status"] =
            file.status === "pending" ? "rejected" : "needs_annotation";

          return {
            ...m,
            datasets: m.datasets.map((ds) => ({
              ...ds,
              sample_files: ds.sample_files.map((f) =>
                f.id === fileId ? { ...f, status: nextStatus } : f,
              ),
            })),
          };
        }),
      );
      setUser((prev) => (prev ? { ...prev, reviews: prev.reviews + 1 } : prev));
      const fileForToast = missions
        .find((m) => m.id === missionId)
        ?.datasets.flatMap((d) => d.sample_files)
        .find((f) => f.id === fileId);
      if (fileForToast?.status === "pending") {
        toast("Upload rejected", { description: _note || undefined });
      } else {
        toast("Annotation sent back", {
          description: _note || "Queued for re-annotation",
        });
      }
    },
    [user, missions],
  );

  // ─── Task management (reviewer) ───────────────────────────────────
  const updateMissionTasks = useCallback(
    (missionId: string, tasks: MissionTaskConfig[]) => {
      apiUpdateMissionTasks(missionId, tasks).catch(() => {});
      setMissions((prev) =>
        prev.map((m) =>
          m.id === missionId ? { ...m, configuredTasks: tasks } : m,
        ),
      );
      toast.success("Annotation schema updated!", {
        description: `${tasks.length} task${tasks.length !== 1 ? "s" : ""} configured`,
      });
    },
    [],
  );

  // ─── Like ─────────────────────────────────────────────────────────
  const toggleLike = useCallback((missionId: string) => {
    setLikedMissions((prev) => {
      const next = new Set(prev);
      if (next.has(missionId)) {
        next.delete(missionId);
        toast("Removed from liked missions");
      } else {
        next.add(missionId);
        toast("Added to liked missions");
      }
      return next;
    });
  }, []);

  // ─── Derived helpers ──────────────────────────────────────────────
  const getMission = useCallback(
    (id: string) => missions.find((m) => m.id === id),
    [missions],
  );

  /** Fetch a single mission from API if not in local state */
  const fetchMission = useCallback(
    async (id: string): Promise<Mission | undefined> => {
      const local = missions.find((m) => m.id === id);
      if (local) return local;
      try {
        const res = await apiGetMission(id);
        const mapped = mapMission(res);
        setMissions((prev) => {
          if (prev.some((m) => m.id === mapped.id)) return prev;
          return [...prev, mapped];
        });
        return mapped;
      } catch {
        return undefined;
      }
    },
    [missions],
  );

  /** Fetch files for all datasets of a mission from the API */
  const fetchMissionFiles = useCallback(
    async (missionId: string): Promise<void> => {
      const mission = missions.find((m) => m.id === missionId);
      if (!mission) return;

      try {
        const results = await Promise.allSettled(
          mission.datasets.map((ds) => apiGetFiles(missionId, ds.id)),
        );

        setMissions((prev) =>
          prev.map((m) => {
            if (m.id !== missionId) return m;
            return {
              ...m,
              datasets: m.datasets.map((ds, i) => {
                const result = results[i];
                if (result.status !== "fulfilled") return ds;
                const apiFiles = result.value.files;
                return {
                  ...ds,
                  sample_files: apiFiles.map(
                    (f): DataFile => ({
                      id: f.id,
                      filename: f.filename,
                      size_kb: f.size_kb,
                      type: f.type,
                      status: f.status.toLowerCase() as DataFile["status"],
                      contributor_id: f.contributor_id || "",
                      contributor_name: f.contributor_name,
                      uploaded_at: f.uploaded_at,
                      annotations: f.annotations?.map((a) => ({
                        id: a.id,
                        annotator_id: a.annotator_id || "",
                        annotator_name: a.annotator_name,
                        label: a.label,
                        notes: a.notes,
                        created_at: a.created_at,
                      })),
                    }),
                  ),
                  file_count: apiFiles.length,
                };
              }),
            };
          }),
        );
      } catch {
        /* network error — keep existing data */
      }
    },
    [missions],
  );

  const getModelsForMission = useCallback(
    (missionId: string) => models.filter((m) => m.mission_id === missionId),
    [models],
  );

  const getFilesNeedingAnnotation = useCallback(
    (missionId: string): DataFile[] => {
      const mission = missions.find((m) => m.id === missionId);
      if (!mission) return [];
      return mission.datasets.flatMap((d) =>
        d.sample_files.filter((f) => f.status === "needs_annotation"),
      );
    },
    [missions],
  );

  const getUserRole = useCallback(
    (missionId: string): Role | undefined => {
      if (!user) return undefined;
      const mission = missions.find((m) => m.id === missionId);
      if (!mission) return undefined;
      const member = mission.contributors.find((c) => c.user_id === user.id);
      if (!member) return undefined;

      // Owner is always a reviewer
      if (mission.owner_id === user.id) return "reviewer";

      // Earned role hierarchy: reviewer > annotator > contributor
      // Backend stores the role set at join time, but we compute the
      // "earned" role from cumulative activity:
      //   - Any membership → contributor
      //   - Has annotations on this mission → annotator
      //   - Has reviews (approved_count > 5 or is owner) → reviewer
      // For now, derive from the stored role + approved_count heuristic
      if (member.approved_count >= 10) return "reviewer";
      if (member.approved_count >= 3) return "annotator";
      return "contributor";
    },
    [missions, user],
  );

  const getUserMissions = useCallback((): {
    mission: Mission;
    role: Role;
  }[] => {
    if (!user) return [];
    return missions
      .filter((m) => m.contributors.some((c) => c.user_id === user.id))
      .map((m) => ({
        mission: m,
        role: getUserRole(m.id) ?? "contributor",
      }));
  }, [missions, user, getUserRole]);

  // ─── Context value ────────────────────────────────────────────────
  const store: Store = {
    isAuthenticated,
    user,
    missions,
    leaderboard,
    models,
    likedMissions,
    loading,
    annotationResponses,
    login,
    signup,
    logout,
    addMission,
    joinMission,
    uploadFiles,
    addAnnotation,
    saveAnnotationResponses,
    approveFile,
    rejectFile,
    updateMissionTasks,
    toggleLike,
    getMission,
    fetchMission,
    fetchMissionFiles,
    getModels: getModelsForMission,
    getUserMissions,
    getFilesNeedingAnnotation,
    getUserRole,
    refreshMissions,
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

// ─── Hook ───────────────────────────────────────────────────────────
export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
