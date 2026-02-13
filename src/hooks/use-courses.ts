import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import Fuse from "fuse.js";
import { coursesApi } from "@/lib/api";
import { Course, CourseFilters } from "@/types";

/**
 * Load the entire course catalog once and cache aggressively (30 min).
 * All pages share this single cached dataset — no redundant fetches.
 */
export function useAllCourses() {
  return useQuery({
    queryKey: ["all-courses"],
    queryFn: () => coursesApi.getAll(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // keep in cache for 1 hour
  });
}

/**
 * Fuse.js configuration for fuzzy course search.
 * - threshold: 0.35 allows ~1-2 character typos while still being relevant
 * - distance: 200 allows matching in longer strings (descriptions)
 * - keys are weighted: course code and name are most important
 */
const FUSE_OPTIONS: Fuse.IFuseOptions<Course> = {
  keys: [
    { name: "external_course_code", weight: 3 },
    { name: "name", weight: 2 },
    { name: "description", weight: 0.5 },
    { name: "tags", weight: 1 },
  ],
  threshold: 0.35,
  distance: 200,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

/**
 * Client-side fuzzy search + structured filtering over the cached course list.
 * Returns results instantly (no network round-trip after initial load).
 *
 * - Text search uses Fuse.js (handles typos, partial matches, relevance ranking)
 * - Structured filters (subject, grades, tags, credits, GPA) are applied after
 */
export function useCourseSearch(filters?: CourseFilters) {
  const { data: allCourses, isLoading } = useAllCourses();

  // Create and memoize the Fuse index — only rebuilt when course list changes
  const fuseRef = useRef<Fuse<Course> | null>(null);
  const fuseCoursesRef = useRef<Course[] | undefined>(undefined);

  if (allCourses && allCourses !== fuseCoursesRef.current) {
    fuseRef.current = new Fuse(allCourses, FUSE_OPTIONS);
    fuseCoursesRef.current = allCourses;
  }

  const results = useMemo(() => {
    if (!allCourses) return [];

    let courses: Course[];

    // Step 1: Fuzzy text search (or return all if no search term)
    if (filters?.search && filters.search.trim().length > 0) {
      const searchTerm = filters.search.trim();
      if (fuseRef.current) {
        courses = fuseRef.current.search(searchTerm).map(r => r.item);
      } else {
        courses = allCourses;
      }
    } else {
      courses = allCourses;
    }

    // Step 2: Apply structured filters
    if (filters) {
      if (filters.subject) {
        courses = courses.filter(c => c.subject === filters.subject);
      }
      if (filters.grades && filters.grades.length > 0) {
        courses = courses.filter(c =>
          c.eligible_grades.some(g => filters.grades.includes(g))
        );
      }
      if (filters.tags && filters.tags.length > 0) {
        // Strict tag filtering: only show courses that have at least one matching tag
        // Case-insensitive matching to handle tag variations
        const filterTagsLower = filters.tags.map(t => t.toLowerCase());
        courses = courses.filter(c =>
          c.tags.some(t => filterTagsLower.includes(t.toLowerCase()))
        );
      }
      if (filters.minCredits !== undefined) {
        courses = courses.filter(c => c.credits >= filters.minCredits!);
      }
      if (filters.maxCredits !== undefined) {
        courses = courses.filter(c => c.credits <= filters.maxCredits!);
      }
      if (filters.minGpaWeight !== undefined) {
        courses = courses.filter(c => c.gpa_weight >= filters.minGpaWeight!);
      }
      if (filters.maxGpaWeight !== undefined) {
        courses = courses.filter(c => c.gpa_weight <= filters.maxGpaWeight!);
      }
    }

    return courses;
  }, [allCourses, filters]);

  return { data: results, isLoading };
}

/**
 * Legacy hook — now powered by useAllCourses + client-side filtering.
 * Kept for backwards compatibility with existing pages.
 */
export function useCourses(filters?: CourseFilters) {
  return useCourseSearch(filters);
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: ["course", id],
    queryFn: () => coursesApi.getById(id),
    enabled: !!id,
  });
}

export function useSubjects() {
  // Derive subjects from cached course list instead of separate API call
  const { data: allCourses } = useAllCourses();

  return useQuery({
    queryKey: ["subjects", allCourses?.length],
    queryFn: () => {
      if (!allCourses) return [];
      const subjects = [...new Set(
        allCourses
          .filter(c => c.is_offered)
          .map(c => c.subject)
          .filter(Boolean)
      )].sort();
      return subjects;
    },
    enabled: !!allCourses,
    staleTime: 30 * 60 * 1000,
  });
}

export function useTags() {
  // Derive tags from cached course list instead of separate API call
  const { data: allCourses } = useAllCourses();

  return useQuery({
    queryKey: ["tags", allCourses?.length],
    queryFn: () => {
      if (!allCourses) return [];
      const tags = [...new Set(allCourses.flatMap(c => c.tags))].sort();
      return tags;
    },
    enabled: !!allCourses,
    staleTime: 30 * 60 * 1000,
  });
}
