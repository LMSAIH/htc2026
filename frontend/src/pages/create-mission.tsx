import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  X,
  Upload,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  "Agriculture",
  "Environment",
  "Languages",
  "Public Health",
  "Conservation",
  "Education",
  "Transportation",
  "Energy",
  "Other",
];

const COMMON_FILE_TYPES = [
  ".csv",
  ".json",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".pdf",
  ".txt",
  ".parquet",
];

export default function CreateMissionPage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [howTo, setHowTo] = useState("");
  const [category, setCategory] = useState("");
  const [targetContributions, setTargetContributions] = useState("1000");
  const [acceptedTypes, setAcceptedTypes] = useState<string[]>([]);
  const [customType, setCustomType] = useState("");

  // Datasets
  const [datasets, setDatasets] = useState<
    { name: string; description: string }[]
  >([{ name: "", description: "" }]);

  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);

  const addFileType = (type: string) => {
    if (type && !acceptedTypes.includes(type)) {
      setAcceptedTypes((prev) => [...prev, type]);
    }
  };

  const removeFileType = (type: string) => {
    setAcceptedTypes((prev) => prev.filter((t) => t !== type));
  };

  const addDataset = () => {
    setDatasets((prev) => [...prev, { name: "", description: "" }]);
  };

  const updateDataset = (
    index: number,
    field: "name" | "description",
    value: string,
  ) => {
    setDatasets((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    );
  };

  const removeDataset = (index: number) => {
    if (datasets.length > 1) {
      setDatasets((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const isValid =
    title.trim() &&
    reason.trim() &&
    description.trim() &&
    category &&
    acceptedTypes.length > 0 &&
    datasets[0].name.trim();

  const handleCreate = () => {
    if (!isValid) return;
    setCreating(true);
    setTimeout(() => {
      setCreating(false);
      setDone(true);
      setTimeout(() => navigate("/app"), 2000);
    }, 1500);
  };

  if (done) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">Mission Created!</h2>
        <p className="text-muted-foreground">
          Your mission "{title}" is now live. Redirecting to missions…
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/app">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          Create a New Mission
        </h1>
        <p className="text-muted-foreground text-[15px]">
          Define a data collection campaign for the community. Every mission
          needs a clear goal and simple contribution instructions.
        </p>
      </div>

      <Separator />

      {/* ─── Form ─── */}
      <div className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-[14px] font-semibold">
            Mission Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            placeholder='e.g., "Global Crop Disease Detection"'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11"
          />
          <p className="text-[12px] text-muted-foreground">
            A clear, descriptive name for the data collection campaign.
          </p>
        </div>

        {/* Category + Target */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[14px] font-semibold">
              Category <span className="text-red-500">*</span>
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target" className="text-[14px] font-semibold">
              Target Contributions
            </Label>
            <Input
              id="target"
              type="number"
              min={100}
              step={100}
              value={targetContributions}
              onChange={(e) => setTargetContributions(e.target.value)}
              className="h-11"
            />
            <p className="text-[12px] text-muted-foreground">
              How many files do you aim to collect?
            </p>
          </div>
        </div>

        {/* Why this matters */}
        <div className="space-y-2">
          <Label htmlFor="reason" className="text-[14px] font-semibold">
            Why This Mission Matters <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="reason"
            placeholder="Explain the real-world problem this data will help solve…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-[14px] font-semibold">
            Full Description <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="description"
            placeholder="Detailed description of the mission — what data you're collecting, how it will be used, what the final dataset will look like…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
        </div>

        {/* Contribution Instructions */}
        <div className="space-y-2">
          <Label htmlFor="how-to" className="text-[14px] font-semibold">
            How to Contribute
          </Label>
          <Textarea
            id="how-to"
            placeholder="Step-by-step instructions for contributors. Keep it simple — remember, many contributors won't have technical backgrounds."
            value={howTo}
            onChange={(e) => setHowTo(e.target.value)}
            rows={4}
          />
          <p className="text-[12px] text-muted-foreground">
            Tip: Numbered steps work best. "1. Take a photo… 2. Upload it…"
          </p>
        </div>

        <Separator />

        {/* Accepted File Types */}
        <div className="space-y-3">
          <Label className="text-[14px] font-semibold">
            Accepted File Types <span className="text-red-500">*</span>
          </Label>
          <p className="text-[12px] text-muted-foreground -mt-1">
            What file formats should contributors upload?
          </p>

          {/* Quick pick */}
          <div className="flex flex-wrap gap-1.5">
            {COMMON_FILE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  acceptedTypes.includes(t)
                    ? removeFileType(t)
                    : addFileType(t)
                }
                className={`rounded-full border px-2.5 py-1 font-mono text-[12px] transition-all ${
                  acceptedTypes.includes(t)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Custom type */}
          <div className="flex gap-2">
            <Input
              placeholder=".custom"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              className="max-w-36 h-9 font-mono text-[13px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const val = customType.startsWith(".")
                    ? customType
                    : `.${customType}`;
                  addFileType(val.toLowerCase());
                  setCustomType("");
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const val = customType.startsWith(".")
                  ? customType
                  : `.${customType}`;
                addFileType(val.toLowerCase());
                setCustomType("");
              }}
              disabled={!customType.trim()}
            >
              Add
            </Button>
          </div>

          {/* Selected types */}
          {acceptedTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {acceptedTypes.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="gap-1 font-mono text-[12px] pl-2 pr-1"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeFileType(t)}
                    className="rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Datasets */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[14px] font-semibold">
                Datasets <span className="text-red-500">*</span>
              </Label>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Organize uploaded files into named datasets.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDataset}
              className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add Dataset
            </Button>
          </div>

          {datasets.map((ds, i) => (
            <div
              key={i}
              className="border rounded-xl p-4 space-y-3 bg-card relative"
            >
              {datasets.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDataset(i)}
                  className="absolute top-3 right-3 rounded-full hover:bg-muted p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <div className="space-y-1.5">
                <Label className="text-[13px]">
                  Dataset Name {i === 0 && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  placeholder={`e.g., "Leaf Images — Tomato"`}
                  value={ds.name}
                  onChange={(e) => updateDataset(i, "name", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Description</Label>
                <Input
                  placeholder="Brief description of what this dataset contains"
                  value={ds.description}
                  onChange={(e) =>
                    updateDataset(i, "description", e.target.value)
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <Button variant="ghost" asChild>
            <Link to="/app">Cancel</Link>
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!isValid || creating}
            size="lg"
            className="gap-2"
          >
            {creating ? (
              "Creating…"
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Create Mission
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
