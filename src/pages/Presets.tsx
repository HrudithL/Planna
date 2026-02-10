import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePresets, useClonePreset, usePlan } from "@/hooks/use-plans";
import { PRESET_CATEGORIES, GRADE_LEVELS, SEMESTERS } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Layers, Copy, Eye } from "lucide-react";

function PresetPreviewDialog({ presetId, open, onClose }: { presetId: string; open: boolean; onClose: () => void }) {
  const { data: plan, isLoading } = usePlan(presetId);

  const grouped = plan?.courses?.reduce((acc, pc) => {
    const key = `${pc.grade_level}-${pc.semester}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(pc);
    return acc;
  }, {} as Record<string, typeof plan.courses>) || {};

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan?.name}</DialogTitle>
          <DialogDescription>{plan?.description}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {GRADE_LEVELS.map(grade => {
              const hasCourses = SEMESTERS.some(s => (grouped[`${grade}-${s}`] || []).length > 0);
              if (!hasCourses) return null;
              return (
                <div key={grade}>
                  <h3 className="mb-2 font-serif text-sm font-medium">{grade} Grade</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {SEMESTERS.map(semester => {
                      const items = grouped[`${grade}-${semester}`] || [];
                      if (!items.length) return null;
                      return (
                        <div key={semester} className="rounded-md border p-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">{semester}</p>
                          <div className="space-y-1">
                            {items.map(pc => (
                              <div key={pc.id} className="flex justify-between text-sm">
                                <span><span className="font-medium text-primary">{pc.course?.course_code}</span> {pc.course?.course_name}</span>
                                <span className="text-muted-foreground">{pc.course?.credits} cr</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PresetsPage() {
  const { data: presets, isLoading } = usePresets();
  const clonePreset = useClonePreset();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [category, setCategory] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const filtered = presets?.filter(p => !category || p.preset_category === category) || [];

  const handleClone = async (presetId: string) => {
    const plan = await clonePreset.mutateAsync(presetId);
    toast({ title: "Plan created from preset!" });
    navigate(`/dashboard/plans/${plan.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Preset Plans</h1>
        <p className="text-muted-foreground">Start with a curated plan for your field of interest</p>
      </div>

      <Select value={category} onValueChange={v => setCategory(v === "all" ? "" : v)}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {PRESET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Layers className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-lg font-medium">No presets found</h3>
            <p className="text-sm text-muted-foreground">Try a different category filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(preset => (
            <Card key={preset.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                {preset.preset_category && <Badge className="mb-2 w-fit">{preset.preset_category}</Badge>}
                <CardTitle className="text-lg">{preset.name}</CardTitle>
                <CardDescription>{preset.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPreviewId(preset.id)}>
                    <Eye className="mr-1 h-3 w-3" /> Preview
                  </Button>
                  <Button size="sm" onClick={() => handleClone(preset.id)} disabled={clonePreset.isPending}>
                    <Copy className="mr-1 h-3 w-3" /> Use This Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {previewId && (
        <PresetPreviewDialog presetId={previewId} open={!!previewId} onClose={() => setPreviewId(null)} />
      )}
    </div>
  );
}
