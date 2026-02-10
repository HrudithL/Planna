import { useState } from "react";
import { useCourses } from "@/hooks/use-courses";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

export default function AdminCourses() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const { data: courses, isLoading } = useCourses({ search: debouncedSearch, subject: "", grades: [], tags: [] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Manage Courses</h1>
        <p className="text-muted-foreground">View and search all courses in the system</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search courses…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Grades</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses?.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-primary">{c.course_code}</TableCell>
                  <TableCell>{c.course_name}</TableCell>
                  <TableCell><Badge variant="outline">{c.subject}</Badge></TableCell>
                  <TableCell>{c.credits}</TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{courses?.length ?? 0} courses total</p>
    </div>
  );
}
