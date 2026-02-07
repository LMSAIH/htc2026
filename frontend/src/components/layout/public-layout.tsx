import { Link, Outlet } from "react-router-dom";
import { Database, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Minimal nav */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-xl tracking-tight"
          >
            <Database className="h-6 w-6 text-primary" />
            <span>
              Data<span className="text-primary">ForAll</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
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
      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3">
              <Link
                to="/"
                className="flex items-center gap-2 font-bold text-lg"
              >
                <Database className="h-5 w-5 text-primary" />
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
