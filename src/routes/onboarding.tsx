import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Heart,
  Scale,
  Ruler,
  User,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/frontend/lib/auth-context";
import { healthService } from "@/backend/services/healthService";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { AgeWheelSelector } from "@/features/onboarding/components/AgeWheelSelector";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/frontend/lib/utils";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
  head: () => ({ meta: [{ title: "Health Profile Setup — GlucoLab" }] }),
});

interface OnboardingDraft {
  step: number;
  fullName: string;
  age: number;
  diabetesType: string;
  weightKg: string;
  heightCm: string;
}

const STORAGE_KEY = "glucolab_onboarding_draft";

const DIABETES_OPTIONS = [
  {
    id: "Type 1 Diabetes",
    title: "Type 1 Diabetes",
    description: "The pancreas produces little or no insulin. Managed with daily insulin therapy.",
    tag: "Insulin Dependent",
  },
  {
    id: "Type 2 Diabetes",
    title: "Type 2 Diabetes",
    description: "The body resists insulin or doesn't make enough. Managed with lifestyle, medication, or insulin.",
    tag: "Most Common",
  },
  {
    id: "Gestational Diabetes",
    title: "Gestational Diabetes",
    description: "High blood glucose developed during pregnancy. Usually resolves after delivery.",
    tag: "Pregnancy",
  },
  {
    id: "Other / Not sure",
    title: "Other / Not sure",
    description: "Pre-diabetes, LADA, MODY, or undergoing medical diagnosis with your doctor.",
    tag: "Evaluation",
  },
];

function OnboardingPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Load saved draft or initialize defaults
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState<number>(30);
  const [diabetesType, setDiabetesType] = useState<string>("Type 1 Diabetes");
  const [weightKg, setWeightKg] = useState<string>("70");
  const [heightCm, setHeightCm] = useState<string>("175");
  const [submitting, setSubmitting] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Authentication & Completion Redirection Guard
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate({ to: "/signup", replace: true });
      return;
    }

    if (profile?.onboarding_completed) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [user, profile, authLoading, navigate]);

  // Load draft from session storage or prefill from user metadata
  useEffect(() => {
    if (typeof window === "undefined" || draftLoaded) return;

    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: OnboardingDraft = JSON.parse(saved);
        if (parsed.fullName) setFullName(parsed.fullName);
        if (parsed.age) setAge(parsed.age);
        if (parsed.diabetesType) setDiabetesType(parsed.diabetesType);
        if (parsed.weightKg) setWeightKg(parsed.weightKg);
        if (parsed.heightCm) setHeightCm(parsed.heightCm);
        if (parsed.step && parsed.step >= 1 && parsed.step <= 4) setCurrentStep(parsed.step);
      } else if (user) {
        // Pre-fill user name from Google account metadata if available
        const metaName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          profile?.name ||
          (user.email ? user.email.split("@")[0] : "");
        if (metaName) {
          setFullName(metaName);
        }
      }
    } catch (e) {
      console.warn("Failed to parse onboarding draft:", e);
    } finally {
      setDraftLoaded(true);
    }
  }, [user, profile, draftLoaded]);

  // Persist draft on changes
  useEffect(() => {
    if (!draftLoaded || typeof window === "undefined") return;

    const draft: OnboardingDraft = {
      step: currentStep,
      fullName,
      age,
      diabetesType,
      weightKg,
      heightCm,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {}
  }, [currentStep, fullName, age, diabetesType, weightKg, heightCm, draftLoaded]);

  // Real-time BMI calculation
  const bmiInfo = useMemo(() => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    if (!w || !h || w <= 0 || h <= 0) return null;

    const heightInMeters = h / 100;
    const bmi = w / (heightInMeters * heightInMeters);
    const rounded = Math.round(bmi * 10) / 10;

    let category = "Normal weight";
    let color = "text-emerald-600 bg-emerald-500/10 border-emerald-500/20";

    if (rounded < 18.5) {
      category = "Underweight";
      color = "text-amber-600 bg-amber-500/10 border-amber-500/20";
    } else if (rounded >= 25 && rounded < 30) {
      category = "Overweight";
      color = "text-blue-600 bg-blue-500/10 border-blue-500/20";
    } else if (rounded >= 30) {
      category = "Obesity";
      color = "text-rose-600 bg-rose-500/10 border-rose-500/20";
    }

    return { bmi: rounded, category, color };
  }, [weightKg, heightCm]);

  // Step 1 Validation
  const validateStep1 = () => {
    if (!fullName.trim()) {
      toast.error("Please enter your full name.");
      return false;
    }
    if (!age || age < 1 || age > 120) {
      toast.error("Please select a valid age between 1 and 120.");
      return false;
    }
    return true;
  };

  // Step 2 Validation
  const validateStep2 = () => {
    if (!diabetesType) {
      toast.error("Please select your diabetes type.");
      return false;
    }
    return true;
  };

  // Step 3 Validation
  const validateStep3 = () => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);

    if (isNaN(w) || w < 20 || w > 350) {
      toast.error("Please enter a valid weight between 20 kg and 350 kg.");
      return false;
    }

    if (isNaN(h) || h < 50 || h > 260) {
      toast.error("Please enter a valid height between 50 cm and 260 cm.");
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!validateStep1()) return;
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!validateStep2()) return;
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!validateStep3()) return;
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Step 4 Completion Submission
  const handleComplete = async () => {
    if (submitting) return;

    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      toast.error("Please review your profile details.");
      return;
    }

    setSubmitting(true);

    try {
      await healthService.completeOnboarding({
        name: fullName.trim(),
        age,
        diabetes_type: diabetesType,
        weight_kg: parseFloat(weightKg),
        height_cm: parseFloat(heightCm),
      });

      // Clear draft storage
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEY);
      }

      await refreshProfile();
      toast.success("Health profile setup complete! Welcome to GlucoLab.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      console.error("Onboarding submission failed:", err);
      toast.error(err.message || "Failed to save profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Activity className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  const progressPercent = Math.round((currentStep / 4) * 100);

  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex flex-col justify-between px-4 py-6 sm:py-10",
        Capacitor.isNativePlatform() &&
          "pt-[calc(1.5rem+max(env(safe-area-inset-top,0px),44px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
      )}
    >
      <div className="w-full max-w-lg mx-auto flex-1 flex flex-col justify-between">
        {/* Top Header & Progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-display font-bold text-sm tracking-tight text-foreground">
                  GlucoLab
                </span>
                <p className="text-[11px] text-muted-foreground font-medium">Health Profile Setup</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary px-2.5 py-0.5 rounded-full bg-primary/10">
                Step {currentStep} of 4
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Wizard Step Body */}
        <div className="my-6 flex-1 flex flex-col justify-center">
          {/* STEP 1: Personal Information */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center space-y-1.5">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 mb-1">
                  <User className="h-6 w-6" />
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  Personal Information
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Let&apos;s start with your name and age so your health charts can be calibrated accurately.
                </p>
              </div>

              <div className="space-y-5 bg-card border border-border/80 rounded-3xl p-5 sm:p-6 shadow-sm">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-semibold">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="h-12 rounded-xl text-base px-3.5 bg-background"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    This will appear on your medical reports and dashboard.
                  </p>
                </div>

                {/* Age Wheel Selector */}
                <div className="space-y-2 pt-1">
                  <Label className="text-sm font-semibold text-center block">Select Your Age</Label>
                  <AgeWheelSelector
                    value={age}
                    onChange={(newAge) => setAge(newAge)}
                    min={1}
                    max={120}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Diabetes Information */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center space-y-1.5">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 mb-1">
                  <Heart className="h-6 w-6" />
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  Diabetes Type
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Select your current diagnosis to help customize target ranges and insulin schedules.
                </p>
              </div>

              <div className="space-y-3">
                {DIABETES_OPTIONS.map((opt) => {
                  const isSelected = diabetesType === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setDiabetesType(opt.id)}
                      className={cn(
                        "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 bg-card shadow-sm active:scale-[0.99]",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-border/80 hover:bg-muted/30"
                      )}
                    >
                      <div
                        className={cn(
                          "h-5 w-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40"
                        )}
                      >
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3
                            className={cn(
                              "text-sm font-bold",
                              isSelected ? "text-primary" : "text-foreground"
                            )}
                          >
                            {opt.title}
                          </h3>
                          <span className="text-[11px] font-semibold text-muted-foreground px-2 py-0.5 rounded-md bg-muted/60">
                            {opt.tag}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {opt.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Body Measurements */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center space-y-1.5">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-1">
                  <Scale className="h-6 w-6" />
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  Body Measurements
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Weight and height are essential for assessing insulin sensitivity and tracking body metrics.
                </p>
              </div>

              <div className="space-y-5 bg-card border border-border/80 rounded-3xl p-5 sm:p-6 shadow-sm">
                {/* Weight Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="weight" className="text-sm font-semibold flex items-center gap-2">
                      <Scale className="h-4 w-4 text-primary" />
                      <span>Current Weight</span>
                    </Label>
                    <span className="text-xs text-muted-foreground font-medium">Kilograms (kg)</span>
                  </div>
                  <div className="relative">
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      min="20"
                      max="350"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="e.g. 70"
                      className="h-12 rounded-xl text-lg font-bold pr-12 bg-background"
                      autoFocus
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">
                      kg
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Valid range: 20 kg to 350 kg</p>
                </div>

                {/* Height Input */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="height" className="text-sm font-semibold flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-primary" />
                      <span>Height</span>
                    </Label>
                    <span className="text-xs text-muted-foreground font-medium">Centimeters (cm)</span>
                  </div>
                  <div className="relative">
                    <Input
                      id="height"
                      type="number"
                      step="0.5"
                      min="50"
                      max="260"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      placeholder="e.g. 175"
                      className="h-12 rounded-xl text-lg font-bold pr-12 bg-background"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">
                      cm
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Valid range: 50 cm to 260 cm</p>
                </div>

                {/* Dynamic BMI Indicator */}
                {bmiInfo && (
                  <div
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold transition-all",
                      bmiInfo.color
                    )}
                  >
                    <span>Calculated Body Mass Index (BMI)</span>
                    <span className="text-sm font-extrabold">
                      {bmiInfo.bmi} · {bmiInfo.category}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Celebration / All Set */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fade-in text-center">
              {/* Celebration Animation Ring */}
              <div className="relative mx-auto flex items-center justify-center w-24 h-24">
                <div className="absolute -inset-2 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500 text-white shadow-elevated">
                  <CheckCircle2 className="h-10 w-10 text-white" strokeWidth={2.5} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Profile Ready</span>
                </div>
                <h2 className="font-display text-3xl font-extrabold text-foreground tracking-tight">
                  You&apos;re All Set!
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Welcome aboard, <strong className="text-foreground">{fullName || "Patient"}</strong>.
                  Let&apos;s start tracking your health with complete clarity.
                </p>
              </div>

              {/* Review Summary Card */}
              <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-sm text-left space-y-3.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">
                  Health Profile Summary
                </h3>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Full Name</span>
                    <p className="font-bold text-foreground truncate">{fullName}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Age</span>
                    <p className="font-bold text-foreground">{age} years old</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Diabetes Condition</span>
                    <p className="font-bold text-foreground">{diabetesType}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Measurements</span>
                    <p className="font-bold text-foreground">
                      {weightKg} kg · {heightCm} cm
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                  <span>Encrypted locally and synchronized securely to your private vault.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Controls Footer */}
        <div className="pt-4 border-t border-border/40 flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={submitting}
              className="h-12 px-5 rounded-2xl border-border hover:bg-muted/50 font-semibold gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="h-12 px-6 rounded-2xl gradient-primary text-primary-foreground font-semibold shadow-soft hover:shadow-elevated gap-2 ml-auto"
            >
              <span>Continue</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleComplete}
              disabled={submitting}
              className="h-13 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg hover:shadow-xl gap-2.5 ml-auto text-base active:scale-[0.99] cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <span>Go to Dashboard</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
