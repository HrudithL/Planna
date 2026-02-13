-- ============================================================================
-- Remove CAN_TAKE_VIRTUAL Tag
-- ============================================================================
-- This migration removes the CAN_TAKE_VIRTUAL tag from all courses as it is
-- redundant with the Virtual tag. Future imports will also exclude this tag.
-- ============================================================================

-- Delete all CAN_TAKE_VIRTUAL tags from course_tags table
DELETE FROM public.course_tags
WHERE tag = 'CAN_TAKE_VIRTUAL';

-- Log the number of tags removed (for verification)
DO $$
DECLARE
    removed_count INTEGER;
BEGIN
    GET DIAGNOSTICS removed_count = ROW_COUNT;
    RAISE NOTICE 'Removed % CAN_TAKE_VIRTUAL tag(s) from course_tags', removed_count;
END $$;







