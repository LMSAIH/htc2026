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
  type MissionContributor,
  type Role,
  type ModelType,
  type Dataset,
  MISSIONS as SEED_MISSIONS,
  LEADERBOARD as SEED_LEADERBOARD,
  MODELS as SEED_MODELS,
  CURRENT_USER as SEED_USER,
  getBadge,
} from "./mock-data";
import { TASK_TEMPLATES } from "./annotation-tasks";
import type { AnnotationTaskType } from "./annotation-tasks";

// ─── Helpers ────────────────────────────────────────────────────────
let _nextId = 100;
function genId(prefix: string) {
  return `${prefix}${_nextId++}`;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ─── State shape ────────────────────────────────────────────────────
interface AppState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  missions: Mission[];
  leaderboard: LeaderboardEntry[];
  models: TrainedModel[];
  likedMissions: Set<string>;
  /** missionId -> fileId -> taskKey -> serializable annotation value */
  annotationResponses: Record<string, Record<string, Record<string, unknown>>>;
}

// ─── Actions ────────────────────────────────────────────────────────
interface AppActions {
  // Auth
  login: (email: string, password: string) => void;
  signup: (name: string, email: string, password: string) => void;
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
  }) => string; // returns new mission ID

  joinMission: (missionId: string, role: Role) => void;

  // File management
  uploadFiles: (
    missionId: string,
    datasetId: string,
    files: { name: string; size: number; type: string }[],
  ) => void;

  // Annotation (inline quick label)
  addAnnotation: (
    missionId: string,
    fileId: string,
    label: string,
    notes: string,
  ) => void;

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
  updateMissionTasks: (
    missionId: string,
    tasks: MissionTaskConfig[],
  ) => void;

  // Like
  toggleLike: (missionId: string) => void;

  // Derived helpers
  getMission: (id: string) => Mission | undefined;
  getModels: (missionId: string) => TrainedModel[];
  getUserMissions: () => { mission: Mission; role: Role }[];
  getFilesNeedingAnnotation: (missionId: string) => DataFile[];
  getUserRole: (missionId: string) => Role | undefined;
}

type Store = AppState & AppActions;

const StoreContext = createContext<Store | null>(null);

// ─── Provider ───────────────────────────────────────────────────────
export function StoreProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(deepClone(SEED_USER));
  const [missions, setMissions] = useState<Mission[]>(() =>
    deepClone(SEED_MISSIONS),
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() =>
    deepClone(SEED_LEADERBOARD),
  );
  const [models, setModels] = useState<TrainedModel[]>(() =>
    deepClone(SEED_MODELS),
  );
  const [likedMissions, setLikedMissions] = useState<Set<string>>(new Set());
  const [annotationResponses, setAnnotationResponses] = useState<
    Record<string, Record<string, Record<string, unknown>>>
  >({});

  // ─── Auth ─────────────────────────────────────────────────────────
  const login = useCallback((email: string, _password: string) => {
    // For local mode: if email matches seed user, log in as them
    // Otherwise, create a lightweight session
    const u: UserProfile = {
      ...deepClone(SEED_USER),
      email,
    };
    setUser(u);
    setIsAuthenticated(true);
    toast.success(`Welcome back, ${u.name}!`);
  }, []);

  const signup = useCallback((name: string, email: string, _password: string) => {
    const newUser: UserProfile = {
      id: genId("u"),
      name,
      avatar: name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2),
      email,
      approved_contributions: 0,
      total_contributions: 0,
      annotations: 0,
      reviews: 0,
      rank: leaderboard.length + 1,
      badge: getBadge(0),
      joined_at: new Date().toISOString(),
    };
    setUser(newUser);
    setIsAuthenticated(true);
    // Add to leaderboard
    setLeaderboard((prev) => [
      ...prev,
      {
        user_id: newUser.id,
        user_name: newUser.name,
        approved_contributions: 0,
        annotations: 0,
        reviews: 0,
        score: 0,
        rank: prev.length + 1,
        badge: getBadge(0),
      },
    ]);
    toast.success(`Welcome to DataForAll, ${name}!`);
  }, [leaderboard.length]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    toast("Logged out successfully");
  }, []);

  // ─── Missions ─────────────────────────────────────────────────────
  const addMission = useCallback(
    (data: {
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
    }): string => {
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
        owner_id: user?.id ?? "u1",
        owner_name: user?.name ?? "Unknown",
        datasets: data.datasets.map((ds, i) => ({
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
        contributors: [
          {
            user_id: user?.id ?? "u1",
            user_name: user?.name ?? "Unknown",
            role: "reviewer" as Role,
            approved_count: 0,
            total_count: 0,
          },
        ],
        created_at: new Date().toISOString(),
        model_available: false,
        configuredTasks: data.configuredTasks,
      };
      setMissions((prev) => [newMission, ...prev]);
      toast.success(`Mission "${data.title}" created!`);
      return missionId;
    },
    [user],
  );

  const joinMission = useCallback(
    (missionId: string, role: Role) => {
      if (!user) return;
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
                role,
                approved_count: 0,
                total_count: 0,
              },
            ],
          };
        }),
      );
      toast.success(`Joined mission as ${role}`);
    },
    [user],
  );

  // ─── File upload ──────────────────────────────────────────────────
  const uploadFiles = useCallback(
    (
      missionId: string,
      datasetId: string,
      files: { name: string; size: number; type: string }[],
    ) => {
      if (!user) return;
      const newFiles: DataFile[] = files.map((f) => ({
        id: genId("f"),
        filename: f.name,
        size_kb: Math.round(f.size / 1024),
        type: f.name.substring(f.name.lastIndexOf(".")),
        status: "pending" as const,
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
          // Also add user as contributor if not already
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
          // Bump contributor total_count
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

      // Update user stats
      setUser((prev) =>
        prev
          ? {
              ...prev,
              total_contributions: prev.total_contributions + files.length,
            }
          : prev,
      );

      toast.success(
        `${files.length} file${files.length > 1 ? "s" : ""} uploaded!`,
      );
    },
    [user],
  );

  // ─── Inline annotation ────────────────────────────────────────────
  const addAnnotation = useCallback(
    (missionId: string, fileId: string, label: string, notes: string) => {
      if (!user) return;
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
                  // After annotation → queue for annotation review
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
      // Update user annotation count
      setUser((prev) =>
        prev ? { ...prev, annotations: prev.annotations + 1 } : prev,
      );
      toast.success("Annotation saved!");
    },
    [user],
  );

  // ─── Full annotation workspace save ───────────────────────────────
  const saveAnnotationResponses = useCallback(
    (
      missionId: string,
      fileId: string,
      responses: Record<string, unknown>,
    ) => {
      if (!user) return;
      // Store the responses
      setAnnotationResponses((prev) => ({
        ...prev,
        [missionId]: {
          ...(prev[missionId] ?? {}),
          [fileId]: responses,
        },
      }));

      // Mark the file as pending review
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
                  // After annotation → queue for annotation review
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
                      label: `Annotated (${Object.keys(responses).length} tasks)`,
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

      setUser((prev) =>
        prev ? { ...prev, annotations: prev.annotations + 1 } : prev,
      );
    },
    [user],
  );

  // ─── Review ───────────────────────────────────────────────────────
  // Pipeline: pending (upload) → needs_annotation → pending_review (annotated) → approved
  const approveFile = useCallback(
    (missionId: string, fileId: string, note?: string) => {
      if (!user) return;
      setMissions((prev) =>
        prev.map((m) => {
          if (m.id !== missionId) return m;
          // Find the file to determine its current status
          const file = m.datasets
            .flatMap((d) => d.sample_files)
            .find((ff) => ff.id === fileId);
          if (!file) return m;

          // Determine next status based on pipeline stage
          const nextStatus: DataFile["status"] =
            file.status === "pending"
              ? "needs_annotation"    // Upload approved → queue for annotation
              : "approved";           // Annotation approved → integrated

          const isIntegrated = nextStatus === "approved";

          return {
            ...m,
            datasets: m.datasets.map((ds) => ({
              ...ds,
              sample_files: ds.sample_files.map((f) =>
                f.id === fileId ? { ...f, status: nextStatus } : f,
              ),
            })),
            // Only bump approved_count when fully integrated
            contributors: isIntegrated
              ? m.contributors.map((c) => {
                  if (c.user_id === file.contributor_id) {
                    return { ...c, approved_count: c.approved_count + 1 };
                  }
                  return c;
                })
              : m.contributors,
          };
        }),
      );
      setUser((prev) =>
        prev ? { ...prev, reviews: prev.reviews + 1 } : prev,
      );
      // Update leaderboard
      if (user) {
        setLeaderboard((prev) =>
          prev.map((e) =>
            e.user_id === user.id
              ? { ...e, reviews: e.reviews + 1, score: e.score + 5 }
              : e,
          ).sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 })),
        );
      }
      // Find file to get context-aware toast
      const fileForToast = missions
        .find((m) => m.id === missionId)
        ?.datasets.flatMap((d) => d.sample_files)
        .find((f) => f.id === fileId);
      if (fileForToast?.status === "pending") {
        toast.success("Upload approved!", { description: "File queued for annotation" });
      } else {
        toast.success("Annotation approved!", { description: "File integrated into dataset" });
      }
    },
    [user, missions],
  );

  const rejectFile = useCallback(
    (missionId: string, fileId: string, note?: string) => {
      if (!user) return;
      setMissions((prev) =>
        prev.map((m) => {
          if (m.id !== missionId) return m;
          const file = m.datasets
            .flatMap((d) => d.sample_files)
            .find((ff) => ff.id === fileId);
          if (!file) return m;

          // Determine next status based on pipeline stage
          const nextStatus: DataFile["status"] =
            file.status === "pending"
              ? "rejected"             // Upload rejected → rejected
              : "needs_annotation";    // Annotation rejected → re-queue for annotation

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
      setUser((prev) =>
        prev ? { ...prev, reviews: prev.reviews + 1 } : prev,
      );
      // Context-aware toast
      const fileForToast = missions
        .find((m) => m.id === missionId)
        ?.datasets.flatMap((d) => d.sample_files)
        .find((f) => f.id === fileId);
      if (fileForToast?.status === "pending") {
        toast("Upload rejected", { description: note || undefined });
      } else {
        toast("Annotation sent back", { description: note || "Queued for re-annotation" });
      }
    },
    [user, missions],
  );

  // ─── Task management (reviewer) ───────────────────────────────────
  const updateMissionTasks = useCallback(
    (missionId: string, tasks: MissionTaskConfig[]) => {
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

  // ─── Derived helpers (stable via useCallback) ─────────────────────
  const getMission = useCallback(
    (id: string) => missions.find((m) => m.id === id),
    [missions],
  );

  const getModels = useCallback(
    (missionId: string) => models.filter((m) => m.mission_id === missionId),
    [models],
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
        role: m.contributors.find((c) => c.user_id === user.id)!.role,
      }));
  }, [missions, user]);

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
      return mission?.contributors.find((c) => c.user_id === user.id)?.role;
    },
    [missions, user],
  );

  // ─── Context value ────────────────────────────────────────────────
  const store: Store = {
    // State
    isAuthenticated,
    user,
    missions,
    leaderboard,
    models,
    likedMissions,
    annotationResponses,
    // Actions
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
    // Helpers
    getMission,
    getModels,
    getUserMissions,
    getFilesNeedingAnnotation,
    getUserRole,
  };

  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────
export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
