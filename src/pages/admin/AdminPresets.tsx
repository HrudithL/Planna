import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePresets } from "@/hooks/use-plans";
import { presetsApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Layers, BookOpen } from "lucide-react";

export default function AdminPresets() {
  const { data: presets, isLoading } = usePresets();
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [editPreset, setEditPreset] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const preset = await presetsApi.create({ name, description: desc });
      qc.invalidateQueries({ queryKey: ["presets"] });
      toast({ title: "Preset created — now add courses to it" });
      resetForm();
      // Navigate to the plan editor so the admin can add courses immediately
      navigate(`/dashboard/plans/${preset.id}`);
    } catch (e: any) {
      toast({ title: "Error creating preset", description: e.message, variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    if (!editPreset || !name.trim()) return;
    try {
      await presetsApi.update(editPreset, { name, description: desc });
      qc.invalidateQueries({ queryKey: ["presets"] });
      toast({ title: "Preset updated" });
      resetForm();
    } catch (e: any) {
      toast({ title: "Error updating preset", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await presetsApi.delete(deleteId);
      qc.invalidateQueries({ queryKey: ["presets"] });
      toast({ title: "Preset deleted" });
      setDeleteId(null);
    } catch (e: any) {
      toast({ title: "Error deleting preset", description: e.message, variant: "destructive" });
    }
  };

  const openEdit = (id: string) => {
    const p = presets?.find(x => x.id === id);
    if (!p) return;
    setName(p.name);
    setDesc(p.description || "");
    setEditPreset(id);
  };

  const resetForm = () => {
    setShowCreate(false);
    setEditPreset(null);
    setName("");
    setDesc("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Presets</h1>
          <p className="text-muted-foreground">Create and manage preset degree plans</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Preset
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : presets?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Layers className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-lg font-medium">No presets yet</h3>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>Create First Preset</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {presets?.map(p => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-lg">{p.name}</CardTitle>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/plans/${p.id}`)}>
                    <BookOpen className="mr-1 h-3 w-3" /> Edit Courses
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(p.id)}>
                    <Pencil className="mr-1 h-3 w-3" /> Edit Details
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(p.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={showCreate || !!editPreset} onOpenChange={resetForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editPreset ? "Edit Preset" : "Create Preset"}</DialogTitle>
            <DialogDescription>
              {editPreset
                ? "Update the preset plan details."
                : "Define the preset plan details. After creating, you'll be taken to the plan editor to add courses."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Computer Science Track" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe this preset…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={editPreset ? handleUpdate : handleCreate}>{editPreset ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Preset</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this preset plan and all its courses.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
