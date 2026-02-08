// ─── Types ──────────────────────────────────────────────────────────
export type Role = "contributor" | "annotator" | "reviewer";

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  email: string;
  approved_contributions: number;
  total_contributions: number;
  annotations: number;
  reviews: number;
  rank: number;
  badge: string;
  joined_at: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  file_count: number;
  total_size_mb: number;
  accepted_types: string[];
  sample_files: DataFile[];
  created_at: string;
}

export interface DataFile {
  id: string;
  filename: string;
  size_kb: number;
  type: string;
  status: "pending" | "approved" | "rejected" | "needs_annotation";
  contributor_id: string;
  contributor_name: string;
  uploaded_at: string;
  annotations?: Annotation[];
}

export interface Annotation {
  id: string;
  annotator_id: string;
  annotator_name: string;
  label: string;
  notes: string;
  created_at: string;
}

export interface Mission {
  id: string;
  title: string;
  reason: string;
  description: string;
  how_to_contribute: string;
  category: string;
  status: "active" | "completed" | "draft";
  owner_id: string;
  owner_name: string;
  datasets: Dataset[];
  accepted_types: string[];
  target_contributions: number;
  current_contributions: number;
  contributors: MissionContributor[];
  created_at: string;
  model_available: boolean;
}

export interface MissionContributor {
  user_id: string;
  user_name: string;
  role: Role;
  approved_count: number;
  total_count: number;
}

export interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  approved_contributions: number;
  annotations: number;
  reviews: number;
  score: number;
  rank: number;
  badge: string;
}

export interface TrainedModel {
  id: string;
  name: string;
  mission_id: string;
  description: string;
  task: string;
  framework: string;
  accuracy: number;
  downloads: number;
  version: string;
  status: "online" | "training" | "offline";
  updated_at: string;
  input_example: string;
  output_example: string;
}

// ─── Badge logic ────────────────────────────────────────────────────
export function getBadge(approved: number): string {
  if (approved >= 500) return "🏆 Legend";
  if (approved >= 200) return "💎 Diamond";
  if (approved >= 100) return "🥇 Gold";
  if (approved >= 50) return "🥈 Silver";
  if (approved >= 20) return "🥉 Bronze";
  if (approved >= 5) return "⭐ Starter";
  return "🌱 New";
}

export function getRankColor(badge: string): string {
  if (badge.includes("Legend")) return "text-amber-500";
  if (badge.includes("Diamond")) return "text-cyan-400";
  if (badge.includes("Gold")) return "text-yellow-500";
  if (badge.includes("Silver")) return "text-gray-400";
  if (badge.includes("Bronze")) return "text-orange-600";
  return "text-green-500";
}

// ─── Current User ───────────────────────────────────────────────────
export const CURRENT_USER: UserProfile = {
  id: "u1",
  name: "Alex Rivera",
  avatar: "AR",
  email: "alex@example.com",
  approved_contributions: 67,
  total_contributions: 82,
  annotations: 134,
  reviews: 45,
  rank: 3,
  badge: getBadge(67),
  joined_at: "2025-09-15T00:00:00Z",
};

// ─── Missions ───────────────────────────────────────────────────────
export const MISSIONS: Mission[] = [
  {
    id: "m1",
    title: "Global Crop Disease Detection",
    reason:
      "Crop diseases destroy up to 40% of global food production annually. An open image dataset enables early detection AI that smallholder farmers can access via a phone camera.",
    description:
      "We are building the world's largest open dataset of crop leaf images labeled by disease type. This will train a classifier that identifies 14+ common crop diseases from a simple phone photo.",
    how_to_contribute:
      "1. Take a clear, close-up photo of a plant leaf (healthy or diseased).\n2. Select the crop type from the dropdown.\n3. If you know the disease, add it in the label field — otherwise leave it blank for annotators.\n4. Upload the image. Our annotators and reviewers will handle the rest!",
    category: "Agriculture",
    status: "active",
    owner_id: "u2",
    owner_name: "Dr. Priya Sharma",
    datasets: [
      {
        id: "d1",
        name: "Leaf Images — Tomato",
        description: "Close-up photographs of tomato plant leaves in various health states.",
        file_count: 1247,
        total_size_mb: 3840,
        accepted_types: [".jpg", ".jpeg", ".png", ".webp"],
        sample_files: [
          { id: "f1", filename: "tomato-blight-001.jpg", size_kb: 2340, type: ".jpg", status: "approved", contributor_id: "u1", contributor_name: "Alex Rivera", uploaded_at: "2026-01-15T10:00:00Z", annotations: [{ id: "a1", annotator_id: "u5", annotator_name: "Kim Chen", label: "Late Blight", notes: "Clear lesions visible on upper leaf surface", created_at: "2026-01-16T08:00:00Z" }] },
          { id: "f2", filename: "tomato-healthy-042.jpg", size_kb: 1890, type: ".jpg", status: "approved", contributor_id: "u3", contributor_name: "Maria Santos", uploaded_at: "2026-01-14T14:30:00Z", annotations: [{ id: "a2", annotator_id: "u5", annotator_name: "Kim Chen", label: "Healthy", notes: "", created_at: "2026-01-15T09:00:00Z" }] },
          { id: "f3", filename: "tomato-septoria-008.png", size_kb: 3120, type: ".png", status: "needs_annotation", contributor_id: "u6", contributor_name: "Jean Dupont", uploaded_at: "2026-02-03T11:20:00Z" },
          { id: "f4", filename: "tomato-leaf-curl-019.jpg", size_kb: 2560, type: ".jpg", status: "pending", contributor_id: "u4", contributor_name: "Raj Patel", uploaded_at: "2026-02-06T16:45:00Z" },
        ],
        created_at: "2025-11-01T00:00:00Z",
      },
      {
        id: "d2",
        name: "Leaf Images — Rice",
        description: "Photographs of rice paddy leaves, focused on blast and sheath blight.",
        file_count: 832,
        total_size_mb: 2100,
        accepted_types: [".jpg", ".jpeg", ".png"],
        sample_files: [
          { id: "f5", filename: "rice-blast-031.jpg", size_kb: 1980, type: ".jpg", status: "approved", contributor_id: "u4", contributor_name: "Raj Patel", uploaded_at: "2026-01-20T09:00:00Z", annotations: [{ id: "a3", annotator_id: "u1", annotator_name: "Alex Rivera", label: "Rice Blast", notes: "Diamond-shaped lesions", created_at: "2026-01-21T10:00:00Z" }] },
          { id: "f6", filename: "rice-healthy-015.jpg", size_kb: 2100, type: ".jpg", status: "pending", contributor_id: "u7", contributor_name: "Yuki Tanaka", uploaded_at: "2026-02-04T07:15:00Z" },
        ],
        created_at: "2025-12-15T00:00:00Z",
      },
    ],
    accepted_types: [".jpg", ".jpeg", ".png", ".webp"],
    target_contributions: 5000,
    current_contributions: 2079,
    contributors: [
      { user_id: "u1", user_name: "Alex Rivera", role: "annotator", approved_count: 34, total_count: 34 },
      { user_id: "u3", user_name: "Maria Santos", role: "contributor", approved_count: 89, total_count: 102 },
      { user_id: "u4", user_name: "Raj Patel", role: "contributor", approved_count: 156, total_count: 178 },
      { user_id: "u5", user_name: "Kim Chen", role: "annotator", approved_count: 0, total_count: 0 },
      { user_id: "u2", user_name: "Dr. Priya Sharma", role: "reviewer", approved_count: 0, total_count: 0 },
    ],
    created_at: "2025-10-01T00:00:00Z",
    model_available: true,
  },
  {
    id: "m2",
    title: "Urban Air Quality Monitoring",
    reason:
      "Air pollution causes 7 million premature deaths per year (WHO). Open sensor data lets researchers and cities build hyper-local pollution maps and forecasting models.",
    description:
      "Collecting readings from low-cost air quality sensors deployed by community volunteers. Data includes PM2.5, PM10, NO₂, O₃, temperature, and humidity at GPS coordinates.",
    how_to_contribute:
      "1. Export a CSV or JSON file from your air quality sensor (we support PurpleAir, AirGradient, SDS011 and generic formats).\n2. Make sure it includes a timestamp column and at least one pollutant reading.\n3. Add your approximate location in the metadata field.\n4. Upload — our pipeline auto-validates the schema.",
    category: "Environment",
    status: "active",
    owner_id: "u1",
    owner_name: "Alex Rivera",
    datasets: [
      {
        id: "d3",
        name: "PM2.5 Sensor Readings",
        description: "Time-series CSV files of particulate matter readings from community sensors.",
        file_count: 4231,
        total_size_mb: 890,
        accepted_types: [".csv", ".json"],
        sample_files: [
          { id: "f7", filename: "sensor-north-2026-01.csv", size_kb: 340, type: ".csv", status: "approved", contributor_id: "u6", contributor_name: "Jean Dupont", uploaded_at: "2026-01-31T18:00:00Z" },
          { id: "f8", filename: "purpleair-export-feb.json", size_kb: 128, type: ".json", status: "pending", contributor_id: "u8", contributor_name: "Amira Hassan", uploaded_at: "2026-02-05T12:30:00Z" },
        ],
        created_at: "2025-11-20T00:00:00Z",
      },
      {
        id: "d4",
        name: "Multi-Pollutant Readings",
        description: "Combined readings including PM2.5, NO₂, O₃, temperature and humidity.",
        file_count: 1856,
        total_size_mb: 520,
        accepted_types: [".csv", ".json", ".xlsx"],
        sample_files: [
          { id: "f9", filename: "airgradient-station-42.csv", size_kb: 210, type: ".csv", status: "approved", contributor_id: "u3", contributor_name: "Maria Santos", uploaded_at: "2026-01-28T09:00:00Z" },
        ],
        created_at: "2025-12-01T00:00:00Z",
      },
    ],
    accepted_types: [".csv", ".json", ".xlsx"],
    target_contributions: 10000,
    current_contributions: 6087,
    contributors: [
      { user_id: "u1", user_name: "Alex Rivera", role: "reviewer", approved_count: 0, total_count: 0 },
      { user_id: "u3", user_name: "Maria Santos", role: "contributor", approved_count: 245, total_count: 260 },
      { user_id: "u6", user_name: "Jean Dupont", role: "annotator", approved_count: 0, total_count: 0 },
      { user_id: "u8", user_name: "Amira Hassan", role: "contributor", approved_count: 312, total_count: 340 },
    ],
    created_at: "2025-09-15T00:00:00Z",
    model_available: true,
  },
  {
    id: "m3",
    title: "Endangered Language Audio Archive",
    reason:
      "Over 3,000 languages are at risk of extinction within a generation. Recorded speech datasets enable speech-to-text models that help preserve and teach these languages.",
    description:
      "Collecting audio recordings of speakers of endangered and under-resourced languages. Each clip should be 5–30 seconds of natural speech with a text transcription if possible.",
    how_to_contribute:
      "1. Record a short audio clip (5–30 seconds) of natural speech or storytelling.\n2. Select the language from our list (or type it in if not listed).\n3. If possible, add a transcription or translation in the notes field.\n4. Upload the audio file. Annotators will verify the language and add transcriptions.",
    category: "Languages",
    status: "active",
    owner_id: "u9",
    owner_name: "Dr. Lin Zhao",
    datasets: [
      {
        id: "d5",
        name: "Audio Clips — Indigenous Americas",
        description: "Speech recordings in Quechua, Nahuatl, Guaraní, and other indigenous American languages.",
        file_count: 623,
        total_size_mb: 4200,
        accepted_types: [".mp3", ".wav", ".ogg", ".flac"],
        sample_files: [
          { id: "f10", filename: "quechua-story-001.wav", size_kb: 8400, type: ".wav", status: "approved", contributor_id: "u3", contributor_name: "Maria Santos", uploaded_at: "2026-01-10T15:00:00Z", annotations: [{ id: "a4", annotator_id: "u9", annotator_name: "Dr. Lin Zhao", label: "Quechua (Southern)", notes: "Story about harvest. Transcription pending.", created_at: "2026-01-12T10:00:00Z" }] },
          { id: "f11", filename: "nahuatl-greeting-012.mp3", size_kb: 1200, type: ".mp3", status: "needs_annotation", contributor_id: "u4", contributor_name: "Raj Patel", uploaded_at: "2026-02-01T08:00:00Z" },
        ],
        created_at: "2025-12-01T00:00:00Z",
      },
      {
        id: "d6",
        name: "Audio Clips — Southeast Asia",
        description: "Speech recordings in Hmong, Karen, Khmer dialects, and other SE Asian languages.",
        file_count: 389,
        total_size_mb: 2800,
        accepted_types: [".mp3", ".wav", ".ogg", ".flac"],
        sample_files: [
          { id: "f12", filename: "hmong-conversation-005.ogg", size_kb: 5600, type: ".ogg", status: "pending", contributor_id: "u7", contributor_name: "Yuki Tanaka", uploaded_at: "2026-02-03T13:00:00Z" },
        ],
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    accepted_types: [".mp3", ".wav", ".ogg", ".flac"],
    target_contributions: 3000,
    current_contributions: 1012,
    contributors: [
      { user_id: "u1", user_name: "Alex Rivera", role: "contributor", approved_count: 12, total_count: 15 },
      { user_id: "u3", user_name: "Maria Santos", role: "contributor", approved_count: 45, total_count: 48 },
      { user_id: "u4", user_name: "Raj Patel", role: "contributor", approved_count: 23, total_count: 30 },
      { user_id: "u9", user_name: "Dr. Lin Zhao", role: "reviewer", approved_count: 0, total_count: 0 },
    ],
    created_at: "2025-11-01T00:00:00Z",
    model_available: false,
  },
  {
    id: "m4",
    title: "Clean Water Source Mapping",
    reason:
      "2.2 billion people lack safely managed drinking water (UN). Geolocated water quality data helps NGOs prioritize infrastructure and emergency response.",
    description:
      "Mapping clean water sources and testing results worldwide. Contributors submit water test results with GPS coordinates, photos of sources, and basic quality measurements.",
    how_to_contribute:
      "1. Test water at a source (well, river, tap) using a basic kit or meter.\n2. Record pH, turbidity, TDS if available and take a photo of the source.\n3. Note the GPS coordinates (your phone camera usually embeds these).\n4. Upload the test result (photo or CSV) and fill in the metadata fields.",
    category: "Public Health",
    status: "active",
    owner_id: "u8",
    owner_name: "Amira Hassan",
    datasets: [
      {
        id: "d7",
        name: "Water Test Results",
        description: "Spreadsheets and forms with pH, turbidity, TDS, coliform readings at GPS coordinates.",
        file_count: 2156,
        total_size_mb: 45,
        accepted_types: [".csv", ".json", ".xlsx"],
        sample_files: [
          { id: "f13", filename: "well-tests-nairobi-jan26.csv", size_kb: 18, type: ".csv", status: "approved", contributor_id: "u8", contributor_name: "Amira Hassan", uploaded_at: "2026-01-22T11:00:00Z" },
        ],
        created_at: "2025-10-15T00:00:00Z",
      },
      {
        id: "d8",
        name: "Water Source Photos",
        description: "Geotagged photos of water sources (wells, rivers, taps) with condition notes.",
        file_count: 987,
        total_size_mb: 2800,
        accepted_types: [".jpg", ".jpeg", ".png"],
        sample_files: [
          { id: "f14", filename: "river-crossing-photo-089.jpg", size_kb: 3400, type: ".jpg", status: "needs_annotation", contributor_id: "u6", contributor_name: "Jean Dupont", uploaded_at: "2026-02-02T16:00:00Z" },
        ],
        created_at: "2025-11-01T00:00:00Z",
      },
    ],
    accepted_types: [".csv", ".json", ".xlsx", ".jpg", ".jpeg", ".png"],
    target_contributions: 8000,
    current_contributions: 3143,
    contributors: [
      { user_id: "u1", user_name: "Alex Rivera", role: "contributor", approved_count: 21, total_count: 25 },
      { user_id: "u6", user_name: "Jean Dupont", role: "contributor", approved_count: 67, total_count: 72 },
      { user_id: "u8", user_name: "Amira Hassan", role: "reviewer", approved_count: 0, total_count: 0 },
    ],
    created_at: "2025-10-10T00:00:00Z",
    model_available: false,
  },
  {
    id: "m5",
    title: "Wildlife Camera Trap Archive",
    reason:
      "Biodiversity monitoring requires identifying species from millions of camera trap images. An open labeled dataset accelerates conservation research globally.",
    description:
      "Aggregating camera trap images from wildlife reserves and conservation projects. Each image needs species identification and count annotation.",
    how_to_contribute:
      "1. Export images from your camera trap (SD card or cloud dashboard).\n2. Name files descriptively if possible (location-date).\n3. Upload a batch — our annotators will identify species.\n4. If you can ID species yourself, add labels in the annotation field!",
    category: "Conservation",
    status: "completed",
    owner_id: "u5",
    owner_name: "Kim Chen",
    datasets: [
      {
        id: "d9",
        name: "Camera Trap Images — Africa",
        description: "Trail camera images from reserves in Kenya, Tanzania, and South Africa.",
        file_count: 12500,
        total_size_mb: 38000,
        accepted_types: [".jpg", ".jpeg", ".png"],
        sample_files: [
          { id: "f15", filename: "serengeti-cam12-20260101.jpg", size_kb: 4200, type: ".jpg", status: "approved", contributor_id: "u5", contributor_name: "Kim Chen", uploaded_at: "2026-01-01T06:00:00Z", annotations: [{ id: "a5", annotator_id: "u1", annotator_name: "Alex Rivera", label: "Zebra (3), Wildebeest (1)", notes: "Dawn, good visibility", created_at: "2026-01-02T08:00:00Z" }] },
        ],
        created_at: "2025-08-01T00:00:00Z",
      },
    ],
    accepted_types: [".jpg", ".jpeg", ".png"],
    target_contributions: 15000,
    current_contributions: 15000,
    contributors: [
      { user_id: "u1", user_name: "Alex Rivera", role: "annotator", approved_count: 0, total_count: 0 },
      { user_id: "u5", user_name: "Kim Chen", role: "reviewer", approved_count: 0, total_count: 0 },
    ],
    created_at: "2025-07-01T00:00:00Z",
    model_available: true,
  },
];

// ─── Leaderboard ────────────────────────────────────────────────────
export const LEADERBOARD: LeaderboardEntry[] = [
  { user_id: "u8", user_name: "Amira Hassan", approved_contributions: 312, annotations: 0, reviews: 890, score: 2002, rank: 1, badge: getBadge(312) },
  { user_id: "u4", user_name: "Raj Patel", approved_contributions: 279, annotations: 45, reviews: 0, score: 603, rank: 2, badge: getBadge(279) },
  { user_id: "u1", user_name: "Alex Rivera", approved_contributions: 67, annotations: 134, reviews: 45, score: 491, rank: 3, badge: getBadge(67) },
  { user_id: "u3", user_name: "Maria Santos", approved_contributions: 379, annotations: 12, reviews: 0, score: 770, rank: 4, badge: getBadge(379) },
  { user_id: "u5", user_name: "Kim Chen", approved_contributions: 45, annotations: 523, reviews: 1200, score: 3491, rank: 5, badge: getBadge(45) },
  { user_id: "u6", user_name: "Jean Dupont", approved_contributions: 189, annotations: 67, reviews: 0, score: 445, rank: 6, badge: getBadge(189) },
  { user_id: "u7", user_name: "Yuki Tanaka", approved_contributions: 34, annotations: 89, reviews: 0, score: 212, rank: 7, badge: getBadge(34) },
  { user_id: "u9", user_name: "Dr. Lin Zhao", approved_contributions: 8, annotations: 0, reviews: 456, score: 920, rank: 8, badge: getBadge(8) },
  { user_id: "u2", user_name: "Dr. Priya Sharma", approved_contributions: 3, annotations: 0, reviews: 678, score: 1359, rank: 9, badge: getBadge(3) },
  { user_id: "u10", user_name: "Sam Okafor", approved_contributions: 23, annotations: 56, reviews: 0, score: 135, rank: 10, badge: getBadge(23) },
].sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 }));

// ─── Trained Models ─────────────────────────────────────────────────
export const MODELS: TrainedModel[] = [
  {
    id: "mod1",
    name: "crop-disease-classifier-v3",
    mission_id: "m1",
    description: "Multi-class image classifier for 14 common crop diseases. Trained on 2,000+ labeled leaf images. Achieves 92.4% top-1 accuracy on the hold-out test set.",
    task: "Image Classification",
    framework: "PyTorch / torchvision",
    accuracy: 92.4,
    downloads: 1843,
    version: "v0.3-beta",
    status: "online",
    updated_at: "2026-01-28T00:00:00Z",
    input_example: "Upload a close-up photo of a plant leaf (.jpg, .png)",
    output_example: '{\n  "prediction": "Late Blight",\n  "confidence": 0.924,\n  "top_3": [\n    { "label": "Late Blight", "score": 0.924 },\n    { "label": "Early Blight", "score": 0.051 },\n    { "label": "Healthy", "score": 0.018 }\n  ]\n}',
  },
  {
    id: "mod2",
    name: "crop-leaf-segmenter",
    mission_id: "m1",
    description: "Semantic segmentation model that isolates leaf regions from background. Useful as a preprocessing step before disease classification.",
    task: "Image Segmentation",
    framework: "PyTorch / segmentation-models",
    accuracy: 88.1,
    downloads: 672,
    version: "v0.1",
    status: "online",
    updated_at: "2026-01-15T00:00:00Z",
    input_example: "Upload a photo containing plant leaves",
    output_example: '{\n  "mask_url": "/outputs/mask_001.png",\n  "leaf_area_pct": 73.2,\n  "regions_detected": 3\n}',
  },
  {
    id: "mod3",
    name: "air-quality-forecaster-v2",
    mission_id: "m2",
    description: "Time-series forecasting model that predicts PM2.5 levels 24 hours ahead given the last 7 days of sensor readings. Uses a transformer encoder architecture.",
    task: "Time-Series Forecasting",
    framework: "PyTorch / Chronos",
    accuracy: 89.7,
    downloads: 2156,
    version: "v0.2",
    status: "online",
    updated_at: "2026-02-01T00:00:00Z",
    input_example: "Paste 7 days of PM2.5 readings as CSV (timestamp, value)",
    output_example: '{\n  "forecast_24h": [\n    { "hour": 1, "pm25": 34.2 },\n    { "hour": 6, "pm25": 28.7 },\n    { "hour": 12, "pm25": 41.3 },\n    { "hour": 24, "pm25": 36.8 }\n  ],\n  "trend": "stable"\n}',
  },
  {
    id: "mod4",
    name: "pollution-hotspot-detector",
    mission_id: "m2",
    description: "Spatial clustering model that identifies pollution hotspots from multi-sensor geo-located readings. Outputs GeoJSON polygons.",
    task: "Spatial Clustering",
    framework: "scikit-learn / HDBSCAN",
    accuracy: 85.3,
    downloads: 498,
    version: "v0.1",
    status: "training",
    updated_at: "2026-02-05T00:00:00Z",
    input_example: "Upload a CSV with columns: lat, lng, pm25, timestamp",
    output_example: '{\n  "clusters": 4,\n  "hotspots": [\n    { "center": [40.71, -74.00], "radius_km": 1.2, "avg_pm25": 78.4 }\n  ]\n}',
  },
  {
    id: "mod5",
    name: "wildlife-species-detector",
    mission_id: "m5",
    description: "Object detection model trained on 12,500 camera trap images. Detects and counts 47 African wildlife species with bounding boxes.",
    task: "Object Detection",
    framework: "PyTorch / YOLOv8",
    accuracy: 94.1,
    downloads: 3421,
    version: "v1.0",
    status: "online",
    updated_at: "2026-01-05T00:00:00Z",
    input_example: "Upload a camera trap image (.jpg, .png)",
    output_example: '{\n  "detections": [\n    { "species": "Zebra", "count": 3, "confidence": 0.97 },\n    { "species": "Wildebeest", "count": 1, "confidence": 0.91 }\n  ],\n  "bbox_image_url": "/outputs/annotated_001.jpg"\n}',
  },
];

export function getModelsForMission(missionId: string): TrainedModel[] {
  return MODELS.filter((m) => m.mission_id === missionId);
}

// ─── Helpers ────────────────────────────────────────────────────────
export function getUserMissions(userId: string): { mission: Mission; role: Role }[] {
  return MISSIONS.filter((m) =>
    m.contributors.some((c) => c.user_id === userId),
  ).map((m) => ({
    mission: m,
    role: m.contributors.find((c) => c.user_id === userId)!.role,
  }));
}

export function getMissionById(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export function getRoleLabel(role: Role): string {
  switch (role) {
    case "contributor":
      return "Contributor";
    case "annotator":
      return "Data Annotator";
    case "reviewer":
      return "Reviewer / Manager";
  }
}

export function getRoleDescription(role: Role): string {
  switch (role) {
    case "contributor":
      return "Upload data files to missions. No technical skills required.";
    case "annotator":
      return "Label and annotate contributed data to build high-quality datasets.";
    case "reviewer":
      return "Review submissions, manage datasets, and approve contributions.";
  }
}

// ─── Annotation / Task System (Zooniverse-style) ─────────────────────
export type TaskType = "single_choice" | "multiple_choice" | "free_text" | "number";

export interface TaskOption {
  id: string;
  label: string;
  description?: string;
}

export interface AnnotationTask {
  id: string;
  mission_id: string;
  order: number;
  title: string;
  instruction: string;
  type: TaskType;
  required: boolean;
  options?: TaskOption[];
  min?: number;
  max?: number;
  placeholder?: string;
}

export interface TaskResponse {
  id: string;
  task_id: string;
  file_id: string;
  user_id: string;
  value: string | string[] | number;
  created_at: string;
}

export const ANNOTATION_TASKS: AnnotationTask[] = [
  // ─── Mission 1: Crop Disease Detection ───
  {
    id: "t1",
    mission_id: "m1",
    order: 1,
    title: "Leaf Health",
    instruction: "Is this leaf healthy or does it show signs of disease?",
    type: "single_choice",
    required: true,
    options: [
      { id: "o1", label: "Healthy", description: "No visible spots, discoloration, or wilting" },
      { id: "o2", label: "Diseased", description: "Visible spots, lesions, discoloration, or wilting" },
      { id: "o3", label: "Uncertain", description: "Can't tell from this image" },
    ],
  },
  {
    id: "t2",
    mission_id: "m1",
    order: 2,
    title: "Disease Identification",
    instruction: "If diseased, which disease(s) do you see? Select all that apply.",
    type: "multiple_choice",
    required: false,
    options: [
      { id: "o4", label: "Late Blight" },
      { id: "o5", label: "Early Blight" },
      { id: "o6", label: "Septoria Leaf Spot" },
      { id: "o7", label: "Leaf Curl" },
      { id: "o8", label: "Bacterial Spot" },
      { id: "o9", label: "Other" },
    ],
  },
  {
    id: "t3",
    mission_id: "m1",
    order: 3,
    title: "Severity Score",
    instruction: "Rate the severity of the disease from 1 (mild) to 5 (severe).",
    type: "number",
    required: false,
    min: 1,
    max: 5,
  },
  {
    id: "t4",
    mission_id: "m1",
    order: 4,
    title: "Notes",
    instruction: "Any additional observations about this sample?",
    type: "free_text",
    required: false,
    placeholder: "e.g. 'Lesions concentrated on leaf tips, early stage…'",
  },

  // ─── Mission 2: Air Quality ───
  {
    id: "t5",
    mission_id: "m2",
    order: 1,
    title: "Data Quality",
    instruction: "Does this sensor reading file look valid?",
    type: "single_choice",
    required: true,
    options: [
      { id: "o10", label: "Valid", description: "Properly formatted, timestamps look correct" },
      { id: "o11", label: "Suspect", description: "Some values look off or gaps in timestamps" },
      { id: "o12", label: "Invalid", description: "Corrupted, wrong format, or nonsense values" },
    ],
  },
  {
    id: "t6",
    mission_id: "m2",
    order: 2,
    title: "Environment Type",
    instruction: "What type of environment is this sensor in?",
    type: "single_choice",
    required: false,
    options: [
      { id: "o13", label: "Urban — Roadside" },
      { id: "o14", label: "Urban — Residential" },
      { id: "o15", label: "Suburban" },
      { id: "o16", label: "Industrial" },
      { id: "o17", label: "Rural" },
      { id: "o18", label: "Unknown" },
    ],
  },

  // ─── Mission 3: Language Audio ───
  {
    id: "t7",
    mission_id: "m3",
    order: 1,
    title: "Audio Quality",
    instruction: "Rate the audio recording quality.",
    type: "single_choice",
    required: true,
    options: [
      { id: "o19", label: "Clear", description: "Speech is easily understandable" },
      { id: "o20", label: "Noisy", description: "Background noise but speech is audible" },
      { id: "o21", label: "Poor", description: "Very hard to hear the speaker" },
    ],
  },
  {
    id: "t8",
    mission_id: "m3",
    order: 2,
    title: "Speaker Count",
    instruction: "How many distinct speakers can you hear?",
    type: "number",
    required: true,
    min: 1,
    max: 10,
  },
  {
    id: "t9",
    mission_id: "m3",
    order: 3,
    title: "Transcription",
    instruction: "If you understand the language, provide a transcription or translation.",
    type: "free_text",
    required: false,
    placeholder: "Transcription or English translation…",
  },

  // ─── Mission 5: Wildlife Camera Traps ───
  {
    id: "t10",
    mission_id: "m5",
    order: 1,
    title: "Species Present",
    instruction: "Which species can you identify in this image? Select all that apply.",
    type: "multiple_choice",
    required: true,
    options: [
      { id: "o22", label: "Zebra" },
      { id: "o23", label: "Wildebeest" },
      { id: "o24", label: "Elephant" },
      { id: "o25", label: "Lion" },
      { id: "o26", label: "Giraffe" },
      { id: "o27", label: "Hyena" },
      { id: "o28", label: "No animal visible" },
      { id: "o29", label: "Other" },
    ],
  },
  {
    id: "t11",
    mission_id: "m5",
    order: 2,
    title: "Animal Count",
    instruction: "How many individual animals can you see?",
    type: "number",
    required: true,
    min: 0,
    max: 50,
  },
];

export const TASK_RESPONSES: TaskResponse[] = [
  { id: "tr1", task_id: "t1", file_id: "f1", user_id: "u5", value: "o2", created_at: "2026-01-16T08:00:00Z" },
  { id: "tr2", task_id: "t2", file_id: "f1", user_id: "u5", value: ["o4"], created_at: "2026-01-16T08:01:00Z" },
  { id: "tr3", task_id: "t3", file_id: "f1", user_id: "u5", value: 4, created_at: "2026-01-16T08:02:00Z" },
  { id: "tr4", task_id: "t1", file_id: "f2", user_id: "u5", value: "o1", created_at: "2026-01-15T09:00:00Z" },
  { id: "tr5", task_id: "t10", file_id: "f15", user_id: "u1", value: ["o22", "o23"], created_at: "2026-01-02T08:00:00Z" },
  { id: "tr6", task_id: "t11", file_id: "f15", user_id: "u1", value: 4, created_at: "2026-01-02T08:01:00Z" },
];

export function getTasksForMission(missionId: string): AnnotationTask[] {
  return ANNOTATION_TASKS.filter((t) => t.mission_id === missionId).sort(
    (a, b) => a.order - b.order,
  );
}

export function getResponsesForFile(fileId: string): TaskResponse[] {
  return TASK_RESPONSES.filter((r) => r.file_id === fileId);
}

export function getFilesNeedingAnnotation(missionId: string): DataFile[] {
  const mission = getMissionById(missionId);
  if (!mission) return [];
  return mission.datasets.flatMap((d) =>
    d.sample_files.filter((f) => f.status === "needs_annotation"),
  );
}
