/**
 * Course Import Module for Planna
 * 
 * This module handles importing courses from JSON data into Supabase.
 * Called by the admin API endpoint when JSON files are uploaded.
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Configuration
// ============================================================================

// Tags to skip during import (case-insensitive)
const SKIP_TAGS = ['CAN_TAKE_VIRTUAL', 'CAN_TAKE_SUMMER', 'science'];

function shouldSkipTag(tagSymbol) {
  return SKIP_TAGS.some(s => s.toLowerCase() === tagSymbol.toLowerCase());
}

function getSupabaseClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// ============================================================================
// Import Logic
// ============================================================================

export async function importCoursesFromJson(coursesData, progressCallback = null) {
  const supabase = getSupabaseClient();

  // Validate input
  if (!Array.isArray(coursesData)) {
    throw new Error('Invalid input: coursesData must be an array');
  }

  const log = (message) => {
    console.log(message);
    if (progressCallback) progressCallback(message);
  };

  log(`Starting course import with ${coursesData.length} courses\n`);

  // Statistics
  let stats = {
    total: coursesData.length,
    coursesCreated: 0,
    coursesUpdated: 0,
    coursesMarkedNotOffered: 0,
    tagsCreated: 0,
    eligibilityCreated: 0,
    relationshipsCreated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    errors: 0,
    errorDetails: []
  };

  // Map to store course_code -> course_id for relationship resolution
  const courseCodeToId = new Map();

  // Collect all course codes from the import to determine which DB courses are missing
  const importedCourseCodes = new Set(coursesData.map(c => c.course_id).filter(Boolean));

  // ============================================================================
  // Pass 0: Mark courses NOT in import as not offered
  // ============================================================================
  log('🔄 Pass 0: Marking courses not in import as not offered...\n');

  try {
    // Get all existing course codes from DB
    const { data: allExisting, error: fetchAllErr } = await supabase
      .from('courses')
      .select('id, external_course_code')
      .eq('is_offered', true);

    if (fetchAllErr) throw fetchAllErr;

    const toMarkNotOffered = (allExisting || []).filter(c => !importedCourseCodes.has(c.external_course_code));

    if (toMarkNotOffered.length > 0) {
      const idsToMark = toMarkNotOffered.map(c => c.id);
      // Mark base courses as not offered
      const { error: markErr } = await supabase
        .from('courses')
        .update({ is_offered: false })
        .in('id', idsToMark);

      if (markErr) throw markErr;

      // Also mark their variants as not offered
      const { error: markVarErr } = await supabase
        .from('course_variants')
        .update({ is_offered: false })
        .in('course_id', idsToMark);

      if (markVarErr) throw markVarErr;

      stats.coursesMarkedNotOffered = toMarkNotOffered.length;
      log(`  Marked ${toMarkNotOffered.length} courses as not offered`);
    } else {
      log('  No courses to mark as not offered');
    }
  } catch (error) {
    log(`  ❌ Error marking courses as not offered: ${error.message}`);
    stats.errors++;
    stats.errorDetails.push({ course_id: 'PASS_0', error: error.message });
  }

  // ============================================================================
  // Pass 1: Upsert all courses + variants
  // ============================================================================
  log('\n📦 Pass 1: Importing courses, tags, eligibility, and variants...\n');

  for (let i = 0; i < coursesData.length; i++) {
    const c = coursesData[i];
    const progress = `[${i + 1}/${coursesData.length}]`;

    try {
      // Check if course already exists
      const { data: existing } = await supabase
        .from('courses')
        .select('id')
        .eq('external_course_code', c.course_id)
        .maybeSingle();

      const courseData = {
        external_course_code: c.course_id,
        external_uuid: c.uuid,
        name: c.name,
        credits: c.credits,
        length: c.length,
        gpa_weight: c.gpa,
        subject: c.subject?.name ?? null,
        is_elective: c.elective,
        // Leave description and notes null (managed by app, not from API)
        description: existing ? undefined : null,
        notes: existing ? undefined : null,
        is_offered: true,
        raw_payload: c
      };

      let courseId;

      if (existing) {
        // Update existing course (also re-enable if it was marked not offered)
        const { data: updated, error } = await supabase
          .from('courses')
          .update(courseData)
          .eq('id', existing.id)
          .select('id')
          .single();

        if (error) throw error;
        courseId = updated.id;
        stats.coursesUpdated++;
        log(`${progress} ✏️  Updated: ${c.course_id} - ${c.name}`);
      } else {
        // Insert new course
        const { data: inserted, error } = await supabase
          .from('courses')
          .insert(courseData)
          .select('id')
          .single();

        if (error) throw error;
        courseId = inserted.id;
        stats.coursesCreated++;
        log(`${progress} ✨ Created: ${c.course_id} - ${c.name}`);
      }

      // Store mapping for relationship resolution
      courseCodeToId.set(c.course_id, courseId);

      // ========================================================================
      // Upsert course tags (skip redundant tags)
      // ========================================================================
      if (Array.isArray(c.tags) && c.tags.length > 0) {
        // Delete existing tags for this course
        await supabase
          .from('course_tags')
          .delete()
          .eq('course_id', courseId);

        for (const tag of c.tags) {
          const tagSymbol = tag.symbol;
          if (shouldSkipTag(tagSymbol)) {
            continue;
          }
          
          const { error } = await supabase
            .from('course_tags')
            .insert({
              course_id: courseId,
              tag: tagSymbol,
              tag_uuid: tag.uuid
            });

          if (!error) {
            stats.tagsCreated++;
          }
        }
      }

      // ========================================================================
      // Upsert course eligibility
      // ========================================================================
      if (Array.isArray(c.grades_eligible)) {
        // Delete existing eligibility for this course
        await supabase
          .from('course_eligibility')
          .delete()
          .eq('course_id', courseId);

        for (const gradeGroup of c.grades_eligible) {
          const terms = gradeGroup.academic_term_offered || [];
          
          if (terms.length > 0) {
            for (const term of terms) {
              const { error } = await supabase
                .from('course_eligibility')
                .insert({
                  course_id: courseId,
                  grade: gradeGroup.grade,
                  term_number: term.academic_term,
                  term_name: term.name,
                  can_plan: term.can_plan
                });

              if (!error) {
                stats.eligibilityCreated++;
              }
            }
          } else {
            const { error } = await supabase
              .from('course_eligibility')
              .insert({
                course_id: courseId,
                grade: gradeGroup.grade,
                term_number: null,
                term_name: null,
                can_plan: true
              });

            if (!error) {
              stats.eligibilityCreated++;
            }
          }
        }
      }

      // ========================================================================
      // Upsert course variants
      // ========================================================================
      if (Array.isArray(c.variants) && c.variants.length > 0) {
        // Delete existing variants for this course
        await supabase
          .from('course_variants')
          .delete()
          .eq('course_id', courseId);

        for (const variant of c.variants) {
          const variantData = {
            course_id: courseId,
            variant_course_code: variant.variant_course_code,
            delivery_mode: variant.delivery_mode || null,
            is_virtual: variant.is_virtual ?? false,
            is_summer: variant.is_summer ?? false,
            term: variant.term || null,
            length: variant.length ?? null,
            credits: variant.credits ?? null,
            is_offered: true,
          };

          const { error } = await supabase
            .from('course_variants')
            .insert(variantData);

          if (!error) {
            stats.variantsCreated++;
          } else {
            // If duplicate variant_course_code (from another course), update it
            if (error.code === '23505') {
              const { error: updateErr } = await supabase
                .from('course_variants')
                .update(variantData)
                .eq('variant_course_code', variant.variant_course_code);

              if (!updateErr) {
                stats.variantsUpdated++;
              }
            } else {
              log(`${progress}   ⚠️ Variant error for ${variant.variant_course_code}: ${error.message}`);
            }
          }
        }
      }

    } catch (error) {
      log(`${progress} ❌ Error importing ${c.course_id}: ${error.message}`);
      stats.errors++;
      stats.errorDetails.push({
        course_id: c.course_id,
        error: error.message
      });
    }
  }

  log('\n📦 Pass 1 complete: All courses imported\n');

  // ============================================================================
  // Pass 2: Create course relationships (prerequisites and corequisites)
  // ============================================================================
  log('🔗 Pass 2: Creating course relationships...\n');

  for (let i = 0; i < coursesData.length; i++) {
    const c = coursesData[i];
    const progress = `[${i + 1}/${coursesData.length}]`;
    const courseId = courseCodeToId.get(c.course_id);

    if (!courseId) {
      continue;
    }

    try {
      // Delete existing relationships for this course
      await supabase
        .from('course_relationships')
        .delete()
        .eq('course_id', courseId);

      // Process prerequisites
      if (Array.isArray(c.prerequisites) && c.prerequisites.length > 0) {
        for (let groupIndex = 0; groupIndex < c.prerequisites.length; groupIndex++) {
          const prereqGroup = c.prerequisites[groupIndex];
          const groupId = `prereq_group_${groupIndex}`;
          const logicType = prereqGroup.requires_all ? 'AND' : 'OR';

          for (const alt of prereqGroup.alternatives || []) {
            const relatedCourseId = courseCodeToId.get(alt.course_code) || null;

            const { error } = await supabase
              .from('course_relationships')
              .insert({
                course_id: courseId,
                related_course_id: relatedCourseId,
                relationship_type: 'prerequisite',
                group_id: groupId,
                logic_type: logicType,
                description: alt.text
              });

            if (!error) {
              stats.relationshipsCreated++;
            }
          }
        }
      }

      // Process corequisites
      if (Array.isArray(c.corequisites) && c.corequisites.length > 0) {
        for (let groupIndex = 0; groupIndex < c.corequisites.length; groupIndex++) {
          const coreqGroup = c.corequisites[groupIndex];
          const groupId = `coreq_group_${groupIndex}`;
          const logicType = coreqGroup.requires_all ? 'AND' : 'OR';

          for (const alt of coreqGroup.alternatives || []) {
            const relatedCourseId = courseCodeToId.get(alt.course_code) || null;

            const { error } = await supabase
              .from('course_relationships')
              .insert({
                course_id: courseId,
                related_course_id: relatedCourseId,
                relationship_type: 'corequisite',
                group_id: groupId,
                logic_type: logicType,
                description: alt.text
              });

            if (!error) {
              stats.relationshipsCreated++;
            }
          }
        }
      }

    } catch (error) {
      log(`${progress} ❌ Error creating relationships for ${c.course_id}: ${error.message}`);
      stats.errors++;
      stats.errorDetails.push({
        course_id: c.course_id,
        error: error.message,
        type: 'relationships'
      });
    }
  }

  log('\n🔗 Pass 2 complete: All relationships created\n');

  // ============================================================================
  // Summary
  // ============================================================================
  log('═══════════════════════════════════════════════════════════');
  log('                   IMPORT SUMMARY                          ');
  log('═══════════════════════════════════════════════════════════');
  log(`Total courses processed:      ${stats.total}`);
  log(`  - Courses created:          ${stats.coursesCreated}`);
  log(`  - Courses updated:          ${stats.coursesUpdated}`);
  log(`  - Courses marked not offered: ${stats.coursesMarkedNotOffered}`);
  log(`Tags created:                 ${stats.tagsCreated}`);
  log(`Eligibility records created:  ${stats.eligibilityCreated}`);
  log(`Relationships created:        ${stats.relationshipsCreated}`);
  log(`Variants created:             ${stats.variantsCreated}`);
  log(`Variants updated:             ${stats.variantsUpdated}`);
  log(`Errors:                       ${stats.errors}`);
  log('═══════════════════════════════════════════════════════════');

  return stats;
}
