/**
 * Audio Transcription Annotation Component
 *
 * Audio player with waveform visualization and transcription field.
 * Based on Label Studio / Prodigy audio annotation patterns.
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  RotateCcw,
} from "lucide-react";

interface AudioTranscriberProps {
  filename: string;
  audioSrc?: string;
  placeholder?: string;
  value: string;
  onChange: (transcription: string) => void;
}

export function AudioTranscriber({
  filename,
  audioSrc,
  placeholder = "Type what you hear…",
  value,
  onChange,
}: AudioTranscriberProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Simulated waveform bars
  const barCount = 60;
  const [bars] = useState(() =>
    Array.from({ length: barCount }, () => 10 + Math.random() * 50),
  );

  useEffect(() => {
    // Simulate audio duration
    if (!audioSrc) {
      setDuration(25.4); // fake duration for demo
    }
  }, [audioSrc]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    if (!audioSrc) {
      // Simulate playback
      setPlaying(!playing);
      if (!playing) {
        const interval = setInterval(() => {
          setCurrentTime((t) => {
            if (t >= duration) {
              clearInterval(interval);
              setPlaying(false);
              return 0;
            }
            return t + 0.1 * speed;
          });
        }, 100);
        return () => clearInterval(interval);
      }
      return;
    }

    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  const skipBack = () => setCurrentTime((t) => Math.max(0, t - 5));
  const skipForward = () => setCurrentTime((t) => Math.min(duration, t + 5));
  const restart = () => {
    setCurrentTime(0);
    setPlaying(false);
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Audio element (hidden) */}
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          onTimeUpdate={() => {
            if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) setDuration(audioRef.current.duration);
          }}
          onEnded={() => setPlaying(false)}
          muted={muted}
        />
      )}

      {/* Waveform visualization */}
      <div className="rounded-lg border bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-mono text-muted-foreground truncate flex-1">
            {filename}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Fake waveform */}
        <div
          className="flex items-end justify-center gap-[2px] h-16 mb-3 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            setCurrentTime(pct * duration);
          }}
        >
          {bars.map((height, i) => {
            const barPct = (i / barCount) * 100;
            const isPlayed = barPct <= progressPct;
            return (
              <div
                key={i}
                className="w-1 rounded-full transition-all duration-75"
                style={{
                  height: `${height}%`,
                  backgroundColor: isPlayed
                    ? "var(--primary)"
                    : "rgba(139, 92, 246, 0.25)",
                }}
              />
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-purple-200 dark:bg-purple-800/40 rounded-full mb-3 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            setCurrentTime(pct * duration);
          }}
        >
          <div
            className="h-full bg-primary rounded-full transition-all duration-75"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={restart}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={skipBack}>
            <SkipBack className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="h-9 w-9 p-0 rounded-full"
            onClick={togglePlay}
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={skipForward}>
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setMuted(!muted)}
          >
            {muted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </Button>

          <div className="flex-1" />

          {/* Speed control */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Speed</span>
            <div className="flex gap-0.5">
              {[0.5, 0.75, 1, 1.25, 1.5].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition-all ${
                    speed === s
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transcription area */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-medium">Transcription</label>
          <span className="text-[11px] text-muted-foreground">
            {value.length} characters
          </span>
        </div>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={5}
          className="text-[14px] leading-relaxed font-mono"
        />
      </div>

      {/* Tips */}
      <div className="rounded-lg bg-muted/50 p-3">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong>Tips:</strong> Use the speed controls to slow down speech. Click
          on the waveform to jump to a specific position. Press <kbd className="px-1 py-0.5 rounded bg-background border text-[10px]">Space</kbd> to
          play/pause, <kbd className="px-1 py-0.5 rounded bg-background border text-[10px]">←</kbd><kbd className="px-1 py-0.5 rounded bg-background border text-[10px]">→</kbd> to
          skip 5s.
        </p>
      </div>
    </div>
  );
}
