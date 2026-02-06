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

/**
 * INITIALIZATION
 */
async function initialize() {
    try {
        const res = await fetch('courses.json');
        if (!res.ok) throw new Error('Data unavailable');
        allCourses = await res.json();

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
        suggestions.innerHTML = results.map(c => `
            <div class="p-4 hover:bg-emerald-500/5 cursor-pointer border-b border-white/5 group transition-colors" 
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
        `).join('');
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
    if (selectedCourses.length < 1) return alert("Select courses first.");

    const minS = parseInt(filterStart.value);
    const maxE = parseInt(filterEnd.value);
    const maxC = parseInt(filterSeats.value);
    const allowedStatuses = Array.from(document.querySelectorAll('.status-check:checked')).map(el => el.value);
    const sortType = filterSort.value;
    const allowedDays = Array.from(document.querySelectorAll('.day-check:checked')).map(el => el.value.substring(0, 3));

    possibleRoutines = [];

    function find(idx, current) {
        if (idx === selectedCourses.length) { possibleRoutines.push([...current]); return; }

        const course = selectedCourses[idx].course;
        for (const sec of course.sections) {
            if (parseInt(sec.count) > maxC && maxC < 100) continue;

            // Strict Status Filter: Must be in the allowed list
            if (!allowedStatuses.includes(sec.status)) continue;

            let validTime = true;
            for (const s of sec.schedules) {
                if (toMin(s.start) < minS || toMin(s.end) > maxE || !allowedDays.includes(s.day.substring(0, 3))) {
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
    if (possibleRoutines.length === 0) return alert("No valid scenarios for these settings.");

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

        return `
            <div class="sidebar-item group">
                ${!isExplorerMode ? `<button onclick="handleRemoveCourse(${i})" class="absolute top-4 right-4 text-slate-600 hover:text-rose-500"><i data-lucide="x" class="w-4 h-4"></i></button>` : ''}
                <h3 class="text-xs font-900 uppercase text-white tracking-tight pr-6">${sc.course.baseTitle}</h3>
                
                <div class="grid grid-cols-4 gap-2 mt-4 py-2 border-y border-white/5">
                    <div class="text-center"><p class="text-[8px] text-slate-600 font-black uppercase">Sec</p><p class="text-[11px] font-bold">${section.section}</p></div>
                    <div class="text-center"><p class="text-[8px] text-slate-600 font-black uppercase">Enr</p><p class="text-[11px] font-bold">${section.count}</p></div>
                    <div class="text-center"><p class="text-[8px] text-slate-600 font-black uppercase">Cap</p><p class="text-[11px] font-bold">${section.capacity}</p></div>
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
            const top = start - (8 * 60);
            const height = end - start;

            if (!dayData[sch.day]) dayData[sch.day] = [];
            const conflict = !isExplorerMode && dayData[sch.day].some(e => (top < e.end && (top + height) > e.start));
            if (conflict) globalConflict = true;

            const block = document.createElement('div');
            block.className = `class-block ${sch.type.toLowerCase()}`;
            block.style.top = `${top}px`;
            block.style.height = `${height}px`;
            block.innerHTML = `
                <div class="class-name">${title}</div>
                <div class="class-info">${sch.start} - ${sch.end}</div>
                <div class="flex justify-between items-center mt-auto opacity-60">
                    <span class="text-[9px] font-black">SEC ${section.section}</span>
                    <span class="text-[9px] font-black">RM ${sch.room}</span>
                </div>
            `;
            const b = document.querySelector(`.day-bucket[data-day="${sch.day}"]`);
            if (b) { b.appendChild(block); dayData[sch.day].push({ start: top, end: top + height }); }
        });
    });
    conflictBadge.classList.toggle('hidden', !globalConflict);
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

document.addEventListener('click', (e) => { if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) suggestions.classList.add('hidden'); });
initialize();
