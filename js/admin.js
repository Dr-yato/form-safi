// ============================================================================
//  Admin Dashboard JavaScript — REAL-TIME Version
//  Live updates via BroadcastChannel + localStorage (like Google Forms)
// ============================================================================

let allResponses = [];
let filteredResponses = [];
let chartInstances = {};
let activeTab = 'tab-stats';
let isLiveConnected = false;
let liveResponseCount = 0;

// French stop words for semantic analysis
const FRENCH_STOP_WORDS = new Set([
    'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'dans', 'pour', 'sur',
    'qui', 'que', 'se', 'par', 'ou', 'avec', 'plus', 'ce', 'cette', 'ces', 'aux', 'pas',
    'mais', 'est', 'sont', 'ont', 'a', 'y', 'ne', 'je', 'tu', 'il', 'elle', 'nous', 'vous',
    'ils', 'elles', 'mon', 'ton', 'son', 'notre', 'votre', 'leur', 'mes', 'tes', 'ses',
    'nos', 'vos', 'leurs', 'donc', 'car', 'parce', 'chez', 'sous', 'vers', 'tout',
    'tous', 'toute', 'toutes', 'comme', 'faire', 'fait', 'plusieurs', 'sans', 'c', 'd', 'j',
    'l', 'm', 'n', 's', 't', 'qu', 'mème', 'meme', 'très', 'tres', 'si', 'bien', 'être', 'avoir',
    'aussi', 'alors', 'peut', 'dehors', 'après', 'apres', 'avant', 'depuis',
    'cinéma', 'cinemas', 'salle', 'salles', 'safi', 'ville', 'cinema', 'ferme', 'fermes', 'fermé', 'fermés',
    'lesquelles', 'lesquels', 'cet', 'ceux', 'celles', 'que', 'qui', 'quelque', 'quelques'
]);

const LIKERT_SCALE = ["Pas du tout", "Plutôt non", "Neutre", "Plutôt oui", "Tout à fait"];
const LIKERT_COLORS = [
    'rgba(239, 68, 68, 0.85)',
    'rgba(251, 146, 60, 0.85)',
    'rgba(148, 163, 184, 0.75)',
    'rgba(52, 211, 153, 0.85)',
    'rgba(16, 185, 129, 0.9)'
];

// Cinema heritage color palette
const colorPalette = [
    '#9d0208', '#370617', '#d4af37', '#e85d04',
    '#6a040f', '#ffb703', '#bc6c25', '#200f13',
    '#16a34a', '#dc2626'
];

const gradientPairs = [
    ['#9d0208', '#370617'],
    ['#d4af37', '#e85d04'],
    ['#370617', '#9d0208'],
    ['#16a34a', '#d4af37'],
    ['#e85d04', '#ffb703'],
    ['#6a040f', '#bc6c25']
];

const USAGE_LABELS = {
    cinema: 'Cinéma', cinematheque: 'Cinémathèque', spectacles: 'Spectacles',
    centre_culturel: 'Centre culturel', mediatheque: 'Médiathèque',
    coworking: 'Coworking', cafe_culturel: 'Café culturel', musee: 'Musée', autre: 'Autre',
    concert: 'Spectacles', center: 'Centre culturel', library: 'Médiathèque',
    cafe: 'Café culturel', museum: 'Musée'
};

const SUPPORT_LABELS = {
    frequenter: 'Fréquenter', benevole: 'Bénévolat', souvenirs: 'Partager souvenirs',
    financier: 'Soutien financier', non: 'Ne souhaite pas',
    visitor: 'Fréquenter', volunteer: 'Bénévolat', share: 'Partager souvenirs',
    finance: 'Soutien financier', not_involved: 'Ne souhaite pas'
};

// ===========================
//  INITIALIZATION
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    const pref = localStorage.getItem('darkMode');
    if (pref === 'on') {
        document.body.classList.add('dark-mode');
    }
    updateDarkToggleLabel();
    checkAuthentication();
});

// ===========================
//  AUTHENTICATION
// ===========================
function checkAuthentication() {
    const loggedIn = sessionStorage.getItem('admin_logged_in') === 'true';
    const loginContainer = document.getElementById('login-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const logoutBtn = document.getElementById('logout-btn');

    if (loggedIn) {
        loginContainer.style.display = 'none';
        dashboardContainer.style.display = 'block';
        logoutBtn.style.display = 'inline-block';
        initDashboard();
    } else {
        loginContainer.style.display = 'flex';
        dashboardContainer.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
}

function handleLoginSubmit(e) {
    e.preventDefault();
    const enteredUser = document.getElementById('username').value.trim();
    const enteredPass = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    const correctPassword = (typeof ADMIN_PASSWORD !== 'undefined') ? ADMIN_PASSWORD : 'adminSafi2026';

    if (enteredUser === 'admin' && enteredPass === correctPassword) {
        sessionStorage.setItem('admin_logged_in', 'true');
        errorEl.style.display = 'none';
        checkAuthentication();
    } else {
        errorEl.style.display = 'block';
        errorEl.classList.add('shake');
        setTimeout(() => errorEl.classList.remove('shake'), 600);
    }
}

function handleLogout(e) {
    e.preventDefault();
    sessionStorage.removeItem('admin_logged_in');
    checkAuthentication();
}

// ===========================
//  DASHBOARD INIT + REALTIME
// ===========================
function initDashboard() {
    // Config tab display
    const urlDisplay = document.getElementById('config-url-display');
    const pwdDisplay = document.getElementById('config-pwd-display');
    const statusBadge = document.getElementById('config-status-badge');

    if (urlDisplay) urlDisplay.value = (typeof APPS_SCRIPT_URL !== 'undefined') ? APPS_SCRIPT_URL : 'Non configuré';
    if (pwdDisplay) pwdDisplay.value = (typeof ADMIN_PASSWORD !== 'undefined') ? ADMIN_PASSWORD : 'adminSafi2026';

    if (statusBadge) {
        if (typeof APPS_SCRIPT_URL === 'undefined' || APPS_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE' || APPS_SCRIPT_URL === '') {
            statusBadge.textContent = '⚡ Mode Temps Réel Local';
            statusBadge.style.backgroundColor = 'rgba(99, 102, 241, 0.15)';
            statusBadge.style.color = '#6366f1';
            statusBadge.style.border = '1px solid rgba(99, 102, 241, 0.3)';
        } else {
            statusBadge.textContent = '✅ Connecté (Apps Script + Temps Réel)';
            statusBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
            statusBadge.style.color = '#10b981';
            statusBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        }
    }

    // Load data from real-time storage
    loadFromRealtime();

    // Setup real-time listener
    setupRealtimeListener();

    // Start background polling for serverless live feed
    startPolling();
}

let pollInterval = null;

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    const isLocalApi = APPS_SCRIPT_URL.startsWith('/') || APPS_SCRIPT_URL.includes('localhost') || APPS_SCRIPT_URL.includes('127.0.0.1');
    if (isLocalApi) {
        // Poll the server every 10 seconds
        pollInterval = setInterval(pollServerForChanges, 10000);
    }
}

function pollServerForChanges() {
    fetch('/api/responses?_t=' + Date.now())
        .then(res => res.json())
        .then(resData => {
            if (resData && resData.status === 'success' && Array.isArray(resData.data)) {
                const serverResponses = resData.data;
                
                // If there are new responses on the server
                if (serverResponses.length > allResponses.length) {
                    const existingIds = new Set(allResponses.map(r => r.id));
                    const newResponses = serverResponses.filter(r => !existingIds.has(r.id));
                    
                    // Update state
                    allResponses = serverResponses;
                    liveResponseCount = allResponses.length;
                    
                    // Display each new response with animation
                    newResponses.forEach(newResp => {
                        showNewResponseNotification(newResp);
                        addToLiveFeed(newResp);
                    });
                    
                    processAndRender();
                    pulseMetricCards();
                    
                    // Sync with localStorage
                    if (window.RT) {
                        localStorage.setItem('cineplus_safi_responses', JSON.stringify(allResponses));
                    }
                } else if (serverResponses.length < allResponses.length) {
                    // Responses were cleared/deleted on the server
                    allResponses = serverResponses;
                    liveResponseCount = allResponses.length;
                    processAndRender();
                }
            }
        })
        .catch(err => console.warn('Error during polling update:', err));
}

function loadFromRealtime() {
    const isLocalApi = APPS_SCRIPT_URL.startsWith('/') || APPS_SCRIPT_URL.includes('localhost') || APPS_SCRIPT_URL.includes('127.0.0.1');
    if (isLocalApi) {
        fetch('/api/responses?_t=' + Date.now())
            .then(res => res.json())
            .then(resData => {
                if (resData && resData.status === 'success' && Array.isArray(resData.data)) {
                    allResponses = resData.data;
                    liveResponseCount = allResponses.length;
                    updateLiveIndicator(true);
                    processAndRender();
                    showToast(`📊 ${allResponses.length} questionnaire(s) chargé(s) depuis le serveur`, 'success');
                    
                    // Sync localStorage in the browser so it matches the server database
                    if (window.RT && JSON.stringify(window.RT.getAll()) !== JSON.stringify(allResponses)) {
                        localStorage.setItem('cineplus_safi_responses', JSON.stringify(allResponses));
                    }
                    return;
                }
                throw new Error('API invalid data');
            })
            .catch(err => {
                console.warn('Impossible de charger depuis le serveur local, fallback sur le localStorage :', err);
                loadFromLocalStorageOnly();
            });
    } else {
        loadFromLocalStorageOnly();
    }
}

function loadFromLocalStorageOnly() {
    if (window.RT) {
        allResponses = window.RT.getAll();
        liveResponseCount = allResponses.length;
        updateLiveIndicator(true);
        processAndRender();
        showToast(`📊 ${allResponses.length} questionnaire(s) chargé(s) en temps réel`, 'success');
    } else {
        allResponses = getMockupData();
        processAndRender();
    }
}

function setupRealtimeListener() {
    if (!window.RT) return;

    isLiveConnected = true;
    updateLiveIndicator(true);

    window.RT.onMessage((msg) => {
        if (msg.type === 'NEW_RESPONSE') {
            // Reload all data
            allResponses = window.RT.getAll();
            liveResponseCount = allResponses.length;

            // Show animated notification
            showNewResponseNotification(msg.response);

            // Re-render everything with animation
            processAndRender();

            // Pulse the metrics
            pulseMetricCards();

            // Add to live feed
            addToLiveFeed(msg.response);

        } else if (msg.type === 'DELETE_RESPONSE') {
            allResponses = window.RT.getAll();
            processAndRender();
            showToast(`🗑️ Questionnaire #${msg.id} supprimé`, 'info');

        } else if (msg.type === 'CLEAR_ALL') {
            allResponses = [];
            processAndRender();
            showToast('🗑️ Toutes les données ont été effacées', 'info');

        } else if (msg.type === 'STORAGE_CHANGE') {
            allResponses = window.RT.getAll();
            processAndRender();
        }
    });
}

function updateLiveIndicator(connected) {
    const indicator = document.getElementById('live-indicator');
    if (!indicator) return;

    if (connected) {
        indicator.innerHTML = `
            <span class="live-dot"></span>
            <span class="live-text">EN DIRECT</span>
            <span class="live-count">${liveResponseCount} réponse(s)</span>
        `;
        indicator.classList.add('connected');
    } else {
        indicator.innerHTML = '<span class="live-text">Déconnecté</span>';
        indicator.classList.remove('connected');
    }
}

// ===========================
//  LIVE NOTIFICATIONS
// ===========================
function showNewResponseNotification(response) {
    const genderLabels = { 'femme': '👩 Femme', 'homme': '👨 Homme' };
    const ageLabels = {
        'moins_18': '< 18 ans', '18_24': '18-24 ans', '25_34': '25-34 ans',
        '35_49': '35-49 ans', '50_64': '50-64 ans', '65_plus': '65+ ans'
    };

    const gender = genderLabels[response.q1_gender] || '—';
    const age = ageLabels[response.q2_age_group] || '—';
    const neighborhood = response.q3_neighborhood || '—';

    // Create floating notification
    const notif = document.createElement('div');
    notif.className = 'realtime-notification';
    notif.innerHTML = `
        <div class="notif-icon">🎬</div>
        <div class="notif-content">
            <div class="notif-title">Nouvelle réponse #${response.id}</div>
            <div class="notif-details">${gender} · ${age} · ${neighborhood}</div>
        </div>
        <div class="notif-badge">EN DIRECT</div>
    `;
    document.body.appendChild(notif);

    // Animate in
    requestAnimationFrame(() => {
        notif.classList.add('show');
    });

    // Remove after 5s
    setTimeout(() => {
        notif.classList.remove('show');
        setTimeout(() => notif.remove(), 400);
    }, 5000);
}

function addToLiveFeed(response) {
    const feed = document.getElementById('live-feed-list');
    if (!feed) return;

    const emptyMsg = feed.querySelector('.feed-empty');
    if (emptyMsg) emptyMsg.remove();

    const genderLabels = { 'femme': 'Femme', 'homme': 'Homme' };
    const ageLabels = {
        'moins_18': '< 18', '18_24': '18-24', '25_34': '25-34',
        '35_49': '35-49', '50_64': '50-64', '65_plus': '65+'
    };

    const time = new Date(response.submission_date);
    const timeStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const item = document.createElement('div');
    item.className = 'feed-item new';
    item.innerHTML = `
        <div class="feed-time">${timeStr}</div>
        <div class="feed-info">
            <span class="feed-id">#${response.id}</span>
            <span class="feed-detail">${genderLabels[response.q1_gender] || '—'} · ${ageLabels[response.q2_age_group] || '—'}</span>
            <span class="feed-neighborhood">${response.q3_neighborhood || '—'}</span>
        </div>
        <div class="feed-status">
            <span class="feed-live-badge">NOUVEAU</span>
        </div>
    `;

    feed.insertBefore(item, feed.firstChild);

    // Animate
    requestAnimationFrame(() => {
        item.classList.add('visible');
    });

    // Limit feed to 20 items
    while (feed.children.length > 20) {
        feed.removeChild(feed.lastChild);
    }
}

function pulseMetricCards() {
    document.querySelectorAll('.metric-card').forEach(card => {
        card.classList.add('pulse-update');
        setTimeout(() => card.classList.remove('pulse-update'), 1000);
    });
}

// ===========================
//  DATA PROCESSING
// ===========================
function processAndRender() {
    applyFilters();
    updateMetrics();
    updateSecondaryMetrics();
    renderInsights();
    renderStatsCharts();
    loadSemanticAnalysis();
    loadResponsesTable();
    updateLiveIndicator(isLiveConnected);
}

function applyFilters() {
    const gender = document.getElementById('filter-gender')?.value || '';
    const age = document.getElementById('filter-age')?.value || '';
    const education = document.getElementById('filter-education')?.value || '';
    const neighborhood = (document.getElementById('filter-neighborhood')?.value || '').trim().toLowerCase();

    filteredResponses = allResponses.filter(r => {
        if (gender && r.q1_gender !== gender) return false;
        if (age && r.q2_age_group !== age) return false;
        if (education && r.q5_education_level !== education) return false;
        if (neighborhood && (!r.q3_neighborhood || !r.q3_neighborhood.toLowerCase().includes(neighborhood))) return false;
        return true;
    });
}

function updateMetrics() {
    animateCounter('metric-total', filteredResponses.length);

    let today = 0, week = 0, month = 0;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    filteredResponses.forEach(r => {
        const d = getSubmissionDate(r);
        if (!d) return;
        if (d >= todayStart) today++;
        if (d >= weekStart) week++;
        if (d >= monthStart) month++;
    });

    animateCounter('metric-today', today);
    animateCounter('metric-week', week);
    animateCounter('metric-month', month);
}

function animateCounter(elementId, targetValue) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const current = parseInt(el.textContent) || 0;
    if (current === targetValue) return;

    const duration = 600;
    const startTime = performance.now();

    function step(timestamp) {
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const value = Math.round(current + (targetValue - current) * eased);
        el.textContent = value;

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}


function pct(n, total) {
    return total > 0 ? Math.round((n / total) * 100) : 0;
}

function avgLikert(dataset, keys) {
    let sum = 0, count = 0;
    dataset.forEach(r => {
        keys.forEach(k => {
            const v = parseInt(r[k], 10);
            if (v >= 1 && v <= 5) { sum += v; count++; }
        });
    });
    return count > 0 ? (sum / count) : 0;
}

function setMetricText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setSparkBar(id, value) {
    const el = document.getElementById(id);
    if (el) el.style.setProperty('--spark-pct', `${Math.min(100, Math.max(0, value))}%`);
}

function updateSecondaryMetrics() {
    const total = filteredResponses.length;
    if (total === 0) {
        ['metric-visited-rate', 'metric-heritage-score', 'metric-rehab-rate', 'metric-recontact-rate'].forEach(id => setMetricText(id, '—'));
        ['metric-visited-spark', 'metric-heritage-spark', 'metric-rehab-spark', 'metric-recontact-spark'].forEach(id => setSparkBar(id, 0));
        return;
    }

    const visitedYes = filteredResponses.filter(r => r.q7_visited_cinema === 'oui').length;
    const visitedPct = pct(visitedYes, total);
    setMetricText('metric-visited-rate', `${visitedPct}%`);
    setSparkBar('metric-visited-spark', visitedPct);

    const heritageAvg = avgLikert(filteredResponses, ['q17_1','q17_2','q17_4','q17_5']);
    const heritagePct = Math.round((heritageAvg / 5) * 100);
    setMetricText('metric-heritage-score', `${heritageAvg.toFixed(1)}/5`);
    setSparkBar('metric-heritage-spark', heritagePct);

    const rehabPositive = filteredResponses.filter(r => {
        const v2 = parseInt(r.q19_2, 10);
        const v5 = parseInt(r.q19_5, 10);
        return (v2 >= 4) || (v5 >= 4);
    }).length;
    const rehabPct = pct(rehabPositive, total);
    setMetricText('metric-rehab-rate', `${rehabPct}%`);
    setSparkBar('metric-rehab-spark', rehabPct);

    const recontactYes = filteredResponses.filter(r => r.q27_recontact === 'oui').length;
    const recontactPct = pct(recontactYes, total);
    setMetricText('metric-recontact-rate', `${recontactPct}%`);
    setSparkBar('metric-recontact-spark', recontactPct);
}

function renderInsights() {
    const list = document.getElementById('insights-list');
    if (!list) return;

    const total = filteredResponses.length;
    if (total === 0) {
        list.innerHTML = '<li class="insight-item insight-empty">Aucune réponse pour générer une synthèse. Soumettez un questionnaire pour alimenter le dashboard.</li>';
        return;
    }

    const insights = [];
    const visitedPct = pct(filteredResponses.filter(r => r.q7_visited_cinema === 'oui').length, total);
    insights.push(`<strong>${visitedPct}%</strong> des répondants ont fréquenté les cinémas de Safi — mémoire directe du patrimoine.`);

    const topCause = getTopLikertStatement({
        q15_2: 'Internet / streaming', q15_1: 'TV satellite', q15_10: 'Changement d\'habitudes',
        q15_9: 'Manque de soutien public', q15_5: 'Salles vétustes'
    }, filteredResponses);
    if (topCause) insights.push(`Cause de fermeture la plus citée : <strong>${topCause.label}</strong> (score moyen ${topCause.avg}/5).`);

    const usageCounts = countMultiField(filteredResponses, 'q20_desired_usage');
    const topUsage = Object.entries(usageCounts).sort((a,b) => b[1]-a[1])[0];
    if (topUsage) insights.push(`Usage souhaité n°1 : <strong>${USAGE_LABELS[topUsage[0]] || topUsage[0]}</strong> (${pct(topUsage[1], total)}% des répondants).`);

    const heritageAvg = avgLikert(filteredResponses, ['q17_1','q17_2','q17_5']);
    if (heritageAvg >= 3.5) insights.push(`Fort attachement émotionnel : score moyen de <strong>${heritageAvg.toFixed(1)}/5</strong> sur l'identité et la mémoire des salles.`);
    else insights.push(`Attachement modéré au patrimoine cinématographique (score moyen <strong>${heritageAvg.toFixed(1)}/5</strong>).`);

    const women = filteredResponses.filter(r => r.q1_gender === 'femme').length;
    const men = filteredResponses.filter(r => r.q1_gender === 'homme').length;
    if (women + men > 0) {
        const dom = women >= men ? 'femmes' : 'hommes';
        insights.push(`Profil majoritaire : <strong>${dom}</strong> (${pct(Math.max(women, men), women + men)}% du panel filtré).`);
    }

    list.innerHTML = insights.map((text, i) => `<li class="insight-item" style="animation-delay:${i * 0.08}s"><span class="insight-dot"></span><span>${text}</span></li>`).join('');
}

function getTopLikertStatement(dict, dataset) {
    let best = null;
    Object.keys(dict).forEach(key => {
        const avg = avgLikert(dataset, [key]);
        if (avg > 0 && (!best || avg > best.avg)) best = { label: dict[key], avg: avg.toFixed(1) };
    });
    return best;
}


function getSubmissionDate(record) {
    if (!record) return null;
    const raw = record.submission_date || record.submissionDate || record.date || record.created_at;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

function safeChartRender(label, fn) {
    try {
        fn();
    } catch (err) {
        console.error(`Chart render failed (${label}):`, err);
    }
}

function renderTimelineChart() {
    const canvas = document.getElementById('chart-timeline');
    if (!canvas || !window.Chart) return;
    destroyChart('chart-timeline');

    const timelineCard = canvas.closest('.chart-card');
    if (timelineCard) timelineCard.classList.remove('chart-empty');

    const counts = {};
    filteredResponses.forEach(r => {
        const d = getSubmissionDate(r);
        if (!d) return;
        const key = d.toISOString().slice(0, 10);
        counts[key] = (counts[key] || 0) + 1;
    });

    const dateKeys = Object.keys(counts).sort();
    let labels = dateKeys;
    let values = dateKeys.map(k => counts[k]);

    if (labels.length === 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        labels = [];
        values = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            labels.push(d.toISOString().slice(0, 10));
            values.push(0);
        }
    } else if (labels.length === 1) {
        const only = new Date(labels[0] + 'T12:00:00');
        const prev = new Date(only);
        prev.setDate(prev.getDate() - 1);
        labels = [prev.toISOString().slice(0, 10), labels[0]];
        values = [0, values[0]];
    }

    const ctx = canvas.getContext('2d');
    const chartHeight = canvas.parentElement?.clientHeight || 300;
    const grad = ctx.createLinearGradient(0, 0, 0, chartHeight);
    grad.addColorStop(0, 'rgba(157, 2, 8, 0.35)');
    grad.addColorStop(1, 'rgba(157, 2, 8, 0.02)');

    chartInstances['chart-timeline'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })),
            datasets: [{
                label: 'Soumissions',
                data: values,
                borderColor: getThemeColor('--dash-primary', '#9d0208'),
                backgroundColor: grad,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: getThemeColor('--dash-primary-light', '#d4af37'),
                pointBorderColor: '#fff',
                pointRadius: values.length <= 2 ? 6 : 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: Math.max(2, ...values),
                    ticks: { precision: 0, color: getThemeColor('--dash-text-muted', '#7d6b6f') },
                    grid: { color: document.body.classList.contains('dark-mode') ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }
                },
                x: {
                    ticks: { color: getThemeColor('--dash-text-muted', '#7d6b6f'), maxRotation: 45, minRotation: 0 },
                    grid: { display: false }
                }
            }
        }
    });

    requestAnimationFrame(() => {
        if (chartInstances['chart-timeline']) chartInstances['chart-timeline'].resize();
    });
}

function updateDarkToggleLabel() {
    const isDark = document.body.classList.contains('dark-mode');
    const iconEl = document.querySelector('#darkToggle .toggle-icon');
    const labelEl = document.querySelector('#darkToggle span:last-child');
    if (iconEl) iconEl.textContent = isDark ? '☀️' : '🌙';
    if (labelEl) labelEl.textContent = isDark ? 'Mode clair' : 'Mode sombre';
}

function resetFilters() {
    document.getElementById('filter-gender').value = '';
    document.getElementById('filter-age').value = '';
    document.getElementById('filter-education').value = '';
    document.getElementById('filter-neighborhood').value = '';
    processAndRender();
}

function loadAnalytics() {
    applyFilters();
    updateMetrics();
    updateSecondaryMetrics();
    renderInsights();
    renderStatsCharts();
    loadSemanticAnalysis();
    if (activeTab === 'tab-responses') {
        loadResponsesTable();
    }
}

// ===========================
//  TAB SWITCHING
// ===========================
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.style.display = 'block';

    // Find the button
    document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.getAttribute('onclick')?.includes(tabId)) {
            b.classList.add('active');
        }
    });

    activeTab = tabId;

    if (tabId === 'tab-responses') loadResponsesTable();
    if (tabId === 'tab-stats') renderStatsCharts();
}

// ===========================
//  CHART RENDERING
// ===========================
function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

function renderStatsCharts() {
    Object.keys(chartInstances).forEach(id => destroyChart(id));

    if (filteredResponses.length === 0) {
        showChartsEmptyState(true);
        renderTimelineChart();
        return;
    }
    showChartsEmptyState(false);
    renderTimelineChart();

    // Chart.js global defaults
    if (window.Chart) {
        Chart.defaults.font.family = "'Plus Jakarta Sans', 'Segoe UI', sans-serif";
        Chart.defaults.color = getThemeColor('--dash-text-muted', '#7d6b6f');
    }

    // --- Q1 Gender ---
    const genderCounts = countField(filteredResponses, 'q1_gender');
    renderDoughnutChart('chart-gender',
        Object.keys(genderCounts).map(k => k === 'femme' ? 'Femme' : 'Homme'),
        Object.values(genderCounts),
        ['var(--dash-primary)', 'var(--dash-primary-light)']
    );

    // --- Q2 Age ---
    const ageCounts = countField(filteredResponses, 'q2_age_group');
    const ageLabelsMap = {
        'moins_18': '< 18 ans', '18_24': '18–24', '25_34': '25–34',
        '35_49': '35–49', '50_64': '50–64', '65_plus': '65+'
    };
    renderGradientBarChart('chart-age',
        Object.keys(ageCounts).map(k => ageLabelsMap[k] || k),
        Object.values(ageCounts),
        'var(--dash-primary)', 'var(--dash-primary-light)'
    );

    // --- Q7 Visited ---
    const visitedCounts = countField(filteredResponses, 'q7_visited_cinema');
    renderDoughnutChart('chart-visited',
        Object.keys(visitedCounts).map(k => k === 'oui' ? 'Oui' : 'Non'),
        Object.values(visitedCounts),
        ['var(--dash-success)', 'var(--dash-danger)']
    );

    const visitedResponses = filteredResponses.filter(r => r.q7_visited_cinema === 'oui');

    // --- Q8 Periods ---
    const periodCounts = countMultiField(visitedResponses, 'q8_periods');
    const periodLabelsMap = {
        'avant_1980': 'Avant 1980', 'annees_1980': 'Années 80',
        'annees_1990': 'Années 90', 'annees_2000': 'Années 2000', 'annees_2010': 'Années 2010+'
    };
    renderHorizontalBar('chart-periods',
        Object.keys(periodCounts).map(k => periodLabelsMap[k] || k),
        Object.values(periodCounts), visitedResponses.length
    );

    // --- Q9 Frequency ---
    const freqCounts = countField(visitedResponses, 'q9_frequency');
    const freqLabelsMap = {
        'plusieurs_semaine': 'Plrs / sem.', 'une_semaine': '1 / sem.',
        'une_deux_mois': '1-2 / mois', 'quelques_an': 'Qlq / an', 'rarement': 'Rarement'
    };
    renderGradientBarChart('chart-frequency',
        Object.keys(freqCounts).map(k => freqLabelsMap[k] || k),
        Object.values(freqCounts),
        'var(--dash-accent)', 'var(--dash-primary)'
    );

    // --- Q11 Movies ---
    const movieCounts = countMultiField(visitedResponses, 'q11_movie_types');
    const movieLabelsMap = {
        'marocains': 'Marocains', 'egyptiens': 'Égyptiens/Arabes',
        'indiens': 'Indiens', 'americains': 'Américains', 'action': 'Action', 'autres': 'Autres'
    };
    renderHorizontalBar('chart-movies',
        Object.keys(movieCounts).map(k => movieLabelsMap[k] || k),
        Object.values(movieCounts), visitedResponses.length
    );

    // --- Likert Charts ---
    const q15S = {
        'q15_1': "TV et chaînes satellitaires", 'q15_2': "Internet et streaming",
        'q15_3': "Piratage des films", 'q15_4': "Prix des billets",
        'q15_5': "Salles vétustes", 'q15_6': "Qualité des films",
        'q15_7': "Insécurité / réputation", 'q15_8': "Valeur des terrains",
        'q15_9': "Manque de soutien public", 'q15_10': "Changement d'habitudes"
    };
    renderLikertChart('chart-closing-reasons', q15S, filteredResponses);

    const q17S = {
        'q17_1': "Bons souvenirs", 'q17_2': "Perte pour la ville",
        'q17_3': "État dégradé", 'q17_4': "Attachement personnel",
        'q17_5': "Identité de Safi", 'q17_6': "Ignorance des jeunes"
    };
    renderLikertChart('chart-representations', q17S, filteredResponses);

    const q19S = {
        'q19_1': "Patrimoine culturel", 'q19_2': "Préserver / réhabiliter",
        'q19_3': "Dynamiser centre-ville", 'q19_4': "Créer des emplois",
        'q19_5': "Fréquenter lieu culturel", 'q19_6': "Associer habitants"
    };
    renderLikertChart('chart-patrimony', q19S, filteredResponses);

    // --- Q20 Usage ---
    const usageCounts = countMultiField(filteredResponses, 'q20_desired_usage');
    renderHorizontalBar('chart-desired-usage',
        Object.keys(usageCounts).map(k => USAGE_LABELS[k] || k),
        Object.values(usageCounts), filteredResponses.length
    );

    // --- Q21 Support ---
    const supportCounts = countMultiField(filteredResponses, 'q21_support_type');
    renderHorizontalBar('chart-support-type',
        Object.keys(supportCounts).map(k => SUPPORT_LABELS[k] || k),
        Object.values(supportCounts), filteredResponses.length
    );

    // --- Q5 Education ---
    const eduCounts = countField(filteredResponses, 'q5_education_level');
    const eduLabelsMap = {
        primaire: 'Primaire', college: 'Collège', lycee: 'Lycée',
        sup_bac4: 'Bac+2→4', sup_bac5: 'Bac+5+'
    };
    renderDoughnutChart('chart-education',
        Object.keys(eduCounts).map(k => eduLabelsMap[k] || k),
        Object.values(eduCounts),
        colorPalette.slice(0, 5)
    );

    // --- Q14 What became ---
    const q14Counts = countMultiField(filteredResponses, 'q14_what_became');
    const q14LabelsMap = {
        abandonnees: 'Abandonnées', commerces: 'Commerces', entrepots: 'Entrepôts',
        demolies: 'Démolies', reaffectees: 'Usage culturel', ne_sais_pas: 'Ne sait pas'
    };
    renderHorizontalBar('chart-q14',
        Object.keys(q14Counts).map(k => q14LabelsMap[k] || k),
        Object.values(q14Counts), filteredResponses.length
    );

    // --- Q25 Media Likert ---
    const q25S = {
        q25_1: 'Attention médias locaux', q25_2: 'Réseaux sociaux utiles', q25_3: 'Intérêt documentaire'
    };
    safeChartRender('chart-q25', () => renderLikertChart('chart-q25', q25S, filteredResponses));

    renderTimelineChart();
}

// ─── Chart Helpers ───────────────────────────────────────────────────────────

function getThemeColor(variableName, fallback) {
    return getComputedStyle(document.body).getPropertyValue(variableName).trim() || fallback;
}


function showChartsEmptyState(show) {
    document.querySelectorAll('.chart-container canvas').forEach(c => {
        if (c.id === 'chart-timeline') return;
        const card = c.closest('.chart-card');
        if (card) card.classList.toggle('chart-empty', show);
    });
}

function renderDoughnutChart(canvasId, labels, data, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resolvedColors = colors.map(c => {
        if (c.startsWith('var(')) {
            return getThemeColor(c.substring(4, c.length - 1), '#9d0208');
        }
        return c;
    });

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: resolvedColors,
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            animation: { animateRotate: true, duration: 800, easing: 'easeOutQuart' },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { 
                        padding: 16, 
                        usePointStyle: true, 
                        pointStyleWidth: 12,
                        color: getThemeColor('--dash-text', '#1e293b')
                    }
                }
            }
        }
    });
}

function renderGradientBarChart(canvasId, labels, data, color1, color2) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resolvedColor1 = color1.startsWith('var(') ? getThemeColor(color1.substring(4, color1.length - 1), '#9d0208') : color1;
    const resolvedColor2 = color2.startsWith('var(') ? getThemeColor(color2.substring(4, color2.length - 1), '#d4af37') : color2;

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, resolvedColor1);
    gradient.addColorStop(1, resolvedColor2);

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: gradient,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        precision: 0,
                        color: getThemeColor('--dash-text-muted', '#7d6b6f')
                    },
                    grid: { color: document.body.classList.contains('dark-mode') ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' }
                },
                x: { 
                    ticks: {
                        color: getThemeColor('--dash-text-muted', '#7d6b6f')
                    },
                    grid: { display: false } 
                }
            }
        }
    });
}

function renderHorizontalBar(canvasId, labels, values, totalCount) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pcts = values.map(v => totalCount > 0 ? Math.round((v / totalCount) * 100) : 0);

    const primaryColor = getThemeColor('--dash-primary', '#9d0208');
    const lightColor = getThemeColor('--dash-primary-light', '#d4af37');

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, primaryColor);
    gradient.addColorStop(1, lightColor);

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: pcts,
                backgroundColor: gradient,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    beginAtZero: true, max: 100,
                    ticks: { 
                        callback: v => v + '%',
                        color: getThemeColor('--dash-text-muted', '#7d6b6f')
                    },
                    grid: { color: document.body.classList.contains('dark-mode') ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' }
                },
                y: { 
                    ticks: {
                        color: getThemeColor('--dash-text-muted', '#7d6b6f')
                    },
                    grid: { display: false } 
                }
            }
        }
    });
}

function renderLikertChart(canvasId, statementsDict, dataset) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const labels = [];
    const valuesMatrix = LIKERT_SCALE.map(() => []);

    Object.keys(statementsDict).forEach(key => {
        labels.push(statementsDict[key]);

        const counts = { "Pas du tout": 0, "Plutôt non": 0, "Neutre": 0, "Plutôt oui": 0, "Tout à fait": 0 };
        let total = 0;
        dataset.forEach(r => {
            const val = r[key];
            if (val) {
                let label = val;
                if (val == 1) label = "Pas du tout";
                else if (val == 2) label = "Plutôt non";
                else if (val == 3) label = "Neutre";
                else if (val == 4) label = "Plutôt oui";
                else if (val == 5) label = "Tout à fait";
                if (counts[label] !== undefined) { counts[label]++; total++; }
            }
        });

        LIKERT_SCALE.forEach((scaleLabel, idx) => {
            valuesMatrix[idx].push(total > 0 ? Math.round((counts[scaleLabel] / total) * 100) : 0);
        });
    });

    const datasets = LIKERT_SCALE.map((scaleLabel, idx) => ({
        label: scaleLabel,
        data: valuesMatrix[idx],
        backgroundColor: LIKERT_COLORS[idx],
        borderRadius: 2,
        borderSkipped: false
    }));

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            scales: {
                x: {
                    stacked: true, max: 100,
                    ticks: { 
                        callback: val => val + '%',
                        color: getThemeColor('--dash-text-muted', '#7d6b6f')
                    },
                    grid: { color: document.body.classList.contains('dark-mode') ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' }
                },
                y: { 
                    stacked: true, 
                    ticks: {
                        color: getThemeColor('--dash-text-muted', '#7d6b6f')
                    },
                    grid: { display: false } 
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { 
                        padding: 12, 
                        usePointStyle: true, 
                        pointStyleWidth: 12,
                        color: getThemeColor('--dash-text', '#1e293b')
                    }
                }
            }
        }
    });
}

// ─── Count Helpers ───────────────────────────────────────────────────────────

function countField(dataset, field) {
    const counts = {};
    dataset.forEach(r => {
        const val = r[field];
        if (val) counts[val] = (counts[val] || 0) + 1;
    });
    return counts;
}

function countMultiField(dataset, field) {
    const counts = {};
    dataset.forEach(r => {
        const arr = r[field];
        if (Array.isArray(arr)) {
            arr.forEach(val => { if (val) counts[val] = (counts[val] || 0) + 1; });
        }
    });
    return counts;
}

// ===========================
//  SEMANTIC WORD CLOUD
// ===========================
function loadSemanticAnalysis() {
    const selectEl = document.getElementById('semantic-question');
    if (!selectEl) return;
    const question = selectEl.value;

    const texts = [];
    filteredResponses.forEach(r => {
        let textVal = '';
        if (question === 'q12') textVal = r.q12_memory;
        else if (question === 'q13_text') textVal = r.q13_text;
        else if (question === 'q16') textVal = r.q16_main_cause;
        else if (question === 'q18') textVal = r.q18_meaning;
        else if (question === 'q26') textVal = r.q26_comments;

        if (textVal && typeof textVal === 'string' && textVal.trim() !== '') {
            texts.push(textVal);
        }
    });

    const wordsList = [];
    const wordPattern = /[a-zA-Zéèàùçâêîôûëïüê'\-]+/g;

    texts.forEach(text => {
        const tokens = text.toLowerCase().match(wordPattern) || [];
        tokens.forEach(tok => {
            let cleanTok = tok;
            if (tok.includes("'")) {
                const parts = tok.split("'");
                cleanTok = parts[parts.length - 1];
            }
            if (cleanTok.length > 2 && !FRENCH_STOP_WORDS.has(cleanTok)) {
                wordsList.push(cleanTok);
            }
        });
    });

    const freq = {};
    wordsList.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

    const sortedFreq = Object.keys(freq)
        .map(w => ({ text: w, value: freq[w] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 30);

    renderWordCloud(sortedFreq);
    renderWordFreqTable(sortedFreq);
}

function renderWordCloud(frequencies) {
    const cloudContainer = document.getElementById('wordcloud');
    if (!cloudContainer) return;
    cloudContainer.innerHTML = '';

    if (frequencies.length === 0) {
        cloudContainer.innerHTML = '<span class="cloud-empty">Aucun mot-clé identifié pour les filtres actifs.</span>';
        return;
    }

    const maxVal = Math.max(...frequencies.map(f => f.value));

    frequencies.forEach((item, i) => {
        const span = document.createElement('span');
        span.className = 'cloud-word';
        span.textContent = item.text;
        span.style.animationDelay = `${i * 50}ms`;

        const fontSize = 14 + ((item.value / maxVal) * 26);
        span.style.fontSize = `${fontSize}px`;

        const palette = ['#9d0208', '#370617', '#d4af37', '#e85d04', '#6a040f', '#16a34a'];
        span.style.color = palette[i % palette.length];
        span.style.fontWeight = item.value > maxVal * 0.5 ? '700' : '500';
        span.title = `Fréquence: ${item.value}`;

        span.addEventListener('click', () => {
            switchTab('tab-responses');
            document.getElementById('search-keyword').value = item.text;
            loadResponsesTable();
        });

        cloudContainer.appendChild(span);
    });
}

function renderWordFreqTable(frequencies) {
    const tbody = document.querySelector('#word-freq-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (frequencies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="empty-cell">Aucune donnée</td></tr>';
        return;
    }

    const maxVal = Math.max(...frequencies.map(f => f.value));

    frequencies.forEach(item => {
        const pct = Math.round((item.value / maxVal) * 100);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.text}</strong></td>
            <td>
                <div class="freq-bar-wrapper">
                    <div class="freq-bar" style="width: ${pct}%"></div>
                    <span class="freq-value">${item.value}</span>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ===========================
//  RESPONSES TABLE
// ===========================
function loadResponsesTable() {
    const searchEl = document.getElementById('search-keyword');
    if (!searchEl) return;
    const keyword = searchEl.value.trim().toLowerCase();

    const rows = filteredResponses.filter(r => {
        if (!keyword) return true;
        const fields = [r.q3_neighborhood, r.q12_memory, r.q13_text, r.q16_main_cause, r.q18_meaning, r.q26_comments];
        return fields.some(f => (f || '').toLowerCase().includes(keyword));
    });

    const tbody = document.querySelector('#responses-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">Aucun répondant ne correspond à la recherche.</td></tr>';
        return;
    }

    const genderLabels = { 'femme': 'Femme', 'homme': 'Homme' };
    const ageLabels = {
        'moins_18': '< 18 ans', '18_24': '18-24', '25_34': '25-34',
        '35_49': '35-49', '50_64': '50-64', '65_plus': '65+'
    };

    rows.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.style.animationDelay = `${idx * 30}ms`;
        tr.className = 'table-row-animated';

        let dateStr = '-';
        if (r.submission_date) {
            const d = new Date(r.submission_date);
            if (!isNaN(d.getTime())) {
                dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
        }

        tr.innerHTML = `
            <td><span class="id-badge">#${r.id}</span></td>
            <td>${dateStr}</td>
            <td>${genderLabels[r.q1_gender] || '-'}</td>
            <td>${ageLabels[r.q2_age_group] || '-'}</td>
            <td>${r.q3_neighborhood || '-'}</td>
            <td>${formatEdu(r.q5_education_level)}</td>
            <td><span class="visit-badge ${r.q7_visited_cinema === 'oui' ? 'yes' : 'no'}">${r.q7_visited_cinema === 'oui' ? 'Oui' : 'Non'}</span></td>
            <td class="actions-cell">
                <button class="btn-action btn-view" onclick="viewResponseDetails(${r.id})">Détails</button>
                <button class="btn-action btn-delete" onclick="confirmDeleteResponse(${r.id})">Suppr.</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function formatEdu(val) {
    const map = {
        'primaire': 'Primaire', 'college': 'Collège',
        'lycee': 'Lycée', 'sup_bac4': 'Bac+2→4', 'sup_bac5': 'Bac+5+'
    };
    return map[val] || val || '-';
}

// ===========================
//  DETAIL MODAL
// ===========================
function viewResponseDetails(id) {
    const r = allResponses.find(x => x.id === id);
    if (!r) return;

    document.getElementById('detail-modal-title').textContent = `Fiche répondant — Questionnaire #${r.id}`;
    const body = document.getElementById('detail-modal-body');

    const formatArr = (arr) => arr && arr.length > 0 ? arr.join(', ') : 'Aucun';
    const formatLikert = (val) => {
        const map = { '1': '❌ Pas du tout', '2': '⚠️ Plutôt non', '3': '🔹 Neutre', '4': '✅ Plutôt oui', '5': '✅✅ Tout à fait' };
        return map[String(val)] || val || '-';
    };

    body.innerHTML = `
        <div class="detail-grid">
            <div class="detail-section">
                <h4>📋 Informations</h4>
                <div class="detail-row"><strong>Date :</strong> ${r.submission_date || '-'}</div>
                <div class="detail-row"><strong>Genre :</strong> ${r.q1_gender || '-'}</div>
                <div class="detail-row"><strong>Âge :</strong> ${r.q2_age_group || '-'}</div>
                <div class="detail-row"><strong>Quartier :</strong> ${r.q3_neighborhood || '-'}</div>
                <div class="detail-row"><strong>Résidence :</strong> ${r.q4_residence_duration || '-'}</div>
                <div class="detail-row"><strong>Études :</strong> ${r.q5_education_level || '-'}</div>
                <div class="detail-row"><strong>Profession :</strong> ${r.q6_profession || '-'}</div>
            </div>
            <div class="detail-section">
                <h4>🎬 Cinéma</h4>
                <div class="detail-row"><strong>A visité :</strong> ${r.q7_visited_cinema || '-'}</div>
                <div class="detail-row"><strong>Périodes :</strong> ${formatArr(r.q8_periods)}</div>
                <div class="detail-row"><strong>Fréquence :</strong> ${r.q9_frequency || '-'}</div>
                <div class="detail-row"><strong>Accompagnement :</strong> ${formatArr(r.q10_companions)}</div>
                <div class="detail-row"><strong>Films :</strong> ${formatArr(r.q11_movie_types)}</div>
            </div>
        </div>
        <div class="detail-section full-width">
            <h4>💬 Réponses ouvertes</h4>
            <div class="detail-row"><strong>Q12 – Souvenir :</strong><br>${r.q12_memory || '-'}</div>
            <div class="detail-row"><strong>Q13 – Salles :</strong><br>${r.q13_text || '-'}</div>
            <div class="detail-row"><strong>Q16 – Cause principale :</strong><br>${r.q16_main_cause || '-'}</div>
            <div class="detail-row"><strong>Q18 – Signification :</strong><br>${r.q18_meaning || '-'}</div>
            <div class="detail-row"><strong>Q26 – Commentaires :</strong><br>${r.q26_comments || '-'}</div>
        </div>
    `;

    document.getElementById('detailModal').style.display = 'flex';
}

function closeDetailModal() {
    document.getElementById('detailModal').style.display = 'none';
}

// ===========================
//  DELETE
// ===========================
function confirmDeleteResponse(id) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le questionnaire #${id} ?`)) return;

    const isLocalApi = APPS_SCRIPT_URL.startsWith('/') || APPS_SCRIPT_URL.includes('localhost') || APPS_SCRIPT_URL.includes('127.0.0.1');
    if (isLocalApi) {
        fetch(`/api/delete/${id}`, { method: 'POST' })
            .then(res => res.json())
            .then(resData => {
                if (resData && resData.status === 'success') {
                    console.log('✅ Deleted from server database:', id);
                }
            })
            .catch(err => console.warn('Erreur lors de la suppression sur le serveur :', err));
    }

    if (window.RT) {
        window.RT.deleteResponse(id);
        allResponses = window.RT.getAll();
        processAndRender();
        showToast(`✅ Questionnaire #${id} supprimé.`, 'success');
    }
}

// ===========================
//  EXPORT
// ===========================
function exportData(format) {
    if (filteredResponses.length === 0) {
        showToast('Aucune donnée à exporter.', 'error');
        return;
    }

    if (format === 'json') {
        const blob = new Blob([JSON.stringify(filteredResponses, null, 2)], { type: 'application/json' });
        downloadBlob(blob, 'enquete_safi_export.json');
        showToast('📥 Export JSON téléchargé !', 'success');
    } else if (format === 'csv') {
        const headers = Object.keys(filteredResponses[0]);
        const csvRows = [headers.join(',')];
        filteredResponses.forEach(r => {
            const row = headers.map(h => {
                let val = r[h];
                if (Array.isArray(val)) val = val.join('; ');
                if (typeof val === 'string') val = '"' + val.replace(/"/g, '""') + '"';
                return val ?? '';
            });
            csvRows.push(row.join(','));
        });
        const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, 'enquete_safi_export.csv');
        showToast('📥 Export CSV téléchargé !', 'success');
    } else if (format === 'excel') {
        const headers = Object.keys(filteredResponses[0]);
        let xml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
        xml += '<head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Enquete Safi</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--><meta charset="UTF-8"></head><body>';
        xml += '<h2>Enquête Patrimoine Salles de Cinéma Safi — Réponses</h2>';
        xml += '<table border="1">';
        
        // Headers
        xml += '<tr>';
        headers.forEach(h => {
            xml += `<th style="background-color: #9d0208; color: #ffffff; font-weight: bold; padding: 6px;">${h}</th>`;
        });
        xml += '</tr>';
        
        // Rows
        filteredResponses.forEach(r => {
            xml += '<tr>';
            headers.forEach(h => {
                let val = r[h];
                if (Array.isArray(val)) val = val.join(', ');
                if (val === undefined || val === null) val = '';
                xml += `<td>${String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
            });
            xml += '</tr>';
        });
        xml += '</table></body></html>';
        
        const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        downloadBlob(blob, 'enquete_safi_export.xls');
        showToast('📥 Export Excel (XLS) téléchargé !', 'success');
    } else if (format === 'pdf') {
        if (typeof html2pdf === 'undefined') {
            showToast('Erreur: Bibliothèque PDF non chargée.', 'error');
            return;
        }
        
        showToast('⏳ Génération du rapport PDF en cours...', 'info');
        
        const activeTabEl = document.querySelector('.tab-content[style*="display: block"]') 
            || document.getElementById(activeTab)
            || document.getElementById('tab-stats');
            
        if (!activeTabEl) {
            showToast('Aucun contenu actif à exporter.', 'error');
            return;
        }
        
        const clone = activeTabEl.cloneNode(true);
        clone.querySelectorAll('.filter-bar, .search-box-wrapper, button, .survey-controls-row, .database-mgmt-panel, .live-feed-instructions').forEach(el => el.remove());
        
        const pdfHeader = document.createElement('div');
        pdfHeader.style.padding = '15px 0 25px 0';
        pdfHeader.style.borderBottom = '3px solid #9d0208';
        pdfHeader.style.marginBottom = '25px';
        pdfHeader.style.fontFamily = "'Cinzel', Georgia, serif";
        pdfHeader.innerHTML = `
            <div style="font-size: 22px; font-weight: bold; color: #9d0208; text-transform: uppercase; letter-spacing: 0.05em;">
                🎬 Rapport d'Enquête — CinePlusSafi
            </div>
            <div style="font-size: 11px; color: #7d6b6f; margin-top: 6px; font-family: 'Plus Jakarta Sans', sans-serif;">
                <strong>Sujet :</strong> Patrimoine des salles de cinéma fermées de la ville de Safi<br>
                <strong>Date de génération :</strong> ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} | 
                <strong>Nombre de répondants analysés :</strong> ${filteredResponses.length}
            </div>
        `;
        clone.insertBefore(pdfHeader, clone.firstChild);
        
        // Optimize visuals for white background paper PDF
        clone.querySelectorAll('.chart-card, .metric-card, .glass-card, .responses-card').forEach(card => {
            card.style.background = '#ffffff';
            card.style.borderColor = '#e2d9cd';
            card.style.color = '#200f13';
            card.style.boxShadow = 'none';
            card.style.padding = '1.5rem';
            card.style.marginBottom = '1.5rem';
            card.style.pageBreakInside = 'avoid';
            card.style.borderRadius = '8px';
        });

        clone.querySelectorAll('.metric-val, .metric-value').forEach(el => {
            el.style.color = '#9d0208';
        });

        clone.querySelectorAll('.chart-title, .card-title').forEach(el => {
            el.style.color = '#370617';
            el.style.borderColor = '#e2d9cd';
        });

        // Make response tables fit nicely in A4
        clone.querySelectorAll('.table-responsive').forEach(el => {
            el.style.boxShadow = 'none';
            el.style.border = '1px solid #e2d9cd';
        });

        const opt = {
            margin:       [0.5, 0.5, 0.5, 0.5],
            filename:     `enquete_safi_rapport_${activeTab}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, background: '#fcfbfa' },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().set(opt).from(clone).save().then(() => {
            showToast('📄 Rapport PDF téléchargé avec succès !', 'success');
        }).catch(err => {
            console.error('PDF generation error:', err);
            showToast('Erreur lors de l\'export PDF.', 'error');
        });
    }
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ===========================
//  TOAST
// ===========================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast-notif show ' + type;

    setTimeout(() => {
        toast.className = 'toast-notif';
    }, 4000);
}

// ===========================
//  DARK MODE
// ===========================
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'on' : 'off');
    updateDarkToggleLabel();
    if (typeof filteredResponses !== 'undefined' && filteredResponses.length > 0) {
        renderStatsCharts();
    }
}

// ===========================
//  MOCKUP DATA (Demo)
// ===========================
function getMockupData() {
    const genders = ['femme', 'homme'];
    const ages = ['moins_18', '18_24', '25_34', '35_49', '50_64', '65_plus'];
    const neighborhoods = ['Plateau', 'Médina', 'Biada', 'R\'mel', 'Hay Hassani', 'Sidi Bouzid', 'Centre-Ville'];
    const durations = ['naissance', 'plus_20', '10_20', '5_10', 'moins_5'];
    const educations = ['primaire', 'college', 'lycee', 'sup_bac4', 'sup_bac5'];
    const professions = ['etudiant', 'prive', 'public', 'liberal', 'commercant', 'sans_emploi', 'retraite', 'foyer'];
    const periods = ['avant_1980', 'annees_1980', 'annees_1990', 'annees_2000', 'annees_2010'];
    const frequencies = ['plusieurs_semaine', 'une_semaine', 'une_deux_mois', 'quelques_an', 'rarement'];
    const companions = ['seul', 'famille', 'amis', 'couple', 'voisins'];
    const movies = ['marocains', 'egyptiens', 'indiens', 'americains', 'action'];
    const usages = ['cinema', 'cinematheque', 'spectacles', 'centre_culturel', 'mediatheque', 'coworking', 'cafe_culturel', 'musee'];
    const supports = ['frequenter', 'benevole', 'souvenirs', 'financier', 'non'];
    const memories = [
        "Je me souviens des films de Bruce Lee au Roxy, c'était magique.",
        "Les séances du dimanche avec mon père au cinéma Atlantide restent gravées dans ma mémoire.",
        "L'ambiance pendant les films indiens, tout le monde chantait.",
        "Les glaces vendues à l'entracte au cinéma Regragui.",
        "Mon premier rendez-vous amoureux au cinéma, je n'ai rien vu du film !"
    ];

    const data = [];
    const count = 15 + Math.floor(Math.random() * 10);

    for (let i = 1; i <= count; i++) {
        const visited = Math.random() > 0.25 ? 'oui' : 'non';
        const daysAgo = Math.floor(Math.random() * 30);
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        d.setHours(Math.floor(Math.random() * 12 + 8), Math.floor(Math.random() * 60));

        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const pickN = (arr, n) => {
            const shuffled = [...arr].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, Math.min(n, shuffled.length));
        };

        const record = {
            id: i,
            submission_date: d.toISOString(),
            q1_gender: pick(genders),
            q2_age_group: pick(ages),
            q3_neighborhood: pick(neighborhoods),
            q4_residence_duration: pick(durations),
            q5_education_level: pick(educations),
            q6_profession: pick(professions),
            q7_visited_cinema: visited,
            q8_periods: visited === 'oui' ? pickN(periods, 2) : [],
            q9_frequency: visited === 'oui' ? pick(frequencies) : '',
            q10_companions: visited === 'oui' ? pickN(companions, 2) : [],
            q11_movie_types: visited === 'oui' ? pickN(movies, 3) : [],
            q12_memory: visited === 'oui' ? pick(memories) : '',
            q13_text: pick(['Atlantide, Roxy', 'Regragui, Sahara', 'Atlantide', 'Roxy, Rialto']),
            q14_what_became: pickN(['abandonnees', 'commerces', 'entrepots', 'demolies'], 2),
            q16_main_cause: pick(['Internet et streaming', 'Piratage', 'Manque de soutien', 'TV satellite']),
            q18_meaning: pick(['Nostalgie', 'Patrimoine perdu', 'Oubli collectif', 'Mémoire vivante']),
            q20_desired_usage: pickN(usages, 3),
            q21_support_type: pickN(supports, 2),
            q26_comments: ''
        };

        // Add Likert answers
        for (let l = 1; l <= 10; l++) record[`q15_${l}`] = String(Math.ceil(Math.random() * 5));
        for (let l = 1; l <= 6; l++) record[`q17_${l}`] = String(Math.ceil(Math.random() * 5));
        for (let l = 1; l <= 6; l++) record[`q19_${l}`] = String(Math.ceil(Math.random() * 5));

        data.push(record);
    }

    return data;
}
