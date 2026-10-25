import api from './client';

// Auth
export const login = (username, password) =>
  api.post('/auth/login', { username, password });

// Dashboard
export const getDashboard = () => api.get('/dashboard');

// Cases
export const getCases = (params) => api.get('/cases', { params });
export const getCase  = (id) => api.get(`/cases/${id}`);
export const createCase = (data) => api.post('/cases', data);
export const updateCase = (id, data) => api.patch(`/cases/${id}`, data);
export const getCaseActions = (id) => api.get(`/cases/${id}/actions`);
export const addCaseAction  = (id, data) => api.post(`/cases/${id}/actions`, data);
export const previewBulkImport = (formData) => api.post('/cases/bulk-import/preview', formData);
export const confirmBulkImport = (data) => api.post('/cases/bulk-import/confirm', data);

// Institutions
export const getInstitutions = (params) => api.get('/institutions', { params });
export const getInstitution  = (id) => api.get(`/institutions/${id}`);
export const getInstitutionCases = (id) => api.get(`/institutions/${id}/cases`);

// Overlaps
export const getOverlaps    = (params) => api.get('/overlaps', { params });
export const getOverlap     = (id) => api.get(`/overlaps/${id}`);
export const reviewOverlap  = (id, data) => api.patch(`/overlaps/${id}/review`, data);
export const runDetection   = () => api.post('/overlaps/detect');

// Notifications
export const getNotifications  = () => api.get('/notifications');
export const markNotifRead     = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotifsRead = () => api.patch('/notifications/read-all');

// Reports
export const getReportSummary  = (params) => api.get('/reports/summary', { params });
export const getMonthlyReport  = (params) => api.get('/reports/monthly', { params });
export const getWorkloadReport = () => api.get('/reports/workload');
export const getOverlapReport  = () => api.get('/reports/overlap-report');
export const logReportExport   = (data) => api.post('/reports/log-export', data);

// Settings
export const getUsers          = () => api.get('/settings/users');
export const createUser        = (data) => api.post('/settings/users', data);
export const updateUser        = (id, data) => api.patch(`/settings/users/${id}`, data);
export const getBureaus        = () => api.get('/settings/bureaus');
export const getDeadlineRules  = () => api.get('/settings/deadline-rules');
export const createDeadlineRule = (data) => api.post('/settings/deadline-rules', data);
export const updateDeadlineRule = (id, data) => api.patch(`/settings/deadline-rules/${id}`, data);
export const getAuditLog       = (params) => api.get('/settings/audit-log', { params });
