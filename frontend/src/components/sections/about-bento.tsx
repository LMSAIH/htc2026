import { useRef, useState, useEffect } from "react";
import { User, Upload, ShieldCheck, Database, Cpu } from "lucide-react";
import { BentoCard } from "@/components/magicui/bento-grid";
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { World, type GlobeConfig } from "@/components/aceternity/github-globe";
import { BlurFade } from "@/components/magicui/blur-fade";

/* ── Modern Pipeline ── */
function DataFlowBeam() {
  const containerRef = useRef<HTMLDivElement>(null);
  const step1 = useRef<HTMLDivElement>(null);
  const step2 = useRef<HTMLDivElement>(null);
  const step3 = useRef<HTMLDivElement>(null);
  const step4 = useRef<HTMLDivElement>(null);
  const step5 = useRef<HTMLDivElement>(null);

  const steps = [
    { ref: step1, icon: User, label: "Contribute", accent: false },
    { ref: step2, icon: Upload, label: "Upload", accent: false },
    { ref: step3, icon: ShieldCheck, label: "Validate", accent: true },
    { ref: step4, icon: Database, label: "Dataset", accent: false },
    { ref: step5, icon: Cpu, label: "AI Model", accent: false },
  ];

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-between px-6 py-8"
    >
      {steps.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="z-10 flex flex-col items-center gap-1.5">
            <div
              ref={s.ref}
              className={
                s.accent
                  ? "flex size-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/5 shadow-sm"
                  : "flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background dark:bg-muted/30"
              }
            >
              <Icon
                className={
                  s.accent
                    ? "h-4.5 w-4.5 text-primary"
                    : "h-4.5 w-4.5 text-muted-foreground/70"
                }
                strokeWidth={1.5}
              />
            </div>
            <span
              className={
                s.accent
                  ? "text-[10px] font-semibold tracking-wide text-primary"
                  : "text-[10px] font-medium tracking-wide text-muted-foreground/60"
              }
            >
              {s.label}
            </span>
          </div>
        );
      })}

      {/* Beams - fast, subtle */}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={step1}
        toRef={step2}
        curvature={0}
        duration={2}
        pathWidth={1.5}
        pathOpacity={0.12}
        gradientStartColor="#2563EB"
        gradientStopColor="#60a5fa"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={step2}
        toRef={step3}
        curvature={0}
        duration={2}
        pathWidth={1.5}
        pathOpacity={0.12}
        gradientStartColor="#60a5fa"
        gradientStopColor="#2563EB"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={step3}
        toRef={step4}
        curvature={0}
        duration={2}
        pathWidth={1.5}
        pathOpacity={0.12}
        gradientStartColor="#2563EB"
        gradientStopColor="#60a5fa"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={step4}
        toRef={step5}
        curvature={0}
        duration={2}
        pathWidth={1.5}
        pathOpacity={0.12}
        gradientStartColor="#60a5fa"
        gradientStopColor="#2563EB"
      />
    </div>
  );
}

/* ── Clean outlined Globe — theme-aware ── */
const globeConfigLight: GlobeConfig = {
  pointSize: 4,
  globeColor: "#f8fafc",
  showAtmosphere: false,
  atmosphereColor: "#ffffff",
  atmosphereAltitude: 0.1,
  emissive: "#ffffff",
  emissiveIntensity: 0.15,
  shininess: 0.1,
  polygonColor: "rgba(203,213,225,0.3)",
  ambientLight: "#ffffff",
  directionalLeftLight: "#ffffff",
  directionalTopLight: "#ffffff",
  pointLight: "#ffffff",
  arcTime: 800,
  arcLength: 0.6,
  rings: 1,
  maxRings: 3,
  initialPosition: { lat: 22, lng: 60 },
  autoRotate: true,
  autoRotateSpeed: 0.4,
};

const globeConfigDark: GlobeConfig = {
  pointSize: 4,
  globeColor: "#0C1631",
  showAtmosphere: true,
  atmosphereColor: "#2563EB",
  atmosphereAltitude: 0.12,
  emissive: "#0C1631",
  emissiveIntensity: 0.2,
  shininess: 0.15,
  polygonColor: "rgba(37,99,235,0.18)",
  ambientLight: "#93c5fd",
  directionalLeftLight: "#60a5fa",
  directionalTopLight: "#93c5fd",
  pointLight: "#2563EB",
  arcTime: 800,
  arcLength: 0.6,
  rings: 1,
  maxRings: 3,
  initialPosition: { lat: 22, lng: 60 },
  autoRotate: true,
  autoRotateSpeed: 0.4,
};

const arcColors = ["#2563EB", "#60a5fa", "#93c5fd"];

const sampleArcs = [
  { order: 1, startLat: 51.5074, startLng: -0.1278, endLat: 40.7128, endLng: -74.006, arcAlt: 0.15, color: arcColors[0] },
  { order: 1, startLat: 28.6139, startLng: 77.209, endLat: 3.139, endLng: 101.6869, arcAlt: 0.12, color: arcColors[1] },
  { order: 2, startLat: 35.6762, startLng: 139.6503, endLat: -33.8688, endLng: 151.2093, arcAlt: 0.25, color: arcColors[2] },
  { order: 2, startLat: 48.8566, startLng: 2.3522, endLat: 28.6139, endLng: 77.209, arcAlt: 0.18, color: arcColors[0] },
  { order: 3, startLat: -23.5505, startLng: -46.6333, endLat: 51.5074, endLng: -0.1278, arcAlt: 0.3, color: arcColors[1] },
  { order: 3, startLat: 14.5995, startLng: 120.9842, endLat: 35.6762, endLng: 139.6503, arcAlt: 0.1, color: arcColors[2] },
  { order: 4, startLat: -1.2921, startLng: 36.8219, endLat: 48.8566, endLng: 2.3522, arcAlt: 0.2, color: arcColors[0] },
  { order: 4, startLat: 40.7128, startLng: -74.006, endLat: -23.5505, endLng: -46.6333, arcAlt: 0.22, color: arcColors[1] },
];

function GitHubGlobeBackground() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const update = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="absolute -right-24 -top-35 h-[450px] w-[450px] overflow-hidden opacity-30 dark:opacity-60">
      <div className="w-full h-full aspect-square">
        <World
          globeConfig={isDark ? globeConfigDark : globeConfigLight}
          data={sampleArcs}
        />
      </div>
    </div>
  );
}

export function AboutBento() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 bg-background">
      <BlurFade inView>
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            How we're building ethical AI infrastructure
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
            We're building the infrastructure for principled AI training. Every
            dataset on DataForAll is crowdsourced, validated, and openly
            licensed.
          </p>
        </div>
      </BlurFade>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2 md:auto-rows-[180px]">
        {/* div1: row 1, cols 1-2 — Pipeline */}
        <BlurFade delay={0.05} inView className="md:[grid-area:1/1/2/3]">
          <BentoCard
            name="Community to AI pipeline"
            description="Contributors upload data → Community validates quality → Curated datasets power ethical AI models"
            background={<DataFlowBeam />}
            className="h-full"
          />
        </BlurFade>

        {/* div2: row 1, col 3 */}
        <BlurFade delay={0.1} inView className="md:[grid-area:1/3/2/4]">
          <BentoCard
            name="Verifiable contributions"
            description="Multi-stage validation ensures rigorous quality before training."
            background={<div />}
            className="h-full"
          />
        </BlurFade>

        {/* div4: row 2, col 1 */}
        <BlurFade delay={0.15} inView className="md:[grid-area:2/1/3/2]">
          <BentoCard
            name="Open access"
            description="All datasets published under open licenses with transparent governance."
            background={<div />}
            className="h-full"
          />
        </BlurFade>

        {/* div3: row 2, cols 2-3 — Globe */}
        <BlurFade delay={0.2} inView className="md:[grid-area:2/2/3/4]">
          <BentoCard
            name="Global connections"
            description="Contributors worldwide collaborate to build ethical AI datasets across every continent."
            background={<GitHubGlobeBackground />}
            className="h-full"
          />
        </BlurFade>
      </div>
    </section>
  );
}
