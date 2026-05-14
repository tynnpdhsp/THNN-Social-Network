import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Timetable.jsx defines import modal + handleImportData but never calls setShowImportModal(true).
 * Full UI tests for JSON/Excel import are skipped until a control opens the modal.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TIMETABLE_SRC = path.resolve(__dirname, '../../../../src/components/Timetable/Timetable.jsx');

describe('Timetable — import (blocked by missing UI trigger)', () => {
  it('source_has_no_setShowImportModal_true_so_modal_unreachable_from_user', () => {
    const src = readFileSync(TIMETABLE_SRC, 'utf8');
    expect(src).toContain('setShowImportModal');
    expect(src).not.toMatch(/setShowImportModal\(true\)/);
  });

  it.skip('when_modal_open_json_invalid_shows_toast_error', async () => {
    /* Open "Nhập dữ liệu" → JSON tab → paste "{}" → Bắt đầu nhập → toast Lỗi: ... */
  });

  it.skip('when_modal_open_json_array_calls_importCourseSections', async () => {
    /* Valid array → importCourseSections(parsed) → success toast → fetchInitialData */
  });

  it.skip('when_modal_open_excel_without_file_shows_error', async () => {
    /* Excel tab, no file, Bắt đầu nhập → toast contains Vui lòng chọn file Excel */
  });

  it.skip('when_modal_open_excel_with_file_calls_importCourseSectionsExcel', async () => {
    /* Upload .xlsx → Bắt đầu nhập → importCourseSectionsExcel(file) */
  });

  it.skip('when_import_api_fails_shows_toast_error_message', async () => {
    /* importCourseSections rejects → toast.error Lỗi: ... */
  });
});
