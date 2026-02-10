import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, FileText, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.getStats(),
  });

  const statCards = [
    { label: "Courses", value: stats?.courses, icon: BookOpen, color: "text-primary" },
    { label: "Users", value: stats?.users, icon: Users, color: "text-secondary" },
    { label: "Student Plans", value: stats?.plans, icon: FileText, color: "text-success" },
    { label: "Presets", value: stats?.presets, icon: Layers, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(s => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <p className="text-3xl font-bold">{s.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-2 font-medium">Manage Courses</h3>
            <p className="mb-4 text-sm text-muted-foreground">View, search, and filter all courses in the system.</p>
            <Button asChild variant="outline"><Link to="/dashboard/admin/courses">Go to Courses</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-2 font-medium">Upload Courses</h3>
            <p className="mb-4 text-sm text-muted-foreground">Import courses from a JSON file.</p>
            <Button asChild variant="outline"><Link to="/dashboard/admin/courses/upload">Upload JSON</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-2 font-medium">Manage Presets</h3>
            <p className="mb-4 text-sm text-muted-foreground">Create and manage preset plans for students.</p>
            <Button asChild variant="outline"><Link to="/dashboard/admin/presets">Go to Presets</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
