import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  User,
  Target,
  Settings,
  ArrowRight,
  Upload,
  Tags,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlurFade } from '@/components/magicui/blur-fade';
import { Highlighter } from '@/components/magicui/highlighter';
import { cn } from '@/lib/utils';

/* ── Role Data ── */
type RoleId = 'non-tech' | 'annotators' | 'technical';

interface Role {
  id: RoleId;
  icon: LucideIcon;
  title: string;
  body: string;
  cta: string;
  ctaHref: string;
  imageIcon: LucideIcon;
  imageTitle: string;
  imageDesc: string;
  color: string;
}

const roles: Role[] = [
  {
    id: 'non-tech',
    icon: User,
    title: 'Contribute your lived experience',
    body: "You don't need to be a programmer to power AI. A doctor classifying medical patterns, a teacher documenting educational resources, or a student recording local biodiversity — your data is the bedrock of ethical AI. Simply upload, describe, and let the community refine it.",
    cta: 'Start Contributing',
    ctaHref: '/signup',
    imageIcon: Upload,
    imageTitle: 'Simple uploads',
    imageDesc:
      'Drag-and-drop your data with guided metadata prompts. No technical skills required.',
    color: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    id: 'annotators',
    icon: Target,
    title: 'Refining the boundaries',
    body: "Precision is our greatest asset. As an annotator, you categorize, label, and validate data to ensure AI models understand the nuances of the real world. Whether you're a linguist tagging sentiment or a radiologist marking anomalies, your expertise makes the difference.",
    cta: 'Become an Annotator',
    ctaHref: '/signup',
    imageIcon: Tags,
    imageTitle: 'Precision labeling',
    imageDesc:
      'Collaborative annotation workspace with consensus verification and quality scoring.',
    color: 'from-violet-500/20 to-purple-500/20',
  },
  {
    id: 'technical',
    icon: Settings,
    title: 'Orchestrating the pipeline',
    body: "Design complex data missions, manage validation schemas, and oversee the integrity of community-driven datasets. Define what 'good data' means for your domain, approve contributions, and export production-ready datasets for model training.",
    cta: 'Create a Mission',
    ctaHref: '/app/create',
    imageIcon: LayoutDashboard,
    imageTitle: 'Full control',
    imageDesc:
      'Define schemas, set validation rules, manage contributors, and export datasets.',
    color: 'from-emerald-500/20 to-teal-500/20',
  },
];

/* ── Background colors for scroll transitions ── */
const bgColors: Record<string, string> = {
  default: '#FFFFFF',
  'non-tech': '#EFF6FF',
  annotators: '#DBEAFE',
  technical: '#1E3A5F',
};

const bgColorsDark: Record<string, string> = {
  default: '#080D1F',
  'non-tech': '#0C1631',
  annotators: '#122450',
  technical: '#1E3A5F',
};

/* ── Placeholder image for each role ── */
function RoleVisual({ role }: { role: Role }) {
  const ImageIcon = role.imageIcon;
  return (
    <div
      className={cn(
        'flex h-full min-h-[500px] flex-col items-center justify-center rounded-3xl border bg-linear-to-br p-12 shadow-xl',
        role.color,
      )}
    >
      <div className="mb-8 flex size-24 items-center justify-center rounded-2xl border-2 bg-background/90 shadow-2xl backdrop-blur">
        <ImageIcon className="h-12 w-12 text-primary" />
      </div>
      <h4 className="mb-3 text-2xl font-bold">{role.imageTitle}</h4>
      <p className="max-w-md text-center text-base text-muted-foreground leading-relaxed">
        {role.imageDesc}
      </p>

      {/* Decorative UI elements */}
      <div className="mt-12 flex w-full max-w-md flex-col gap-4">
        <div className="flex items-center gap-4 rounded-xl border bg-background/70 p-4 backdrop-blur shadow-sm">
          <div className="h-4 w-4 rounded-full bg-emerald-500 shadow-lg" />
          <div className="h-3 flex-1 rounded-full bg-muted" />
          <div className="h-3 w-16 rounded-full bg-primary/40" />
        </div>
        <div className="flex items-center gap-4 rounded-xl border bg-background/70 p-4 backdrop-blur shadow-sm">
          <div className="h-4 w-4 rounded-full bg-amber-500 shadow-lg" />
          <div className="h-3 flex-1 rounded-full bg-muted" />
          <div className="h-3 w-12 rounded-full bg-primary/40" />
        </div>
        <div className="flex items-center gap-4 rounded-xl border bg-background/70 p-4 backdrop-blur shadow-sm">
          <div className="h-4 w-4 rounded-full bg-blue-500 shadow-lg" />
          <div className="h-3 flex-1 rounded-full bg-muted" />
          <div className="h-3 w-20 rounded-full bg-primary/40" />
        </div>
      </div>
    </div>
  );
}

/* ── Theme hook ── */
function useIsDark() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const update = () =>
      setIsDark(document.documentElement.classList.contains('dark'));
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

/* ── Main Section Component ── */
export function ForEveryoneSection() {
  const [activeRole, setActiveRole] = useState<RoleId>('non-tech');
  const sectionRef = useRef<HTMLElement>(null);
  const panelRefs = useRef<Map<RoleId, HTMLDivElement>>(new Map());
  const isDark = useIsDark();

  const handleScroll = useCallback(() => {
    if (!sectionRef.current) return;

    const scrollY = window.scrollY + window.innerHeight / 3;
    let foundRole: RoleId | null = null;

    for (const role of roles) {
      const el = panelRefs.current.get(role.id);
      if (!el) continue;
      const top = el.offsetTop + (sectionRef.current.offsetTop || 0);
      const bottom = top + el.offsetHeight;
      if (scrollY >= top && scrollY < bottom) {
        foundRole = role.id;
        break;
      }
    }

    if (foundRole && foundRole !== activeRole) {
      setActiveRole(foundRole);
    }

    if (sectionRef.current) {
      const colors = isDark ? bgColorsDark : bgColors;
      const color = foundRole ? colors[foundRole] : colors.default;
      sectionRef.current.style.backgroundColor = color;

      // In light mode, the "technical" bg is dark — switch text to light
      if (!isDark && foundRole === 'technical') {
        sectionRef.current.style.color = '#F1F5F9';
      } else {
        sectionRef.current.style.color = '';
      }
    }
  }, [activeRole, isDark]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const activeRoleData = roles.find((r) => r.id === activeRole) || roles[0];

  return (
    <section
      ref={sectionRef}
      className="py-24"
      style={{
        backgroundColor: isDark ? '#080D1F' : '#FFFFFF',
        transition: 'background-color 1s ease, color 1s ease',
      }}
    >
      <div className="mx-auto max-w-6xl px-4">
        <BlurFade inView>
          <div className="mb-20 text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              This platform is built for{' '}
              <Highlighter
                action="highlight"
                color={isDark ? '#1E3A6E' : '#DBEAFE'}
              >
                everyone
              </Highlighter>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Whether you're a domain expert, a data enthusiast, or a machine
              learning engineer — there's a role for you in building AI worth
              trusting.
            </p>
          </div>
        </BlurFade>

        <div className="relative mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-20">
            {/* Left column: scrollable text frames */}
            <div className="flex flex-col">
              {roles.map((role) => {
                const Icon = role.icon;
                const isActive = activeRole === role.id;

                return (
                  <div
                    key={role.id}
                    ref={(el) => {
                      if (el) panelRefs.current.set(role.id, el);
                    }}
                    data-color={role.id}
                    className={cn(
                      'min-h-screen transition-opacity duration-700',
                      'flex flex-col justify-center',
                      'py-32',
                      isActive ? 'opacity-100' : 'lg:opacity-40',
                    )}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-sm font-medium uppercase tracking-wider text-primary">
                        {role.id === 'non-tech'
                          ? 'Data Contributors'
                          : role.id === 'annotators'
                            ? 'Domain Experts'
                            : 'Project Architects'}
                      </span>
                    </div>

                    <h3 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                      {role.title}
                    </h3>
                    <p className="mt-6 max-w-xl text-xl leading-relaxed text-muted-foreground">
                      {role.body}
                    </p>

                    <div className="mt-10">
                      <Link to={role.ctaHref}>
                        <Button
                          size="lg"
                          variant="outline"
                          className="gap-2 bg-white/60 dark:bg-white/10 border-white/30 dark:border-white/15 backdrop-blur-md shadow-lg hover:bg-white/80 dark:hover:bg-white/15 hover:shadow-xl transition-all"
                        >
                          {role.cta}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>

                    {/* Mobile: show image inline */}
                    <div className="mt-12 lg:hidden">
                      <RoleVisual role={role} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right column: sticky image (desktop only) */}
            <div className="hidden lg:block">
              <div className="sticky top-32">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeRole}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <RoleVisual role={activeRoleData} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
