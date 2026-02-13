import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useCallback } from "react";
import { usePlan, useAddCourseToPlan, useRemoveCourseFromPlan } from "@/hooks/use-plans";
import { useCourseSearch } from "@/hooks/use-courses";
import { plansApi, coursesApi } from "@/lib/api";
import {
  ALL_GRADE_LEVELS, JUNIOR_HIGH_GRADES, HIGH_SCHOOL_GRADES,
  PlanCourse, Course, termLabel,
} from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, X, ArrowLeft, AlertTriangle, Download, Pencil, Check, BookOpen, Sun, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Utility function to extract base course code (remove last letter)
function getBaseCourseCode(code: string): string {
  if (code.length <= 1) return code;
  return code.slice(0, -1);
}

// Function to detect if two courses should be grouped
function shouldGroupCourses(code1: string, code2: string): boolean {
  if (!code1 || !code2) return false;
  const base1 = getBaseCourseCode(code1);
  const base2 = getBaseCourseCode(code2);
  if (base1 !== base2) return false;
  // Check if only last letter differs
  const last1 = code1[code1.length - 1];
  const last2 = code2[code2.length - 1];
  return last1 !== last2 && /^[A-Z]$/.test(last1) && /^[A-Z]$/.test(last2);
}

function SortableCourseItem({ pc, onRemove }: { pc: PlanCourse; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: pc.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const course = pc.course;
  const isSemester = (course?.length ?? 2) === 1;
  const termLabelText = termLabel(pc.term_index);

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border bg-card p-2">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-primary">{course?.external_course_code}</span>
          <span className="truncate text-sm">{course?.name}</span>
        </div>
      </div>
      {isSemester && termLabelText && termLabelText !== "Unknown" && (
        <Badge variant="outline" className="shrink-0 text-xs">{termLabelText}</Badge>
      )}
      <Badge variant="secondary" className="shrink-0 text-xs">{course?.credits} cr</Badge>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PlanEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: plan, isLoading } = usePlan(id!);
  const addCourse = useAddCourseToPlan();
  const removeCourse = useRemoveCourseFromPlan();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [showSelector, setShowSelector] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState<{
    gradeLevel: string; termIndex: number; isJuniorHigh: boolean; yearIndex: number;
  } | null>(null);
  const [selectorSearch, setSelectorSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<PlanCourse | null>(null);

  const [prereqWarnings, setPrereqWarnings] = useState<Record<string, string[]>>({});

  // Collect all course codes already in the plan (for prerequisite checking)
  const plannedCourseCodes = useMemo(() => {
    if (!plan?.courses) return [] as string[];
    return plan.courses
      .map(pc => pc.course?.external_course_code)
      .filter((code): code is string => !!code);
  }, [plan?.courses]);

  // Build the course query filters based on the selector target
  const selectorFilters = useMemo(() => {
    const base = { search: selectorSearch, subject: "", grades: [] as string[], tags: [] as string[] };
    if (!selectorTarget) return base;

    // Always filter by grade level
    const grades = selectorTarget.gradeLevel ? [selectorTarget.gradeLevel] : [];

    // For summer terms (0 = Summer 1, 1 = Summer 2), show summer-tagged courses
    // This is the only case where we require a specific tag
    if (selectorTarget.termIndex === 0 || selectorTarget.termIndex === 1) {
      return { ...base, tags: ["summer"], grades };
    }
    
    // For school year terms (fall/spring), just filter by grade eligibility
    // Junior high courses are identified by grade eligibility (6th, 7th, 8th), not by tag
    return { ...base, grades };
  }, [selectorSearch, selectorTarget]);

  const { data: allCourses } = useCourseSearch(selectorFilters);

  // Check prerequisites for visible courses when selector opens
  const checkPrereqs = useCallback(async (courseList: Course[]) => {
    const newWarnings: Record<string, string[]> = {};
    const checks = courseList.slice(0, 50).map(async (course) => {
      try {
        const result = await coursesApi.checkPrerequisitesMet(course.id, plannedCourseCodes);
        if (!result.met) {
          newWarnings[course.id] = result.unmet;
        }
      } catch {
        // silently skip
      }
    });
    await Promise.all(checks);
    setPrereqWarnings(newWarnings);
  }, [plannedCourseCodes]);

  useEffect(() => {
    if (showSelector && allCourses && allCourses.length > 0) {
      checkPrereqs(allCourses);
    }
  }, [showSelector, allCourses, checkPrereqs]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Group courses by grade + term (summer1, summer2, fall, spring)
  // term_index 0 = Summer 1, 1 = Summer 2, 2 = Fall, 3 = Spring
  const grouped = useMemo(() => {
    if (!plan?.courses) return {};
    const map: Record<string, PlanCourse[]> = {};
    for (const pc of plan.courses) {
      let termKey = "summer1";
      if (pc.term_index === 1) termKey = "summer2";
      else if (pc.term_index === 2) termKey = "fall";
      else if (pc.term_index === 3) termKey = "spring";
      // Handle legacy term_index 0 as summer1, legacy 1 as fall, legacy 2 as spring
      else if (pc.term_index === null || pc.term_index === undefined) continue;
      
      const key = `${pc.grade_level}-${termKey}`;
      if (!map[key]) map[key] = [];
      map[key].push(pc);
    }
    for (const key in map) {
      map[key].sort((a, b) => {
        // Sort by order_index
        return (a.order_index ?? 0) - (b.order_index ?? 0);
      });
    }
    return map;
  }, [plan?.courses]);

  // Validation warnings
  const [prereqPlanWarnings, setPrereqPlanWarnings] = useState<string[]>([]);
  
  const gradeWarnings = useMemo(() => {
    if (!plan?.courses) return [];
    const w: string[] = [];
    for (const pc of plan.courses) {
      const c = pc.course;
      if (!c) continue;
      if (pc.grade_level && !c.eligible_grades.includes(pc.grade_level)) {
        w.push(`${c.external_course_code} is not eligible for ${pc.grade_level} grade`);
      }
    }
    return w;
  }, [plan?.courses]);

  // Check prerequisites for all courses in the plan
  useEffect(() => {
    if (!plan?.courses || plan.courses.length === 0) {
      setPrereqPlanWarnings([]);
      return;
    }

    const ALL_GRADES = [...JUNIOR_HIGH_GRADES, ...HIGH_SCHOOL_GRADES] as readonly string[];

    (async () => {
      const w: string[] = [];
      for (const pc of plan.courses!) {
        const c = pc.course;
        if (!c) continue;
        // Get all courses the student has taken in PREVIOUS grade levels
        const gradeIdx = ALL_GRADES.indexOf(pc.grade_level as any);
        const priorCodes = plan.courses!
          .filter(prev => {
            const prevIdx = ALL_GRADES.indexOf(prev.grade_level as any);
            // Courses from earlier grades count as completed prerequisites
            return prevIdx < gradeIdx;
          })
          .map(prev => prev.course?.external_course_code)
          .filter((code): code is string => !!code);

        try {
          const result = await coursesApi.checkPrerequisitesMet(c.id, priorCodes);
          if (!result.met) {
            w.push(`${c.external_course_code} (${c.name}): missing ${result.unmet.join(", ")}`);
          }
        } catch {
          // silently skip
        }
      }
      setPrereqPlanWarnings(w);
    })();
  }, [plan?.courses]);

  const warnings = useMemo(() => [...gradeWarnings, ...prereqPlanWarnings], [gradeWarnings, prereqPlanWarnings]);

  // Credit summary
  const creditSummary = useMemo(() => {
    if (!plan?.courses) return { total: 0, bySubject: {} as Record<string, number>, byGrade: {} as Record<string, number> };
    let total = 0;
    const bySubject: Record<string, number> = {};
    const byGrade: Record<string, number> = {};
    for (const pc of plan.courses) {
      const cr = pc.course?.credits ?? 0;
      total += cr;
      const subj = pc.course?.subject ?? "Unknown";
      bySubject[subj] = (bySubject[subj] || 0) + cr;
      const gl = pc.grade_level ?? "Unknown";
      byGrade[gl] = (byGrade[gl] || 0) + cr;
    }
    return { total, bySubject, byGrade };
  }, [plan?.courses]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !plan) return;

    for (const key in grouped) {
      const items = grouped[key];
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(items, oldIndex, newIndex).map((pc, i) => ({ ...pc, order_index: i }));
        const otherCourses = plan.courses!.filter(pc => !items.some(i => i.id === pc.id));
        await plansApi.reorderCourses(plan.id, [...otherCourses, ...reordered]);
        qc.invalidateQueries({ queryKey: ["plan", plan.id] });
        break;
      }
    }
  };

  const openSelector = (gradeLevel: string, termIndex: number, isJuniorHigh: boolean, yearIndex: number) => {
    setSelectorTarget({ gradeLevel, termIndex, isJuniorHigh, yearIndex });
    setSelectorSearch("");
    setShowSelector(true);
  };

  const handleAddCourse = async (course: Course) => {
    if (!selectorTarget || !plan) return;

    const { gradeLevel, termIndex, yearIndex } = selectorTarget;

    // Use the termIndex from selectorTarget directly
    // For semester courses, check if we should group with existing course
    const isSemesterCourse = course.length === 1;
    if (isSemesterCourse) {
      // Check if there's a matching course in the other term of the same period
      // For summer: check if course exists in Summer 1 (0) when adding to Summer 2 (1) or vice versa
      // For school year: check if course exists in Fall (2) when adding to Spring (3) or vice versa
      const otherTermIndex = termIndex === 0 ? 1 : termIndex === 1 ? 0 : termIndex === 2 ? 3 : 2;
      const existingCourse = plan.courses?.find(
        pc => pc.course_id === course.id
          && pc.grade_level === gradeLevel
          && pc.term_index === otherTermIndex
      );

      if (existingCourse && existingCourse.course) {
        // Check if courses should be grouped (same base code, different last letter)
        const existingCode = existingCourse.course.external_course_code;
        if (shouldGroupCourses(course.external_course_code, existingCode)) {
          // Courses will be grouped visually, but we still add the new course
          // The grouping logic will handle the display
        }
      }

      // Query term eligibility to verify course can be placed in this term
      try {
        const gradeNum = gradeLevel.replace(/\D/g, "");
        const eligibleTerms = await coursesApi.getTermEligibility(course.id, gradeNum);
        // Map old term numbers (1, 2) to new term indices (2, 3) for school year
        // For summer, we use 0 and 1 directly
        const mappedTerms = eligibleTerms.map(t => {
          if (t === 1) return 2; // Fall
          if (t === 2) return 3; // Spring
          return t; // Keep summer terms as-is (0, 1)
        });
        
        // If term is not eligible and there's an alternative, use that
        if (!mappedTerms.includes(termIndex) && mappedTerms.length > 0) {
          // Use the first eligible term
          await addCourse.mutateAsync({
            planId: plan.id,
            courseId: course.id,
            termIndex: mappedTerms[0],
            yearIndex,
            gradeLevel,
          });
        } else {
          await addCourse.mutateAsync({
            planId: plan.id,
            courseId: course.id,
            termIndex,
            yearIndex,
            gradeLevel,
          });
        }
      } catch {
        // Fallback: use the selected termIndex
        await addCourse.mutateAsync({
          planId: plan.id,
          courseId: course.id,
          termIndex,
          yearIndex,
          gradeLevel,
        });
      }
    } else {
      // Full year courses: for school year, place in Fall (2); for summer, place in Summer 1 (0)
      const fullYearTermIndex = (termIndex === 2 || termIndex === 3) ? 2 : 0;
      await addCourse.mutateAsync({
        planId: plan.id,
        courseId: course.id,
        termIndex: fullYearTermIndex,
        yearIndex,
        gradeLevel,
      });
    }

    toast({ title: `Added ${course.external_course_code}` });
    setShowSelector(false);
  };

  const handleRemove = async () => {
    if (!removeTarget || !plan) return;
    await removeCourse.mutateAsync({ planId: plan.id, planCourseId: removeTarget.id });
    toast({ title: `Removed ${removeTarget.course?.external_course_code}` });
    setRemoveTarget(null);
  };

  const handleSaveName = async () => {
    if (!plan || !name.trim()) return;
    await plansApi.update(plan.id, { name });
    qc.invalidateQueries({ queryKey: ["plan", plan.id] });
    setEditingName(false);
  };

  const handleExport = async () => {
    if (!plan) return;
    const csv = await plansApi.exportCsv(plan.id);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported!" });
  };

  // Calculate year_index for a given grade level. Starting year is 2025 for 6th grade.
  const getYear = (gradeLevel: string) => {
    const baseYear = 2025;
    const idx = ALL_GRADE_LEVELS.indexOf(gradeLevel as any);
    return baseYear + (idx >= 0 ? idx : 0);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  if (!plan) {
    return <div className="py-12 text-center text-muted-foreground">Plan not found</div>;
  }

  // Helper function to get grouped courses for display
  const getGroupedCoursesForDisplay = (items: PlanCourse[], termIndex: number, gradeLevel: string): (PlanCourse | { grouped: PlanCourse[] })[] => {
    const result: (PlanCourse | { grouped: PlanCourse[] })[] = [];
    const processed = new Set<string>();
    
    // Find the other term index for grouping (Summer 1<->Summer 2, Fall<->Spring)
    const otherTermIndex = termIndex === 0 ? 1 : termIndex === 1 ? 0 : termIndex === 2 ? 3 : 2;
    
    // Get other term's items
    const otherTermKey = `${gradeLevel}-${otherTermIndex === 0 ? "summer1" : otherTermIndex === 1 ? "summer2" : otherTermIndex === 2 ? "fall" : "spring"}`;
    const otherTermItems = grouped[otherTermKey] || [];
    
    for (const pc of items) {
      if (processed.has(pc.id)) continue;
      
      const courseCode = pc.course?.external_course_code;
      if (!courseCode) {
        result.push(pc);
        processed.add(pc.id);
        continue;
      }
      
      // Check if there's a matching course in the current term's items
      const matchingCourse = items.find(otherPc => {
        if (otherPc.id === pc.id || processed.has(otherPc.id)) return false;
        const otherCode = otherPc.course?.external_course_code;
        if (!otherCode) return false;
        return shouldGroupCourses(courseCode, otherCode);
      });
      
      // Check if there's a matching course in the other term
      const matchingInOtherTerm = otherTermItems.find(otherPc => {
        const otherCode = otherPc.course?.external_course_code;
        if (!otherCode) return false;
        return shouldGroupCourses(courseCode, otherCode);
      });
      
      if (matchingCourse || matchingInOtherTerm) {
        // Group these courses - only include courses from current term in this column's display
        const groupedCourses = [pc];
        if (matchingCourse) {
          groupedCourses.push(matchingCourse);
          processed.add(matchingCourse.id);
        }
        // Note: matchingInOtherTerm is shown in the other column, not here
        result.push({ grouped: groupedCourses });
        processed.add(pc.id);
      } else {
        result.push(pc);
        processed.add(pc.id);
      }
    }
    
    return result;
  };

  const renderGradeSection = (
    sectionTitle: string,
    grades: readonly string[],
    isJuniorHigh: boolean,
  ) => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground border-b pb-2">
        {sectionTitle}
      </h2>
      {grades.map(grade => {
        const gradeYear = getYear(grade);
        const summer1Key = `${grade}-summer1`;
        const summer2Key = `${grade}-summer2`;
        const fallKey = `${grade}-fall`;
        const springKey = `${grade}-spring`;
        const summer1Items = grouped[summer1Key] || [];
        const summer2Items = grouped[summer2Key] || [];
        const fallItems = grouped[fallKey] || [];
        const springItems = grouped[springKey] || [];
        const summer1Credits = summer1Items.reduce((s, pc) => s + (pc.course?.credits ?? 0), 0);
        const summer2Credits = summer2Items.reduce((s, pc) => s + (pc.course?.credits ?? 0), 0);
        const fallCredits = fallItems.reduce((s, pc) => s + (pc.course?.credits ?? 0), 0);
        const springCredits = springItems.reduce((s, pc) => s + (pc.course?.credits ?? 0), 0);

        const renderTermColumn = (
          termIndex: number,
          title: string,
          items: PlanCourse[],
          credits: number,
          isSummer: boolean
        ) => {
          const displayItems = getGroupedCoursesForDisplay(items, termIndex, grade);
          return (
            <div className={`rounded-lg border p-3 ${isSummer ? "bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-800/30" : "bg-background"}`}>
              <div className="mb-3 flex items-center justify-between">
                <h4 className={`flex items-center gap-1.5 text-sm font-medium ${isSummer ? "" : ""}`}>
                  {isSummer && <Sun className="h-3.5 w-3.5 text-amber-500" />}
                  {title}
                </h4>
                <span className="text-xs text-muted-foreground">{credits} cr</span>
              </div>
              <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {displayItems.map((item, idx) => {
                    if ('grouped' in item) {
                      // Render grouped courses as a single item
                      const grouped = item.grouped;
                      const firstCourse = grouped[0].course;
                      const totalCredits = grouped.reduce((sum, pc) => sum + (pc.course?.credits ?? 0), 0);
                      
                      // Check if we have courses in both terms of the same period
                      const hasSummer1 = grouped.some(pc => pc.term_index === 0);
                      const hasSummer2 = grouped.some(pc => pc.term_index === 1);
                      const hasFall = grouped.some(pc => pc.term_index === 2);
                      const hasSpring = grouped.some(pc => pc.term_index === 3);
                      
                      // Also check in other term's items for cross-term grouping
                      const otherTermKey = `${grade}-${termIndex === 0 ? "summer2" : termIndex === 1 ? "summer1" : termIndex === 2 ? "spring" : "fall"}`;
                      const otherTermItems = grouped[otherTermKey] || [];
                      const matchingInOtherTerm = otherTermItems.find(otherPc => {
                        const otherCode = otherPc.course?.external_course_code;
                        const currentCode = firstCourse?.external_course_code;
                        if (!otherCode || !currentCode) return false;
                        return shouldGroupCourses(currentCode, otherCode);
                      });
                      
                      const isFullSummer = (hasSummer1 && hasSummer2) || (hasSummer1 && matchingInOtherTerm?.term_index === 1) || (hasSummer2 && matchingInOtherTerm?.term_index === 0);
                      const isFullYear = (hasFall && hasSpring) || (hasFall && matchingInOtherTerm?.term_index === 3) || (hasSpring && matchingInOtherTerm?.term_index === 2);
                      
                      return (
                        <div key={`grouped-${idx}`} className="flex items-center gap-2 rounded-md border bg-card p-2 border-primary/20">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-primary">{firstCourse?.external_course_code}</span>
                              <span className="truncate text-sm">{firstCourse?.name}</span>
                              <Badge variant="outline" className="shrink-0 text-xs">
                                {isFullSummer ? "Full Summer" : isFullYear ? "Full Year" : "Grouped"}
                              </Badge>
                            </div>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-xs">{totalCredits} cr</Badge>
                          <div className="flex gap-1">
                            {grouped.map((pc, gIdx) => (
                              <button 
                                key={pc.id}
                                onClick={() => setRemoveTarget(pc)} 
                                className="text-muted-foreground hover:text-destructive"
                                title={`Remove ${pc.course?.external_course_code}`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <SortableCourseItem key={item.id} pc={item} onRemove={() => setRemoveTarget(item)} />
                    );
                  })}
                </div>
              </SortableContext>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full border border-dashed text-muted-foreground"
                onClick={() => openSelector(grade, termIndex, isJuniorHigh, gradeYear)}
              >
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
          );
        };

        return (
          <Card key={grade}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{grade} Grade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summer terms in their own compact section - shown first */}
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                  <Sun className="h-4 w-4 text-amber-500" />
                  Summer
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {renderTermColumn(0, `Summer 1 ${gradeYear}`, summer1Items, summer1Credits, true)}
                  {renderTermColumn(1, `Summer 2 ${gradeYear}`, summer2Items, summer2Credits, true)}
                </div>
              </div>

              {/* School year (fall + spring) */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">School Year</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {renderTermColumn(2, `Fall ${gradeYear}`, fallItems, fallCredits, false)}
                  {renderTermColumn(3, `Spring ${gradeYear + 1}`, springItems, springCredits, false)}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/plans")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input value={name} onChange={e => setName(e.target.value)} className="h-9 w-64" autoFocus />
                <Button size="sm" onClick={handleSaveName}><Check className="h-4 w-4" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{plan.name}</h1>
                <Button variant="ghost" size="icon" onClick={() => { setName(plan.name); setEditingName(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>

        {plan.description && (
          <p className="text-sm text-muted-foreground">{plan.description}</p>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Timeline */}
          <div className="flex-1 space-y-8">
            {renderGradeSection("Junior High School", JUNIOR_HIGH_GRADES, true)}
            {renderGradeSection("High School", HIGH_SCHOOL_GRADES, false)}
          </div>

          {/* Summary sidebar */}
          <div className="w-full space-y-4 lg:w-72">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Plan Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-2xl font-bold text-primary">{creditSummary.total}</p>
                  <p className="text-xs text-muted-foreground">Total Credits</p>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">By Subject</h4>
                  {Object.entries(creditSummary.bySubject).map(([subj, cr]) => (
                    <div key={subj} className="flex justify-between text-sm">
                      <span>{subj}</span>
                      <span className="text-muted-foreground">{cr} cr</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">By Grade Level</h4>
                  {Object.entries(creditSummary.byGrade).map(([g, cr]) => (
                    <div key={g} className="flex justify-between text-sm">
                      <span>{g}</span>
                      <span className="text-muted-foreground">{cr} cr</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {warnings.length > 0 && (
              <Card className="border-warning/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-warning">
                    <AlertTriangle className="h-4 w-4" /> Warnings ({warnings.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {warnings.map((w, i) => (
                      <li key={i} className="text-xs text-muted-foreground">{w}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Course Selector Modal */}
      <Dialog open={showSelector} onOpenChange={(open) => { setShowSelector(open); if (!open) setSelectorSearch(""); }}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>Add Course</DialogTitle>
            <DialogDescription>
              {selectorTarget && (
                <>
                  Adding to {selectorTarget.gradeLevel} — {termLabel(selectorTarget.termIndex)} {selectorTarget.termIndex === 0 || selectorTarget.termIndex === 1 ? selectorTarget.yearIndex : selectorTarget.termIndex === 2 ? selectorTarget.yearIndex : selectorTarget.yearIndex + 1}
                  {(selectorTarget.termIndex === 0 || selectorTarget.termIndex === 1) && (
                    <Badge variant="secondary" className="ml-2 text-xs"><Sun className="mr-1 h-3 w-3" />Summer courses only</Badge>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Command shouldFilter={false} className="border-t">
            <CommandInput
              placeholder="Search courses… (typos ok)"
              value={selectorSearch}
              onValueChange={setSelectorSearch}
            />
            <CommandList className="max-h-72">
              <CommandEmpty>
                <div className="py-4 text-center text-sm text-muted-foreground">
                  <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  No courses found{(selectorTarget?.termIndex === 0 || selectorTarget?.termIndex === 1) ? " (only summer-tagged courses can be added here)" : ""}
                </div>
              </CommandEmpty>
              <CommandGroup>
                <TooltipProvider delayDuration={200}>
                  {allCourses?.filter(c => {
                    // Don't show courses already in this grade+term
                    if (!selectorTarget) return true;
                    return !plan?.courses?.some(
                      pc => pc.course_id === c.id
                        && pc.grade_level === selectorTarget.gradeLevel
                        && pc.term_index === selectorTarget.termIndex
                    );
                  }).map(course => {
                    const unmetPrereqs = prereqWarnings[course.id];
                    const hasUnmet = unmetPrereqs && unmetPrereqs.length > 0;
                    return (
                      <CommandItem
                        key={course.id}
                        value={course.id}
                        onSelect={() => handleAddCourse(course)}
                        className={`flex items-center justify-between ${hasUnmet ? "border border-amber-300/50 bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-xs font-medium text-primary shrink-0">{course.external_course_code}</span>
                          <span className="ml-1 text-sm truncate">{course.name}</span>
                          {course.length === 1 && <Badge variant="outline" className="ml-1 text-xs shrink-0">Semester</Badge>}
                          {hasUnmet && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="ml-1 h-3.5 w-3.5 text-amber-500 shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <p className="text-xs font-medium">Missing prerequisite(s):</p>
                                <ul className="mt-1 list-disc pl-3 text-xs">
                                  {unmetPrereqs.map((u, i) => <li key={i}>{u}</li>)}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0 ml-2">{course.credits} cr</Badge>
                      </CommandItem>
                    );
                  })}
                </TooltipProvider>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Course</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {removeTarget?.course?.name} from this plan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );
}
