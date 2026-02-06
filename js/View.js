/**
 * RoutinePro - View
 * Handles DOM manipulation, rendering, and UI feedback.
 */
class RoutineView {
    constructor() {
        this.searchInput = document.getElementById('course-search');
        this.suggestions = document.getElementById('search-suggestions');
        this.selectedList = document.getElementById('selected-courses-list');
        this.conflictBadge = document.getElementById('conflict-badge');
        this.totalCreditsEl = document.getElementById('total-credits');
        this.exportBtn = document.getElementById('export-btn');
        this.generateAllBtn = document.getElementById('generate-all-btn');
        this.explorerNav = document.getElementById('explorer-nav');
        this.routineCounter = document.getElementById('routine-counter');
        this.gapDisplay = document.getElementById('gap-info-badge');
        this.headerGapDisplay = document.getElementById('header-gap-display');
        this.semesterBadge = document.getElementById('semester-badge');
        this.syncModal = document.getElementById('sync-modal');
        this.toastContainer = document.getElementById('toast-container');
        this.filterStart = document.getElementById('filter-start');
        this.filterEnd = document.getElementById('filter-end');
    }

    populateTimeFilters() {
        const times = [
            { v: 480, l: '08:00 AM' }, { v: 540, l: '09:00 AM' }, { v: 600, l: '10:00 AM' },
            { v: 660, l: '11:00 AM' }, { v: 720, l: '12:00 PM' }, { v: 780, l: '01:00 PM' },
            { v: 840, l: '02:00 PM' }, { v: 900, l: '03:00 PM' }, { v: 960, l: '04:00 PM' },
            { v: 1020, l: '05:00 PM' }, { v: 1080, l: '06:00 PM' }, { v: 1140, l: '07:00 PM' },
            { v: 1200, l: '08:00 PM' }
        ];

        if (this.filterStart) {
            this.filterStart.innerHTML = times.map(t => `<option value="${t.v}">${t.l}</option>`).join('');
        }
        if (this.filterEnd) {
            this.filterEnd.innerHTML = times.map((t, i) => `<option value="${t.v}" ${i === times.length - 1 ? 'selected' : ''}>${t.l}</option>`).join('');
        }
    }

    formatGap(totalGapMin) {
        if (totalGapMin === 0) return "0m";
        const hrs = Math.floor(totalGapMin / 60);
        const mins = totalGapMin % 60;
        return `${hrs > 0 ? hrs + 'h ' : ''}${mins}m`;
    }

    renderSidebar(selectedCourses, isExplorerMode, currentRoutine, onRemove, onSectionChange) {
        if (selectedCourses.length === 0) {
            this.selectedList.innerHTML = `<div class="text-center py-12 opacity-20 border-2 border-dashed border-white/5 rounded-2xl"><i data-lucide="command" class="w-8 h-8 mx-auto mb-2"></i><p class="text-[10px] font-bold uppercase tracking-widest">Awaiting Input</p></div>`;
            lucide.createIcons();
            return;
        }

        this.selectedList.innerHTML = selectedCourses.map((sc, i) => {
            const section = isExplorerMode
                ? currentRoutine.find(item => item.courseTitle === sc.course.baseTitle).section
                : sc.course.sections[sc.selectedSectionIndex];

            const statusClass = `tag-${section.status.toLowerCase()}`;
            const hue = this.getCourseHue(sc.course.baseTitle);
            const accentStyle = document.body.getAttribute('data-theme') === 'spectrum'
                ? `style="border-left: 4px solid hsla(${hue}, 70%, 60%, 0.8)"`
                : '';

            return `
                <div class="sidebar-item group" ${accentStyle}>
                    ${!isExplorerMode ? `<button class="remove-btn absolute top-4 right-4 text-slate-600 hover:text-rose-500" data-index="${i}"><i data-lucide="x" class="w-4 h-4"></i></button>` : ''}
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
                        <select class="section-select prism-input !py-1.5 !text-[10px] !rounded-lg" data-index="${i}">
                            ${sc.course.sections.map((s, si) => `<option value="${si}" ${si === sc.selectedSectionIndex ? 'selected' : ''}>Switch to Sec ${s.section}</option>`).join('')}
                        </select>
                        <i data-lucide="chevron-down" class="select-arrow w-3 h-3"></i>
                    </div>` : `
                    <div class="mt-3 flex items-center gap-2 text-[10px] font-black text-[var(--accent-secondary)] uppercase tracking-widest"><i data-lucide="shield-check" class="w-4 h-4"></i> Locked in Scenario</div>`}
                </div>
            `;
        }).join('');

        // Attach listeners
        this.selectedList.querySelectorAll('.remove-btn').forEach(btn => {
            btn.onclick = () => onRemove(btn.dataset.index);
        });
        this.selectedList.querySelectorAll('.section-select').forEach(select => {
            select.onchange = (e) => onSectionChange(select.dataset.index, e.target.value);
        });

        lucide.createIcons();
    }

    renderRoutine(items, isExplorerMode) {
        const buckets = document.querySelectorAll('.day-bucket');
        buckets.forEach(b => b.innerHTML = '');
        let globalConflict = false;
        const dayData = {};

        items.forEach(item => {
            const title = isExplorerMode ? item.courseTitle : item.course.baseTitle;
            const section = isExplorerMode ? item.section : item.course.sections[item.selectedSectionIndex];

            section.schedules.forEach(sch => {
                const start = this.toMin(sch.start);
                const end = this.toMin(sch.end);

                // Use smaller vertical scale for mobile
                const isMobile = window.innerWidth < 768;
                const scale = isMobile ? (50 / 60) : (70 / 60);

                const top = (start - (8 * 60)) * scale;
                const height = (end - start) * scale;

                if (!dayData[sch.day]) dayData[sch.day] = [];
                const conflict = !isExplorerMode && dayData[sch.day].some(e => (top < e.end && (top + height) > e.start));
                if (conflict) globalConflict = true;

                const block = document.createElement('div');
                block.className = `class-block ${sch.type.toLowerCase()}`;

                if (document.body.getAttribute('data-theme') === 'spectrum') {
                    const hue = this.getCourseHue(title);
                    block.style.background = `linear-gradient(135deg, hsla(${hue}, 70%, 60%, 0.15), rgba(255,255,255,0.02))`;
                    block.style.borderLeft = `4px solid hsla(${hue}, 70%, 60%, 0.9)`;
                    block.style.backdropFilter = 'blur(10px)';
                    block.style.webkitBackdropFilter = 'blur(10px)';
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
        this.conflictBadge.classList.toggle('hidden', !globalConflict);
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = type === 'success' ? 'check-circle' : 'alert-circle';
        const iconColor = type === 'success' ? 'text-emerald-400' : 'text-rose-400';
        toast.innerHTML = `
            <div class="toast-icon"><i data-lucide="${icon}" class="w-5 h-5 ${iconColor}"></i></div>
            <div class="toast-message">${message}</div>
        `;
        this.toastContainer.appendChild(toast);
        lucide.createIcons();
        setTimeout(() => {
            toast.classList.add('removing');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    }

    updateSyncUI(allCourses) {
        const countDisplay = document.getElementById('course-count-display');
        const updateDisplay = document.getElementById('last-update-display');
        if (countDisplay) countDisplay.innerText = `${allCourses.length} Courses`;
        const lastSync = localStorage.getItem('routine-pro-last-sync');
        if (updateDisplay) updateDisplay.innerText = lastSync ? `Last Sync: ${lastSync}` : 'Default (Pre-loaded)';

        const semester = localStorage.getItem('routine-pro-semester');
        if (semester && this.semesterBadge) {
            this.semesterBadge.innerText = semester;
            this.semesterBadge.classList.remove('hidden');
        } else if (this.semesterBadge) {
            this.semesterBadge.classList.add('hidden');
        }
    }

    getCourseHue(title) {
        let hash = 0;
        for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
        return Math.abs(hash % 360);
    }

    toMin(s) {
        try {
            const [t, m] = s.trim().split(' ');
            let [h, min] = t.split(':').map(Number);
            if (h === 12) h = 0; if (m === 'PM') h += 12;
            return h * 60 + min;
        } catch (e) { return 0; }
    }
}
