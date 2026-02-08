/**
 * Visual Question Answering (VQA) Component
 *
 * Displays an image alongside a question and collects answers.
 * Based on VizWiz / VQA v2 annotation patterns.
 */

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Image as ImageIcon,
  MessageCircleQuestion,
  Plus,
  Trash2,
} from "lucide-react";

export interface VQAPair {
  id: string;
  question: string;
  answer: string;
}

interface VQAWidgetProps {
  filename: string;
  imageSrc?: string;
  /** Pre-defined questions to answer (if any) */
  presetQuestions?: string[];
  /** Whether user can add their own questions */
  allowCustomQuestions?: boolean;
  value: VQAPair[];
  onChange: (pairs: VQAPair[]) => void;
}

export function VQAWidget({
  filename,
  imageSrc,
  presetQuestions = [],
  allowCustomQuestions = true,
  value,
  onChange,
}: VQAWidgetProps) {
  const [newQuestion, setNewQuestion] = useState("");

  // Initialize preset questions that haven't been answered yet
  const existingQs = new Set(value.map((v) => v.question));
  const unansweredPresets = presetQuestions.filter((q) => !existingQs.has(q));

  const addPair = (question: string) => {
    const pair: VQAPair = {
      id: `vqa_${Date.now()}`,
      question: question.trim(),
      answer: "",
    };
    onChange([...value, pair]);
  };

  const updateAnswer = (id: string, answer: string) => {
    onChange(value.map((v) => (v.id === id ? { ...v, answer } : v)));
  };

  const removePair = (id: string) => {
    onChange(value.filter((v) => v.id !== id));
  };

  const handleAddCustom = () => {
    if (newQuestion.trim()) {
      addPair(newQuestion);
      setNewQuestion("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Image preview */}
      <div className="rounded-lg border overflow-hidden bg-muted/20 aspect-[16/10]">
        {imageSrc ? (
          <img src={imageSrc} alt={filename} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-900/20 flex flex-col items-center justify-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 opacity-20 mb-2" />
            <span className="text-sm font-mono opacity-50">{filename}</span>
          </div>
        )}
      </div>

      {/* Preset questions to answer */}
      {unansweredPresets.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            Questions to answer:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {unansweredPresets.map((q, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={() => addPair(q)}
              >
                <Plus className="h-3 w-3" />
                {q.length > 50 ? q.slice(0, 50) + "…" : q}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Q&A pairs */}
      {value.length > 0 && (
        <div className="space-y-3">
          {value.map((pair, idx) => (
            <div
              key={pair.id}
              className="rounded-lg border bg-card overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
                <MessageCircleQuestion className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[13px] font-medium flex-1">
                  Q{idx + 1}: {pair.question}
                </span>
                <button
                  onClick={() => removePair(pair.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-3">
                <Textarea
                  value={pair.answer}
                  onChange={(e) => updateAnswer(pair.id, e.target.value)}
                  placeholder="Type your answer…"
                  rows={2}
                  className="text-[13px]"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add custom question */}
      {allowCustomQuestions && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Add your own question:
          </span>
          <div className="flex gap-2">
            <Input
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="What objects are in this image?"
              className="text-[13px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCustom();
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddCustom}
              disabled={!newQuestion.trim()}
              className="shrink-0 gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[11px]">
          {value.length} Q&A pair{value.length !== 1 ? "s" : ""}
        </Badge>
        {value.length > 0 && (
          <Badge
            variant="outline"
            className={`text-[11px] ${
              value.every((v) => v.answer.trim())
                ? "text-green-600 border-green-300"
                : "text-yellow-600 border-yellow-300"
            }`}
          >
            {value.filter((v) => v.answer.trim()).length}/{value.length} answered
          </Badge>
        )}
      </div>
    </div>
  );
}
