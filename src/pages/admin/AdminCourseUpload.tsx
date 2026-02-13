import { useState, useRef } from "react";
import { coursesApi, adminApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileJson, CheckCircle2, AlertCircle, Wrench } from "lucide-react";

export default function AdminCourseUpload() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ added: number; updated?: number; markedNotOffered?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{ fixed: number; errors: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);

        let courses: any[] | null = null;

        if (Array.isArray(raw)) {
          // Backwards compatibility: plain array of course objects
          courses = raw;
        } else if (raw && Array.isArray(raw.courses)) {
          // New format: step5_final.json style { "courses": [ ... ] }
          courses = raw.courses;
        }

        if (!courses) {
          throw new Error("JSON must be either an array of courses or an object with a 'courses' array");
        }

        setPreview(courses);
      } catch (err: any) {
        setError(err.message || "Invalid JSON file");
        setPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!preview) return;
    setUploading(true);
    try {
      const res = await coursesApi.uploadJson(preview);
      setResult(res);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast({ title: `Successfully imported ${res.added} courses` });
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFixEligibility = async () => {
    setFixing(true);
    setFixResult(null);
    setError(null);
    try {
      const res = await adminApi.fixMissingEligibility();
      setFixResult(res);
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast({ 
        title: `Fixed ${res.fixed} courses`, 
        description: res.errors > 0 ? `${res.errors} errors occurred` : undefined 
      });
    } catch (err: any) {
      setError(err.message || "Fix failed");
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Upload Courses</h1>
        <p className="text-muted-foreground">
          Import courses from a JSON file (for example, the api_surface_mapper <code>step5_final.json</code> format).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fix Missing Grades</CardTitle>
          <CardDescription>
            If courses are missing grade eligibility information, this will extract it from the stored course data and populate missing records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleFixEligibility} disabled={fixing} variant="outline">
            <Wrench className="mr-2 h-4 w-4" />
            {fixing ? "Fixing…" : "Fix Missing Eligibility Records"}
          </Button>

          {fixResult && (
            <div className="flex items-center gap-2 rounded-md border border-success/50 bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Fixed {fixResult.fixed} courses
              {fixResult.errors > 0 && (
                <span className="text-destructive"> ({fixResult.errors} errors)</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload JSON File</CardTitle>
          <CardDescription>
            Select a JSON file containing either an array of courses or an object with a <code>courses</code> array, matching
            the structure of <code>step5_final.json</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/50"
            onClick={() => fileRef.current?.click()}
          >
            <FileJson className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Click to select a JSON file</p>
            <p className="text-xs text-muted-foreground">Supports .json files</p>
          </div>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          {result && (
            <div className="space-y-1 rounded-md border border-success/50 bg-success/10 p-3 text-sm text-success">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Import complete
              </div>
              <ul className="ml-6 list-disc text-xs">
                <li>{result.added} new courses added</li>
                {(result.updated ?? 0) > 0 && <li>{result.updated} courses updated</li>}
                {(result.markedNotOffered ?? 0) > 0 && <li>{result.markedNotOffered} courses marked as not offered</li>}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview ({preview.length} courses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto rounded-md border bg-muted/50 p-3">
              <pre className="text-xs">{JSON.stringify(preview.slice(0, 5), null, 2)}</pre>
              {preview.length > 5 && <p className="mt-2 text-xs text-muted-foreground">…and {preview.length - 5} more</p>}
            </div>
            <div className="mt-4 flex gap-3">
              <Button onClick={handleUpload} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Importing…" : `Import ${preview.length} Courses`}
              </Button>
              <Button variant="outline" onClick={() => { setPreview(null); setError(null); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
