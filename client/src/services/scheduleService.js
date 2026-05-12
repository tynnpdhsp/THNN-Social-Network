const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': 'Bearer dummy-token' // Mock token for backend
});

// --- Schedule ---
export const getSchedules = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/schedules/${query ? `?${query}` : ''}`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch schedules');
    return await response.json();
  } catch (error) {
    console.error('Error fetching schedules:', error);
    throw error;
  }
};

export const getScheduleById = async (id) => {
  try {
    const response = await fetch(`${API_URL}/schedules/detail/${id}`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch schedule detail');
    return await response.json();
  } catch (error) {
    console.error('Error fetching schedule detail:', error);
    throw error;
  }
};

export const createSchedule = async (data) => {
  try {
    const response = await fetch(`${API_URL}/schedules/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create schedule');
    return await response.json();
  } catch (error) {
    console.error('Error creating schedule:', error);
    throw error;
  }
};

export const updateSchedule = async (id, data) => {
  try {
    const response = await fetch(`${API_URL}/schedules/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update schedule');
    return await response.json();
  } catch (error) {
    console.error('Error updating schedule:', error);
    throw error;
  }
};

export const deleteSchedule = async (id) => {
  try {
    const response = await fetch(`${API_URL}/schedules/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete schedule');
    return await response.json();
  } catch (error) {
    console.error('Error deleting schedule:', error);
    throw error;
  }
};

export const setActiveSchedule = async (id) => {
  try {
    const response = await fetch(`${API_URL}/schedules/${id}/set-active`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to set active schedule');
    return await response.json();
  } catch (error) {
    console.error('Error setting active schedule:', error);
    throw error;
  }
};

// --- Schedule Entry ---
export const getScheduleEntries = async (scheduleId) => {
  try {
    const response = await fetch(`${API_URL}/schedules/${scheduleId}/entries`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch schedule entries');
    return await response.json();
  } catch (error) {
    console.error('Error fetching schedule entries:', error);
    throw error;
  }
};

export const createScheduleEntry = async (scheduleId, data) => {
  try {
    const response = await fetch(`${API_URL}/schedules/${scheduleId}/entries`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create schedule entry');
    return await response.json();
  } catch (error) {
    console.error('Error creating schedule entry:', error);
    throw error;
  }
};

export const updateScheduleEntry = async (entryId, data) => {
  try {
    const response = await fetch(`${API_URL}/schedules/entries/${entryId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update schedule entry');
    return await response.json();
  } catch (error) {
    console.error('Error updating schedule entry:', error);
    throw error;
  }
};

export const deleteScheduleEntry = async (entryId) => {
  try {
    const response = await fetch(`${API_URL}/schedules/entries/${entryId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete schedule entry');
    return await response.json();
  } catch (error) {
    console.error('Error deleting schedule entry:', error);
    throw error;
  }
};

// --- Study Note ---
export const getStudyNotes = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/schedules/notes/${query ? `?${query}` : ''}`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch study notes');
    return await response.json();
  } catch (error) {
    console.error('Error fetching study notes:', error);
    throw error;
  }
};

export const createStudyNote = async (data) => {
  try {
    const response = await fetch(`${API_URL}/schedules/notes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create study note');
    return await response.json();
  } catch (error) {
    console.error('Error creating study note:', error);
    throw error;
  }
};

export const deleteStudyNote = async (id) => {
  try {
    const response = await fetch(`${API_URL}/schedules/notes/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete study note');
    return await response.json();
  } catch (error) {
    console.error('Error deleting study note:', error);
    throw error;
  }
};

export const importCourseSections = async (data) => {
  try {
    const response = await fetch(`${API_URL}/schedules/course-sections`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to import course sections');
    return await response.json();
  } catch (error) {
    console.error('Error importing course sections:', error);
    throw error;
  }
};

export const importCourseSectionsExcel = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/schedules/course-sections/excel`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer dummy-token' // Mock token
      },
      body: formData
    });
    if (!response.ok) throw new Error('Failed to import course sections from Excel');
    return await response.json();
  } catch (error) {
    console.error('Error importing Excel:', error);
    throw error;
  }
};
