import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { plansApi, presetsApi } from "@/lib/api";
import { useAuth } from "./use-auth";

export function useUserPlans() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["plans", user?.id],
    queryFn: () => plansApi.getUserPlans(user!.id),
    enabled: !!user,
  });
}

export function usePlan(id: string) {
  return useQuery({
    queryKey: ["plan", id],
    queryFn: () => plansApi.getById(id),
    enabled: !!id,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      plansApi.create(user!.id, name, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plansApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function useAddCourseToPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { planId: string; courseId: string; termIndex: number; yearIndex: number; gradeLevel: string }) =>
      plansApi.addCourse(args.planId, args.courseId, args.termIndex, args.yearIndex, args.gradeLevel),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["plan", vars.planId] }),
  });
}

export function useRemoveCourseFromPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { planId: string; planCourseId: string }) =>
      plansApi.removeCourse(args.planId, args.planCourseId),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["plan", vars.planId] }),
  });
}

export function useClonePreset() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (presetId: string) => plansApi.clonePreset(presetId, user!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function usePresets() {
  return useQuery({
    queryKey: ["presets"],
    queryFn: () => presetsApi.getAll(),
  });
}
