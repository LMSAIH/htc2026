import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlurFade } from '@/components/magicui/blur-fade';
import { Highlighter } from '@/components/magicui/highlighter';
import { cn } from '@/lib/utils';

/* ── Role Data ── */
type RoleId = 'non-tech' | 'annotators' | 'technical';

interface Role {
  id: RoleId;
  label: string;
  title: string;
  body: string;
  cta: string;
  ctaHref: string;
  color: string;
}

const roles: Role[] = [
  {
    id: 'non-tech',
    label: 'Contributors',
    title: 'Contribute your lived experience',
    body: "You don't need to be a programmer to power AI. A doctor classifying medical patterns, a teacher documenting educational resources, or a student recording local biodiversity — your data is the bedrock of ethical AI. Simply upload, describe, and let the community refine it.",
    cta: 'Start Contributing',
    ctaHref: '/signup',
    color: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    id: 'annotators',
    label: 'Annotators',
    title: 'Refining the boundaries',
    body: "Precision is our greatest asset. As an annotator, you categorize, label, and validate data to ensure AI models understand the nuances of the real world. Whether you're a linguist tagging sentiment or a radiologist marking anomalies, your expertise makes the difference.",
    cta: 'Become an Annotator',
    ctaHref: '/signup',
    color: 'from-violet-500/20 to-purple-500/20',
  },
  {
    id: 'technical',
    label: 'Architects',
    title: 'Orchestrating the pipeline',
    body: "Design complex data missions, manage validation schemas, and oversee the integrity of community-driven datasets. Define what 'good data' means for your domain, approve contributions, and export production-ready datasets for model training.",
    cta: 'Create a Mission',
    ctaHref: '/app/create',
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

/* ── Dashboard Preview Components ── */

function ContributorPreview() {
  return (
    <div className="flex flex-col gap-4 flex-1 p-6">
      <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
        <span className="bg-orange-100 text-orange-600 rounded px-1.5 py-0.5 text-[10px] font-bold">
          dataforall
        </span>
        <span>/</span>
        <span>Missions</span>
        <span>/</span>
        <span className="text-gray-600">African Crop Disease Detection</span>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🌾</span>
          <h4 className="text-[15px] font-bold text-gray-900">
            African Crop Disease Detection
          </h4>
          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
            Active
          </span>
        </div>
        <p className="text-[12px] text-gray-500 mb-3">
          by <span className="font-medium text-gray-700">Dr. Amina</span> · Agriculture ·{' '}
          <span className="text-amber-600 font-medium">🖼️ Image Classification</span>
        </p>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500" style={{ width: '62%' }} />
          </div>
          <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
            620 / 1,000 (62%)
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-[13px] font-semibold text-gray-700">Contribute</span>
        </div>
        <div className="rounded-lg border-2 border-dashed border-orange-200 bg-orange-50/40 p-6 flex flex-col items-center gap-2 flex-1 justify-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-orange-100">
            <Upload className="h-5 w-5 text-orange-500" />
          </div>
          <span className="text-[13px] font-medium text-gray-600">Drop files here</span>
          <span className="text-[10px] text-gray-400">Accepted: .jpg, .png · Max 10 MB</span>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2.5 rounded-lg bg-gray-50 px-3 py-2">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-[12px] font-medium text-gray-600 flex-1 truncate">leaf_rust_042.jpg</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Approved</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-gray-50 px-3 py-2">
            <div className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[12px] font-medium text-gray-600 flex-1 truncate">blight_sample.png</span>
            <span className="text-[10px] text-amber-600 font-semibold">Pending</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnnotatorPreview() {
  return (
    <div className="flex flex-col gap-4 flex-1 p-6">
      <div className="flex items-center gap-2 text-[11px] font-medium">
        <span className="text-gray-400">←</span>
        <span className="text-gray-600">African Crop Disease Detection</span>
        <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-[10px] font-bold ml-1">
          🖼️ Image Classification
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="h-1.5 w-20 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full bg-violet-500" style={{ width: '33%' }} />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums">4/12</span>
        </div>
      </div>

      <div className="flex gap-3 flex-1">
        <div className="flex-1 rounded-xl bg-white border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4 flex flex-col items-center justify-center">
          <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-green-100 via-emerald-50 to-lime-100 flex items-center justify-center mb-3">
            <img src="/public/leaf.jpg" alt="Leaf" className="w-full h-full object-cover rounded-md" />
          </div>
          <span className="text-[11px] text-gray-400">leaf_healthy_042.jpg</span>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-gray-300">−</span>
            <span className="text-[10px] text-gray-500 font-medium">100%</span>
            <span className="text-[10px] text-gray-300">+</span>
          </div>
        </div>

        <div className="w-[55%] flex flex-col gap-3">
          <div className="rounded-xl bg-white border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-violet-600 uppercase tracking-wider">Task 1 of 3</span>
              <span className="text-[10px] text-gray-400">Required</span>
            </div>
            <p className="text-[13px] font-semibold text-gray-800 mb-3">What disease is visible?</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300" />
                <span className="text-[12px] text-gray-500">Leaf Rust</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300" />
                <span className="text-[12px] text-gray-500">Blight</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300" />
                <span className="text-[12px] text-gray-500">Mildew</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border-2 border-blue-500 bg-blue-50 px-3 py-2">
                <div className="h-3.5 w-3.5 rounded-full border-2 border-blue-500 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                </div>
                <span className="text-[12px] font-semibold text-blue-700">Healthy</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-gray-400">Consensus</span>
              <span className="text-[13px] font-bold text-emerald-600">0.96</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: '96%' }} />
            </div>
          </div>

          <div className="flex gap-2">
            <button className="flex-1 rounded-lg bg-blue-600 py-2 text-[12px] font-semibold text-white">Submit</button>
            <button className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] font-medium text-gray-500">Skip</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchitectPreview() {
  return (
    <div className="flex flex-col gap-4 flex-1 p-6">
      <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
        <span className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 text-[10px] font-bold">dataforall</span>
        <span>/</span>
        <span>Missions</span>
        <span>/</span>
        <span className="text-gray-600">Manage</span>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="flex items-center gap-2 mb-1.5">
          <span>🌾</span>
          <span className="text-[14px] font-bold text-gray-900">African Crop Disease Detection</span>
          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 ml-auto">Live</span>
        </div>
        <div className="flex gap-0 mt-2 border-b border-gray-100">
          <span className="text-[11px] text-gray-400 px-3 py-1.5">Overview</span>
          <span className="text-[11px] text-gray-400 px-3 py-1.5">Data</span>
          <span className="text-[11px] text-gray-400 px-3 py-1.5">Annotate</span>
          <span className="text-[11px] font-semibold text-blue-600 px-3 py-1.5 border-b-2 border-blue-500">Settings</span>
          <span className="text-[11px] text-gray-400 px-3 py-1.5">Models</span>
        </div>
      </div>

      <div className="flex gap-3 flex-1">
        <div className="flex-1 flex flex-col gap-3">
          <div className="rounded-xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Validation Schema</span>
            <div className="mt-2.5 space-y-2">
              {['Image resolution ≥ 1024px', 'GPS metadata required', 'Format: JPEG, PNG'].map((rule) => (
                <div key={rule} className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 rounded bg-blue-500 flex items-center justify-center">
                    <svg className="h-2 w-2 text-white" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                    </svg>
                  </div>
                  <span className="text-[11px] text-gray-600">{rule}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 flex-1">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Contributors</span>
            <div className="mt-2.5 space-y-2">
              {[
                { name: 'Dr. Amina', role: 'Owner', color: 'text-blue-600 bg-blue-50' },
                { name: 'James K.', role: 'Annotator', color: 'text-violet-600 bg-violet-50' },
                { name: 'Sarah M.', role: 'Contributor', color: 'text-gray-500 bg-gray-50' },
              ].map((c) => (
                <div key={c.name} className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500">{c.name[0]}</div>
                  <span className="text-[11px] font-medium text-gray-700 flex-1">{c.name}</span>
                  <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${c.color}`}>{c.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="w-[45%] flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: '1.2k', label: 'Files' },
              { val: '24', label: 'Members' },
              { val: '89%', label: 'Validated' },
              { val: '3', label: 'Models' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-gray-50 border border-gray-100 p-2.5 text-center">
                <div className="text-[16px] font-bold text-gray-800">{s.val}</div>
                <div className="text-[9px] text-gray-400 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 flex-1">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Models</span>
            <div className="mt-2.5 space-y-2">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-2">
                <span className="text-[10px]">✨</span>
                <span className="text-[11px] font-medium text-emerald-700 flex-1">ResNet-50 v2</span>
                <span className="text-[10px] font-bold text-emerald-600">94.2%</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-100 px-2.5 py-2">
                <span className="text-[10px]">⏳</span>
                <span className="text-[11px] font-medium text-orange-700 flex-1">YOLOv8 fine-tune</span>
                <span className="text-[10px] font-bold text-orange-500 animate-pulse">Training…</span>
              </div>
            </div>
          </div>
          <button className="w-full rounded-lg bg-gray-900 py-2.5 text-[12px] font-semibold text-white shadow-sm">
            Export Dataset →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Role Visual Selector ── */
function RoleVisual({ role }: { role: Role }) {
  switch (role.id) {
    case 'non-tech':
      return <ContributorPreview />;
    case 'annotators':
      return <AnnotatorPreview />;
    case 'technical':
      return <ArchitectPreview />;
    default:
      return <ContributorPreview />;
  }
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
  const [stickyVisible, setStickyVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const panelRefs = useRef<Map<RoleId, HTMLDivElement>>(new Map());
  const isDark = useIsDark();

  const handleScroll = useCallback(() => {
    if (!sectionRef.current) return;

    const sectionRect = sectionRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;

    // Show sticky panel when section is in view, hide when leaving
    const sectionTop = sectionRect.top;
    const sectionBottom = sectionRect.bottom;
    const enterThreshold = viewportH * 0.3;
    const exitThreshold = viewportH * 0.5;

    const isVisible =
      sectionTop < enterThreshold && sectionBottom > exitThreshold;
    setStickyVisible(isVisible);

    // Determine active role based on which panel is centered in viewport
    const viewportCenter = viewportH * 0.4;
    let foundRole: RoleId | null = null;

    for (const role of roles) {
      const el = panelRefs.current.get(role.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top < viewportCenter && rect.bottom > viewportCenter) {
        foundRole = role.id;
        break;
      }
    }

    if (foundRole && foundRole !== activeRole) {
      setActiveRole(foundRole);
    }

    // Background color transitions
    if (sectionRef.current) {
      const colors = isDark ? bgColorsDark : bgColors;
      const color = foundRole ? colors[foundRole] : colors.default;
      sectionRef.current.style.backgroundColor = color;

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

  return (
    <section
      ref={sectionRef}
      className="py-24"
      style={{
        backgroundColor: isDark ? '#080D1F' : '#FFFFFF',
        transition: 'background-color 0.8s ease, color 0.8s ease',
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
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16">
            {/* Left column: scrollable text panels */}
            <div className="flex flex-col">
              {roles.map((role, i) => {
                const isActive = activeRole === role.id;

                return (
                  <div
                    key={role.id}
                    ref={(el) => {
                      if (el) panelRefs.current.set(role.id, el);
                    }}
                    className={cn(
                      'min-h-[80vh] transition-opacity duration-500 ease-out',
                      'flex flex-col justify-center',
                      i === 0 ? 'pt-8 pb-24' : i === roles.length - 1 ? 'pt-24 pb-8' : 'py-24',
                      isActive ? 'opacity-100' : 'lg:opacity-20',
                    )}
                  >
                    {/* Role label — clean, no icon box */}
                    <p className="mb-4 text-[13px] font-semibold tracking-wide text-primary/80">
                      {String(i + 1).padStart(2, '0')} — {role.label}
                    </p>

                    <h3 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
                      {role.title}
                    </h3>

                    <p
                      className={cn(
                        'mt-5 max-w-lg text-[17px] leading-relaxed',
                        role.id === 'technical'
                          ? 'text-white/60'
                          : 'text-muted-foreground',
                      )}
                    >
                      {role.body}
                    </p>

                    <div className="mt-8">
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

                    {/* Mobile: inline preview */}
                    <div className="mt-10 lg:hidden">
                      <div
                        className="rounded-2xl border overflow-hidden min-h-[420px] flex flex-col"
                        style={{ backgroundColor: '#FAFAFA' }}
                      >
                        <RoleVisual role={role} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right column: persistent sticky frame with crossfade (desktop) */}
            <div className="hidden lg:block">
              <div
                className="sticky top-[calc(50vh-270px)]"
                style={{
                  opacity: stickyVisible ? 1 : 0,
                  transform: stickyVisible
                    ? 'translateY(0)'
                    : 'translateY(24px)',
                  transition:
                    'opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)',
                }}
              >
                {/* Persistent outer frame — never unmounts */}
                <div
                  className="rounded-2xl border border-gray-200/60 overflow-hidden min-h-[540px] flex flex-col relative"
                  style={{
                    backgroundColor: '#FAFAFA',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Layer each preview, crossfade via opacity */}
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      className="absolute inset-0 flex flex-col"
                      style={{
                        opacity: activeRole === role.id ? 1 : 0,
                        transition: 'opacity 0.5s cubic-bezier(0.16,1,0.3,1)',
                        pointerEvents:
                          activeRole === role.id ? 'auto' : 'none',
                      }}
                    >
                      <RoleVisual role={role} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
