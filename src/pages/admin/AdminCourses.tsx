import { useState, useMemo } from "react";
import { useCourseSearch, useSubjects, useTags } from "@/hooks/use-courses";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, coursesApi, variantsApi } from "@/lib/api";
import { CourseFilters, Course, CourseVariant, ALL_GRADE_LEVELS, DELIVERY_MODE_LABELS } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Search, X, Filter, AlertTriangle, Pencil, Link2, Trash2, Check, Plus, Monitor, Sun } from "lucide-react";

const CREDIT_OPTIONS = [0, 0.5, 1, 2, 3];
const GPA_OPTIONS = [4, 4.5, 5];

export default function AdminCourses() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Filter state
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [grades, setGrades] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [selectedCredits, setSelectedCredits] = useState<number[]>([]);
  const [selectedGpa, setSelectedGpa] = useState<number[]>([]);

  // Edit dialog state
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState<Partial<Course> & { tags: string[]; eligible_grades: string[] }>({
    name: "", credits: 0, length: 1, gpa_weight: 4, subject: "", is_elective: false,
    description: "", notes: "", is_offered: true, tags: [], eligible_grades: [],
  });
  const [saving, setSaving] = useState(false);

  // Variant management state
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [editVariant, setEditVariant] = useState<CourseVariant | null>(null);
  const [variantForm, setVariantForm] = useState({
    variant_course_code: "",
    delivery_mode: "in_person",
    is_virtual: false,
    is_summer: false,
    term: "Full Year",
    length: 2,
    credits: 1,
    is_offered: true,
  });

  // Create course dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    external_course_code: "", name: "", credits: 1, length: 2, gpa_weight: 4,
    subject: "", is_elective: false, description: "", notes: "",
    tags: [] as string[], eligible_grades: [] as string[],
  });
  const [creating, setCreating] = useState(false);

  // Prerequisite fix state
  const [showRelationships, setShowRelationships] = useState(false);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [loadingRels, setLoadingRels] = useState(false);
  const [fixSearch, setFixSearch] = useState("");
  const [fixRelId, setFixRelId] = useState<string | null>(null);

  const filters: CourseFilters = {
    search,
    subject,
    grades,
    tags,
    ...(selectedCredits.length === 1 && { minCredits: selectedCredits[0], maxCredits: selectedCredits[0] }),
    ...(selectedGpa.length === 1 && { minGpaWeight: selectedGpa[0], maxGpaWeight: selectedGpa[0] }),
  };

  const { data: courses, isLoading } = useCourseSearch(filters);
  const { data: subjectList } = useSubjects();
  const { data: tagList } = useTags();

  // Filter subjects: exclude CTE
  const filteredSubjects = useMemo(() => {
    return (subjectList || []).filter(s => s !== "CTE");
  }, [subjectList]);

  // Fetch course IDs with issues
  const { data: issueIds } = useQuery({
    queryKey: ["admin-course-issue-ids"],
    queryFn: () => adminApi.getCourseIdsWithIssues(),
    staleTime: 60 * 1000,
  });


  const hasFilters = !!subject || grades.length > 0 || tags.length > 0 || selectedCredits.length > 0 || selectedGpa.length > 0;

  // Filter courses: apply credit/gpa multi-select and error toggle
  const displayCourses = useMemo(() => {
    if (!courses) return [];
    let filtered = courses;

    // Multi-select credit filter
    if (selectedCredits.length > 0) {
      filtered = filtered.filter(c => selectedCredits.includes(c.credits));
    }
    // Multi-select GPA filter
    if (selectedGpa.length > 0) {
      filtered = filtered.filter(c => selectedGpa.includes(c.gpa_weight));
    }

    if (showErrorsOnly && issueIds) {
      filtered = filtered.filter(c => issueIds.has(c.id));
    }
    return filtered;
  }, [courses, selectedCredits, selectedGpa, showErrorsOnly, issueIds]);

  const errorCount = useMemo(() => {
    if (!courses || !issueIds) return 0;
    return courses.filter(c => issueIds.has(c.id)).length;
  }, [courses, issueIds]);

  const clearFilters = () => {
    setSubject(""); setGrades([]); setTags([]); setSearch("");
    setSelectedCredits([]); setSelectedGpa([]);
    setShowErrorsOnly(false);
  };

  const toggleGrade = (g: string) =>
    setGrades(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const toggleTag = (t: string) =>
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const toggleCredit = (c: number) =>
    setSelectedCredits(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleGpaOption = (g: number) =>
    setSelectedGpa(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const toggleEditGrade = (g: string) =>
    setEditForm(prev => ({
      ...prev,
      eligible_grades: prev.eligible_grades.includes(g)
        ? prev.eligible_grades.filter(x => x !== g)
        : [...prev.eligible_grades, g],
    }));
  const toggleEditTag = (t: string) =>
    setEditForm(prev => ({
      ...prev,
      tags: prev.tags.includes(t) ? prev.tags.filter(x => x !== t) : [...prev.tags, t],
    }));

  // Prerequisites state inside edit dialog
  const [editRels, setEditRels] = useState<any[]>([]);
  const [editRelsLoading, setEditRelsLoading] = useState(false);
  const [showAddPrereq, setShowAddPrereq] = useState(false);
  const [prereqCodeInput, setPrereqCodeInput] = useState("");
  const [prereqDescInput, setPrereqDescInput] = useState("");
  const [prereqType, setPrereqType] = useState<'prerequisite' | 'corequisite' | 'recommended'>('prerequisite');
  const [editingRelCodeId, setEditingRelCodeId] = useState<string | null>(null);
  const [editingRelCodeValue, setEditingRelCodeValue] = useState("");

  // ── Edit ──
  const openEdit = async (course: Course) => {
    setEditCourse(course);
    setEditForm({
      name: course.name,
      credits: course.credits,
      length: course.length,
      gpa_weight: course.gpa_weight,
      subject: course.subject,
      is_elective: course.is_elective,
      description: course.description || "",
      notes: course.notes || "",
      is_offered: course.is_offered,
      tags: [...course.tags],
      eligible_grades: [...course.eligible_grades],
    });
    setShowVariantForm(false);
    setEditVariant(null);
    setShowAddPrereq(false);
    setPrereqCodeInput("");
    setPrereqDescInput("");
    setEditingRelCodeId(null);
    setEditingRelCodeValue("");

    // Load relationships for this course
    setEditRelsLoading(true);
    try {
      const rels = await adminApi.getCourseRelationships(course.id);
      setEditRels(rels);
    } catch {
      setEditRels([]);
    } finally {
      setEditRelsLoading(false);
    }
  };

  const handleAddPrereqByCode = async () => {
    if (!editCourse || !prereqCodeInput.trim()) return;
    try {
      await adminApi.addCourseRelationshipByCode(
        editCourse.id,
        prereqCodeInput.trim(),
        prereqType,
        prereqDescInput.trim() || prereqCodeInput.trim(),
      );
      toast({ title: `Added ${prereqType} for code ${prereqCodeInput.trim()}` });
      const rels = await adminApi.getCourseRelationships(editCourse.id);
      setEditRels(rels);
      qc.invalidateQueries({ queryKey: ["admin-course-issue-ids"] });
      setShowAddPrereq(false);
      setPrereqCodeInput("");
      setPrereqDescInput("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleUpdateRelCode = async (relId: string) => {
    if (!editingRelCodeValue.trim()) return;
    try {
      await adminApi.updateRelationshipCourseCode(relId, editingRelCodeValue.trim());
      toast({ title: "Course code updated" });
      if (editCourse) {
        const rels = await adminApi.getCourseRelationships(editCourse.id);
        setEditRels(rels);
      }
      qc.invalidateQueries({ queryKey: ["admin-course-issue-ids"] });
      setEditingRelCodeId(null);
      setEditingRelCodeValue("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteEditRel = async (relId: string) => {
    if (!editCourse) return;
    try {
      await adminApi.deleteCourseRelationship(relId);
      toast({ title: "Relationship removed" });
      const rels = await adminApi.getCourseRelationships(editCourse.id);
      setEditRels(rels);
      qc.invalidateQueries({ queryKey: ["admin-course-issue-ids"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };


  const handleSave = async () => {
    if (!editCourse) return;
    setSaving(true);
    try {
      await coursesApi.update(editCourse.id, {
        name: editForm.name,
        credits: editForm.credits,
        length: editForm.length,
        gpa_weight: editForm.gpa_weight,
        subject: editForm.subject,
        is_elective: editForm.is_elective,
        description: editForm.description || null,
        notes: editForm.notes || null,
        is_offered: editForm.is_offered,
        tags: editForm.tags,
        eligible_grades: editForm.eligible_grades,
      });
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
      toast({ title: "Course updated" });
      setEditCourse(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Variant handlers ──
  const openVariantForm = (variant?: CourseVariant) => {
    if (variant) {
      setEditVariant(variant);
      setVariantForm({
        variant_course_code: variant.variant_course_code,
        delivery_mode: variant.delivery_mode || "in_person",
        is_virtual: variant.is_virtual,
        is_summer: variant.is_summer,
        term: variant.term || "Full Year",
        length: variant.length ?? 2,
        credits: variant.credits ?? 1,
        is_offered: variant.is_offered,
      });
    } else {
      setEditVariant(null);
      setVariantForm({
        variant_course_code: editCourse?.external_course_code || "",
        delivery_mode: "in_person",
        is_virtual: false,
        is_summer: false,
        term: "Full Year",
        length: 2,
        credits: 1,
        is_offered: true,
      });
    }
    setShowVariantForm(true);
  };

  const handleSaveVariant = async () => {
    if (!editCourse) return;
    try {
      if (editVariant) {
        await variantsApi.update(editVariant.id, {
          variant_course_code: variantForm.variant_course_code,
          delivery_mode: variantForm.delivery_mode,
          is_virtual: variantForm.is_virtual,
          is_summer: variantForm.is_summer,
          term: variantForm.term,
          length: variantForm.length,
          credits: variantForm.credits,
          is_offered: variantForm.is_offered,
        });
        toast({ title: "Variant updated" });
      } else {
        await variantsApi.create(editCourse.id, {
          variant_course_code: variantForm.variant_course_code,
          delivery_mode: variantForm.delivery_mode,
          is_virtual: variantForm.is_virtual,
          is_summer: variantForm.is_summer,
          term: variantForm.term,
          length: variantForm.length,
          credits: variantForm.credits,
          is_offered: variantForm.is_offered,
        });
        toast({ title: "Variant created" });
      }
      // Refresh
      qc.invalidateQueries({ queryKey: ["courses"] });
      const updated = await coursesApi.getById(editCourse.id);
      setEditCourse(updated);
      setShowVariantForm(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!editCourse) return;
    try {
      await variantsApi.delete(variantId);
      toast({ title: "Variant deleted" });
      qc.invalidateQueries({ queryKey: ["courses"] });
      const updated = await coursesApi.getById(editCourse.id);
      setEditCourse(updated);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // ── Create Course ──
  const handleCreate = async () => {
    if (!createForm.external_course_code || !createForm.name) {
      toast({ title: "Course code and name are required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await coursesApi.create({
        external_course_code: createForm.external_course_code,
        name: createForm.name,
        credits: createForm.credits,
        length: createForm.length,
        gpa_weight: createForm.gpa_weight,
        subject: createForm.subject || "Unknown",
        is_elective: createForm.is_elective,
        description: createForm.description || null,
        notes: createForm.notes || null,
        tags: createForm.tags,
        eligible_grades: createForm.eligible_grades,
      });
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast({ title: "Course created" });
      setShowCreate(false);
      setCreateForm({
        external_course_code: "", name: "", credits: 1, length: 2, gpa_weight: 4,
        subject: "", is_elective: false, description: "", notes: "",
        tags: [], eligible_grades: [],
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // ── Relationships ──
  const openRelationships = async (course: Course) => {
    setShowRelationships(true);
    setEditCourse(course);
    setLoadingRels(true);
    try {
      const rels = await adminApi.getCourseRelationships(course.id);
      setRelationships(rels);
    } catch (e: any) {
      toast({ title: "Error loading relationships", description: e.message, variant: "destructive" });
    } finally {
      setLoadingRels(false);
    }
  };


  const handleDeleteRelationship = async (relId: string) => {
    try {
      await adminApi.deleteCourseRelationship(relId);
      toast({ title: "Relationship removed" });
      if (editCourse) {
        const rels = await adminApi.getCourseRelationships(editCourse.id);
        setRelationships(rels);
      }
      qc.invalidateQueries({ queryKey: ["admin-course-issue-ids"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Courses</h1>
          <p className="text-muted-foreground">View, search, filter, and edit all courses in the system</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Course
        </Button>
      </div>

      {/* Search + filter toggle */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by code, name, or description… (typos ok)" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="mr-2 h-4 w-4" /> Filters
          {hasFilters && <Badge className="ml-2" variant="secondary">{(subject ? 1 : 0) + grades.length + tags.length + selectedCredits.length + selectedGpa.length}</Badge>}
        </Button>
        {errorCount > 0 && (
          <Button
            variant={showErrorsOnly ? "default" : "outline"}
            onClick={() => setShowErrorsOnly(!showErrorsOnly)}
            className={showErrorsOnly ? "" : "border-destructive text-destructive"}
          >
            <AlertTriangle className="mr-2 h-4 w-4" /> {errorCount} with errors
          </Button>
        )}
        {(hasFilters || showErrorsOnly) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" /> Clear All
          </Button>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card>
          <CardContent className="grid gap-6 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Subject</label>
              <Select value={subject} onValueChange={v => setSubject(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="All subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {filteredSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Grade Level</label>
              <div className="flex flex-wrap gap-2">
                {ALL_GRADE_LEVELS.map(g => (
                  <Badge
                    key={g}
                    variant={grades.includes(g) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleGrade(g)}
                  >
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Credits</label>
              <div className="flex flex-wrap gap-2">
                {CREDIT_OPTIONS.map(c => (
                  <Badge
                    key={c}
                    variant={selectedCredits.includes(c) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCredit(c)}
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">GPA Weight</label>
              <div className="flex flex-wrap gap-2">
                {GPA_OPTIONS.map(g => (
                  <Badge
                    key={g}
                    variant={selectedGpa.includes(g) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleGpaOption(g)}
                  >
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="mb-2 block text-sm font-medium">Tags</label>
              <div className="flex flex-wrap gap-2">
                {(tagList || []).map(t => (
                  <Badge
                    key={t}
                    variant={tags.includes(t) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>GPA Wt</TableHead>
                <TableHead>Grades</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayCourses.map(c => {
                const hasIssue = issueIds?.has(c.id);
                return (
                  <TableRow key={c.id} className={`${hasIssue ? "bg-destructive/5" : ""} ${!c.is_offered ? "opacity-60" : ""}`}>
                    <TableCell>
                      {hasIssue && (
                        <button onClick={() => openRelationships(c)} title="Has unresolved prerequisites">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-primary">{c.external_course_code}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell><Badge variant="outline">{c.subject}</Badge></TableCell>
                    <TableCell>{c.credits}</TableCell>
                    <TableCell>{c.gpa_weight}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.eligible_grades.map(g => (
                          <span key={g} className="rounded bg-accent px-1 py-0.5 text-xs">{g}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{c.variants.length}</span>
                    </TableCell>
                    <TableCell>
                      {c.is_offered ? (
                        <Badge variant="default" className="text-xs">Offered</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Not Offered</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="Edit course">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {displayCourses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                    No courses found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {displayCourses.length} courses{showErrorsOnly ? " with errors" : ""} {courses && displayCourses.length !== courses.length ? `(of ${courses.length} total)` : "total"}
      </p>

      {/* ── Edit Course Dialog ── */}
      <Dialog open={!!editCourse && !showRelationships} onOpenChange={() => setEditCourse(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {editCourse && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Course</DialogTitle>
                <DialogDescription>{editCourse.external_course_code}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Name</label>
                  <Input value={editForm.name} onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Subject</label>
                  <Input value={editForm.subject} onChange={e => setEditForm(prev => ({ ...prev, subject: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Credits</label>
                  <Input type="number" step="0.5" min="0" value={editForm.credits} onChange={e => setEditForm(prev => ({ ...prev, credits: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Length (terms)</label>
                  <Select value={String(editForm.length)} onValueChange={v => setEditForm(prev => ({ ...prev, length: parseInt(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Semester (1)</SelectItem>
                      <SelectItem value="2">Full Year (2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">GPA Weight</label>
                  <Input type="number" step="0.5" min="0" value={editForm.gpa_weight} onChange={e => setEditForm(prev => ({ ...prev, gpa_weight: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="flex items-center gap-6 sm:col-span-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={editForm.is_elective} onCheckedChange={v => setEditForm(prev => ({ ...prev, is_elective: v }))} />
                    <span className="text-sm">Elective</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={editForm.is_offered} onCheckedChange={v => setEditForm(prev => ({ ...prev, is_offered: v }))} />
                    <span className="text-sm">Offered</span>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Description</label>
                  <Textarea value={editForm.description || ""} onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))} rows={3} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Notes</label>
                  <Textarea value={editForm.notes || ""} onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Eligible Grade Levels</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_GRADE_LEVELS.map(g => (
                      <Badge
                        key={g}
                        variant={editForm.eligible_grades.includes(g) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleEditGrade(g)}
                      >
                        {g}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {(tagList || []).map(t => (
                      <Badge
                        key={t}
                        variant={editForm.tags.includes(t) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleEditTag(t)}
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* ── Prerequisites & Relationships Section ── */}
                <div className="sm:col-span-2 border-t pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-sm font-medium">Prerequisites & Relationships ({editRels.length})</label>
                    <Button size="sm" variant="outline" onClick={() => { setShowAddPrereq(!showAddPrereq); setPrereqSearch(""); }}>
                      <Plus className="mr-1 h-3 w-3" /> Add Relationship
                    </Button>
                  </div>
                  {editRelsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : editRels.length === 0 && !showAddPrereq ? (
                    <p className="text-xs text-muted-foreground">No prerequisites or corequisites defined.</p>
                  ) : (
                    <div className="space-y-2">
                      {editRels.map(rel => {
                        const isUnresolved = !rel.related_course_id;
                        const isEditingCode = editingRelCodeId === rel.id;
                        return (
                          <div key={rel.id} className={`flex items-center gap-3 rounded-md border p-2 text-sm ${isUnresolved ? "border-destructive/50 bg-destructive/5" : ""}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant={rel.relationship_type === "prerequisite" ? "default" : "secondary"} className="text-xs">
                                  {rel.relationship_type}
                                </Badge>
                                {rel.logic_type && <Badge variant="outline" className="text-xs">{rel.logic_type}</Badge>}
                                {isUnresolved && <Badge variant="destructive" className="text-xs">Unresolved</Badge>}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="font-mono text-xs font-medium text-primary">{rel.related_course_code || "—"}</span>
                                {rel.related_course ? (
                                  <span className="text-xs text-muted-foreground">
                                    <Link2 className="mr-1 inline h-3 w-3" />
                                    {rel.related_course.external_course_code} — {rel.related_course.name}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{rel.description || "(no description)"}</span>
                                )}
                              </div>
                              {/* Inline code editor */}
                              {isEditingCode && (
                                <div className="mt-2 flex items-center gap-2">
                                  <Input
                                    value={editingRelCodeValue}
                                    onChange={e => setEditingRelCodeValue(e.target.value)}
                                    placeholder="Course code (e.g. 0075)"
                                    className="h-7 w-32 font-mono text-xs"
                                    onKeyDown={e => { if (e.key === 'Enter') handleUpdateRelCode(rel.id); }}
                                    autoFocus
                                  />
                                  <Button size="sm" className="h-7 px-2 text-xs" onClick={() => handleUpdateRelCode(rel.id)}>
                                    <Check className="mr-1 h-3 w-3" /> Save
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setEditingRelCodeId(null); setEditingRelCodeValue(""); }}>
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </div>
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                              setEditingRelCodeId(rel.id);
                              setEditingRelCodeValue(rel.related_course_code || "");
                            }}>
                              <Pencil className="mr-1 h-3 w-3" /> Code
                            </Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteEditRel(rel.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add new relationship form (by course code) */}
                  {showAddPrereq && (
                    <div className="mt-3 space-y-3 rounded-md border p-3 bg-muted/30">
                      <h4 className="text-sm font-medium">Add Relationship</h4>
                      <div>
                        <label className="mb-1 block text-xs">Type</label>
                        <Select value={prereqType} onValueChange={v => setPrereqType(v as any)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="prerequisite">Prerequisite</SelectItem>
                            <SelectItem value="corequisite">Corequisite</SelectItem>
                            <SelectItem value="recommended">Recommended</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs">Course Code</label>
                        <Input
                          placeholder="e.g. 0075 (prefix matches 0075A, 0075B…)"
                          value={prereqCodeInput}
                          onChange={e => setPrereqCodeInput(e.target.value)}
                          className="font-mono"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs">Description (optional)</label>
                        <Input
                          placeholder="e.g. AP Seminar"
                          value={prereqDescInput}
                          onChange={e => setPrereqDescInput(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddPrereqByCode} disabled={!prereqCodeInput.trim()}>
                          <Plus className="mr-1 h-3 w-3" /> Add
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setShowAddPrereq(false); setPrereqCodeInput(""); setPrereqDescInput(""); }}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Variants Section ── */}
                <div className="sm:col-span-2 border-t pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-sm font-medium">Variants ({editCourse.variants.length})</label>
                    <Button size="sm" variant="outline" onClick={() => openVariantForm()}>
                      <Plus className="mr-1 h-3 w-3" /> Add Variant
                    </Button>
                  </div>
                  {editCourse.variants.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No variants defined for this course.</p>
                  ) : (
                    <div className="space-y-2">
                      {editCourse.variants.map(v => (
                        <div key={v.id} className="flex items-center gap-3 rounded-md border p-2 text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-primary">{v.variant_course_code}</span>
                              <span className="text-xs text-muted-foreground">{DELIVERY_MODE_LABELS[v.delivery_mode || ''] || v.delivery_mode}</span>
                              {v.is_virtual && <Monitor className="h-3 w-3 text-blue-500" />}
                              {v.is_summer && <Sun className="h-3 w-3 text-amber-500" />}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {v.term} · {v.credits} cr · {v.length} terms
                            </div>
                          </div>
                          {!v.is_offered && <Badge variant="secondary" className="text-xs">Not Offered</Badge>}
                          <Button size="icon" variant="ghost" onClick={() => openVariantForm(v)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteVariant(v.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Variant form (inline) */}
                  {showVariantForm && (
                    <div className="mt-3 space-y-3 rounded-md border p-3 bg-muted/30">
                      <h4 className="text-sm font-medium">{editVariant ? "Edit Variant" : "New Variant"}</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs">Variant Code</label>
                          <Input value={variantForm.variant_course_code} onChange={e => setVariantForm(prev => ({ ...prev, variant_course_code: e.target.value }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Delivery Mode</label>
                          <Select value={variantForm.delivery_mode} onValueChange={v => setVariantForm(prev => ({ ...prev, delivery_mode: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="in_person">In Person</SelectItem>
                              <SelectItem value="vir_sup">Virtual (Supervised)</SelectItem>
                              <SelectItem value="vir_inst_day">Virtual (Instructional Day)</SelectItem>
                              <SelectItem value="summer_virtual">Summer Virtual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Term</label>
                          <Select value={variantForm.term} onValueChange={v => setVariantForm(prev => ({ ...prev, term: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Full Year">Full Year</SelectItem>
                              <SelectItem value="Semester">Semester</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Credits</label>
                          <Input type="number" step="0.5" min="0" value={variantForm.credits} onChange={e => setVariantForm(prev => ({ ...prev, credits: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs">Length</label>
                          <Input type="number" min="1" value={variantForm.length} onChange={e => setVariantForm(prev => ({ ...prev, length: parseInt(e.target.value) || 1 }))} />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-xs">
                            <Checkbox checked={variantForm.is_virtual} onCheckedChange={(v) => setVariantForm(prev => ({ ...prev, is_virtual: !!v }))} />
                            Virtual
                          </label>
                          <label className="flex items-center gap-1.5 text-xs">
                            <Checkbox checked={variantForm.is_summer} onCheckedChange={(v) => setVariantForm(prev => ({ ...prev, is_summer: !!v }))} />
                            Summer
                          </label>
                          <label className="flex items-center gap-1.5 text-xs">
                            <Checkbox checked={variantForm.is_offered} onCheckedChange={(v) => setVariantForm(prev => ({ ...prev, is_offered: !!v }))} />
                            Offered
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveVariant}>{editVariant ? "Update" : "Add"}</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowVariantForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditCourse(null)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Course Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Course</DialogTitle>
            <DialogDescription>Add a new course to the system manually.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Course Code *</label>
              <Input value={createForm.external_course_code} onChange={e => setCreateForm(prev => ({ ...prev, external_course_code: e.target.value }))} placeholder="e.g., MATH101" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Name *</label>
              <Input value={createForm.name} onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Subject</label>
              <Input value={createForm.subject} onChange={e => setCreateForm(prev => ({ ...prev, subject: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Credits</label>
              <Input type="number" step="0.5" min="0" value={createForm.credits} onChange={e => setCreateForm(prev => ({ ...prev, credits: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Length</label>
              <Select value={String(createForm.length)} onValueChange={v => setCreateForm(prev => ({ ...prev, length: parseInt(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Semester (1)</SelectItem>
                  <SelectItem value="2">Full Year (2)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">GPA Weight</label>
              <Input type="number" step="0.5" min="0" value={createForm.gpa_weight} onChange={e => setCreateForm(prev => ({ ...prev, gpa_weight: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={createForm.is_elective} onCheckedChange={v => setCreateForm(prev => ({ ...prev, is_elective: v }))} />
              <span className="text-sm">Elective</span>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Description</label>
              <Textarea value={createForm.description} onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))} rows={3} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">Eligible Grades</label>
              <div className="flex flex-wrap gap-2">
                {ALL_GRADE_LEVELS.map(g => (
                  <Badge
                    key={g}
                    variant={createForm.eligible_grades.includes(g) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setCreateForm(prev => ({
                      ...prev,
                      eligible_grades: prev.eligible_grades.includes(g)
                        ? prev.eligible_grades.filter(x => x !== g)
                        : [...prev.eligible_grades, g],
                    }))}
                  >
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">Tags</label>
              <div className="flex flex-wrap gap-2">
                {(tagList || []).map(t => (
                  <Badge
                    key={t}
                    variant={createForm.tags.includes(t) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setCreateForm(prev => ({
                      ...prev,
                      tags: prev.tags.includes(t)
                        ? prev.tags.filter(x => x !== t)
                        : [...prev.tags, t],
                    }))}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating…" : "Create Course"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Prerequisite / Relationships Dialog ── */}
      <Dialog open={showRelationships} onOpenChange={() => { setShowRelationships(false); setEditCourse(null); setFixRelId(null); setFixSearch(""); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {editCourse && (
            <>
              <DialogHeader>
                <DialogTitle>Prerequisites & Relationships</DialogTitle>
                <DialogDescription>{editCourse.external_course_code} — {editCourse.name}</DialogDescription>
              </DialogHeader>
              {loadingRels ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : relationships.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No relationships found for this course.</p>
              ) : (
                <div className="space-y-3">
                  {relationships.map(rel => {
                    const isUnresolved = !rel.related_course_id;
                    const isEditingCode = fixRelId === rel.id;
                    return (
                      <div key={rel.id} className={`rounded-md border p-3 ${isUnresolved ? "border-destructive/50 bg-destructive/5" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={rel.relationship_type === "prerequisite" ? "default" : "secondary"} className="text-xs">
                                {rel.relationship_type}
                              </Badge>
                              {rel.logic_type && <Badge variant="outline" className="text-xs">{rel.logic_type}</Badge>}
                              {isUnresolved && <Badge variant="destructive" className="text-xs">Unresolved</Badge>}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="font-mono text-sm font-medium text-primary">{rel.related_course_code || "—"}</span>
                              <span className="text-sm">{rel.description || "(no description)"}</span>
                            </div>
                            {rel.related_course && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                <Link2 className="mr-1 inline h-3 w-3" />
                                {rel.related_course.external_course_code} — {rel.related_course.name}
                              </p>
                            )}
                            {/* Inline code editor */}
                            {isEditingCode && (
                              <div className="mt-2 flex items-center gap-2">
                                <Input
                                  value={fixSearch}
                                  onChange={e => setFixSearch(e.target.value)}
                                  placeholder="Course code (e.g. 0075)"
                                  className="h-8 w-40 font-mono text-sm"
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && fixSearch.trim()) {
                                      (async () => {
                                        try {
                                          await adminApi.updateRelationshipCourseCode(rel.id, fixSearch.trim());
                                          toast({ title: "Course code updated" });
                                          if (editCourse) {
                                            const rels = await adminApi.getCourseRelationships(editCourse.id);
                                            setRelationships(rels);
                                          }
                                          qc.invalidateQueries({ queryKey: ["admin-course-issue-ids"] });
                                          setFixRelId(null);
                                          setFixSearch("");
                                        } catch (e: any) {
                                          toast({ title: "Error", description: e.message, variant: "destructive" });
                                        }
                                      })();
                                    }
                                  }}
                                  autoFocus
                                />
                                <Button size="sm" className="h-8 text-xs" onClick={async () => {
                                  if (!fixSearch.trim()) return;
                                  try {
                                    await adminApi.updateRelationshipCourseCode(rel.id, fixSearch.trim());
                                    toast({ title: "Course code updated" });
                                    if (editCourse) {
                                      const rels = await adminApi.getCourseRelationships(editCourse.id);
                                      setRelationships(rels);
                                    }
                                    qc.invalidateQueries({ queryKey: ["admin-course-issue-ids"] });
                                    setFixRelId(null);
                                    setFixSearch("");
                                  } catch (e: any) {
                                    toast({ title: "Error", description: e.message, variant: "destructive" });
                                  }
                                }}>
                                  <Check className="mr-1 h-3 w-3" /> Save
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setFixRelId(null); setFixSearch(""); }}>
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => { setFixRelId(rel.id); setFixSearch(rel.related_course_code || ""); }}>
                              <Pencil className="mr-1 h-3 w-3" /> Code
                            </Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteRelationship(rel.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
