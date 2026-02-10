import { useQuery } from "@tanstack/react-query";
import { coursesApi } from "@/lib/api";
import { CourseFilters } from "@/types";

export function useCourses(filters?: CourseFilters) {
  return useQuery({
    queryKey: ["courses", filters],
    queryFn: () => coursesApi.getAll(filters),
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: ["course", id],
    queryFn: () => coursesApi.getById(id),
    enabled: !!id,
  });
}
