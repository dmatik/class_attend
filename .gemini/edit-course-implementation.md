# Edit Course Feature Implementation

## Overview
Added the ability to edit courses by adding an Edit icon next to the Delete icon on each course card. The edit modal is similar to the add course modal but with specific logic for handling different types of edits.

## Changes Made

### 1. CourseManager Component (`src/components/CourseManager.tsx`)
- **Added Edit icon import** from lucide-react
- **Added `onEditCourse` prop** to the component interface
- **Added state for edit mode**: `editingCourse` to track which course is being edited
- **Added `handleEditClick` function**: Pre-fills the form with existing course data when edit is clicked
- **Added `handleDialogClose` function**: Resets form state when modal is closed
- **Updated `handleSubmit`**: Now handles both add and edit modes
- **Updated UI**:
  - Added Edit button (pencil icon) next to Delete button for each course
  - Modal title changes to "עריכת חוג" (Edit Course) in edit mode
  - Submit button text changes to "שמור שינויים" (Save Changes) in edit mode

### 2. App Component (`src/App.tsx`)
- **Added `handleEditCourse` function** with the following logic:

#### Edit Logic Based on What Changed:

1. **Number of Lessons Changed**:
   - Rebuilds ALL events (including past events) with the new number of lessons
   - Preserves replacement events (events marked with `isReplacement: true`)
   - Starts from the course start date and creates exactly the specified number of lessons

2. **Week Days Changed**:
   - Rebuilds events FROM TODAY FORWARD only
   - Keeps all past events unchanged
   - Preserves all replacement events
   - Respects the total lesson count or end date limits

3. **End Date Changed**:
   - Deletes all events AFTER the new end date
   - Preserves replacement events (they are not deleted)
   - Updates course name in remaining sessions if name also changed

4. **Only Name Changed**:
   - Simply updates the course name in all associated sessions
   - No events are deleted or recreated

### 3. Key Features
- ✅ Edit icon next to delete icon on each course
- ✅ Modal pre-filled with existing course data
- ✅ Smart event rebuilding based on what changed
- ✅ Replacement events are always preserved
- ✅ Past events preserved when only changing week days
- ✅ All events rebuilt when changing lesson count
- ✅ Events after end date deleted when end date changes
- ✅ Hebrew UI with proper RTL support

## Testing Recommendations
1. Create a course with some sessions
2. Try editing week days - verify past events remain unchanged
3. Try editing number of lessons - verify all events are rebuilt
4. Try editing end date - verify events after that date are deleted
5. Add a replacement event and verify it's preserved in all edit scenarios
6. Try editing just the name - verify only names are updated

## Technical Notes
- The implementation uses `format(new Date(), 'yyyy-MM-dd')` to get today's date
- Replacement events are identified by the `isReplacement: true` flag
- The logic prioritizes lesson count changes over day changes (checked first)
- All date comparisons use ISO date strings (YYYY-MM-DD format)
