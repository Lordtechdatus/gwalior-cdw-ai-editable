"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDashed,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Database,
  Download,
  Eye,
  Factory,
  FileCheck2,
  FilePlus2,
  ImageIcon,
  LayoutDashboard,
  Leaf,
  LoaderCircle,
  LogOut,
  MapPin,
  Menu,
  Recycle,
  Route,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Truck,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Role = "generator" | "recycler" | "authority";
type Screen = "role-selection" | "generator-login" | "recycler-login" | "authority-login" | "otp-verification" | "generator-dashboard" | "recycler-dashboard" | "authority-dashboard";
type AuthSession = { authenticated: boolean; mobile?: string; role?: Role | null };
type ReportStatus =
  | "Submitted"
  | "Processing"
  | "Scheduled"
  | "Collected"
  | "Recycled"
  | "Review";

type Viewer = {
  name: string;
  email: string;
  authenticated: boolean;
};

type MaterialResult = {
  material: string;
  probability: number;
  areaM2: number;
  volumeM3: number;
  massKg: number;
  co2Kg: number;
  color: string;
};

type AnalysisResult = {
  analysisId: string;
  mode: "prototype" | "model";
  dominantMaterial: string;
  confidence: number;
  manualReviewRequired: boolean;
  totalAreaM2: number;
  totalVolumeM3: number;
  totalMassKg: number;
  totalCo2Kg: number;
  materials: MaterialResult[];
  message: string;
};

type WasteReport = {
  id: string;
  material: string;
  volume: number;
  mass: number;
  location: string;
  status: ReportStatus;
  date: string;
  confidence: number;
  generator: string;
  co2: number;
};

const roleDetails: Record<
  Role,
  {
    label: string;
    description: string;
    icon: typeof Building2;
    access: string[];
  }
> = {
  generator: {
    label: "Waste Generator",
    description: "Report C&D waste, request collection, and track every movement.",
    icon: Building2,
    access: ["AI waste report", "Collection tracking", "Impact history"],
  },
  recycler: {
    label: "Recycler",
    description: "Receive assigned loads, verify quantities, and record recovery.",
    icon: Recycle,
    access: ["Assigned loads", "Processing updates", "Recovery certificate"],
  },
  authority: {
    label: "Authority",
    description: "Review reports, supervise compliance, and monitor the city.",
    icon: ShieldCheck,
    access: ["City analytics", "Compliance review", "Audit records"],
  },
};

const loginDetails: Record<Role, { title: string; description: string; userType: string }> = {
  generator: { title: "Waste Generator Login", description: "Report C&D waste and track collection.", userType: "Generator/User" },
  recycler: { title: "Recycler Team Login", description: "Manage assigned loads and recycling verification.", userType: "Recycling Team" },
  authority: { title: "Authority Admin Login", description: "Review reports, compliance, and city operations.", userType: "Admin" },
};

function loginScreenFor(role: Role): Screen {
  return `${role}-login` as Screen;
}

function dashboardScreenFor(role: Role): Screen {
  return `${role}-dashboard` as Screen;
}

const initialReports: WasteReport[] = [
  {
    id: "NG-2026-001",
    material: "Concrete",
    volume: 2.5,
    mass: 4500,
    location: "Lashkar",
    status: "Scheduled",
    date: "11 Jul 2026",
    confidence: 0.86,
    generator: "Apex Buildworks",
    co2: 750,
  },
  {
    id: "NG-2026-002",
    material: "Mixed waste",
    volume: 1.8,
    mass: 3240,
    location: "City Centre",
    status: "Collected",
    date: "10 Jul 2026",
    confidence: 0.63,
    generator: "UrbanArc Projects",
    co2: 521,
  },
  {
    id: "NG-2026-003",
    material: "Brick",
    volume: 3.2,
    mass: 5760,
    location: "Morar",
    status: "Recycled",
    date: "09 Jul 2026",
    confidence: 0.91,
    generator: "Gwalior Habitat",
    co2: 768,
  },
  {
    id: "NG-2026-004",
    material: "Steel",
    volume: 0.7,
    mass: 5495,
    location: "Thatipur",
    status: "Review",
    date: "11 Jul 2026",
    confidence: 0.54,
    generator: "Metro Civil Works",
    co2: 10990,
  },
  {
    id: "NG-2026-005",
    material: "Soil",
    volume: 4.1,
    mass: 6560,
    location: "Gole Ka Mandir",
    status: "Processing",
    date: "08 Jul 2026",
    confidence: 0.84,
    generator: "Nirman Associates",
    co2: 205,
  },
];

const impactTrend = [
  { month: "Feb", recycled: 12, landfill: 8 },
  { month: "Mar", recycled: 15, landfill: 7 },
  { month: "Apr", recycled: 18, landfill: 6 },
  { month: "May", recycled: 17, landfill: 5 },
  { month: "Jun", recycled: 23, landfill: 4 },
  { month: "Jul", recycled: 27, landfill: 3 },
];

const statusTone: Record<ReportStatus, string> = {
  Submitted: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  Processing: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  Scheduled: "border-violet-400/20 bg-violet-400/10 text-violet-300",
  Collected: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
  Recycled: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  Review: "border-rose-400/20 bg-rose-400/10 text-rose-300",
};

function formatMass(massKg: number) {
  return massKg >= 1000
    ? `${(massKg / 1000).toFixed(2)} t`
    : `${massKg.toFixed(0)} kg`;
}

function formatCo2(co2Kg: number) {
  const sign = co2Kg < 0 ? "−" : "";
  const value = Math.abs(co2Kg);
  return value >= 1000
    ? `${sign}${(value / 1000).toFixed(2)} t`
    : `${sign}${value.toFixed(0)} kg`;
}

export default function CdwPlatform({ viewer }: { viewer: Viewer }) {
  const [screen, setScreen] = useState<Screen>("role-selection");
  const [role, setRole] = useState<Role>("generator");
  const [session, setSession] = useState<AuthSession>({ authenticated: false });
  const [mobile, setMobile] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeView, setActiveView] = useState("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [reports, setReports] = useState(initialReports);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => (response.ok ? (await response.json()) as AuthSession : { authenticated: false }))
      .then((current) => {
        if (!active) return;
        setSession(current);
        if (current.authenticated && current.mobile) {
          setMobile(current.mobile);
          if (current.role) {
            setRole(current.role);
            setScreen(dashboardScreenFor(current.role));
          }
        }
      })
      .finally(() => active && setAuthLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const guardHistory = () => {
      window.history.pushState({ cdwScreen: screen }, "", window.location.href);
    };
    window.history.replaceState({ cdwScreen: screen }, "", window.location.href);
    const onPopState = () => {
      if (!session.authenticated && screen.includes("dashboard")) {
        setScreen("role-selection");
      }
      guardHistory();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [screen, session.authenticated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function beginRoleLogin(selectedRole: Role) {
    setRole(selectedRole);
    setActiveView("overview");
    setScreen(loginScreenFor(selectedRole));
    setMobileMenu(false);
  }

  function leaveWorkspace() {
    setScreen("role-selection");
    setMobileMenu(false);
  }

  async function logout(changeNumber = false) {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession({ authenticated: false });
    setDemoMode(false);
    setRole("generator");
    setActiveView("overview");
    setMobileMenu(false);
    setMobile("");
    setScreen("role-selection");
  }

  if (authLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#07100f] text-[#79e9bd]"><LoaderCircle className="h-7 w-7 animate-spin" aria-label="Checking secure session" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#07100f] text-[#f3fbf8]">
      {screen === "role-selection" && (
        <RoleSelection viewer={viewer} onSelect={beginRoleLogin} />
      )}

      {(screen === "generator-login" || screen === "recycler-login" || screen === "authority-login") && (
        <MobileEntry
          role={role}
          mobile={mobile}
          onMobileChange={setMobile}
          onBack={() => setScreen("role-selection")}
          onSent={(activeDemoMode) => {
            setDemoMode(activeDemoMode);
            setScreen("otp-verification");
          }}
        />
      )}

      {screen === "otp-verification" && (
        <OtpVerification
          mobile={mobile}
          role={role}
          demoMode={demoMode}
          onVerified={(verifiedRole) => {
            if (verifiedRole !== role) {
              setToast("You are not authorized to access this workspace.");
              setScreen("role-selection");
              return;
            }
            setSession({ authenticated: true, mobile, role: verifiedRole });
            setRole(verifiedRole);
            setScreen(dashboardScreenFor(verifiedRole));
            setToast("Mobile number verified successfully");
          }}
          onChangeMobile={() => { setMobile(""); setDemoMode(false); setScreen(loginScreenFor(role)); }}
        />
      )}

      {screen === dashboardScreenFor(role) && session.authenticated && session.role === role && (
        <Workspace
          viewer={viewer}
          role={role}
          activeView={activeView}
          mobileMenu={mobileMenu}
          reports={reports}
          onReportsChange={setReports}
          onViewChange={(view) => {
            setActiveView(view);
            setMobileMenu(false);
          }}
          onMenu={() => setMobileMenu((value) => !value)}
          onLeave={leaveWorkspace}
          onLogout={() => logout(false)}
          onChangeMobile={() => logout(true)}
          onToast={setToast}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-300/20 bg-[#10231e] px-4 py-3 text-sm text-emerald-100 shadow-2xl">
          <CheckCircle2 className="h-4 w-4 text-[#2ee6a6]" />
          {toast}
        </div>
      )}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-10 w-10 place-items-center rounded-xl border border-[#2ee6a6]/30 bg-[#2ee6a6]/10 text-[#2ee6a6]">
        <Recycle className="h-5 w-5" />
        <span className="pulse-dot absolute right-0 top-0 h-2 w-2 rounded-full bg-[#2ee6a6]" />
      </div>
      {!compact && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#82a49b]">
            Smart City Gwalior
          </p>
          <p className="text-sm font-semibold text-white">Nirmal C&D Intelligence</p>
        </div>
      )}
    </div>
  );
}

function Landing({ onStart, viewer }: { onStart: () => void; viewer: Viewer }) {
  return (
    <main className="grid-surface min-h-screen overflow-hidden">
      <header className="mx-auto flex w-full max-w-[1420px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Brand />
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs text-[#78958e]">
              {viewer.authenticated ? "Authenticated workspace" : "Project demonstration"}
            </p>
            <p className="text-sm font-medium text-[#dcece7]">{viewer.name}</p>
          </div>
          <button
            onClick={onStart}
            className="rounded-xl border border-[#2ee6a6]/25 bg-[#2ee6a6]/10 px-4 py-2.5 text-sm font-semibold text-[#73f1c3] transition hover:bg-[#2ee6a6]/15"
          >
            Open workspace
          </button>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-86px)] w-full max-w-[1420px] items-center gap-14 px-5 pb-14 pt-8 sm:px-8 lg:grid-cols-[1.04fr_.96fr] lg:px-12 lg:pb-20">
        <div className="fade-up max-w-3xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#2ee6a6]/20 bg-[#2ee6a6]/8 px-3 py-1.5 text-xs font-semibold text-[#72eebf]">
            <Sparkles className="h-3.5 w-3.5" />
            Field intelligence for circular construction
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
            From a site photo to a
            <span className="block text-[#2ee6a6]">verified recycling record.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-[#9bb0aa] sm:text-lg">
            Report construction waste, estimate material quantities, coordinate collection,
            and give Gwalior authorities one traceable view of recycling and compliance.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <button
              onClick={onStart}
              className="accent-shadow inline-flex items-center gap-2 rounded-xl bg-[#2ee6a6] px-5 py-3.5 text-sm font-bold text-[#052018] transition hover:-translate-y-0.5 hover:bg-[#56edba]"
            >
              Enter operations hub <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#workflow"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-5 py-3.5 text-sm font-semibold text-[#d8e9e4] transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              View workflow <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-12 grid max-w-2xl grid-cols-3 gap-3 border-t border-white/8 pt-6">
            {[
              ["5", "Material classes"],
              ["3", "Operational roles"],
              ["100%", "Traceable workflow"],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="text-2xl font-semibold text-white sm:text-3xl">{value}</p>
                <p className="mt-1 text-[11px] leading-4 text-[#708a83] sm:text-xs">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[610px] lg:mx-0 lg:ml-auto">
          <div className="absolute -inset-8 rounded-[3rem] bg-[#2ee6a6]/5 blur-3xl" />
          <div className="glass-panel relative overflow-hidden rounded-[2rem] p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-white/8 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6e8e85]">
                  Live audit preview
                </p>
                <p className="mt-1 text-sm font-semibold text-white">Site image NG-AUD-1186</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#2ee6a6]/10 px-3 py-1.5 text-xs font-semibold text-[#72eebf]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2ee6a6]" /> Analysed
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[1.08fr_.92fr]">
              <div className="relative h-64 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(155deg,#233b35,#0b1715_60%,#07100f)]">
                <div className="absolute inset-x-8 bottom-7 h-24 rounded-[50%_45%_25%_30%] bg-[#6d776c] opacity-50 blur-[1px]" />
                <div className="absolute bottom-8 left-14 h-16 w-24 rotate-[-8deg] rounded-lg bg-[#9b5d3d]/70" />
                <div className="absolute bottom-9 right-16 h-20 w-28 rotate-[5deg] rounded-xl bg-[#89918e]/70" />
                <div className="absolute inset-x-0 top-0 h-px bg-[#2ee6a6] shadow-[0_0_14px_#2ee6a6] scan-line" />
                <div className="absolute left-4 top-4 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] text-[#b7cbc5] backdrop-blur">
                  RGB • 224 × 224
                </div>
                <div className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-lg border border-[#2ee6a6]/20 bg-[#09221a]/85 px-2.5 py-1.5 text-[10px] font-semibold text-[#70ecc0]">
                  <ScanLine className="h-3 w-3" /> Region map generated
                </div>
              </div>

              <div className="space-y-3">
                <div className="soft-panel rounded-2xl p-4">
                  <p className="text-[11px] text-[#78958e]">Dominant material</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p className="text-xl font-semibold text-white">Concrete</p>
                    <p className="text-sm font-semibold text-[#2ee6a6]">79.2%</p>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full w-[79%] rounded-full bg-[#2ee6a6]" />
                  </div>
                </div>
                {[
                  ["Volume", "2.24 m³"],
                  ["Waste mass", "5.38 t"],
                  ["CO₂ estimate", "842 kg"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-3.5 py-3"
                  >
                    <span className="text-xs text-[#78958e]">{label}</span>
                    <span className="text-sm font-semibold text-[#dff1eb]">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-3.5 py-3 text-[11px] leading-5 text-amber-100/80">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
              Quantities remain estimates until a field officer confirms calibration and actual weight.
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="border-t border-white/8 bg-[#091411] px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1420px]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2ee6a6]">
            One accountable chain
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white">
            Every report moves through a controlled municipal workflow.
          </h2>
          <div className="mt-9 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              [Camera, "Capture", "Photo and site data"],
              [Sparkles, "Analyse", "Material estimate"],
              [ClipboardCheck, "Verify", "Officer review"],
              [Truck, "Collect", "Vehicle tracking"],
              [Recycle, "Recover", "Recycler evidence"],
              [ShieldCheck, "Close", "Compliance record"],
            ].map(([Icon, title, detail], index) => {
              const WorkflowIcon = Icon as typeof Camera;
              return (
                <article key={title as string} className="soft-panel relative rounded-2xl p-4">
                  <p className="text-[10px] font-semibold text-[#58756d]">0{index + 1}</p>
                  <WorkflowIcon className="mt-5 h-5 w-5 text-[#2ee6a6]" />
                  <h3 className="mt-4 text-sm font-semibold text-white">{title as string}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#78958e]">{detail as string}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function AuthShell({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  return (
    <main className="grid-surface min-h-screen px-4 py-6 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        {onBack ? (
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#91aaa2] hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        ) : <span />}
        <Brand />
      </div>
      <div className="mx-auto grid min-h-[calc(100vh-90px)] max-w-lg place-items-center py-10">
        <section className="glass-panel w-full rounded-[2rem] p-6 shadow-2xl sm:p-9">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[#2ee6a6]/25 bg-[#2ee6a6]/10 text-[#2ee6a6]">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="mt-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#2ee6a6]">Nirmal Gwalior</p>
          <h1 className="mt-3 text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">Secure access to your operations workspace</h1>
          {children}
        </section>
      </div>
    </main>
  );
}

function MobileEntry({ role, mobile, onMobileChange, onSent, onBack }: { role: Role; mobile: string; onMobileChange: (value: string) => void; onSent: (demoMode: boolean) => void; onBack: () => void }) {
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const valid = /^[6-9]\d{9}$/.test(mobile);
  const clientDemoMode = process.env.NEXT_PUBLIC_DEMO_OTP_MODE === "true";

  async function sendOtp(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) { setError("Enter a valid 10-digit Indian mobile number beginning with 6, 7, 8, or 9."); return; }
    setSending(true); setError("");
    if (clientDemoMode) {
      setOtpSent(true);
      onSent(true);
      void fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, role }),
      }).catch(() => undefined);
      return;
    }
    try {
      const response = await fetch("/api/auth/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile, role }) });
      const body = await response.json() as { error?: string; success?: boolean; demoMode?: boolean };
      if (!response.ok) throw new Error(body.error ?? "Unable to send OTP.");
      setOtpSent(body.success === true);
      onSent(body.demoMode === true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send OTP.");
    } finally { setSending(false); }
  }

  return (
    <AuthShell onBack={onBack}>
      <div className="mt-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2ee6a6]">{loginDetails[role].userType}</p>
        <h2 className="mt-2 text-xl font-semibold text-white">{loginDetails[role].title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#8ca39c]">{loginDetails[role].description}</p>
      </div>
      <form onSubmit={sendOtp} className="mt-8">
        <label htmlFor="mobile-number" className="text-sm font-semibold text-[#dcebe7]">Mobile number</label>
        <div className={`mt-2 flex overflow-hidden rounded-xl border bg-black/20 focus-within:border-[#2ee6a6]/60 ${error ? "border-rose-400/50" : "border-white/10"}`}>
          <span className="grid place-items-center border-r border-white/10 px-4 text-sm font-semibold text-[#a9beb8]">+91</span>
          <input id="mobile-number" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={mobile} onChange={(event) => { onMobileChange(event.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }} placeholder="98765 43210" className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-base tracking-[0.08em] text-white outline-none placeholder:text-[#48645c]" aria-describedby={error ? "mobile-error" : undefined} aria-invalid={Boolean(error)} autoFocus />
        </div>
        {error && <p id="mobile-error" role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
        <button type="submit" disabled={sending || otpSent} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2ee6a6] px-5 py-3.5 text-sm font-bold text-[#052018] disabled:cursor-not-allowed disabled:opacity-60">
          {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} Send OTP
        </button>
        <button type="button" onClick={onBack} className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-[#91aaa2] hover:text-white">Back to role selection</button>
      </form>
    </AuthShell>
  );
}

function formatOtpTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function OtpVerification({ role, mobile, demoMode, onVerified, onChangeMobile }: { role: Role; mobile: string; demoMode: boolean; onVerified: (role: Role) => void; onChangeMobile: () => void }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [remaining, setRemaining] = useState(600);
  const [resendRemaining, setResendRemaining] = useState(60);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
      setResendRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function setDigit(index: number, value: string) {
    const nextValue = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((digit, position) => position === index ? nextValue : digit));
    setError("");
    if (nextValue && index < 5) {
      window.setTimeout(() => refs.current[index + 1]?.focus(), 0);
    }
  }

  function onKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      window.setTimeout(() => refs.current[index - 1]?.focus(), 0);
    }
    if (event.key === "ArrowLeft" && index > 0) window.setTimeout(() => refs.current[index - 1]?.focus(), 0);
    if (event.key === "ArrowRight" && index < 5) window.setTimeout(() => refs.current[index + 1]?.focus(), 0);
  }

  function onPaste(event: React.ClipboardEvent) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setDigits(Array.from({ length: 6 }, (_, index) => pasted[index] ?? ""));
    window.setTimeout(() => refs.current[Math.min(pasted.length, 6) - 1]?.focus(), 0);
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (remaining === 0) { setError("This OTP has expired. Request a new OTP."); return; }
    const otp = digits.join("");
    if (otp.length !== 6) { setError("Enter the complete six-digit OTP."); return; }
    setProcessing(true); setError("");
    try {
      const response = await fetch("/api/auth/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile, otp, role }) });
      const body = await response.json() as { error?: string; role?: Role };
      if (!response.ok) throw new Error(body.error ?? "OTP verification failed.");
      if (!body.role) throw new Error("You are not authorized to access this workspace.");
      onVerified(body.role);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "OTP verification failed."); }
    finally { setProcessing(false); }
  }

  async function resend() {
    if (resendRemaining > 0) return;
    setProcessing(true); setError("");
    try {
      const response = await fetch("/api/auth/resend-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile, role }) });
      const body = await response.json() as { error?: string; demoMode?: boolean };
      if (!response.ok) throw new Error(body.error ?? "Unable to resend OTP.");
      if (body.demoMode !== demoMode) throw new Error("OTP mode changed. Please enter your mobile number again.");
      setDigits(["", "", "", "", "", ""]); setRemaining(600); setResendRemaining(60); window.setTimeout(() => refs.current[0]?.focus(), 0);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to resend OTP."); }
    finally { setProcessing(false); }
  }

  const masked = `${mobile.slice(0, 5)} ${mobile.slice(5)}`;
  return (
    <AuthShell>
      <p className="mt-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#2ee6a6]">{loginDetails[role].title}</p>
      {demoMode && (
        <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-bold text-amber-200">
          <CircleDashed className="h-3.5 w-3.5" /> Demo Mode – No SMS sent
        </div>
      )}
      <p className="mt-5 text-center text-sm text-[#93aaa3]">OTP sent to <span className="font-semibold text-white">+91 {masked}</span></p>
      {demoMode && <p className="mt-3 text-center text-base font-bold tracking-wide text-[#7aefc2]">Demo OTP: 123456</p>}
      <form onSubmit={verify} className="mt-7">
        <fieldset disabled={processing}>
          <legend className="sr-only">Six-digit one-time password</legend>
          <div className="flex justify-center gap-2 sm:gap-3" onPaste={onPaste}>
            {digits.map((digit, index) => <input key={index} ref={(element) => { refs.current[index] = element; }} value={digit} onChange={(event) => setDigit(index, event.target.value)} onKeyDown={(event) => onKeyDown(index, event)} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} aria-label={`OTP digit ${index + 1}`} className="h-12 w-11 rounded-xl border border-white/10 bg-black/20 text-center text-xl font-semibold text-white outline-none focus:border-[#2ee6a6]/70 sm:h-14 sm:w-12" autoFocus={index === 0} />)}
          </div>
        </fieldset>
        <div className="mt-5 flex items-center justify-between text-xs"><span className={remaining === 0 ? "text-rose-300" : "text-[#78958e]"}>{remaining === 0 ? "OTP expired" : `Expires in ${formatOtpTime(remaining)}`}</span><button type="button" onClick={resend} disabled={processing || resendRemaining > 0} className="font-semibold text-[#63e9b9] disabled:text-[#577069]">{resendRemaining > 0 ? `Resend OTP in ${resendRemaining}s` : "Resend OTP"}</button></div>
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-200">{error}</p>}
        <button type="submit" disabled={processing || digits.some((digit) => !digit)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2ee6a6] px-5 py-3.5 text-sm font-bold text-[#052018] disabled:cursor-not-allowed disabled:opacity-60">{processing && <LoaderCircle className="h-4 w-4 animate-spin" />} Verify OTP</button>
        <button type="button" onClick={onChangeMobile} disabled={processing} className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-[#91aaa2] hover:text-white disabled:opacity-50">Change mobile number</button>
      </form>
    </AuthShell>
  );
}

function RoleSelection({ viewer, onSelect }: { viewer: Viewer; onSelect: (role: Role) => void }) {
  return (
    <main className="grid-surface min-h-screen px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <span />
          <Brand />
        </div>

        <div className="mx-auto mt-16 max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2ee6a6]">
            Access responsibility
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Choose your operations workspace
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#89a099] sm:text-base">
            Select a role to continue to its dedicated mobile verification screen.
          </p>
        </div>

        <div className="mt-11 grid gap-4 lg:grid-cols-3">
          {(Object.keys(roleDetails) as Role[]).map((roleKey, index) => {
            const item = roleDetails[roleKey];
            const Icon = item.icon;
            return (
              <button
                key={roleKey}
                data-role={roleKey}
                onClick={() => onSelect(roleKey)}
                className="group glass-panel rounded-3xl p-6 text-left transition duration-300 hover:-translate-y-1 hover:border-[#2ee6a6]/35"
              >
                <div className="flex items-start justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[#2ee6a6]/20 bg-[#2ee6a6]/10 text-[#2ee6a6]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-semibold text-[#486a61]">0{index + 1}</span>
                </div>
                <h2 className="mt-7 text-xl font-semibold text-white">{item.label}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-[#879d97]">{item.description}</p>
                <ul className="mt-6 space-y-2.5">
                  {item.access.map((access) => (
                    <li key={access} className="flex items-center gap-2 text-xs text-[#b8cbc5]">
                      <Check className="h-3.5 w-3.5 text-[#2ee6a6]" /> {access}
                    </li>
                  ))}
                </ul>
                <div className="mt-7 flex items-center justify-between border-t border-white/8 pt-4 text-sm font-semibold text-[#6feabb]">
                  Enter workspace
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mx-auto mt-8 flex max-w-xl items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs text-[#78958e]">
          <UserRound className="h-4 w-4 text-[#2ee6a6]" />
          Select a role to begin secure access.
        </div>
      </div>
    </main>
  );
}

function Workspace({
  viewer,
  role,
  activeView,
  mobileMenu,
  reports,
  onReportsChange,
  onViewChange,
  onMenu,
  onLeave,
  onLogout,
  onChangeMobile,
  onToast,
}: {
  viewer: Viewer;
  role: Role;
  activeView: string;
  mobileMenu: boolean;
  reports: WasteReport[];
  onReportsChange: (reports: WasteReport[]) => void;
  onViewChange: (view: string) => void;
  onMenu: () => void;
  onLeave: () => void;
  onLogout: () => void;
  onChangeMobile: () => void;
  onToast: (message: string) => void;
}) {
  const navItems = useMemo(() => getNavItems(role), [role]);

  return (
    <div className="min-h-screen bg-[#07100f] lg:grid lg:grid-cols-[248px_1fr]">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-white/8 bg-[#081310] p-4 transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0 ${
          mobileMenu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-1 py-2">
          <Brand />
          <button onClick={onMenu} className="rounded-lg p-2 text-[#78958e] lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-7 rounded-2xl border border-[#2ee6a6]/15 bg-[#2ee6a6]/[0.055] p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5d8277]">
            Active role
          </p>
          <div className="mt-2 flex items-center gap-2.5">
            {(() => {
              const RoleIcon = roleDetails[role].icon;
              return <RoleIcon className="h-4 w-4 text-[#2ee6a6]" />;
            })()}
            <p className="text-sm font-semibold text-[#dff1eb]">{roleDetails[role].label}</p>
          </div>
        </div>

        <nav className="mt-7 flex-1 space-y-1" aria-label={`${roleDetails[role].label} navigation`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? "bg-[#2ee6a6]/10 font-semibold text-[#6ceabd]"
                    : "text-[#819991] hover:bg-white/[0.035] hover:text-[#d8e8e3]"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
                {item.badge && (
                  <span className="ml-auto rounded-full bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/8 pt-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#1b302a] text-xs font-bold text-[#7defc5]">
              {viewer.name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#d9e9e4]">{viewer.name}</p>
              <p className="truncate text-[10px] text-[#607a72]">{viewer.email}</p>
            </div>
          </div>
          <button
            onClick={onLeave}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#7e968e] transition hover:bg-white/[0.035] hover:text-white"
          >
            <ArrowLeft className="h-[18px] w-[18px]" /> Switch workspace
          </button>
          <button
            onClick={onChangeMobile}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#7e968e] transition hover:bg-white/[0.035] hover:text-white"
          >
            <Smartphone className="h-[18px] w-[18px]" /> Change mobile number
          </button>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#7e968e] transition hover:bg-white/[0.035] hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" /> Logout
          </button>
        </div>
      </aside>

      {mobileMenu && <button className="fixed inset-0 z-40 bg-black/65 lg:hidden" onClick={onMenu} aria-label="Close navigation" />}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-white/8 bg-[#07100f]/90 px-4 backdrop-blur-xl sm:px-7 lg:px-9">
          <div className="flex items-center gap-3">
            <button onClick={onMenu} className="rounded-xl border border-white/8 p-2 text-[#9aafa9] lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5d7b72]">Operations hub</p>
              <p className="mt-0.5 text-sm font-semibold text-white sm:text-base">{roleDetails[role].label} workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-[#2ee6a6]/15 bg-[#2ee6a6]/[0.055] px-3 py-1.5 text-[11px] font-semibold text-[#6feabd] sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2ee6a6]" /> System operational
            </span>
            <button className="relative rounded-xl border border-white/8 p-2.5 text-[#91a59f] transition hover:bg-white/[0.035] hover:text-white" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-400" />
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-7 lg:p-9">
          {role === "generator" && (
            <GeneratorWorkspace
              activeView={activeView}
              reports={reports}
              onReportsChange={onReportsChange}
              onViewChange={onViewChange}
              onToast={onToast}
            />
          )}
          {role === "recycler" && (
            <RecyclerWorkspace activeView={activeView} onToast={onToast} />
          )}
          {role === "authority" && (
            <AuthorityWorkspace activeView={activeView} reports={reports} onToast={onToast} />
          )}
        </main>
      </div>
    </div>
  );
}

function getNavItems(role: Role) {
  if (role === "generator") {
    return [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "new-report", label: "New waste report", icon: FilePlus2 },
      { id: "reports", label: "My reports", icon: ClipboardList },
      { id: "collections", label: "Collection tracking", icon: Route },
      { id: "impact", label: "Environmental impact", icon: Leaf },
    ];
  }
  if (role === "recycler") {
    return [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "assigned", label: "Assigned loads", icon: Truck, badge: "3" },
      { id: "processing", label: "Processing records", icon: Factory },
      { id: "certificates", label: "Certificates", icon: FileCheck2 },
      { id: "performance", label: "Recovery performance", icon: BarChart3 },
    ];
  }
  return [
    { id: "overview", label: "City overview", icon: LayoutDashboard },
    { id: "reports", label: "Report review", icon: ClipboardCheck, badge: "3" },
    { id: "compliance", label: "Compliance", icon: ShieldCheck },
    { id: "operations", label: "Collection operations", icon: Truck },
    { id: "analytics", label: "Environmental analytics", icon: BarChart3 },
    { id: "settings", label: "System settings", icon: Settings2 },
  ];
}

function PageHeading({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2ee6a6]">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#819991]">{copy}</p>
      </div>
      {action}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone?: "green" | "blue" | "amber" | "rose";
}) {
  const tones = {
    green: "bg-emerald-400/10 text-emerald-300 border-emerald-300/15",
    blue: "bg-cyan-400/10 text-cyan-300 border-cyan-300/15",
    amber: "bg-amber-400/10 text-amber-300 border-amber-300/15",
    rose: "bg-rose-400/10 text-rose-300 border-rose-300/15",
  };
  return (
    <article className="soft-panel rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-[#769087]">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div className={`grid h-9 w-9 place-items-center rounded-xl border ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[#637e75]">{detail}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusTone[status]}`}>{status}</span>;
}

function GeneratorWorkspace({
  activeView,
  reports,
  onReportsChange,
  onViewChange,
  onToast,
}: {
  activeView: string;
  reports: WasteReport[];
  onReportsChange: (reports: WasteReport[]) => void;
  onViewChange: (view: string) => void;
  onToast: (message: string) => void;
}) {
  if (activeView === "new-report") {
    return (
      <NewWasteReport
        onCancel={() => onViewChange("overview")}
        onSubmitted={(analysis, form, persistedId) => {
          const nextId = persistedId ?? `NG-2026-${String(reports.length + 1).padStart(3, "0")}`;
          onReportsChange([
            {
              id: nextId,
              material: analysis.dominantMaterial,
              volume: analysis.totalVolumeM3,
              mass: analysis.totalMassKg,
              location: form.location,
              status: analysis.manualReviewRequired ? "Review" : "Submitted",
              date: "11 Jul 2026",
              confidence: analysis.confidence,
              generator: form.siteName,
              co2: analysis.totalCo2Kg,
            },
            ...reports,
          ]);
          onToast(`${nextId} submitted successfully`);
          onViewChange("reports");
        }}
      />
    );
  }

  if (activeView === "reports") {
    return <ReportsTable title="My waste reports" reports={reports.slice(0, 4)} onToast={onToast} />;
  }

  if (activeView === "collections") {
    return <CollectionTracking />;
  }

  if (activeView === "impact") {
    return <ImpactView />;
  }

  return (
    <div className="fade-up space-y-7">
      <PageHeading
        eyebrow="Waste generator"
        title="Good afternoon, Apex Buildworks"
        copy="Your current collection is scheduled. Review the assignment or submit a new waste report."
        action={
          <button
            onClick={() => onViewChange("new-report")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2ee6a6] px-4 py-3 text-sm font-bold text-[#052018] transition hover:bg-[#55edba]"
          >
            <Camera className="h-4 w-4" /> New waste report
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Reports submitted" value="12" detail="3 submitted this month" icon={ClipboardList} />
        <MetricCard label="Waste diverted" value="18.6 t" detail="69% verified recycling" icon={Recycle} tone="blue" />
        <MetricCard label="CO₂ avoided" value="1.42 t" detail="Methodology-adjusted estimate" icon={Leaf} tone="green" />
        <MetricCard label="Compliance" value="92%" detail="One document needs attention" icon={ShieldCheck} tone="amber" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
        <section className="soft-panel rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">Active collection</p>
              <p className="mt-1 text-[11px] text-[#6f8981]">Request NG-2026-001 • Concrete waste</p>
            </div>
            <StatusBadge status="Scheduled" />
          </div>

          <div className="mt-7 grid grid-cols-4 gap-1">
            {[
              ["Submitted", true],
              ["Processing", true],
              ["Scheduled", true],
              ["Collected", false],
            ].map(([label, done], index) => (
              <div key={label as string} className="relative text-center">
                {index < 3 && (
                  <div className={`absolute left-1/2 top-3 h-px w-full ${done ? "bg-[#2ee6a6]/55" : "bg-white/10"}`} />
                )}
                <div className={`relative mx-auto grid h-6 w-6 place-items-center rounded-full border ${done ? "border-[#2ee6a6] bg-[#153f32] text-[#2ee6a6]" : "border-white/15 bg-[#0d1a17] text-[#506d64]"}`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-2.5 w-2.5" />}
                </div>
                <p className={`mt-2 text-[9px] sm:text-[11px] ${done ? "text-[#b5ccc5]" : "text-[#58736b]"}`}>{label as string}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 grid gap-3 rounded-2xl border border-white/8 bg-black/10 p-4 sm:grid-cols-3">
            {[
              [CalendarClock, "Collection time", "12 Jul • 09:00 AM"],
              [Truck, "Assigned vehicle", "Tipper • MP07-GA-2841"],
              [UserRound, "Driver", "Rakesh Verma"],
            ].map(([Icon, label, value]) => {
              const ItemIcon = Icon as typeof Truck;
              return (
                <div key={label as string} className="flex items-start gap-3">
                  <ItemIcon className="mt-0.5 h-4 w-4 text-[#2ee6a6]" />
                  <div>
                    <p className="text-[10px] text-[#607a72]">{label as string}</p>
                    <p className="mt-1 text-xs font-semibold text-[#d5e5e0]">{value as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="soft-panel rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white">Impact progress</p>
              <p className="mt-1 text-[11px] text-[#6f8981]">July 2026</p>
            </div>
            <Award className="h-5 w-5 text-amber-300" />
          </div>
          <div className="mt-6 grid place-items-center">
            <div className="relative grid h-32 w-32 place-items-center rounded-full bg-[conic-gradient(#2ee6a6_0_72%,rgba(255,255,255,.06)_72%_100%)]">
              <div className="grid h-[106px] w-[106px] place-items-center rounded-full bg-[#0d1d19] text-center">
                <div>
                  <p className="text-2xl font-semibold text-white">72%</p>
                  <p className="text-[9px] uppercase tracking-[0.16em] text-[#627d75]">monthly goal</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            {[["32%", "less dumping"], ["18%", "CO₂ reduction"], ["245 L", "fuel saved"]].map(([value, label]) => (
              <div key={label} className="rounded-xl bg-white/[0.025] px-2 py-2.5">
                <p className="text-xs font-semibold text-[#dcece7]">{value}</p>
                <p className="mt-1 text-[8px] leading-3 text-[#5f7971]">{label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <ReportsTable title="Recent reports" reports={reports.slice(0, 3)} compact onToast={onToast} />
    </div>
  );
}

function NewWasteReport({
  onCancel,
  onSubmitted,
}: {
  onCancel: () => void;
  onSubmitted: (
    analysis: AnalysisResult,
    form: { siteName: string; location: string },
    persistedId?: string,
  ) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const [siteName, setSiteName] = useState("Apex Buildworks");
  const [location, setLocation] = useState("Lashkar");
  const [cameraHeight, setCameraHeight] = useState("3.0");
  const [fov, setFov] = useState("60");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function analyseImage() {
    if (!file) {
      setError("Choose a construction-waste image first.");
      return;
    }
    setError(null);
    setLoading(true);
    setAnalysis(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("cameraHeight", cameraHeight);
      formData.append("fov", fov);
      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      const payload = (await response.json()) as AnalysisResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Analysis failed");
      setAnalysis(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to analyse this image.");
    } finally {
      setLoading(false);
    }
  }

  async function submitReport() {
    if (!analysis || !file || submitting) return;
    setError(null);
    setSubmitting(true);
    let persistedId: string | undefined;

    try {
      const uploadData = new FormData();
      uploadData.append("image", file);
      const uploadResponse = await fetch("/api/uploads", {
        method: "POST",
        body: uploadData,
      });

      if (uploadResponse.status === 401) {
        onSubmitted(analysis, { siteName, location });
        return;
      }

      const uploadPayload = (await uploadResponse.json()) as {
        objectKey?: string;
        error?: string;
      };
      if (!uploadResponse.ok || !uploadPayload.objectKey) {
        throw new Error(uploadPayload.error ?? "The site image could not be stored.");
      }

      const reportResponse = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          siteName,
          ward: location,
          cameraHeightM: Number(cameraHeight),
          horizontalFovDeg: Number(fov),
          imageObjectKey: uploadPayload.objectKey,
          analysis,
        }),
      });
      const reportPayload = (await reportResponse.json()) as {
        report?: { id?: string };
        error?: string;
      };
      if (!reportResponse.ok || !reportPayload.report?.id) {
        throw new Error(reportPayload.error ?? "The report could not be saved.");
      }
      persistedId = reportPayload.report.id;
      onSubmitted(analysis, { siteName, location }, persistedId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit this report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fade-up space-y-6">
      <PageHeading
        eyebrow="New report"
        title="Capture and quantify C&D waste"
        copy="Upload one clear site image, provide the capture conditions, and review the generated estimate before submission."
        action={
          <button onClick={onCancel} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[#a8bbb5] hover:bg-white/[0.035]">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </button>
        }
      />

      <div className="flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] p-4 text-xs leading-6 text-amber-100/80">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        This build uses a deterministic prototype analyser. It proves the complete coding workflow but does not replace the trained DenseNet, U-Net, and calibrated depth models described in the report.
      </div>

      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <section className="soft-panel rounded-3xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">1. Report information</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Site / generator name">
              <input value={siteName} onChange={(event) => setSiteName(event.target.value)} className="field-control" />
            </Field>
            <Field label="Ward / locality">
              <select value={location} onChange={(event) => setLocation(event.target.value)} className="field-control">
                <option>Lashkar</option><option>City Centre</option><option>Morar</option><option>Thatipur</option><option>Gole Ka Mandir</option>
              </select>
            </Field>
            <Field label="Camera height (m)">
              <input type="number" min="1" max="8" step="0.1" value={cameraHeight} onChange={(event) => setCameraHeight(event.target.value)} className="field-control" />
            </Field>
            <Field label="Horizontal FOV (degrees)">
              <input type="number" min="30" max="120" value={fov} onChange={(event) => setFov(event.target.value)} className="field-control" />
            </Field>
          </div>

          <h2 className="mt-8 text-sm font-semibold text-white">2. Site image</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setAnalysis(null);
              setError(null);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 grid min-h-56 w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-[#2ee6a6]/25 bg-[#2ee6a6]/[0.025] transition hover:border-[#2ee6a6]/45 hover:bg-[#2ee6a6]/[0.045]"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Selected C&D waste" className="h-64 w-full object-cover" />
            ) : (
              <div className="px-5 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#2ee6a6]/10 text-[#2ee6a6]">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="mt-4 text-sm font-semibold text-[#d9ebe5]">Choose a site image</p>
                <p className="mt-1 text-xs text-[#6e8981]">JPEG, PNG or WebP • maximum 10 MB</p>
              </div>
            )}
          </button>
          {file && (
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#78958e]">
              <span className="truncate">{file.name}</span>
              <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          )}

          {error && <p className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-3 py-2.5 text-xs text-rose-200">{error}</p>}

          <button
            onClick={analyseImage}
            disabled={loading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2ee6a6] px-4 py-3.5 text-sm font-bold text-[#052018] transition hover:bg-[#55edba] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Analysing image…</> : <><Sparkles className="h-4 w-4" /> Analyse waste image</>}
          </button>
        </section>

        <section className="soft-panel rounded-3xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">3. Review estimate</h2>
          {!analysis && !loading && (
            <div className="grid min-h-[560px] place-items-center text-center">
              <div className="max-w-xs">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/8 bg-white/[0.025] text-[#58756d]">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <p className="mt-4 text-sm font-semibold text-[#b7cbc5]">No analysis yet</p>
                <p className="mt-2 text-xs leading-6 text-[#607a72]">Upload an image and run the prototype analyser to generate material, mass, and CO₂ estimates.</p>
              </div>
            </div>
          )}
          {loading && <AnalysisSkeleton />}
          {analysis && (
            <AnalysisPanel
              analysis={analysis}
              submitting={submitting}
              onSubmit={submitReport}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-[11px] font-medium text-[#78958e]">{label}{children}</label>;
}

function AnalysisSkeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-4">
      <div className="h-28 rounded-2xl bg-white/[0.035]" />
      <div className="grid grid-cols-2 gap-3"><div className="h-20 rounded-xl bg-white/[0.03]" /><div className="h-20 rounded-xl bg-white/[0.03]" /></div>
      <div className="h-48 rounded-2xl bg-white/[0.03]" />
    </div>
  );
}

function AnalysisPanel({
  analysis,
  submitting,
  onSubmit,
}: {
  analysis: AnalysisResult;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-[#2ee6a6]/15 bg-[#2ee6a6]/[0.045] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#6f9389]">Dominant material</p>
            <p className="mt-2 text-2xl font-semibold text-white">{analysis.dominantMaterial}</p>
          </div>
          <span className="rounded-full bg-[#2ee6a6]/10 px-3 py-1.5 text-xs font-semibold text-[#6feabd]">{(analysis.confidence * 100).toFixed(1)}%</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-[#2ee6a6]" style={{ width: `${analysis.confidence * 100}%` }} />
        </div>
      </div>

      {analysis.manualReviewRequired && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.055] p-3 text-[11px] leading-5 text-amber-100/80">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /> Low confidence: this report will be routed to an authority reviewer.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {[
          ["Estimated area", `${analysis.totalAreaM2.toFixed(2)} m²`],
          ["Estimated volume", `${analysis.totalVolumeM3.toFixed(3)} m³`],
          ["Estimated mass", formatMass(analysis.totalMassKg)],
          ["CO₂ indicator", formatCo2(analysis.totalCo2Kg)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/8 bg-black/10 p-3">
            <p className="text-[10px] text-[#607a72]">{label}</p>
            <p className="mt-1.5 text-sm font-semibold text-[#dcece7]">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
        <p className="text-xs font-semibold text-white">Material breakdown</p>
        <div className="mt-4 space-y-3">
          {analysis.materials.map((material) => (
            <div key={material.material}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-2 text-[#a9bdb7]"><span className="h-2 w-2 rounded-full" style={{ background: material.color }} />{material.material}</span>
                <span className="font-semibold text-[#d9e9e4]">{(material.probability * 100).toFixed(1)}% • {formatMass(material.massKg)}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full" style={{ width: `${material.probability * 100}%`, background: material.color }} /></div>
            </div>
          ))}
        </div>
      </div>

      <button disabled={submitting} onClick={onSubmit} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2ee6a6] px-4 py-3.5 text-sm font-bold text-[#052018] hover:bg-[#55edba] disabled:cursor-not-allowed disabled:opacity-60">
        {submitting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Saving report…</> : <><FileCheck2 className="h-4 w-4" /> Confirm and submit report</>}
      </button>
      <p className="text-center text-[10px] leading-4 text-[#567269]">Submission records the estimate, model mode, capture inputs, and review requirement.</p>
    </div>
  );
}

function ReportsTable({ title, reports, compact = false, onToast }: { title: string; reports: WasteReport[]; compact?: boolean; onToast: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = reports.filter((report) => `${report.id} ${report.material} ${report.location}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <section className={`soft-panel rounded-3xl ${compact ? "p-5 sm:p-6" : "fade-up p-5 sm:p-6"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-sm font-semibold text-white">{title}</h2><p className="mt-1 text-[11px] text-[#668078]">Traceable material and collection records</p></div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/10 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-[#617b73]" />
            <input aria-label="Search reports" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="w-28 bg-transparent text-xs text-white outline-none placeholder:text-[#4f6b62]" />
          </label>
          <button onClick={() => onToast("Report export prepared")} className="rounded-xl border border-white/8 p-2.5 text-[#829991] hover:bg-white/[0.035]" aria-label="Download reports"><Download className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead><tr className="border-b border-white/8 text-[10px] uppercase tracking-[0.12em] text-[#58736b]">{["Report", "Material", "Location", "Volume", "Mass", "Confidence", "Status", ""].map((head) => <th key={head} className="px-3 py-3 font-semibold">{head}</th>)}</tr></thead>
          <tbody>
            {filtered.map((report) => (
              <tr key={report.id} className="border-b border-white/[0.055] text-xs text-[#b8cbc5] last:border-0 hover:bg-white/[0.018]">
                <td className="px-3 py-4"><p className="font-semibold text-[#dcece7]">{report.id}</p><p className="mt-1 text-[9px] text-[#5d776f]">{report.date}</p></td>
                <td className="px-3 py-4">{report.material}</td><td className="px-3 py-4">{report.location}</td><td className="px-3 py-4">{report.volume.toFixed(2)} m³</td><td className="px-3 py-4">{formatMass(report.mass)}</td>
                <td className="px-3 py-4"><span className={report.confidence < 0.65 ? "text-amber-300" : "text-[#9eb5ae]"}>{Math.round(report.confidence * 100)}%</span></td>
                <td className="px-3 py-4"><StatusBadge status={report.status} /></td>
                <td className="px-3 py-4"><button onClick={() => onToast(`Opened ${report.id}`)} className="rounded-lg p-2 text-[#728b83] hover:bg-white/5 hover:text-white" aria-label={`View ${report.id}`}><Eye className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CollectionTracking() {
  const events = [
    ["Report submitted", "11 Jul • 09:14", true],
    ["AI estimate reviewed", "11 Jul • 10:42", true],
    ["Vehicle MP07-GA-2841 assigned", "11 Jul • 12:05", true],
    ["Collection scheduled", "12 Jul • 09:00", true],
    ["Waste collected", "Awaiting field confirmation", false],
    ["Recycler received", "Pending", false],
  ];
  return (
    <div className="fade-up space-y-6">
      <PageHeading eyebrow="Collection tracking" title="Request NG-2026-001" copy="Follow the complete collection chain from submitted report to recycler receipt." />
      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <section className="soft-panel rounded-3xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Status timeline</h2>
          <div className="mt-6 space-y-0">
            {events.map(([label, detail, done], index) => (
              <div key={label as string} className="relative flex gap-4 pb-7 last:pb-0">
                {index < events.length - 1 && <span className={`absolute left-[11px] top-6 h-full w-px ${done ? "bg-[#2ee6a6]/35" : "bg-white/8"}`} />}
                <span className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-full border ${done ? "border-[#2ee6a6] bg-[#153b30] text-[#2ee6a6]" : "border-white/12 bg-[#0c1a17] text-[#516d64]"}`}>{done ? <Check className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}</span>
                <div><p className={`text-xs font-semibold ${done ? "text-[#d6e7e1]" : "text-[#708981]"}`}>{label as string}</p><p className="mt-1 text-[10px] text-[#58736b]">{detail as string}</p></div>
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-4">
          <div className="soft-panel rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Vehicle assignment</h2><Truck className="h-5 w-5 text-[#2ee6a6]" /></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[["Vehicle", "Tipper • MP07-GA-2841"], ["Driver", "Rakesh Verma"], ["ETA", "12 Jul • 09:00 AM"], ["Destination", "Morar Recycling Facility"]].map(([label, value]) => <div key={label} className="rounded-xl bg-black/10 p-3"><p className="text-[10px] text-[#607a72]">{label}</p><p className="mt-1.5 text-xs font-semibold text-[#d8e8e3]">{value}</p></div>)}
            </div>
          </div>
          <div className="soft-panel rounded-3xl p-5 sm:p-6"><div className="flex items-center gap-3"><MapPin className="h-5 w-5 text-[#2ee6a6]" /><div><p className="text-sm font-semibold text-white">Lashkar → Morar</p><p className="mt-1 text-[11px] text-[#668078]">14.6 km • optimized municipal route</p></div></div><div className="mt-5 h-28 overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_20%_60%,rgba(46,230,166,.25),transparent_12%),radial-gradient(circle_at_82%_30%,rgba(46,230,166,.18),transparent_11%),linear-gradient(135deg,#132a24,#0a1714)]"><svg viewBox="0 0 400 112" className="h-full w-full" aria-label="Collection route"><path d="M65 71 C130 18, 230 95, 335 37" fill="none" stroke="#2ee6a6" strokeWidth="3" strokeDasharray="7 6" /><circle cx="65" cy="71" r="7" fill="#2ee6a6" /><circle cx="335" cy="37" r="7" fill="#0d1a17" stroke="#2ee6a6" strokeWidth="3" /></svg></div></div>
        </section>
      </div>
    </div>
  );
}

function ImpactView() {
  return (
    <div className="fade-up space-y-6">
      <PageHeading eyebrow="Environmental impact" title="Your verified diversion impact" copy="Indicators use confirmed recycler records; prototype image estimates are excluded until verification." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Waste recycled" value="18.6 t" detail="Across 9 verified reports" icon={Recycle} /><MetricCard label="Net CO₂ avoided" value="1.42 t" detail="Scenario-based indicator" icon={Leaf} tone="green" /><MetricCard label="Landfill diversion" value="69%" detail="Target: 75%" icon={Route} tone="blue" /><MetricCard label="Reports verified" value="9 / 12" detail="Three still in workflow" icon={ShieldCheck} tone="amber" /></div>
      <TrendPanel />
    </div>
  );
}

function RecyclerWorkspace({ activeView, onToast }: { activeView: string; onToast: (message: string) => void }) {
  const [jobs, setJobs] = useState([
    { id: "NG-2026-001", source: "Apex Buildworks", material: "Concrete", mass: 4500, eta: "12 Jul • 09:35", status: "Assigned" },
    { id: "NG-2026-006", source: "Northern Infra", material: "Brick", mass: 2880, eta: "12 Jul • 11:10", status: "Assigned" },
    { id: "NG-2026-007", source: "City Renewal Cell", material: "Mixed waste", mass: 6120, eta: "12 Jul • 14:25", status: "Review" },
  ]);
  const advance = (id: string) => {
    setJobs((current) => current.map((job) => job.id === id ? { ...job, status: job.status === "Assigned" ? "Received" : "Processing" } : job));
    onToast(`${id} status updated`);
  };

  if (activeView === "certificates") return <CertificateView onToast={onToast} />;
  if (activeView === "performance") return <ImpactView />;

  return (
    <div className="fade-up space-y-7">
      <PageHeading eyebrow="Recycler operations" title={activeView === "overview" ? "Today’s recovery queue" : "Assigned waste loads"} copy="Verify delivered quantities, document processing, and close the recycling chain with evidence." action={<button onClick={() => onToast("Weighbridge record opened")} className="inline-flex items-center gap-2 rounded-xl bg-[#2ee6a6] px-4 py-3 text-sm font-bold text-[#052018]"><Factory className="h-4 w-4" /> Add weighbridge entry</button>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Assigned today" value="3 loads" detail="13.5 tonnes expected" icon={Truck} /><MetricCard label="Received" value="2 loads" detail="8.1 tonnes recorded" icon={ClipboardCheck} tone="blue" /><MetricCard label="Recovery rate" value="81%" detail="Seven-day rolling average" icon={Recycle} tone="green" /><MetricCard label="Evidence due" value="1" detail="Certificate incomplete" icon={AlertTriangle} tone="amber" /></div>
      <section className="soft-panel rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Incoming loads</h2><p className="mt-1 text-[11px] text-[#668078]">Update only after physical verification</p></div><span className="rounded-full bg-[#2ee6a6]/10 px-3 py-1.5 text-[10px] font-semibold text-[#6feabd]">3 active</span></div>
        <div className="mt-5 grid gap-3">
          {jobs.map((job) => (
            <article key={job.id} className="grid gap-4 rounded-2xl border border-white/8 bg-black/10 p-4 md:grid-cols-[1.2fr_.9fr_.8fr_auto] md:items-center">
              <div><div className="flex items-center gap-2"><p className="text-xs font-semibold text-white">{job.id}</p><span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-[#8da39d]">{job.material}</span></div><p className="mt-1.5 text-[10px] text-[#607a72]">{job.source}</p></div>
              <div><p className="text-[10px] text-[#607a72]">Expected quantity</p><p className="mt-1 text-xs font-semibold text-[#d7e7e2]">{formatMass(job.mass)}</p></div>
              <div><p className="text-[10px] text-[#607a72]">Arrival</p><p className="mt-1 text-xs font-semibold text-[#d7e7e2]">{job.eta}</p></div>
              <button onClick={() => advance(job.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2ee6a6]/20 bg-[#2ee6a6]/[0.065] px-3 py-2.5 text-xs font-semibold text-[#6feabd] hover:bg-[#2ee6a6]/10">{job.status}<ChevronRight className="h-3.5 w-3.5" /></button>
            </article>
          ))}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]"><TrendPanel /><section className="soft-panel rounded-3xl p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Material recovery</h2><Recycle className="h-5 w-5 text-[#2ee6a6]" /></div><div className="mt-6 space-y-4">{[["Concrete", 88, "#2ee6a6"], ["Brick", 81, "#67c8ff"], ["Steel", 96, "#ad8cff"], ["Wood", 64, "#f5b557"], ["Soil", 73, "#a5c778"]].map(([material, value, color]) => <div key={material as string}><div className="flex justify-between text-[11px]"><span className="text-[#a9bdb7]">{material as string}</span><span className="font-semibold text-white">{value as number}%</span></div><div className="mt-2 h-1.5 rounded-full bg-white/5"><div className="h-full rounded-full" style={{ width: `${value}%`, background: color as string }} /></div></div>)}</div></section></div>
    </div>
  );
}

function CertificateView({ onToast }: { onToast: (message: string) => void }) {
  return <div className="fade-up space-y-6"><PageHeading eyebrow="Recycling evidence" title="Certificates and receipts" copy="Every closed load requires verified input weight, recovered quantity, rejects, and documentary evidence." /><section className="soft-panel rounded-3xl p-5 sm:p-6"><div className="grid gap-3">{[["RC-2026-087", "NG-2026-003", "Brick", "Issued"], ["RC-2026-086", "NG-2026-002", "Mixed waste", "Issued"], ["DRAFT", "NG-2026-005", "Soil", "Incomplete"]].map(([certificate, report, material, status]) => <article key={certificate} className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#2ee6a6]/10 text-[#2ee6a6]"><FileCheck2 className="h-5 w-5" /></div><div><p className="text-xs font-semibold text-white">{certificate}</p><p className="mt-1 text-[10px] text-[#617b73]">{report} • {material}</p></div></div><div className="flex items-center gap-3"><span className={`text-[10px] font-semibold ${status === "Issued" ? "text-emerald-300" : "text-amber-300"}`}>{status}</span><button onClick={() => onToast(`${certificate} opened`)} className="rounded-lg border border-white/8 p-2 text-[#819991]"><Eye className="h-4 w-4" /></button></div></article>)}</div></section></div>;
}

function AuthorityWorkspace({ activeView, reports, onToast }: { activeView: string; reports: WasteReport[]; onToast: (message: string) => void }) {
  if (activeView === "reports") return <AuthorityReports reports={reports} onToast={onToast} />;
  if (activeView === "compliance") return <ComplianceView />;
  if (activeView === "operations") return <OperationsView />;
  if (activeView === "analytics") return <ImpactView />;
  if (activeView === "settings") return <SettingsView onToast={onToast} />;

  return (
    <div className="fade-up space-y-7">
      <PageHeading eyebrow="Municipal authority" title="City operations at a glance" copy="Review waste flows, intervene in exceptions, and measure verified recycling performance across Gwalior." action={<button onClick={() => onToast("Executive report prepared")} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-semibold text-[#cfe1dc]"><Download className="h-4 w-4" /> Export summary</button>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Waste reported" value="32.4 t" detail="+8.2% from last month" icon={Database} /><MetricCard label="Verified recycled" value="22.5 t" detail="69.4% diversion rate" icon={Recycle} tone="blue" /><MetricCard label="Compliance rate" value="70%" detail="7 of 10 active projects" icon={ShieldCheck} tone="green" /><MetricCard label="Critical alerts" value="3" detail="Require authority action" icon={AlertTriangle} tone="rose" /></div>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><TrendPanel /><section className="soft-panel rounded-3xl p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Compliance position</h2><ShieldCheck className="h-5 w-5 text-[#2ee6a6]" /></div><div className="mt-7 grid place-items-center"><div className="relative grid h-36 w-36 place-items-center rounded-full bg-[conic-gradient(#2ee6a6_0_70%,#f4b654_70%_88%,#fb7185_88%_100%)]"><div className="grid h-[112px] w-[112px] place-items-center rounded-full bg-[#0d1d19] text-center"><div><p className="text-3xl font-semibold text-white">70%</p><p className="text-[9px] text-[#668078]">city compliant</p></div></div></div></div><div className="mt-7 space-y-2">{[["Compliant", "7 projects", "#2ee6a6"], ["Attention", "2 projects", "#f4b654"], ["Non-compliant", "1 project", "#fb7185"]].map(([label, value, color]) => <div key={label} className="flex items-center justify-between rounded-xl bg-black/10 px-3 py-2.5 text-[11px]"><span className="flex items-center gap-2 text-[#9fb4ae]"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span><span className="font-semibold text-[#dcece7]">{value}</span></div>)}</div></section></div>
      <ReportsTable title="Reports requiring attention" reports={reports.filter((report) => report.status === "Review" || report.status === "Processing")} compact onToast={onToast} />
    </div>
  );
}

function TrendPanel() {
  const max = 30;
  return (
    <section className="soft-panel rounded-3xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold text-white">Recycling versus landfill</h2><p className="mt-1 text-[11px] text-[#668078]">Verified tonnes • last six months</p></div><div className="flex gap-3 text-[9px] text-[#78958e]"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2ee6a6]" />Recycled</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#f4b654]" />Landfill</span></div></div>
      <div className="mt-7 flex h-52 items-end gap-3 border-b border-white/8 px-1 sm:gap-5">
        {impactTrend.map((item) => <div key={item.month} className="flex h-full flex-1 flex-col justify-end"><div className="flex h-[170px] items-end justify-center gap-1"><div className="w-2.5 rounded-t-sm bg-[#2ee6a6] sm:w-4" style={{ height: `${(item.recycled / max) * 100}%` }} title={`${item.recycled} tonnes recycled`} /><div className="w-2.5 rounded-t-sm bg-[#f4b654]/75 sm:w-4" style={{ height: `${(item.landfill / max) * 100}%` }} title={`${item.landfill} tonnes landfill`} /></div><p className="py-2 text-center text-[9px] text-[#5f7971]">{item.month}</p></div>)}
      </div>
    </section>
  );
}

function AuthorityReports({ reports, onToast }: { reports: WasteReport[]; onToast: (message: string) => void }) {
  const [filter, setFilter] = useState<"All" | ReportStatus>("All");
  const filtered = filter === "All" ? reports : reports.filter((report) => report.status === filter);
  return <div className="fade-up space-y-6"><PageHeading eyebrow="Authority review" title="Submitted waste records" copy="Inspect estimates, confidence flags, collection status, and evidence before approving closure." /><div className="flex flex-wrap gap-2">{(["All", "Submitted", "Processing", "Scheduled", "Collected", "Review"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold ${filter === item ? "border-[#2ee6a6]/30 bg-[#2ee6a6]/10 text-[#6feabd]" : "border-white/8 bg-white/[0.02] text-[#718a82]"}`}>{item}</button>)}</div><ReportsTable title={`${filter} reports`} reports={filtered} onToast={onToast} /></div>;
}

function ComplianceView() {
  return <div className="fade-up space-y-6"><PageHeading eyebrow="Compliance control" title="Project compliance register" copy="Flags combine reporting delays, unverified disposal, missing recycler evidence, and low-confidence AI estimates." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Compliant projects" value="7" detail="No overdue actions" icon={CheckCircle2} /><MetricCard label="Under review" value="2" detail="Evidence requested" icon={Clock3} tone="amber" /><MetricCard label="Non-compliant" value="1" detail="Escalation required" icon={AlertTriangle} tone="rose" /><MetricCard label="Average closure" value="3.4 d" detail="Target below four days" icon={Activity} tone="blue" /></div><section className="soft-panel rounded-3xl p-5 sm:p-6"><div className="space-y-3">{[["Metro Civil Works", "Thatipur", "Low-confidence steel estimate", "Critical"], ["UrbanArc Projects", "City Centre", "Recycler receipt missing", "Attention"], ["Northern Infra", "Morar", "Collection overdue by 18 hours", "Attention"]].map(([project, location, issue, severity]) => <article key={project} className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className={`grid h-10 w-10 place-items-center rounded-xl ${severity === "Critical" ? "bg-rose-400/10 text-rose-300" : "bg-amber-400/10 text-amber-300"}`}><AlertTriangle className="h-5 w-5" /></div><div><p className="text-xs font-semibold text-white">{project}</p><p className="mt-1 text-[10px] text-[#607a72]">{location} • {issue}</p></div></div><button className="rounded-xl border border-white/8 px-3 py-2 text-[10px] font-semibold text-[#a9bdb7] hover:bg-white/[0.035]">Open case</button></article>)}</div></section></div>;
}

function OperationsView() {
  return <div className="fade-up space-y-6"><PageHeading eyebrow="Collection operations" title="Vehicle and route supervision" copy="Monitor scheduled collections, vehicle capacity, delays, and recycler destinations." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Vehicles active" value="8 / 11" detail="Three currently available" icon={Truck} /><MetricCard label="Collections today" value="14" detail="Nine completed" icon={Route} tone="blue" /><MetricCard label="Average ETA" value="28 min" detail="Within service target" icon={Clock3} tone="green" /><MetricCard label="Delayed" value="2" detail="Traffic and site access" icon={AlertTriangle} tone="amber" /></div><CollectionTracking /></div>;
}

function SettingsView({ onToast }: { onToast: (message: string) => void }) {
  return <div className="fade-up space-y-6"><PageHeading eyebrow="System administration" title="Calculation and review controls" copy="Manage factors and thresholds without silently changing historical calculations." /><div className="grid gap-5 lg:grid-cols-2"><section className="soft-panel rounded-3xl p-5 sm:p-6"><h2 className="text-sm font-semibold text-white">Review thresholds</h2><div className="mt-5 space-y-4"><Field label="Manual review below confidence"><input className="field-control" value="0.70" readOnly /></Field><Field label="Maximum upload size"><input className="field-control" value="10 MB" readOnly /></Field><Field label="Default camera height"><input className="field-control" value="3.0 m" readOnly /></Field></div><button onClick={() => onToast("Settings saved as a new configuration version")} className="mt-6 rounded-xl bg-[#2ee6a6] px-4 py-3 text-sm font-bold text-[#052018]">Save version</button></section><section className="soft-panel rounded-3xl p-5 sm:p-6"><h2 className="text-sm font-semibold text-white">Model integration</h2><div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-4"><div className="flex items-center gap-3"><CircleDashed className="h-5 w-5 text-amber-300" /><div><p className="text-xs font-semibold text-amber-100">Prototype adapter active</p><p className="mt-1 text-[10px] leading-5 text-amber-100/60">Waiting for validated model weights and calibrated inference service.</p></div></div></div><div className="mt-4 space-y-2">{[["Classifier", "Adapter ready"], ["Segmentation", "Adapter ready"], ["Depth calibration", "Validation required"], ["Emission factors", "Version 0.1"]].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl bg-black/10 px-3 py-3 text-[11px]"><span className="text-[#8da49d]">{label}</span><span className="font-semibold text-[#dcece7]">{value}</span></div>)}</div></section></div></div>;
}
