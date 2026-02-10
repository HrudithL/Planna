import { Link, useNavigate } from "react-router-dom";
import { useUserPlans, useCreatePlan, useDeletePlan } from "@/hooks/use-plans";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Trash2, ExternalLink, Download } from "lucide-react";
import { useState } from "react";
import { plansApi } from "@/lib/api";

export default function PlansPage() {
  const { data: plans, isLoading } = useUserPlans();
  const createPlan = useCreatePlan();
  const deletePlan = useDeletePlan();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const plan = await createPlan.mutateAsync({ name: newName, description: newDesc });
    toast({ title: "Plan created!" });
    setShowCreate(false);
    setNewName("");
    setNewDesc("");
    navigate(`/dashboard/plans/${plan.id}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deletePlan.mutateAsync(deleteId);
    toast({ title: "Plan deleted" });
    setDeleteId(null);
  };

  const handleExport = async (id: string, name: string) => {
    const csv = await plansApi.exportCsv(id);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Plan exported as CSV" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Plans</h1>
          <p className="text-muted-foreground">Create and manage your degree plans</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Plan
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-6 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent></Card>
          ))}
        </div>
      ) : plans?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-1 text-lg font-medium">No plans yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">Create your first degree plan or start from a preset template.</p>
            <div className="flex gap-3">
              <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" /> Create Plan</Button>
              <Button variant="outline" asChild><Link to="/dashboard/presets">Browse Presets</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans?.map(plan => (
            <Card key={plan.id} className="group transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {plan.description && <CardDescription>{plan.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-xs text-muted-foreground">
                  Updated {new Date(plan.updated_at).toLocaleDateString()}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" asChild>
                    <Link to={`/dashboard/plans/${plan.id}`}>
                      <ExternalLink className="mr-1 h-3 w-3" /> Open
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleExport(plan.id, plan.name)}>
                    <Download className="mr-1 h-3 w-3" /> CSV
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(plan.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Plan</DialogTitle>
            <DialogDescription>Give your degree plan a name and description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Plan Name</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="My 4-Year Plan" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description (optional)</label>
              <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="College prep track…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createPlan.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. All courses in this plan will be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
