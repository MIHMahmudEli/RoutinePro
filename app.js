/**
 * Routine Pro — Core Application Logic
 * Optimized for performance and high-fidelity rendering.
 */

let allCourses = [];
let selectedCourses = []; // [{ course, selectedSectionIndex }]
let possibleRoutines = []; // [[{courseTitle, section}, ...]]
let currentRoutineIndex = 0;
let isExplorerMode = false;

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

// Filter Inputs
const filterStart = document.getElementById('filter-start');
const filterEnd = document.getElementById('filter-end');
const filterSeats = document.getElementById('filter-seats');
const seatValDisplay = document.getElementById('seat-val');

/**
 * Data Initialization
 */
async function initializeApp() {
    try {
        const response = await fetch('courses.json');
        if (!response.ok) throw new Error('Data fetch failed');
        allCourses = await response.json();

        // Populate Time Filters
        const times = [
            { v: 480, l: '08:00 AM' }, { v: 540, l: '09:00 AM' }, { v: 600, l: '10:00 AM' },
            { v: 660, l: '11:00 AM' }, { v: 720, l: '12:00 PM' }, { v: 780, l: '01:00 PM' },
            { v: 840, l: '02:00 PM' }, { v: 900, l: '03:00 PM' }, { v: 960, l: '04:00 PM' },
            { v: 1020, l: '05:00 PM' }, { v: 1080, l: '06:00 PM' }, { v: 1140, l: '07:00 PM' },
            { v: 1200, l: '08:00 PM' }, { v: 1260, l: '09:00 PM' }, { v: 1320, l: '10:00 PM' }
        ];

        filterStart.innerHTML = times.map(t => `<option value="${t.v}">${t.l}</option>`).join('');
        filterEnd.innerHTML = times.map((t, i) => `<option value="${t.v}" ${i === times.length - 1 ? 'selected' : ''}>${t.l}</option>`).join('');

    } catch (error) {
        console.error('Initialization Error:', error);
    }
}

// Slider Display update
if (filterSeats) {
    filterSeats.addEventListener('input', (e) => {
        seatValDisplay.innerText = e.target.value;
    });
}

/**
 * Search & Suggestions
 */
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) {
        suggestions.classList.add('hidden');
        return;
    }

    const filtered = allCourses.filter(c =>
        c.baseTitle.toLowerCase().includes(query) ||
        (c.code && c.code.toLowerCase().includes(query))
    ).slice(0, 10);

    if (filtered.length > 0) {
        suggestions.innerHTML = filtered.map(course => `
            <div class="suggestion-item" onclick="handleAddCourse('${course.baseTitle.replace(/'/g, "\\'")}', '${course.code}')">
                <div class="flex justify-between items-start group gap-4">
                    <span class="text-white font-[700] text-sm group-hover:text-sky-400 transition-colors flex-1 min-w-0">${course.baseTitle}</span>
                    <div class="bg-sky-500/10 text-sky-400 text-[9px] px-2 py-1 rounded-md font-black shrink-0 mt-0.5">+ ADD</div>
                </div>
                <div class="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-1 opacity-60">
                    ${course.code ? course.code + ' • ' : ''} ${course.sections.length} Sections
                </div>
            </div>
        `).join('');
        suggestions.classList.remove('hidden');
    } else {
        suggestions.classList.add('hidden');
    }
});

/**
 * Event Handlers
 */
window.handleAddCourse = (title, code) => {
    if (isExplorerMode) stopExplorer();
    const course = allCourses.find(c => c.baseTitle === title && c.code === code);
    if (!course) return;

    if (selectedCourses.some(sc => sc.course.baseTitle === title && sc.course.code === code)) {
        searchInput.value = '';
        suggestions.classList.add('hidden');
        return;
    }

    selectedCourses.push({ course, selectedSectionIndex: 0 });
    searchInput.value = '';
    suggestions.classList.add('hidden');
    syncWorkspace();
};

window.handleRemoveCourse = (index) => {
    if (isExplorerMode) stopExplorer();
    selectedCourses.splice(index, 1);
    syncWorkspace();
};

window.handleSectionChange = (courseIndex, sectionIndex) => {
    if (isExplorerMode) stopExplorer();
    selectedCourses[courseIndex].selectedSectionIndex = parseInt(sectionIndex);
    syncWorkspace();
};

/**
 * Automated Routine Generation Logic
 */
generateAllBtn.addEventListener('click', () => {
    if (selectedCourses.length < 1) {
        alert("Please add at least 1 course to generate routines.");
        return;
    }

    const minStartTime = parseInt(filterStart.value);
    const maxEndTime = parseInt(filterEnd.value);
    const maxSeats = parseInt(filterSeats.value);

    // Status filters
    const allowedStatuses = Array.from(document.querySelectorAll('.status-check:checked')).map(el => el.value);

    // Day filters
    const allowedDays = Array.from(document.querySelectorAll('.day-check:checked')).map(el => el.value.substring(0, 3));

    // Sort preference
    const sortPref = document.querySelector('input[name="sort-gap"]:checked').value;

    possibleRoutines = [];

    function findCombinations(courseIdx, currentCombo) {
        if (courseIdx === selectedCourses.length) {
            possibleRoutines.push([...currentCombo]);
            return;
        }

        const courseObj = selectedCourses[courseIdx].course;
        for (const section of courseObj.sections) {
            // 1. Status & Seat Filter
            // Note: Our current JSON has 'count' and 'capacity'. Status is derivation.
            const isFull = section.count >= section.capacity;
            const currentStatus = isFull ? 'Closed' : 'Open'; // Default logic
            // (If your courses.json adds explicit status, use that)
            if (!allowedStatuses.includes(currentStatus)) continue;

            if (section.count > maxSeats) continue;

            // 2. Schedule Filters (Time & Day)
            let timeValid = true;
            let dayValid = true;
            for (const sch of section.schedules) {
                const sMin = toMinutes(sch.start);
                const eMin = toMinutes(sch.end);

                if (sMin < minStartTime || eMin > maxEndTime) {
                    timeValid = false;
                    break;
                }

                if (!allowedDays.includes(sch.day.substring(0, 3))) {
                    dayValid = false;
                    break;
                }
            }
            if (!timeValid || !dayValid) continue;

            // 3. Conflict Check
            if (!hasConflict(section, currentCombo)) {
                currentCombo.push({ courseTitle: courseObj.baseTitle, section });
                findCombinations(courseIdx + 1, currentCombo);
                currentCombo.pop();
            }
        }
    }

    function hasConflict(newSection, existingCombo) {
        return existingCombo.some(item => {
            const secA = newSection;
            const secB = item.section;
            return secA.schedules.some(schA => {
                return secB.schedules.some(schB => {
                    if (schA.day !== schB.day) return false;
                    const sA = toMinutes(schA.start);
                    const eA = toMinutes(schA.end);
                    const sB = toMinutes(schB.start);
                    const eB = toMinutes(schB.end);
                    return (sA < eB && eA > sB);
                });
            });
        });
    }

    findCombinations(0, []);

    // 4. Sort if requested
    if (sortPref === 'min') {
        possibleRoutines.sort((a, b) => calculateGaps(a) - calculateGaps(b));
    }

    if (possibleRoutines.length === 0) {
        alert("No routines match your filters. Try relaxing the time or status constraints.");
        return;
    }

    isExplorerMode = true;
    currentRoutineIndex = 0;
    syncWorkspace();

    // Auto scroll to routine canvas
    document.getElementById('explorer-nav').scrollIntoView({ behavior: 'smooth' });
});

function calculateGaps(routine) {
    let totalGap = 0;
    const dayGroups = {};

    routine.forEach(item => {
        item.section.schedules.forEach(s => {
            if (!dayGroups[s.day]) dayGroups[s.day] = [];
            dayGroups[s.day].push({ s: toMinutes(s.start), e: toMinutes(s.end) });
        });
    });

    Object.values(dayGroups).forEach(slots => {
        slots.sort((x, y) => x.s - y.s);
        for (let i = 0; i < slots.length - 1; i++) {
            totalGap += Math.max(0, slots[i + 1].s - slots[i].e);
        }
    });
    return totalGap;
}

function stopExplorer() {
    isExplorerMode = false;
    syncWorkspace();
}

exitExplorerBtn.addEventListener('click', stopExplorer);
prevBtn.addEventListener('click', () => { if (currentRoutineIndex > 0) { currentRoutineIndex--; updateExplorerUI(); } });
nextBtn.addEventListener('click', () => { if (currentRoutineIndex < possibleRoutines.length - 1) { currentRoutineIndex++; updateExplorerUI(); } });

function updateExplorerUI() {
    routineCounter.innerText = `Scenario ${currentRoutineIndex + 1}/${possibleRoutines.length}`;
    renderRoutine();
    renderSidebar();
    calculateCredits();
}

/**
 * UI Sync Logic
 */
function syncWorkspace() {
    explorerNav.classList.toggle('hidden', !isExplorerMode);
    explorerNav.classList.toggle('flex', isExplorerMode);

    if (isExplorerMode) {
        updateExplorerUI();
    } else {
        renderSidebar();
        calculateCredits();
        renderRoutine();
    }
    lucide.createIcons();
}

function renderSidebar() {
    if (selectedCourses.length === 0) {
        selectedList.innerHTML = `<div class="text-center py-20 opacity-40"><i data-lucide="layers" class="w-12 h-12 text-slate-700 mx-auto mb-4"></i><p class="text-slate-500 text-sm font-medium">Search to build your routine</p></div>`;
        return;
    }
    selectedList.innerHTML = selectedCourses.map((sc, i) => {
        // Context-Aware Section Sync
        const section = isExplorerMode
            ? possibleRoutines[currentRoutineIndex].find(item => item.courseTitle === sc.course.baseTitle).section
            : sc.course.sections[sc.selectedSectionIndex];

        const isFull = parseInt(section.count) >= parseInt(section.capacity);
        const statusColor = isFull ? 'text-rose-400 bg-rose-400/10' : 'text-emerald-400 bg-emerald-400/10';

        return `
            <div class="course-card animate-fade">
                ${!isExplorerMode ? `
                <button onclick="handleRemoveCourse(${i})" class="absolute top-3 right-4 text-slate-600 hover:text-rose-500 transition-colors">
                    <i data-lucide="x" class="w-3 h-3"></i>
                </button>` : ''}
                <div class="space-y-3">
                    <h3 class="text-white text-[11px] font-black leading-tight uppercase tracking-wider pr-6">${sc.course.baseTitle}</h3>
                    
                    <div class="grid grid-cols-4 gap-1 py-2 border-y border-white/5">
                        <div class="text-center border-r border-white/5">
                            <div class="text-[7px] text-slate-500 font-black uppercase tracking-tighter mb-0.5">Sec</div>
                            <div class="text-[9px] text-white font-bold">${section.section}</div>
                        </div>
                        <div class="text-center border-r border-white/5">
                            <div class="text-[7px] text-slate-500 font-black uppercase tracking-tighter mb-0.5">Count</div>
                            <div class="text-[9px] text-white font-bold">${section.count}</div>
                        </div>
                        <div class="text-center border-r border-white/5">
                            <div class="text-[7px] text-slate-500 font-black uppercase tracking-tighter mb-0.5">Cap</div>
                            <div class="text-[9px] text-white font-bold">${section.capacity}</div>
                        </div>
                        <div class="text-center">
                            <div class="text-[7px] text-slate-500 font-black uppercase tracking-tighter mb-0.5">Status</div>
                            <div class="text-[8px] ${statusColor} px-1 py-0.5 rounded-sm font-black inline-block uppercase">${section.status}</div>
                        </div>
                    </div>

                    ${!isExplorerMode ? `
                    <div class="flex flex-col gap-1.5">
                        <div class="flex items-center gap-2 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                            <i data-lucide="hash" class="w-3 h-3 text-sky-500/50"></i>
                            Change Section
                        </div>
                        <select class="section-select w-full !py-2 !text-[10px]" onchange="handleSectionChange(${i}, this.value)">
                            ${sc.course.sections.map((s, si) => `
                                <option value="${si}" ${si === sc.selectedSectionIndex ? 'selected' : ''}>
                                    Section ${s.section}
                                </option>
                            `).join('')}
                        </select>
                    </div>` : `
                    <div class="flex items-center gap-2 text-[8px] font-black text-sky-400 uppercase tracking-widest">
                        <i data-lucide="check-circle-2" class="w-3 h-3"></i>
                        Active in Scenario ${currentRoutineIndex + 1}
                    </div>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

function calculateCredits() {
    const target = isExplorerMode ? possibleRoutines[currentRoutineIndex] : selectedCourses;
    const credits = target.reduce((sum, item) => {
        const title = (isExplorerMode ? item.courseTitle : item.course.baseTitle).toLowerCase();
        return sum + (title.includes('lab') ? 1 : 3);
    }, 0);
    totalCreditsEl.innerText = credits;
}

function renderRoutine() {
    const buckets = document.querySelectorAll('.day-bucket');
    buckets.forEach(b => b.innerHTML = '');
    let globalHasConflict = false;
    const scheduleByDay = {};
    const itemsToRender = isExplorerMode ? possibleRoutines[currentRoutineIndex] : selectedCourses;

    itemsToRender.forEach(item => {
        const courseTitle = isExplorerMode ? item.courseTitle : item.course.baseTitle;
        const section = isExplorerMode ? item.section : item.course.sections[item.selectedSectionIndex];
        section.schedules.forEach(sched => {
            const range = getTimeRange(sched.start, sched.end);
            if (!range) return;
            const { top, height } = range;
            const day = sched.day;
            if (!scheduleByDay[day]) scheduleByDay[day] = [];
            const isConflicting = !isExplorerMode && scheduleByDay[day].some(s => (top >= s.top && top < s.top + s.height) || (top + height > s.top && top + height <= s.top + s.height) || (s.top >= top && s.top < top + height));
            if (isConflicting) globalHasConflict = true;

            const block = document.createElement('div');
            block.className = `class-block ${sched.type.toLowerCase()} ${isConflicting ? 'conflict' : ''}`;
            block.style.top = `${top}px`;
            block.style.height = `${height}px`;
            block.innerHTML = `<div class="block-header"><div class="course-name-clean">${courseTitle}</div><div class="time-clean">${sched.start} — ${sched.end}</div></div><div class="block-footer-clean"><div class="meta-pill">SEC: <span class="meta-val">${section.section}</span></div><div class="meta-pill">RM: <span class="meta-val">${sched.room}</span></div></div>`;
            const bucket = document.querySelector(`.day-bucket[data-day="${day}"]`);
            if (bucket) { bucket.appendChild(block); scheduleByDay[day].push({ top, height }); }
        });
    });
    conflictBadge.classList.toggle('hidden', !globalHasConflict);
    conflictBadge.classList.toggle('flex', globalHasConflict);
}

function toMinutes(s) {
    try {
        const [t, m] = s.trim().split(' ');
        let [h, min] = t.split(':').map(Number);
        if (h === 12) h = 0; if (m === 'PM') h += 12;
        return h * 60 + min;
    } catch (e) { return 0; }
}

function getTimeRange(startStr, endStr) {
    if (!startStr || !endStr || startStr === 'nan' || startStr === 'None') return null;
    const start = toMinutes(startStr); const end = toMinutes(endStr);
    return { top: Math.max(0, start - (8 * 60)), height: Math.max(30, end - start) };
}

exportBtn.addEventListener('click', async () => {
    const originalGrid = document.getElementById('routine-actual-grid');
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<i class="animate-spin w-5 h-5" data-lucide="loader-2"></i> Capturing...';
    exportBtn.disabled = true;
    lucide.createIcons();
    try {
        const scrollWrapper = document.getElementById('routine-scroll-wrapper');
        const scrollLeft = scrollWrapper.scrollLeft; scrollWrapper.scrollLeft = 0;
        const canvas = await html2canvas(originalGrid, {
            scale: 2, backgroundColor: '#0b0f19', useCORS: true,
            width: originalGrid.offsetWidth, height: originalGrid.offsetHeight,
            onclone: (clonedDoc) => {
                const clonedGrid = clonedDoc.getElementById('routine-actual-grid');
                if (clonedGrid) {
                    clonedGrid.style.width = originalGrid.offsetWidth + 'px';
                    clonedGrid.style.height = originalGrid.offsetHeight + 'px';
                    clonedGrid.querySelectorAll('.course-name-clean').forEach(lbl => {
                        lbl.style.display = 'block'; lbl.style.webkitLineClamp = 'unset'; lbl.style.lineClamp = 'unset';
                        lbl.style.overflow = 'visible'; lbl.style.maxHeight = 'none'; lbl.style.fontSize = '7px';
                    });
                    clonedGrid.querySelectorAll('*').forEach(el => { el.style.transition = 'none'; el.style.animation = 'none'; });
                }
            }
        });
        scrollWrapper.scrollLeft = scrollLeft;
        const link = document.createElement('a');
        link.download = `AIUB_Routine_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL("image/png", 1.0);
        link.click();
    } catch (e) { console.error('Export Error:', e); alert('Visual capture failed.'); } finally {
        exportBtn.innerHTML = originalText; exportBtn.disabled = false; lucide.createIcons();
    }
});

document.addEventListener('click', (e) => { if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) suggestions.classList.add('hidden'); });
initializeApp().then(() => syncWorkspace());
