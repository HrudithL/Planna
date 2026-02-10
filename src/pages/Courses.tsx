import { useState } from "react";
import { useCourses } from "@/hooks/use-courses";
import { useDebounce } from "@/hooks/use-debounce";
import { CourseFilters, GRADE_LEVELS } from "@/types";
import { SUBJECTS, ALL_TAGS } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, BookOpen, Filter } from "lucide-react";
import { Course } from "@/types";

export default function CoursesPage() {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [grades, setGrades] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const debouncedSearch = useDebounce(search);
  const filters: CourseFilters = { search: debouncedSearch, subject, grades, tags };
  const { data: courses, isLoading } = useCourses(filters);
  const hasFilters = !!subject || grades.length > 0 || tags.length > 0;

  const clearFilters = () => { setSubject(""); setGrades([]); setTags([]); setSearch(""); };

  const toggleGrade = (g: string) =>
    setGrades(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const toggleTag = (t: string) =>
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

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
            placeholder="Search by code, name, or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="mr-2 h-4 w-4" /> Filters
          {hasFilters && <Badge className="ml-2" variant="secondary">{(subject ? 1 : 0) + grades.length + tags.length}</Badge>}
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
          <CardContent className="grid gap-6 p-4 sm:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium">Subject</label>
              <Select value={subject} onValueChange={v => setSubject(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="All subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Grade Level</label>
              <div className="flex flex-wrap gap-3">
                {GRADE_LEVELS.map(g => (
                  <label key={g} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={grades.includes(g)} onCheckedChange={() => toggleGrade(g)} />
                    {g}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Tags</label>
              <div className="flex flex-wrap gap-2">
                {ALL_TAGS.map(t => (
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
        <p className="text-sm text-muted-foreground">{courses?.length ?? 0} courses found</p>
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
      ) : courses?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-1 text-lg font-medium">No courses found</h3>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses?.map(course => (
            <Card
              key={course.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setSelectedCourse(course)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-primary">{course.course_code}</p>
                    <CardTitle className="text-base">{course.course_name}</CardTitle>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Course detail dialog */}
      <Dialog open={!!selectedCourse} onOpenChange={() => setSelectedCourse(null)}>
        <DialogContent className="max-w-lg">
          {selectedCourse && (
            <>
              <DialogHeader>
                <p className="text-sm font-medium text-primary">{selectedCourse.course_code}</p>
                <DialogTitle>{selectedCourse.course_name}</DialogTitle>
                <DialogDescription>{selectedCourse.subject} · {selectedCourse.credits} credits · GPA weight: {selectedCourse.gpa}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {selectedCourse.course_description && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Description</h4>
                    <p className="text-sm text-muted-foreground">{selectedCourse.course_description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Term</h4>
                    <p className="text-sm text-muted-foreground">{selectedCourse.term}</p>
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
                {selectedCourse.prerequisite_text && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Prerequisites</h4>
                    <p className="text-sm text-muted-foreground">{selectedCourse.prerequisite_text}</p>
                  </div>
                )}
                {selectedCourse.corequisite_text && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Corequisites</h4>
                    <p className="text-sm text-muted-foreground">{selectedCourse.corequisite_text}</p>
                  </div>
                )}
                {selectedCourse.enrollment_notes && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Enrollment Notes</h4>
                    <p className="text-sm text-muted-foreground">{selectedCourse.enrollment_notes}</p>
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
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
