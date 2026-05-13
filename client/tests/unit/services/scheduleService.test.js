import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeResponse } from '../_fakes/fetch.js';

vi.mock('@/config/api.js', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/config/api.js';
import {
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  setActiveSchedule,
  getScheduleEntries,
  createScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
  getStudyNotes,
  createStudyNote,
  deleteStudyNote,
  importCourseSections,
  importCourseSectionsExcel,
} from '@/services/scheduleService.js';

describe('scheduleService', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it('getSchedules_no_query', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getSchedules();
    expect(apiFetch).toHaveBeenCalledWith('/schedules/');
  });

  it('getSchedules_empty_object_no_query', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getSchedules({});
    expect(apiFetch).toHaveBeenCalledWith('/schedules/');
  });

  it('getSchedules_with_query', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getSchedules({ active: '1' });
    expect(apiFetch).toHaveBeenCalledWith('/schedules/?active=1');
  });

  it('getScheduleById_path', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await getScheduleById('sid');
    expect(apiFetch).toHaveBeenCalledWith('/schedules/detail/sid');
  });

  it('createSchedule_POST', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, { id: 'n' }));
    const data = { name: 'S1' };
    await createSchedule(data);
    expect(apiFetch).toHaveBeenCalledWith('/schedules/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('updateSchedule_PUT', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    const data = { name: 'S2' };
    await updateSchedule('10', data);
    expect(apiFetch).toHaveBeenCalledWith('/schedules/10', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  });

  it('deleteSchedule_DELETE', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await deleteSchedule('11');
    expect(apiFetch).toHaveBeenCalledWith('/schedules/11', { method: 'DELETE' });
  });

  it('setActiveSchedule_POST', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await setActiveSchedule('12');
    expect(apiFetch).toHaveBeenCalledWith('/schedules/12/set-active', { method: 'POST' });
  });

  it('getScheduleEntries_GET', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getScheduleEntries('sch1');
    expect(apiFetch).toHaveBeenCalledWith('/schedules/sch1/entries');
  });

  it('createScheduleEntry_POST', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    const body = { title: 'E' };
    await createScheduleEntry('sch2', body);
    expect(apiFetch).toHaveBeenCalledWith('/schedules/sch2/entries', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  });

  it('updateScheduleEntry_PUT', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    const body = { note: 'n' };
    await updateScheduleEntry('ent1', body);
    expect(apiFetch).toHaveBeenCalledWith('/schedules/entries/ent1', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  });

  it('deleteScheduleEntry_DELETE', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await deleteScheduleEntry('ent2');
    expect(apiFetch).toHaveBeenCalledWith('/schedules/entries/ent2', { method: 'DELETE' });
  });

  it('getStudyNotes_no_query', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getStudyNotes();
    expect(apiFetch).toHaveBeenCalledWith('/schedules/notes/');
  });

  it('getStudyNotes_with_query', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, []));
    await getStudyNotes({ schedule_id: 's' });
    expect(apiFetch).toHaveBeenCalledWith('/schedules/notes/?schedule_id=s');
  });

  it('createStudyNote_POST', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    const data = { text: 't' };
    await createStudyNote(data);
    expect(apiFetch).toHaveBeenCalledWith('/schedules/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('deleteStudyNote_DELETE', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    await deleteStudyNote('n1');
    expect(apiFetch).toHaveBeenCalledWith('/schedules/notes/n1', { method: 'DELETE' });
  });

  it('importCourseSections_POST_JSON', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    const payload = { sections: [] };
    await importCourseSections(payload);
    expect(apiFetch).toHaveBeenCalledWith('/schedules/course-sections', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });

  it('importCourseSectionsExcel_POST_FormData', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(200, {}));
    const file = new File(['x'], 'book.xlsx');
    await importCourseSectionsExcel(file);
    expect(apiFetch).toHaveBeenCalledWith(
      '/schedules/course-sections/excel',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    const fd = apiFetch.mock.calls[0][1].body;
    expect(fd.get('file')).toBe(file);
  });

  it('getSchedules_not_ok_throws', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeResponse(500, {}));
    await expect(getSchedules()).rejects.toThrow('Failed to fetch schedules');
  });

  it('propagates_rejection', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('down'));
    await expect(getScheduleById('1')).rejects.toThrow('down');
  });
});
