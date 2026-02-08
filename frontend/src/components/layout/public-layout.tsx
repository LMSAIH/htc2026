import { Link, Outlet } from "react-router-dom";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Minimal nav */}
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-xl tracking-tight"
          >
            <span
              aria-hidden
              className="h-8 w-8 bg-foreground dark:bg-white"
              style={{
                WebkitMaskImage: "url(/logo.png)",
                maskImage: "url(/logo.png)",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskSize: "contain",
                maskSize: "contain",
              }}
            />
            <span>
              Data<span className="text-primary">ForAll</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <AnimatedThemeToggler
              aria-label="Toggle theme"
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:h-4 [&>svg]:w-4"
            />
            <a
              href="https://github.com/LMSAIH/htc2026"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="icon">
                <Github className="h-4 w-4" />
              </Button>
            </a>
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Sign up</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-4">
              <Link
                to="/"
                className="flex items-center gap-2 font-bold text-lg"
              >
                <span
                  aria-hidden
                  className="h-6 w-6 bg-foreground dark:bg-white"
                  style={{
                    WebkitMaskImage: "url(/logo.png)",
                    maskImage: "url(/logo.png)",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                  }}
                />
                DataForAll
              </Link>
              <p className="text-sm text-muted-foreground max-w-xs">
                Community-driven open data platform. Pool data, curate datasets,
                and deploy AI models for everyone.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Platform</h4>
              <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link
                  to="/app/missions"
                  className="hover:text-foreground transition-colors"
                >
                  Missions
                </Link>
                <Link
                  to="/app/contribute"
                  className="hover:text-foreground transition-colors"
                >
                  Contribute
                </Link>
                <Link
                  to="/app/curate"
                  className="hover:text-foreground transition-colors"
                >
                  Curate
                </Link>
                <Link
                  to="/app/playground"
                  className="hover:text-foreground transition-colors"
                >
                  AI Playground
                </Link>
              </nav>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Resources</h4>
              <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link
                  to="/app"
                  className="hover:text-foreground transition-colors"
                >
                  Dashboard
                </Link>
                <a
                  href="https://github.com/LMSAIH/htc2026"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
                <span className="text-muted-foreground/60">API Docs (soon)</span>
              </nav>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Legal</h4>
              <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
                <span className="text-muted-foreground/60">Privacy Policy</span>
                <span className="text-muted-foreground/60">Terms of Service</span>
                <span className="text-muted-foreground/60">
                  Data License: CC BY-SA 4.0
                </span>
              </nav>
            </div>
          </div>

          <Separator className="my-8" />

          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} DataForAll. Open data for everyone.
          </p>
        </div>
      </footer>
    </div>
  );
}
