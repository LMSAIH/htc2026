import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Particles } from "@/components/magicui/particles";
import { Safari } from "@/components/ui/safari";
import { AboutBento } from "@/components/sections/about-bento";
import { ForEveryoneSection } from "@/components/sections/for-everyone-section";

function useIsDark() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const update = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export default function HomePage() {
  const isDark = useIsDark();

  return (
    <div className="relative">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-background">
        <Particles
          className="absolute inset-0"
          quantity={60}
          color="#2563EB"
          staticity={30}
        />

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-10 px-4 pt-28 pb-16 text-center sm:pt-40 sm:pb-24">
          <BlurFade delay={0.1}>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              AI models that work for people
              <br className="hidden sm:block" />
              <span className="text-muted-foreground">
                — and not the other way around
              </span>
            </h1>
          </BlurFade>

          <BlurFade delay={0.2}>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Crowdsourcing principled data to train AI models that represent
              everyone, not just the few. Anyone — from doctors to students — can
              contribute data, validate annotations, and build datasets that
              power ethical AI.
            </p>
          </BlurFade>

          <BlurFade delay={0.3}>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/app">
                <Button
                  size="lg"
                  className="gap-2 text-base bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 backdrop-blur-sm hover:bg-primary hover:shadow-xl hover:shadow-primary/30 transition-all"
                >
                  Join the Mission <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/signup">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 text-base bg-white/60 dark:bg-white/10 border-white/30 dark:border-white/15 backdrop-blur-md shadow-lg hover:bg-white/80 dark:hover:bg-white/15 hover:shadow-xl transition-all"
                >
                  Contribute Your Data
                </Button>
              </Link>
            </div>
          </BlurFade>

          {/* Dashboard preview in Safari frame with gradient halo */}
          <BlurFade delay={0.4} className="w-full">
            <div className="mx-auto mt-8 w-full max-w-5xl relative">
              {/* Half-circle gradient background behind Safari */}
              <div className="absolute -inset-20 -z-10 rounded-full bg-[radial-gradient(ellipse_at_center,#2563EB_0%,#7C3AED_40%,transparent_70%)] opacity-20 blur-3xl" />

              <div className="rounded-xl shadow-2xl overflow-hidden relative">
                <Safari
                  url="dataforall.xyz/app"
                  imageSrc={isDark ? "/dashboard-dark.png" : "/dashboard-light.png"}
                  style={{ display: "block" }}
                />

                {/* Overlay fade at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-28 bg-linear-to-t from-white dark:from-[#080D1F] to-transparent pointer-events-none z-20" />
              </div>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ── About Us Bento Grid ── */}
      <AboutBento />

      {/* ── For Everyone — Scroll-triggered Roles ── */}
      <ForEveryoneSection />

      {/* ── Final CTA ── */}
      <section className="bg-background">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-28 text-center">
          <BlurFade inView>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to build AI worth trusting?
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Every dataset starts with a single contribution. Make yours count.
            </p>
          </BlurFade>
          <BlurFade delay={0.1} inView>
            <Link to="/signup">
              <Button
                size="lg"
                className="gap-2 bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 backdrop-blur-sm hover:bg-primary hover:shadow-xl hover:shadow-primary/30 transition-all"
              >
                Become a Contributor <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </BlurFade>
        </div>
      </section>
    </div>
  );
}
