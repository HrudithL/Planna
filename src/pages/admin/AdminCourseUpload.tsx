import { useState, useRef } from "react";
import { coursesApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileJson, CheckCircle2, AlertCircle } from "lucide-react";

export default function AdminCourseUpload() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ added: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(data)) throw new Error("JSON must be an array of courses");
        setPreview(data);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Upload Courses</h1>
        <p className="text-muted-foreground">Import courses from a JSON file</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload JSON File</CardTitle>
          <CardDescription>Select a JSON file containing an array of course objects</CardDescription>
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
            <div className="flex items-center gap-2 rounded-md border border-success/50 bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Successfully imported {result.added} courses
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
