import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { usePlan, useAddCourseToPlan, useRemoveCourseFromPlan } from "@/hooks/use-plans";
import { useCourses } from "@/hooks/use-courses";
import { useDebounce } from "@/hooks/use-debounce";
import { plansApi } from "@/lib/api";
import { GRADE_LEVELS, SEMESTERS, PlanCourse, Course } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, X, ArrowLeft, AlertTriangle, Download, Pencil, Check, BookOpen } from "lucide-react";
import { Search } from "lucide-react";

function SortableCourseItem({ pc, onRemove }: { pc: PlanCourse; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: pc.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const course = pc.course;

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border bg-card p-2">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-primary">{course?.course_code}</span>
          <span className="truncate text-sm">{course?.course_name}</span>
        </div>
      </div>
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
  const [selectorTarget, setSelectorTarget] = useState<{ gradeLevel: string; semester: string; year: number } | null>(null);
  const [selectorSearch, setSelectorSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<PlanCourse | null>(null);

  const debouncedSelectorSearch = useDebounce(selectorSearch);
  const { data: allCourses } = useCourses({ search: debouncedSelectorSearch, subject: "", grades: [], tags: [] });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Group courses by grade/semester
  const grouped = useMemo(() => {
    if (!plan?.courses) return {};
    const map: Record<string, PlanCourse[]> = {};
    for (const pc of plan.courses) {
      const key = `${pc.grade_level}-${pc.semester}`;
      if (!map[key]) map[key] = [];
      map[key].push(pc);
    }
    // Sort each group by order_index
    for (const key in map) {
      map[key].sort((a, b) => a.order_index - b.order_index);
    }
    return map;
  }, [plan?.courses]);

  // Validation warnings
  const warnings = useMemo(() => {
    if (!plan?.courses) return [];
    const w: string[] = [];
    for (const pc of plan.courses) {
      const c = pc.course;
      if (!c) continue;
      // Grade level check
      if (!c.eligible_grades.includes(pc.grade_level)) {
        w.push(`${c.course_code} is not eligible for ${pc.grade_level} grade`);
      }
      // Prerequisite check (simple text match)
      if (c.prerequisite_text) {
        const prereqCodes = plan.courses
          .filter(p => {
            const gradeOrder = GRADE_LEVELS.indexOf(p.grade_level as any);
            const thisOrder = GRADE_LEVELS.indexOf(pc.grade_level as any);
            return gradeOrder < thisOrder || (gradeOrder === thisOrder && p.semester === "Fall" && pc.semester === "Spring");
          })
          .map(p => p.course?.course_code);
        if (!prereqCodes.some(code => code && c.prerequisite_text!.includes(code))) {
          w.push(`${c.course_code} requires prerequisite: ${c.prerequisite_text}`);
        }
      }
    }
    return w;
  }, [plan?.courses]);

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
      byGrade[pc.grade_level] = (byGrade[pc.grade_level] || 0) + cr;
    }
    return { total, bySubject, byGrade };
  }, [plan?.courses]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !plan) return;

    // Find which semester group both items are in
    for (const key in grouped) {
      const items = grouped[key];
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(items, oldIndex, newIndex).map((pc, i) => ({ ...pc, order_index: i }));
        // Update all plan courses
        const otherCourses = plan.courses!.filter(pc => !items.some(i => i.id === pc.id));
        await plansApi.reorderCourses(plan.id, [...otherCourses, ...reordered]);
        qc.invalidateQueries({ queryKey: ["plan", plan.id] });
        break;
      }
    }
  };

  const openSelector = (gradeLevel: string, semester: string, year: number) => {
    setSelectorTarget({ gradeLevel, semester, year });
    setSelectorSearch("");
    setShowSelector(true);
  };

  const handleAddCourse = async (course: Course) => {
    if (!selectorTarget || !plan) return;
    await addCourse.mutateAsync({
      planId: plan.id,
      courseId: course.id,
      semester: selectorTarget.semester,
      year: selectorTarget.year,
      gradeLevel: selectorTarget.gradeLevel,
    });
    toast({ title: `Added ${course.course_code}` });
    setShowSelector(false);
  };

  const handleRemove = async () => {
    if (!removeTarget || !plan) return;
    await removeCourse.mutateAsync({ planId: plan.id, planCourseId: removeTarget.id });
    toast({ title: `Removed ${removeTarget.course?.course_code}` });
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

  const getYear = (gradeLevel: string) => {
    const baseYear = 2025;
    const idx = GRADE_LEVELS.indexOf(gradeLevel as any);
    return baseYear + idx;
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
          <div className="flex-1 space-y-6">
            {GRADE_LEVELS.map(grade => (
              <Card key={grade}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{grade} Grade</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {SEMESTERS.map(semester => {
                      const key = `${grade}-${semester}`;
                      const items = grouped[key] || [];
                      const semCredits = items.reduce((s, pc) => s + (pc.course?.credits ?? 0), 0);

                      return (
                        <div key={key} className="rounded-lg border bg-background p-3">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-sm font-medium">{semester} {getYear(grade) + (semester === "Spring" ? 1 : 0)}</h4>
                            <span className="text-xs text-muted-foreground">{semCredits} credits</span>
                          </div>
                          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                              {items.map(pc => (
                                <SortableCourseItem key={pc.id} pc={pc} onRemove={() => setRemoveTarget(pc)} />
                              ))}
                            </div>
                          </SortableContext>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 w-full border border-dashed text-muted-foreground"
                            onClick={() => openSelector(grade, semester, getYear(grade) + (semester === "Spring" ? 1 : 0))}
                          >
                            <Plus className="mr-1 h-3 w-3" /> Add Course
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
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
      <Dialog open={showSelector} onOpenChange={setShowSelector}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Course</DialogTitle>
            <DialogDescription>
              {selectorTarget && `Adding to ${selectorTarget.gradeLevel} — ${selectorTarget.semester} ${selectorTarget.year}`}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search courses…"
              value={selectorSearch}
              onChange={e => setSelectorSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {allCourses?.filter(c => !plan?.courses?.some(pc => pc.course_id === c.id)).map(course => (
              <button
                key={course.id}
                className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-accent"
                onClick={() => handleAddCourse(course)}
              >
                <div>
                  <span className="text-xs font-medium text-primary">{course.course_code}</span>
                  <span className="ml-2 text-sm">{course.course_name}</span>
                </div>
                <Badge variant="secondary" className="text-xs">{course.credits} cr</Badge>
              </button>
            ))}
            {allCourses?.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                No courses found
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Course</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {removeTarget?.course?.course_name} from this plan?
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
