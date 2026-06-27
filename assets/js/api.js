import * as Common from './common.js';

const dashboardApiRequest = Common.apiRequest;

const dashboardApiRequest = Common.apiRequest;

const dashboardApiRequest = Common.apiRequest;

const dashboardApiRequest = Common.apiRequest;

const dashboardApiRequest = Common.apiRequest;

const dashboardApiRequest = Common.apiRequest;

const dashboardApiRequest = Common.apiRequest;
import { apiRequest } from './common.js?v=20260622-stock-matching';

import { apiRequest } from './common.js?v=20260622-stocks-nav';
export function pollNow() {
  return dashboardApiRequest('/api/poll', { method: 'POST' });
}

export function updateSaleStatus(saleId, status) {
  return dashboardApiRequest(`/api/sales/${encodeURIComponent(saleId)}/status`, {
    method: 'POST',
    body: JSON.stringify({ status })
  });
}

export function mergeSale(saleId, payload) {
  return dashboardApiRequest(`/api/sales/${encodeURIComponent(saleId)}/merge`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createGroup(payload) {
  return dashboardApiRequest('/api/groups', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function renameGroup(groupId, name) {
  return dashboardApiRequest(`/api/groups/${encodeURIComponent(groupId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name })
  });
}
