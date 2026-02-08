import { Link } from "react-router-dom";
import {
  ArrowRight,
  Upload,
  Users,
  Shield,
  Database,
  Rocket,
  Bot,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BlurFade } from "@/components/magicui/blur-fade";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { AnimatedGradientText } from "@/components/magicui/animated-gradient-text";
import { Particles } from "@/components/magicui/particles";
import { BorderBeam } from "@/components/magicui/border-beam";

const features = [
  {
    icon: Rocket,
    title: "Launch Missions",
    description:
      "Create data collection campaigns. Set goals, define schemas, and rally a community around a shared dataset.",
  },
  {
    icon: Upload,
    title: "Simple Contribution",
    description:
      "Drag-and-drop uploads with guided metadata prompts. No technical skills required to make an impact.",
  },
  {
    icon: Shield,
    title: "Expert Curation",
    description:
      "Collaborative labeling workspace with consensus verification. Multiple reviewers ensure gold-standard quality.",
  },
  {
    icon: Bot,
    title: "AI Playground",
    description:
      "Train models on curated datasets and test them instantly in the browser. One-click API export.",
  },
  {
    icon: Users,
    title: "Community Driven",
    description:
      "Everyone from researchers to everyday citizens can contribute, curate, and benefit from open datasets.",
  },
  {
    icon: Globe,
    title: "Open By Default",
    description:
      "All datasets are published under open licenses. Transparent governance and community-defined rules.",
  },
];

const stats = [
  { label: "Datasets", value: 128 },
  { label: "Contributors", value: 2450 },
  { label: "Data Points", value: 185000 },
  { label: "Models Deployed", value: 34 },
];

export default function HomePage() {
  return (
    <div className="relative">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b">
        <Particles
          className="absolute inset-0"
          quantity={60}
          color="#6366f1"
          staticity={30}
        />

        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-12 px-4 py-32 text-center sm:py-44">
          <BlurFade delay={0}>
            <span className="inline-flex items-center gap-2 rounded-full border bg-muted/60 px-4 py-1.5 text-sm font-medium backdrop-blur">
              <Database className="h-3.5 w-3.5" />
              Open data for everyone
            </span>
          </BlurFade>

          <BlurFade delay={0.1}>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              Pool Data.{" "}
              <AnimatedGradientText className="font-display text-4xl font-semibold sm:text-6xl lg:text-7xl">
                Build AI.
              </AnimatedGradientText>{" "}
              <br className="hidden sm:block" />
              Change the World.
            </h1>
          </BlurFade>

          <BlurFade delay={0.2}>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
              DataForAll is a community-driven platform for collecting, curating,
              and deploying open datasets. No gatekeepers — just people building
              useful data together.
            </p>
          </BlurFade>

          <BlurFade delay={0.3}>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/app">
                <Button size="lg" className="gap-2 text-base">
                  Explore Missions <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="lg" variant="outline" className="gap-2 text-base">
                  Start Contributing
                </Button>
              </Link>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-4 py-20 sm:grid-cols-4">
          {stats.map((stat, i) => (
            <BlurFade key={stat.label} delay={0.1 * i} inView>
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl font-bold sm:text-4xl">
                  <NumberTicker value={stat.value} />
                </span>
                <span className="text-meta text-muted-foreground">{stat.label}</span>
              </div>
            </BlurFade>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-6xl px-4 py-28">
        <BlurFade inView>
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything you need to democratize data
            </h2>
            <p className="mt-3 text-muted-foreground text-lg max-w-2xl mx-auto">
              From grassroots data collection to production AI — one platform,
              zero barriers.
            </p>
          </div>
        </BlurFade>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <BlurFade key={feature.title} delay={0.05 * i} inView>
              <Card className="relative overflow-hidden h-full hover:shadow-md transition-shadow">
                <BorderBeam size={180} duration={12} delay={i * 2} />
                <CardHeader>
                  <feature.icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </BlurFade>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-28 text-center">
          <BlurFade inView>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to make data open?
            </h2>
            <p className="mt-3 text-muted-foreground text-lg">
              Join thousands of contributors building the future of open data.
            </p>
          </BlurFade>
          <BlurFade delay={0.1} inView>
            <Link to="/signup">
              <Button size="lg" className="gap-2">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </BlurFade>
        </div>
      </section>
    </div>
  );
}
