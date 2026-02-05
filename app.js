/**
 * Routine Pro — Core Application Logic
 * Optimized for performance and high-fidelity rendering.
 */

let allCourses = [];
let selectedCourses = []; // [{ course, selectedSectionIndex }]

const searchInput = document.getElementById('course-search');
const suggestions = document.getElementById('search-suggestions');
const selectedList = document.getElementById('selected-courses-list');
const conflictBadge = document.getElementById('conflict-badge');
const totalCreditsEl = document.getElementById('total-credits');
const exportBtn = document.getElementById('export-btn');

/**
 * Data Initialization
 */
async function initializeApp() {
    try {
        const response = await fetch('courses.json');
        if (!response.ok) throw new Error('Data fetch failed');
        allCourses = await response.json();
    } catch (error) {
        console.error('Initialization Error:', error);
    }
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
                <div class="flex justify-between items-center group">
                    <span class="text-white font-[700] text-sm group-hover:text-indigo-400 transition-colors">${course.baseTitle}</span>
                    <div class="bg-indigo-500/10 text-indigo-400 text-[9px] px-2 py-1 rounded-md font-black">+ ADD</div>
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
    selectedCourses.splice(index, 1);
    syncWorkspace();
};

window.handleSectionChange = (courseIndex, sectionIndex) => {
    selectedCourses[courseIndex].selectedSectionIndex = parseInt(sectionIndex);
    syncWorkspace();
};

/**
 * UI Sync Logic
 */
function syncWorkspace() {
    renderSidebar();
    calculateCredits();
    renderRoutine();
    lucide.createIcons();
}

function renderSidebar() {
    if (selectedCourses.length === 0) {
        selectedList.innerHTML = `
            <div class="text-center py-20 opacity-40">
                <i data-lucide="layers" class="w-12 h-12 text-slate-700 mx-auto mb-4"></i>
                <p class="text-slate-500 text-sm font-medium">Search to start building...</p>
            </div>
        `;
        return;
    }

    selectedList.innerHTML = selectedCourses.map((sc, i) => {
        const currentSec = sc.course.sections[sc.selectedSectionIndex];
        return `
            <div class="course-card">
                <button onclick="handleRemoveCourse(${i})" class="absolute top-4 right-4 text-slate-600 hover:text-rose-500 transition-colors">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
                <div class="pr-6">
                    <h3 class="text-white text-[13px] font-[800] leading-tight mb-4 uppercase tracking-tight">${sc.course.baseTitle}</h3>
                    <div class="flex items-center gap-3">
                        <select class="section-select flex-1" onchange="handleSectionChange(${i}, this.value)">
                            ${sc.course.sections.map((s, si) => `
                                <option value="${si}" ${si === sc.selectedSectionIndex ? 'selected' : ''}>
                                    Section ${s.section}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function calculateCredits() {
    const credits = selectedCourses.reduce((sum, sc) => {
        const title = sc.course.baseTitle.toLowerCase();
        return sum + (title.includes('lab') ? 1 : 3);
    }, 0);
    totalCreditsEl.innerText = credits;
}

/**
 * Routine Grid Rendering
 */
function renderRoutine() {
    const buckets = document.querySelectorAll('.day-bucket');
    buckets.forEach(b => b.innerHTML = '');

    let globalHasConflict = false;
    const scheduleByDay = {};

    selectedCourses.forEach(sc => {
        const section = sc.course.sections[sc.selectedSectionIndex];
        section.schedules.forEach(sched => {
            const day = sched.day;
            const range = getTimeRange(sched.start, sched.end);
            if (!range) return;

            const { top, height } = range;
            if (!scheduleByDay[day]) scheduleByDay[day] = [];

            const isConflicting = scheduleByDay[day].some(s => (top >= s.top && top < s.top + s.height) || (top + height > s.top && top + height <= s.top + s.height) || (s.top >= top && s.top < top + height));
            if (isConflicting) globalHasConflict = true;

            const block = document.createElement('div');
            block.className = `class-block ${sched.type.toLowerCase()} ${isConflicting ? 'conflict' : ''}`;
            block.style.top = `${top}px`;
            block.style.height = `${height}px`;

            // Clean Inner Content
            block.innerHTML = `
                <div class="block-header">
                    <div class="course-name-clean">${sc.course.baseTitle}</div>
                    <div class="time-clean">${sched.start} — ${sched.end}</div>
                </div>
                <div class="block-footer-clean">
                    <div class="meta-pill">SEC: <span class="meta-val">${section.section}</span></div>
                    <div class="meta-pill">RM: <span class="meta-val">${sched.room}</span></div>
                </div>
            `;

            const bucket = document.querySelector(`.day-bucket[data-day="${day}"]`);
            if (bucket) {
                bucket.appendChild(block);
                scheduleByDay[day].push({ top, height });
            }
        });
    });

    conflictBadge.classList.toggle('hidden', !globalHasConflict);
    conflictBadge.classList.toggle('flex', globalHasConflict);
}

function getTimeRange(startStr, endStr) {
    if (!startStr || !endStr || startStr === 'nan' || startStr === 'None') return null;
    const toMinutes = (s) => {
        try {
            const [t, m] = s.trim().split(' ');
            let [h, min] = t.split(':').map(Number);
            if (h === 12) h = 0;
            if (m === 'PM') h += 12;
            return h * 60 + min;
        } catch (e) { return 0; }
    };
    const start = toMinutes(startStr);
    const end = toMinutes(endStr);
    const top = Math.max(0, start - (8 * 60));
    const height = Math.max(30, end - start);
    return { top, height };
}

/**
 * High-Resolution Image Export (Fixed for Layout Collapse)
 */
exportBtn.addEventListener('click', async () => {
    const originalGrid = document.getElementById('routine-actual-grid');

    // UI Feedback
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<i class="animate-spin w-5 h-5" data-lucide="loader-2"></i> Capturing...';
    exportBtn.disabled = true;
    lucide.createIcons();

    try {
        // Force scroll-to-top to prevent capture offsets
        const scrollWrapper = document.getElementById('routine-scroll-wrapper');
        const scrollLeft = scrollWrapper.scrollLeft;
        scrollWrapper.scrollLeft = 0;

        const canvas = await html2canvas(originalGrid, {
            scale: 2,
            backgroundColor: '#0b0f19',
            useCORS: true,
            logging: false,
            // These options are critical for absolute positioning stability
            width: originalGrid.offsetWidth,
            height: originalGrid.offsetHeight,
            onclone: (clonedDoc) => {
                const clonedGrid = clonedDoc.getElementById('routine-actual-grid');
                if (clonedGrid) {
                    // 1. Force full dimensions
                    clonedGrid.style.width = originalGrid.offsetWidth + 'px';
                    clonedGrid.style.height = originalGrid.offsetHeight + 'px';

                    // 2. Fix Text Rendering for Canvas
                    // Line-clamp often fails in html2canvas. We'll force standard wrap.
                    const labels = clonedGrid.querySelectorAll('.course-name-clean');
                    labels.forEach(lbl => {
                        lbl.style.display = 'block';
                        lbl.style.webkitLineClamp = 'unset';
                        lbl.style.lineClamp = 'unset';
                        lbl.style.overflow = 'visible';
                        lbl.style.maxHeight = 'none';
                        lbl.style.fontSize = '7px'; // Slightly smaller for extra safety in capture
                    });

                    // 3. Remove animations
                    const animated = clonedGrid.querySelectorAll('*');
                    animated.forEach(el => {
                        el.style.transition = 'none';
                        el.style.animation = 'none';
                    });
                }
            }
        });

        // Restore scroll position
        scrollWrapper.scrollLeft = scrollLeft;

        const link = document.createElement('a');
        link.download = `AIUB_Routine_${new Date().toLocaleDateString().replace(/\//g, '-')}.png`;
        link.href = canvas.toDataURL("image/png", 1.0);
        link.click();

    } catch (e) {
        console.error('Export Error:', e);
        alert('Visual capture failed. Please try again.');
    } finally {
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
        lucide.createIcons();
    }
});

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) suggestions.classList.add('hidden');
});

initializeApp().then(() => syncWorkspace());
