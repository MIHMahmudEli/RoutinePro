/**
 * Routine Pro — Elite Core
 * Version 5.0 (Prism Ultra Architecture)
 */

let allCourses = [];
let selectedCourses = []; // [{ course, selectedSectionIndex }]
let possibleRoutines = []; // [[{courseTitle, section}, ...]]
let currentRoutineIndex = 0;
let isExplorerMode = false;

// Theme Engine
window.setTheme = (theme) => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('routine-pro-theme', theme);
    if (typeof renderRoutine === 'function') renderRoutine();
};
// Restore Theme
const savedTheme = localStorage.getItem('routine-pro-theme');
if (savedTheme) document.body.setAttribute('data-theme', savedTheme);

// DOM Elements
const searchInput = document.getElementById('course-search');
const suggestions = document.getElementById('search-suggestions');
const selectedList = document.getElementById('selected-courses-list');
const conflictBadge = document.getElementById('conflict-badge');
const totalCreditsEl = document.getElementById('total-credits');
const exportBtn = document.getElementById('export-btn');
const generateAllBtn = document.getElementById('generate-all-btn');
const explorerNav = document.getElementById('explorer-nav');
const routineCounter = document.getElementById('routine-counter');
const prevBtn = document.getElementById('prev-routine');
const nextBtn = document.getElementById('next-routine');
const exitExplorerBtn = document.getElementById('exit-explorer');

// Global Filter Inputs
const filterStart = document.getElementById('filter-start');
const filterEnd = document.getElementById('filter-end');
const filterSeats = document.getElementById('filter-seats');
const seatValDisplay = document.getElementById('seat-val');
const filterSort = document.getElementById('filter-sort');

// Sync Data Elements
const courseFileInput = document.getElementById('course-file-input');
const courseCountDisplay = document.getElementById('course-count-display');
const lastUpdateDisplay = document.getElementById('last-update-display');
const syncModal = document.getElementById('sync-modal');
const toastContainer = document.getElementById('toast-container');

/**
 * TOAST NOTIFICATION SYSTEM
 */
window.showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = type === 'success' ? 'check-circle' : 'alert-circle';
    const iconColor = type === 'success' ? 'text-emerald-400' : 'text-rose-400';

    toast.innerHTML = `
        <div class="toast-icon">
            <i data-lucide="${icon}" class="w-5 h-5 ${iconColor}"></i>
        </div>
        <div class="toast-message">${message}</div>
    `;

    toastContainer.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
};

/**
 * INITIALIZATION
 */
async function initialize() {
    try {
        const localCourses = localStorage.getItem('routine-pro-courses');
        if (localCourses) {
            allCourses = JSON.parse(localCourses);
            updateSyncUI();
        } else {
            const res = await fetch('courses.json');
            if (res.ok) {
                allCourses = await res.json();
                updateSyncUI();
            }
        }

        const times = [
            { v: 480, l: '08:00 AM' }, { v: 540, l: '09:00 AM' }, { v: 600, l: '10:00 AM' },
            { v: 660, l: '11:00 AM' }, { v: 720, l: '12:00 PM' }, { v: 780, l: '01:00 PM' },
            { v: 840, l: '02:00 PM' }, { v: 900, l: '03:00 PM' }, { v: 960, l: '04:00 PM' },
            { v: 1020, l: '05:00 PM' }, { v: 1080, l: '06:00 PM' }, { v: 1140, l: '07:00 PM' },
            { v: 1200, l: '08:00 PM' }
        ];

        filterStart.innerHTML = times.map(t => `<option value="${t.v}">${t.l}</option>`).join('');
        filterEnd.innerHTML = times.map((t, i) => `<option value="${t.v}" ${i === times.length - 1 ? 'selected' : ''}>${t.l}</option>`).join('');

        syncWorkspace();
    } catch (e) {
        console.error('Boot Error:', e);
    }
}

// Slider Sync
if (filterSeats) {
    const sliderFill = document.getElementById('slider-fill');
    filterSeats.addEventListener('input', (e) => {
        const val = e.target.value;
        seatValDisplay.innerText = val;
        if (sliderFill) sliderFill.style.width = `${val}%`;
    });
}

/**
 * SEARCH LOGIC
 */
searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (q.length < 2) { suggestions.classList.add('hidden'); return; }

    const results = allCourses.filter(c =>
        c.baseTitle.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q))
    ).slice(0, 15);

    if (results.length > 0) {
        suggestions.innerHTML = results.map(c => {
            const searchAccent = document.body.getAttribute('data-theme') === 'spectrum'
                ? `style="border-left: 3px solid hsla(${getCourseHue(c.baseTitle)}, 70%, 60%, 0.8)"`
                : '';

            return `
                <div class="p-4 hover:bg-emerald-500/5 cursor-pointer border-b border-white/5 group transition-colors" 
                    ${searchAccent}
                    onclick="handleAddCourse('${c.baseTitle.replace(/'/g, "\\'")}', '${c.code}')">
                    <div class="flex justify-between items-center">
                        <div>
                            <div class="text-white text-sm font-bold group-hover:text-emerald-400 transition-colors uppercase">${c.baseTitle}</div>
                            <div class="text-[10px] text-slate-500 uppercase font-black mt-1 tracking-widest">
                                ${c.code || 'CORE'} • ${c.sections.length} Dept Sections
                            </div>
                        </div>
                        <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                            <i data-lucide="plus" class="w-4 h-4"></i>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        suggestions.classList.remove('hidden');
        lucide.createIcons();
    } else {
        suggestions.classList.add('hidden');
    }
});

/**
 * ACTIONS
 */
window.handleAddCourse = (title, code) => {
    if (isExplorerMode) stopExplorer();
    const course = allCourses.find(c => c.baseTitle === title && c.code === code);
    if (!course || selectedCourses.some(sc => sc.course.baseTitle === title)) {
        searchInput.value = ''; suggestions.classList.add('hidden'); return;
    }
    selectedCourses.push({ course, selectedSectionIndex: 0 });
    searchInput.value = ''; suggestions.classList.add('hidden');
    syncWorkspace();
};

window.handleRemoveCourse = (idx) => {
    if (isExplorerMode) stopExplorer();
    selectedCourses.splice(idx, 1);
    syncWorkspace();
};

window.handleSectionChange = (cIdx, sIdx) => {
    if (isExplorerMode) stopExplorer();
    selectedCourses[cIdx].selectedSectionIndex = parseInt(sIdx);
    syncWorkspace();
};

/**
 * GENERATION ENGINE
 */
generateAllBtn.addEventListener('click', () => {
    if (selectedCourses.length < 1) return showToast("Select courses first.", "error");

    const minS = parseInt(filterStart.value);
    const maxE = parseInt(filterEnd.value);
    const maxC = parseInt(filterSeats.value);
    const allowedStatuses = Array.from(document.querySelectorAll('.status-check:checked')).map(el => el.value.toLowerCase().trim());
    const sortType = filterSort.value;
    const allowedDays = Array.from(document.querySelectorAll('.day-check:checked')).map(el => el.value.substring(0, 3).toLowerCase());

    possibleRoutines = [];

    function find(idx, current) {
        if (idx === selectedCourses.length) { possibleRoutines.push([...current]); return; }

        const course = selectedCourses[idx].course;
        for (const sec of course.sections) {
            if (parseInt(sec.count) > maxC && maxC < 100) continue;

            // Strict Status Filter: Must be in the allowed list (Case Insensitive)
            if (!allowedStatuses.includes(sec.status.toLowerCase().trim())) continue;

            let validTime = true;
            for (const s of sec.schedules) {
                if (toMin(s.start) < minS || toMin(s.end) > maxE || !allowedDays.includes(s.day.substring(0, 3).toLowerCase())) {
                    validTime = false; break;
                }
            }
            if (!validTime) continue;
            if (hasConflict(sec, current)) continue;

            current.push({ courseTitle: course.baseTitle, section: sec });
            find(idx + 1, current);
            current.pop();
        }
    }

    function hasConflict(secA, existing) {
        return existing.some(item => {
            const secB = item.section;
            return secA.schedules.some(schA => secB.schedules.some(schB => {
                if (schA.day !== schB.day) return false;
                return (toMin(schA.start) < toMin(schB.end) && toMin(schA.end) > toMin(schB.start));
            }));
        });
    }

    find(0, []);
    if (possibleRoutines.length === 0) return showToast("No valid scenarios for these settings.", "error");

    showToast(`Found ${possibleRoutines.length} scenarios!`);

    // Sorting & Optimization Engine
    if (sortType === 'gaps') {
        // 1. Calculate and attach gap scores
        const scoredRoutines = possibleRoutines.map(r => ({ routine: r, gaps: calculateGaps(r) }));

        // 2. Find the absolute minimum gap achieved
        const minGap = Math.min(...scoredRoutines.map(sr => sr.gaps));

        // 3. Filter to ONLY include those with the absolute minimum gap
        possibleRoutines = scoredRoutines
            .filter(sr => sr.gaps === minGap)
            .map(sr => sr.routine);

        // 4. Sort is technically already 'perfect' now, but we can shuffle the identical ones
        for (let i = possibleRoutines.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [possibleRoutines[i], possibleRoutines[j]] = [possibleRoutines[j], possibleRoutines[i]];
        }
    } else {
        // Shuffle for true "Random" feel
        for (let i = possibleRoutines.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [possibleRoutines[i], possibleRoutines[j]] = [possibleRoutines[j], possibleRoutines[i]];
        }
    }

    isExplorerMode = true; currentRoutineIndex = 0;
    syncWorkspace();
    explorerNav.scrollIntoView({ behavior: 'smooth' });
});

/**
 * RENDERING CORE
 */
function syncWorkspace() {
    explorerNav.classList.toggle('hidden', !isExplorerMode);
    explorerNav.classList.toggle('flex', isExplorerMode);

    if (isExplorerMode) {
        routineCounter.innerText = `${currentRoutineIndex + 1} / ${possibleRoutines.length}`;

        // Show Gap info in the explorer badge
        const totalGapMin = calculateGaps(possibleRoutines[currentRoutineIndex]);
        const gapHrs = Math.floor(totalGapMin / 60);
        const gapMins = totalGapMin % 60;
        const gapText = totalGapMin === 0 ? "No Waiting Gaps!" : `${gapHrs > 0 ? gapHrs + 'h ' : ''}${gapMins}m Waiting Time`;

        const gapDisplay = document.getElementById('gap-info-badge');
        if (gapDisplay) gapDisplay.innerText = gapText;
    }

    renderSidebar();
    renderRoutine();
    calculateCredits();
    lucide.createIcons();
}

function renderSidebar() {
    if (selectedCourses.length === 0) {
        selectedList.innerHTML = `<div class="text-center py-12 opacity-20 border-2 border-dashed border-white/5 rounded-2xl"><i data-lucide="command" class="w-8 h-8 mx-auto mb-2"></i><p class="text-[10px] font-bold uppercase tracking-widest">Awaiting Input</p></div>`;
        return;
    }

    selectedList.innerHTML = selectedCourses.map((sc, i) => {
        const section = isExplorerMode
            ? possibleRoutines[currentRoutineIndex].find(item => item.courseTitle === sc.course.baseTitle).section
            : sc.course.sections[sc.selectedSectionIndex];

        const statusClass = `tag-${section.status.toLowerCase()}`;

        const accentStyle = document.body.getAttribute('data-theme') === 'spectrum'
            ? `style="border-left: 4px solid hsla(${getCourseHue(sc.course.baseTitle)}, 70%, 60%, 0.8)"`
            : '';
        return `
            <div class="sidebar-item group" ${accentStyle}>
                ${!isExplorerMode ? `<button onclick="handleRemoveCourse(${i})" class="absolute top-4 right-4 text-slate-600 hover:text-rose-500"><i data-lucide="x" class="w-4 h-4"></i></button>` : ''}
                <h3 class="text-xs font-900 uppercase text-white tracking-tight pr-6">${sc.course.baseTitle}</h3>
                
                <div class="grid grid-cols-4 gap-2 mt-4 py-2 border-y border-white/5">
                    <div class="text-center"><p class="text-[8px] text-slate-600 font-black uppercase">Sec</p><p class="text-[9px] font-bold">${section.section}</p></div>
                    <div class="text-center"><p class="text-[8px] text-slate-600 font-black uppercase">Enr</p><p class="text-[9px] font-bold">${section.count}</p></div>
                    <div class="text-center"><p class="text-[8px] text-slate-600 font-black uppercase">Cap</p><p class="text-[9px] font-bold">${section.capacity}</p></div>
                    <div class="text-center">
                        <p class="text-[8px] text-slate-600 font-black uppercase">Stat</p>
                        <span class="status-tag ${statusClass}">${section.status}</span>
                    </div>
                </div>

                ${!isExplorerMode ? `
                <div class="select-wrapper mt-3">
                    <select class="prism-input !py-1.5 !text-[10px] !rounded-lg" onchange="handleSectionChange(${i}, this.value)">
                        ${sc.course.sections.map((s, si) => `<option value="${si}" ${si === sc.selectedSectionIndex ? 'selected' : ''}>Switch to Sec ${s.section}</option>`).join('')}
                    </select>
                    <i data-lucide="chevron-down" class="select-arrow w-3 h-3"></i>
                </div>` : `
                <div class="mt-3 flex items-center gap-2 text-[10px] font-black text-[var(--accent-secondary)] uppercase tracking-widest"><i data-lucide="shield-check" class="w-4 h-4"></i> Locked in Scenario</div>`}
            </div>
        `;
    }).join('');
}

function renderRoutine() {
    const buckets = document.querySelectorAll('.day-bucket');
    buckets.forEach(b => b.innerHTML = '');
    let globalConflict = false;
    const items = isExplorerMode ? possibleRoutines[currentRoutineIndex] : selectedCourses;
    const dayData = {};

    items.forEach(item => {
        const title = isExplorerMode ? item.courseTitle : item.course.baseTitle;
        const section = isExplorerMode ? item.section : item.course.sections[item.selectedSectionIndex];

        section.schedules.forEach(sch => {
            const start = toMin(sch.start);
            const end = toMin(sch.end);
            const top = (start - (8 * 60)) * (70 / 60);
            const height = (end - start) * (70 / 60);

            if (!dayData[sch.day]) dayData[sch.day] = [];
            const conflict = !isExplorerMode && dayData[sch.day].some(e => (top < e.end && (top + height) > e.start));
            if (conflict) globalConflict = true;

            const block = document.createElement('div');
            block.className = `class-block ${sch.type.toLowerCase()}`;

            // Spectrum Dynamic Colors
            if (document.body.getAttribute('data-theme') === 'spectrum') {
                const hue = getCourseHue(title);
                const colorBase = `hsla(${hue}, 70%, 60%, 0.15)`;
                const colorSolid = `hsla(${hue}, 70%, 60%, 0.9)`;

                block.style.background = `linear-gradient(135deg, ${colorBase}, rgba(255,255,255,0.02))`;
                block.style.backdropFilter = 'blur(10px)';
                block.style.webkitBackdropFilter = 'blur(10px)';
                block.style.border = '1px solid rgba(255,255,255,0.1)';
                block.style.borderLeft = `4px solid ${colorSolid}`;
                block.style.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255,255,255,0.05)`;
            }

            block.style.top = `${top}px`;
            block.style.height = `${height}px`;
            block.innerHTML = `
                <div class="class-name">${title}</div>
                <div class="class-info">${sch.start} - ${sch.end}</div>
                <div class="flex justify-between items-center mt-auto opacity-60">
                    <span class="text-[8px] font-black">SEC ${section.section}</span>
                    <span class="text-[8px] font-black">RM ${sch.room}</span>
                </div>
            `;
            const b = document.querySelector(`.day-bucket[data-day="${sch.day}"]`);
            if (b) { b.appendChild(block); dayData[sch.day].push({ start: top, end: top + height }); }
        });
    });
    conflictBadge.classList.toggle('hidden', !globalConflict);
}

function getCourseHue(title) {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 360);
}

function calculateCredits() {
    const target = isExplorerMode ? possibleRoutines[currentRoutineIndex] : selectedCourses;
    totalCreditsEl.innerText = target.reduce((s, it) => s + ((it.courseTitle || it.course.baseTitle).toLowerCase().includes('lab') ? 1 : 3), 0);
}

// Helpers
function toMin(s) {
    try {
        const [t, m] = s.trim().split(' ');
        let [h, min] = t.split(':').map(Number);
        if (h === 12) h = 0; if (m === 'PM') h += 12;
        return h * 60 + min;
    } catch (e) { return 0; }
}

function calculateGaps(routine) {
    let totalGaps = 0;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    days.forEach(day => {
        let schs = [];
        routine.forEach(item => {
            item.section.schedules.forEach(s => {
                if (s.day === day) schs.push({ start: toMin(s.start), end: toMin(s.end) });
            });
        });
        if (schs.length > 1) {
            schs.sort((a, b) => a.start - b.start);
            for (let i = 0; i < schs.length - 1; i++) {
                const gap = schs[i + 1].start - schs[i].end;
                if (gap > 0) totalGaps += gap;
            }
        }
    });
    return totalGaps;
}

function stopExplorer() { isExplorerMode = false; syncWorkspace(); }

// Nav
prevBtn.onclick = () => { if (currentRoutineIndex > 0) { currentRoutineIndex--; syncWorkspace(); } };
nextBtn.onclick = () => { if (currentRoutineIndex < possibleRoutines.length - 1) { currentRoutineIndex++; syncWorkspace(); } };
exitExplorerBtn.onclick = stopExplorer;

// Export
exportBtn.onclick = async () => {
    const el = document.getElementById('routine-actual-grid');
    const originalHTML = exportBtn.innerHTML;

    // UI feedback without breaking layout
    exportBtn.disabled = true;
    exportBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> GENERATING...`;
    lucide.createIcons();

    try {
        // Get current theme background color
        const themeBg = getComputedStyle(document.body).getPropertyValue('--bg-surface').trim() || '#0a0d14';

        const canvas = await html2canvas(el, {
            scale: 2,
            backgroundColor: themeBg,
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0
        });

        const link = document.createElement('a');
        link.download = `RoutinePro_${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    } catch (err) {
        console.error("Export failed:", err);
    } finally {
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalHTML;
        lucide.createIcons();
    }
};

/**
 * SYNC & DATA MANAGEMENT
 */
function updateSyncUI() {
    if (courseCountDisplay) courseCountDisplay.innerText = `${allCourses.length} Courses`;
    const lastSync = localStorage.getItem('routine-pro-last-sync');
    if (lastUpdateDisplay) lastUpdateDisplay.innerText = lastSync ? `Last Sync: ${lastSync}` : 'Default (Pre-loaded)';
}

if (courseFileInput) {
    courseFileInput.addEventListener('change', handleFileUpload);
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const btn = e.target.closest('#sync-modal').querySelector('.prism-btn');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> PROCESSING...`;
    lucide.createIcons();

    try {
        if (file.name.endsWith('.json')) {
            const text = await file.text();
            const data = JSON.parse(text);
            saveCourses(data, file.name);
        } else if (file.name.endsWith('.xlsx')) {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                const courses = parseExcelData(data);
                saveCourses(courses, file.name);
            };
            reader.readAsBinaryString(file);
        }
    } catch (err) {
        console.error("Upload Error:", err);
        showToast("Failed to process file.", "error");
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.innerText = originalText;
            lucide.createIcons();
            if (syncModal) syncModal.classList.add('hidden');
        }, 1500);
    }
}

function parseExcelData(rows) {
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i].includes("Class ID")) { headerIdx = i; break; }
    }

    if (headerIdx === -1) throw new Error("Could not find Class ID header");

    const dataRows = rows.slice(headerIdx + 1);
    const coursesMap = {};
    let currentCourseCode = "";

    dataRows.forEach(row => {
        const classId = String(row[1] || '').trim();
        if (!classId || classId === "nan") return;

        const rawCode = String(row[2] || '').trim();
        if (rawCode && rawCode !== "nan") currentCourseCode = rawCode;

        const status = String(row[3] || 'Open');
        const capacity = String(row[4] || '0');
        const count = String(row[5] || '0');
        const fullTitle = String(row[6] || '');
        const sectionName = String(row[7] || '');
        const classType = String(row[9] || '');
        const day = String(row[10] || '');
        const startTime = String(row[11] || '');
        const endTime = String(row[12] || '');
        const room = String(row[13] || '');

        const baseTitle = fullTitle.replace(/\s*\[.*\]$/, '').trim();
        const key = `${baseTitle}@@@${currentCourseCode}`;

        if (!coursesMap[key]) {
            coursesMap[key] = {
                code: currentCourseCode,
                baseTitle: baseTitle,
                sections: {}
            };
        }

        if (!coursesMap[key].sections[sectionName]) {
            coursesMap[key].sections[sectionName] = {
                id: classId,
                section: sectionName,
                status: status,
                capacity: capacity,
                count: count,
                schedules: []
            };
        }

        coursesMap[key].sections[sectionName].schedules.push({
            day: day,
            start: startTime,
            end: endTime,
            room: room,
            type: classType
        });
    });

    return Object.values(coursesMap).map(data => {
        data.sections = Object.values(data.sections).sort((a, b) => a.section.localeCompare(b.section));
        return data;
    });
}

function saveCourses(data, source = 'Local Storage') {
    allCourses = data;
    localStorage.setItem('routine-pro-courses', JSON.stringify(data));
    const now = new Date().toLocaleString();
    localStorage.setItem('routine-pro-last-sync', now);
    updateSyncUI();
    selectedCourses = [];
    possibleRoutines = [];
    currentRoutineIndex = 0;
    syncWorkspace();
    showToast(`${data.length} courses loaded from ${source}`);
}

document.addEventListener('click', (e) => {
    if (searchInput && !searchInput.contains(e.target) && suggestions && !suggestions.contains(e.target)) {
        suggestions.classList.add('hidden');
    }
});
initialize();
