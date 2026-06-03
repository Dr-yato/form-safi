// ============================================================================
// REALTIME DATA LAYER — CinePlusSafi Survey
// Uses localStorage as shared data store + BroadcastChannel for live push.
// This simulates Google Forms real-time behaviour with no backend required.
// ============================================================================

const STORAGE_KEY = 'cineplus_safi_responses';
const CHANNEL_NAME = 'cineplus_realtime';

// ─── Storage Helpers ─────────────────────────────────────────────────────────

function RT_getAll() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function RT_save(responses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(responses));
  } catch (e) {
    console.error('LocalStorage write failed:', e);
  }
}

function RT_addResponse(responseData) {
  let all = RT_getAll();
  if (!Array.isArray(all)) all = [];
  const newId = all.length > 0 ? Math.max(...all.map(r => r ? (r.id || 0) : 0)) + 1 : 1;
  const record = {
    ...responseData,
    id: newId,
    submission_date: new Date().toISOString()
  };
  all.push(record);
  RT_save(all);
  RT_broadcast({ type: 'NEW_RESPONSE', response: record, total: all.length });
  return record;
}

function RT_deleteResponse(id) {
  let all = RT_getAll();
  if (!Array.isArray(all)) all = [];
  all = all.filter(r => r && r.id !== id);
  RT_save(all);
  RT_broadcast({ type: 'DELETE_RESPONSE', id, total: all.length });
}

function RT_clearAll() {
  RT_save([]);
  RT_broadcast({ type: 'CLEAR_ALL', total: 0 });
}

// ─── Broadcast Channel ───────────────────────────────────────────────────────

let _channel = null;

function RT_getChannel() {
  if (!_channel && typeof BroadcastChannel !== 'undefined') {
    try {
      _channel = new BroadcastChannel(CHANNEL_NAME);
    } catch (e) {
      console.warn('BroadcastChannel initialization failed (possibly sandboxed):', e);
      _channel = null;
    }
  }
  return _channel;
}

function RT_broadcast(message) {
  try {
    const ch = RT_getChannel();
    if (ch) {
      ch.postMessage(message);
    }
  } catch (e) {
    console.warn('Broadcast failed:', e);
  }
}

function RT_onMessage(callback) {
  const ch = RT_getChannel();
  if (ch) {
    ch.onmessage = (event) => callback(event.data);
  }
  // Also listen to storage events (cross-tab fallback for older browsers)
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      callback({ type: 'STORAGE_CHANGE', total: RT_getAll().length });
    }
  });
}

// ─── Export ──────────────────────────────────────────────────────────────────
// (Exposed as globals for simplicity — no module bundler required)
window.RT = { getAll: RT_getAll, addResponse: RT_addResponse, deleteResponse: RT_deleteResponse, clearAll: RT_clearAll, onMessage: RT_onMessage };
