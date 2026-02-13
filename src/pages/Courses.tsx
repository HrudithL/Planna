import { useState, useMemo } from "react";
import { useCourseSearch, useSubjects, useTags } from "@/hooks/use-courses";
import { CourseFilters, ALL_GRADE_LEVELS, DELIVERY_MODE_LABELS, Course } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, BookOpen, Filter, Monitor, Sun } from "lucide-react";

const CREDIT_OPTIONS = [0, 0.5, 1, 2, 3];
const GPA_OPTIONS = [4, 4.5, 5];

export default function CoursesPage() {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [grades, setGrades] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedCredits, setSelectedCredits] = useState<number[]>([]);
  const [selectedGpa, setSelectedGpa] = useState<number[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showFilters, setShowFilters] = useState(false);

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

  // Exclude CTE from subjects
  const filteredSubjects = useMemo(() => {
    return (subjectList || []).filter(s => s !== "CTE");
  }, [subjectList]);

  // Apply multi-select credit/GPA filters client-side
  const displayCourses = useMemo(() => {
    if (!courses) return [];
    let filtered = courses;
    if (selectedCredits.length > 0) {
      filtered = filtered.filter(c => selectedCredits.includes(c.credits));
    }
    if (selectedGpa.length > 0) {
      filtered = filtered.filter(c => selectedGpa.includes(c.gpa_weight));
    }
    return filtered;
  }, [courses, selectedCredits, selectedGpa]);

  const hasFilters = !!subject || grades.length > 0 || tags.length > 0 || selectedCredits.length > 0 || selectedGpa.length > 0;

  const clearFilters = () => {
    setSubject(""); setGrades([]); setTags([]); setSearch("");
    setSelectedCredits([]); setSelectedGpa([]);
  };

  const toggleGrade = (g: string) =>
    setGrades(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const toggleTag = (t: string) =>
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const toggleCredit = (c: number) =>
    setSelectedCredits(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleGpaOption = (g: number) =>
    setSelectedGpa(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Course Catalog</h1>
        <p className="text-muted-foreground">Search and browse all available courses</p>
      </div>

      {/* Search + filter toggle */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by code, name, or description… (typos ok)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="mr-2 h-4 w-4" /> Filters
          {hasFilters && <Badge className="ml-2" variant="secondary">{(subject ? 1 : 0) + grades.length + tags.length + selectedCredits.length + selectedGpa.length}</Badge>}
        </Button>
        {hasFilters && (
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

      {/* Results count */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground">{displayCourses.length} courses found</p>
      )}

      {/* Course grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
            </CardContent></Card>
          ))}
        </div>
      ) : displayCourses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-1 text-lg font-medium">No courses found</h3>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayCourses.map(course => (
            <Card
              key={course.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setSelectedCourse(course)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-primary">{course.external_course_code}</p>
                    <CardTitle className="text-base">{course.name}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{course.credits} cr</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant="outline">{course.subject}</Badge>
                <div className="flex flex-wrap gap-1">
                  {course.eligible_grades.map(g => (
                    <span key={g} className="rounded bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">{g}</span>
                  ))}
                </div>
                {course.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {course.tags.map(t => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                )}
                {course.variants.length > 1 && (
                  <p className="text-xs text-muted-foreground">{course.variants.length} delivery options available</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Course detail dialog */}
      <Dialog open={!!selectedCourse} onOpenChange={() => setSelectedCourse(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedCourse && (
            <>
              <DialogHeader>
                <p className="text-sm font-medium text-primary">{selectedCourse.external_course_code}</p>
                <DialogTitle>{selectedCourse.name}</DialogTitle>
                <DialogDescription>{selectedCourse.subject} · {selectedCourse.credits} credits · GPA weight: {selectedCourse.gpa_weight}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {selectedCourse.description && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Description</h4>
                    <p className="text-sm text-muted-foreground">{selectedCourse.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Length</h4>
                    <p className="text-sm text-muted-foreground">{selectedCourse.length === 2 ? 'Full Year' : 'Semester'}</p>
                  </div>
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Eligible Grades</h4>
                    <div className="flex gap-1">
                      {selectedCourse.eligible_grades.map(g => (
                        <Badge key={g} variant="outline" className="text-xs">{g}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                {selectedCourse.notes && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Notes</h4>
                    <p className="text-sm text-muted-foreground">{selectedCourse.notes}</p>
                  </div>
                )}
                {selectedCourse.tags.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Tags</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedCourse.tags.map(t => <Badge key={t}>{t}</Badge>)}
                    </div>
                  </div>
                )}

                {/* Variants / delivery options */}
                {selectedCourse.variants.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Delivery Options</h4>
                    <div className="space-y-2">
                      {selectedCourse.variants.filter(v => v.is_offered).map(v => (
                        <div key={v.id} className="flex items-center gap-3 rounded-md border p-2 text-sm">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{v.variant_course_code}</span>
                              <span className="text-xs text-muted-foreground">{DELIVERY_MODE_LABELS[v.delivery_mode || ''] || v.delivery_mode}</span>
                              {v.is_virtual && <Monitor className="h-3 w-3 text-blue-500" />}
                              {v.is_summer && <Sun className="h-3 w-3 text-amber-500" />}
                            </div>
                            <p className="text-xs text-muted-foreground">{v.term} · {v.credits} credits · {v.length} terms</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
