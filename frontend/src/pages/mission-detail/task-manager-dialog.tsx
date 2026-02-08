import { useState, useMemo, useCallback } from "react";
import {
  CheckCircle2,
  Sparkles,
  Trash2,
  Plus,
  Settings2,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Mission, MissionTaskConfig } from "@/lib/mock-data";
import {
  getTemplate,
  getTemplatesForModelType,
  getRecommendedTemplates,
  groupTemplatesByCategory,
  CATEGORY_LABELS,
  type AnnotationTaskType,
} from "@/lib/annotation-tasks";
import { TaskConfigEditor } from "@/components/annotation/task-config-editor";

interface TaskManagerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mission: Mission;
  onSave: (tasks: MissionTaskConfig[]) => void;
}

export function TaskManagerDialog({
  open,
  onOpenChange,
  mission,
  onSave,
}: TaskManagerDialogProps) {
  const [taskConfigs, setTaskConfigs] = useState<MissionTaskConfig[]>(
    () => (mission.configuredTasks ?? []).map((t) => ({ ...t, configOverrides: { ...t.configOverrides } })),
  );
  const [activeTaskIdx, setActiveTaskIdx] = useState<number | null>(
    () => (mission.configuredTasks && mission.configuredTasks.length > 0 ? 0 : null),
  );

  const availableTemplates = useMemo(
    () => getTemplatesForModelType(mission.model_type),
    [mission.model_type],
  );

  const recommendedTypes = useMemo(
    () => new Set(getRecommendedTemplates(mission.model_type).map((t) => t.type)),
    [mission.model_type],
  );

  const grouped = useMemo(
    () => groupTemplatesByCategory(availableTemplates),
    [availableTemplates],
  );

  const selectedTypes = useMemo(
    () => new Set(taskConfigs.map((t) => t.type)),
    [taskConfigs],
  );

  const toggleTask = (type: AnnotationTaskType) => {
    if (selectedTypes.has(type)) {
      const idx = taskConfigs.findIndex((t) => t.type === type);
      const next = taskConfigs.filter((t) => t.type !== type);
      setTaskConfigs(next);
      if (activeTaskIdx !== null) {
        if (activeTaskIdx === idx) setActiveTaskIdx(next.length > 0 ? Math.min(idx, next.length - 1) : null);
        else if (activeTaskIdx > idx) setActiveTaskIdx(activeTaskIdx - 1);
      }
    } else {
      const tpl = getTemplate(type);
      const newTask: MissionTaskConfig = {
        type,
        required: false,
        configOverrides: tpl ? { ...tpl.defaultConfig } : {},
      };
      const next = [...taskConfigs, newTask];
      setTaskConfigs(next);
      setActiveTaskIdx(next.length - 1);
    }
  };

  const updateTaskConfig = useCallback((idx: number, updated: MissionTaskConfig) => {
    setTaskConfigs((prev) => prev.map((t, i) => (i === idx ? updated : t)));
  }, []);

  const removeTask = (idx: number) => {
    const next = taskConfigs.filter((_, i) => i !== idx);
    setTaskConfigs(next);
    if (activeTaskIdx === idx) setActiveTaskIdx(next.length > 0 ? Math.min(idx, next.length - 1) : null);
    else if (activeTaskIdx !== null && activeTaskIdx > idx) setActiveTaskIdx(activeTaskIdx - 1);
  };

  const moveTask = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= taskConfigs.length) return;
    const next = [...taskConfigs];
    [next[idx], next[target]] = [next[target], next[idx]];
    setTaskConfigs(next);
    if (activeTaskIdx === idx) setActiveTaskIdx(target);
    else if (activeTaskIdx === target) setActiveTaskIdx(idx);
  };

  const handleSave = () => onSave(taskConfigs);

  const activeTask = activeTaskIdx !== null ? taskConfigs[activeTaskIdx] : null;
  const activeTemplate = activeTask ? getTemplate(activeTask.type) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-7xl max-h-[92vh] h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Annotation Schema Editor
          </DialogTitle>
          <DialogDescription>
            Define the annotation tasks, input types, and output schemas for this mission.
            Annotators will follow this configuration when labeling data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* ═══ LEFT PANEL — Task Selection & Order ═══ */}
          <div className="w-full md:w-[300px] lg:w-[360px] border-b md:border-b-0 md:border-r flex flex-col shrink-0 max-h-[35vh] md:max-h-none">
            <div className="px-4 py-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">Active Tasks</span>
                <Badge variant="secondary" className="text-[11px]">
                  {taskConfigs.length}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Click a task to configure its schema. Drag to reorder.
              </p>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-3 space-y-1.5">
                {taskConfigs.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-[13px] font-medium">No tasks added</p>
                    <p className="text-[11px] mt-1">Add tasks from the catalog below.</p>
                  </div>
                )}
                {taskConfigs.map((tc, idx) => {
                  const tpl = getTemplate(tc.type);
                  if (!tpl) return null;
                  const isActive = activeTaskIdx === idx;
                  return (
                    <div
                      key={`${tc.type}-${idx}`}
                      className={`group flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-all ${
                        isActive
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/30 hover:bg-muted/30"
                      }`}
                      onClick={() => setActiveTaskIdx(idx)}
                    >
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          className="text-muted-foreground/40 hover:text-foreground h-3 disabled:opacity-20"
                          disabled={idx === 0}
                          onClick={(e) => { e.stopPropagation(); moveTask(idx, -1); }}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground/40 hover:text-foreground h-3 disabled:opacity-20"
                          disabled={idx === taskConfigs.length - 1}
                          onClick={(e) => { e.stopPropagation(); moveTask(idx, 1); }}
                        >
                          ▼
                        </button>
                      </div>
                      <span className="text-sm shrink-0">{tpl.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate">
                          {tc.customTitle || tpl.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {tpl.category} · {tc.required ? "required" : "optional"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        onClick={(e) => { e.stopPropagation(); removeTask(idx); }}
                        title="Remove task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}

                {taskConfigs.length > 0 && (
                  <Separator className="my-3" />
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-muted-foreground">Add Tasks</span>
                    <button
                      type="button"
                      onClick={() => {
                        const recommended = getRecommendedTemplates(mission.model_type);
                        const newTasks: MissionTaskConfig[] = recommended.map((t) => ({
                          type: t.type,
                          required: false,
                          configOverrides: { ...t.defaultConfig },
                        }));
                        setTaskConfigs(newTasks);
                        setActiveTaskIdx(newTasks.length > 0 ? 0 : null);
                      }}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 ml-auto"
                    >
                      <Sparkles className="h-3 w-3" />
                      Use recommended
                    </button>
                  </div>

                  {(Object.entries(grouped) as [string, typeof availableTemplates][]).map(
                    ([cat, templates]) => (
                      <div key={cat} className="space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                          {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}
                        </span>
                        {templates.map((tpl) => {
                          const isAdded = selectedTypes.has(tpl.type);
                          return (
                            <button
                              key={tpl.type}
                              type="button"
                              onClick={() => { if (!isAdded) toggleTask(tpl.type); }}
                              disabled={isAdded}
                              className={`w-full text-left rounded-md px-2.5 py-1.5 text-[12px] transition-all flex items-center gap-2 ${
                                isAdded
                                  ? "opacity-40 cursor-not-allowed bg-muted/20"
                                  : "hover:bg-muted/50 cursor-pointer"
                              }`}
                            >
                              <span>{tpl.emoji}</span>
                              <span className="flex-1 truncate">{tpl.label}</span>
                              {isAdded ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                              ) : recommendedTypes.has(tpl.type) ? (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">rec</Badge>
                              ) : (
                                <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* ═══ RIGHT PANEL — Task Configuration ═══ */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {activeTask && activeTemplate ? (
              <ScrollArea className="flex-1">
                <div className="p-4 sm:p-6 lg:p-8">
                  <TaskConfigEditor
                    template={activeTemplate}
                    taskConfig={activeTask}
                    onChange={(updated) => updateTaskConfig(activeTaskIdx!, updated)}
                  />
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div className="space-y-2 text-muted-foreground">
                  <Settings2 className="h-10 w-10 mx-auto opacity-30" />
                  <p className="text-[14px] font-medium">
                    {taskConfigs.length === 0
                      ? "Add annotation tasks to get started"
                      : "Select a task to configure"}
                  </p>
                  <p className="text-[12px] max-w-sm mx-auto">
                    {taskConfigs.length === 0
                      ? "Choose from the task catalog on the left, or click 'Use recommended' for sensible defaults based on your model type."
                      : "Click on any task in the list to customize its labels, output schema, and annotator instructions."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t shrink-0 flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 sm:mr-auto text-[12px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Changes apply to new annotations. Existing annotations are preserved.
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Save ({taskConfigs.length} task{taskConfigs.length !== 1 ? "s" : ""})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
