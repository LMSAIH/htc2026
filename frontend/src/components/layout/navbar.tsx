import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Database,
  Rocket,
  Upload,
  CheckCircle,
  BarChart3,
  Bot,
  Menu,
  X,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Missions", href: "/missions", icon: Rocket },
  { label: "Contribute", href: "/contribute", icon: Upload },
  { label: "Curate", href: "/curate", icon: CheckCircle },
  { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { label: "AI Playground", href: "/playground", icon: Bot },
];

export function Navbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <Database className="h-6 w-6 text-primary" />
          <span>
            Data<span className="text-primary">ForAll</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link key={item.href} to={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-2",
                    isActive && "font-semibold"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/LMSAIH/htc2026"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex"
          >
            <Button variant="outline" size="icon">
              <Github className="h-4 w-4" />
            </Button>
          </a>

          <AnimatedThemeToggler className="hidden md:inline-flex h-9 w-9 rounded-md items-center justify-center border border-input bg-background hover:bg-accent transition-colors [&_svg]:h-4 [&_svg]:w-4" />

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="flex items-center gap-2 text-lg font-bold mb-6">
                <Database className="h-5 w-5 text-primary" />
                DataForAll
              </SheetTitle>
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const isActive = location.pathname.startsWith(item.href);
                  return (
                    <Link key={item.href} to={item.href} onClick={() => setOpen(false)}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className="w-full justify-start gap-3"
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
