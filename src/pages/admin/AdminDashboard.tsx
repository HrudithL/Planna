import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, FileText, Layers, RefreshCw, Download, CheckCircle2, XCircle, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string; output?: string } | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importComplete, setImportComplete] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.getStats(),
  });

  const { data: importData } = useQuery({
    queryKey: ["import-status"],
    queryFn: () => adminApi.getImportStatus(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const importMutation = useMutation({
    mutationFn: () => {
      return adminApi.importCourses();
    },
    onSuccess: (data) => {
      setImportStatus({ success: data.success, message: data.message, output: data.output });
      setImportComplete(true);
      // Refetch stats immediately
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["import-status"] });
    },
    onError: (error: Error) => {
      // Show the full error message (may contain multiple lines)
      const errorMessage = error.message || 'Unknown error occurred';
      setImportStatus({ success: false, message: errorMessage });
      setImportComplete(true);
    },
  });

  const handleImport = () => {
    if (confirm("This will scrape and import all courses from app.schoolinks.com. This process may take 10-30 minutes. Continue?")) {
      setImportStatus(null);
      setImportComplete(false);
      setShowImportDialog(true);
      importMutation.mutate();
    }
  };

  const handleDialogClose = () => {
    if (importComplete) {
      setShowImportDialog(false);
      setImportComplete(false);
      setImportStatus(null);
      if (importStatus?.success) {
        toast({
          title: "Import Complete",
          description: "Course import has completed successfully and courses have been loaded into the database.",
        });
      } else if (importStatus && !importStatus.success) {
        toast({
          title: "Import Failed",
          description: importStatus.message.split('\n')[0],
          variant: "destructive",
          duration: 10000,
        });
      }
    }
  };

  const statCards = [
    { label: "Courses", value: stats?.courses, icon: BookOpen, color: "text-primary" },
    { label: "Users", value: stats?.users, icon: Users, color: "text-secondary" },
    { label: "Student Plans", value: stats?.plans, icon: FileText, color: "text-success" },
    { label: "Presets", value: stats?.presets, icon: Layers, color: "text-warning" },
  ];

  return (
    <>
      {/* Blocking Import Dialog */}
      <Dialog 
        open={showImportDialog} 
        onOpenChange={(open) => {
          // Only allow closing if import is complete
          if (!open && importComplete) {
            handleDialogClose();
          }
        }}
      >
        <DialogContent 
          className="sm:max-w-md [&>button]:hidden"
          onInteractOutside={(e) => {
            // Prevent closing by clicking outside during import
            if (!importComplete) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            // Prevent closing with Escape during import
            if (!importComplete) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            // Prevent closing by clicking outside during import
            if (!importComplete) {
              e.preventDefault();
            }
          }}
        >
          {/* Conditionally show close button only when import is complete */}
          {importComplete && (
            <button
              onClick={handleDialogClose}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          )}
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importComplete ? (
                importStatus?.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Import Complete
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    Import Failed
                  </>
                )
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Importing Courses
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {importComplete ? (
                importStatus?.success ? (
                  "All courses have been successfully imported into the database."
                ) : (
                  "The import process encountered an error. Please check the details below."
                )
              ) : (
                "Please wait while courses are being imported. This process may take 10-30 minutes. Do not close this window or navigate away."
              )}
            </DialogDescription>
          </DialogHeader>
          
          {importComplete && importStatus && (
            <div className="space-y-2">
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm font-medium mb-2">Status:</p>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {importStatus.message}
                </p>
              </div>
            </div>
          )}

          {!importComplete && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <RefreshCw className="h-12 w-12 animate-spin text-primary" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Importing courses from app.schoolinks.com...
              </p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>• Scraping course data</p>
                <p>• Adding GPA weights</p>
                <p>• Parsing prerequisites</p>
                <p>• Collapsing semester pairs</p>
                <p>• Importing to database</p>
              </div>
            </div>
          )}

          <DialogFooter>
            {importComplete ? (
              <Button onClick={handleDialogClose} className="w-full">
                Done
              </Button>
            ) : (
              <Button disabled className="w-full">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Import Courses Card */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import Courses from API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scrape and import all courses from app.schoolinks.com. This will:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li>Scrape 1,500+ courses from the API</li>
            <li>Add GPA weights (AP/KAP=5.0, Dual Credit=4.5, Regular=4.0)</li>
            <li>Parse and resolve prerequisites</li>
            <li>Collapse semester pairs into full-year courses</li>
            <li>Import everything to the database</li>
          </ul>
          {importData?.hasData && (
            <Alert>
              <AlertTitle>Last Import</AlertTitle>
              <AlertDescription>
                {importData.totalCourses} courses imported successfully
              </AlertDescription>
            </Alert>
          )}
          {importStatus && (
            <Alert variant={importStatus.success ? "default" : "destructive"}>
              <AlertTitle>{importStatus.success ? "Import Status" : "Import Error"}</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap text-xs">
                {importStatus.message}
              </AlertDescription>
            </Alert>
          )}
          <Button
            onClick={handleImport}
            disabled={importMutation.isPending}
            className="w-full"
            size="lg"
          >
            {importMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Importing courses... Please wait (this may take 10-30 minutes)
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Start Course Import
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Note: Make sure the backend server is running (npm run dev:server) and SUPABASE_DB_URL is set
          </p>
        </CardContent>
      </Card>

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
    </>
  );
}
