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
        this.shareBtn = document.getElementById('share-btn');
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
        this.manualStart = document.getElementById('manual-start');
        this.manualEnd = document.getElementById('manual-end');
        this.manualAddBtn = document.getElementById('add-manual-btn');
        this.metadataText = document.getElementById('metadata-text');
        this.hueMap = new Map();
        this.hueSeed = Math.random();
    }

    renderLibraryMetadata(metadata, dataSource = 'Global', displayTime = null) {
        if (!this.metadataText || !metadata) return;

        const syncDate = displayTime ? new Date(displayTime) : new Date(metadata.lastUpdate);
        const relativeTime = this.getRelativeTime(syncDate);
        
        const sourceColor = dataSource === 'Local' ? 'text-amber-400' : 'text-emerald-400';
        const sourceLabel = dataSource === 'Local' ? 'Local Sync' : 'Global Sync';

        // Add a small badge for local sync if desired
        const timePart = (dataSource === 'Local' && !displayTime) ? '' : ` · <span class="${sourceColor} font-black">${relativeTime}</span>`;

        this.metadataText.innerHTML = `${sourceLabel}: <span class="text-white">${metadata.semester}</span>${timePart}`;
    }

    getRelativeTime(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        const mins = Math.floor(diffInSeconds / 60);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return date.toLocaleDateString();
    }

    populateTimeFilters() {
        const times = [
            { v: 480, l: '08:00 AM' }, { v: 510, l: '08:30 AM' }, { v: 540, l: '09:00 AM' }, { v: 570, l: '09:30 AM' },
            { v: 600, l: '10:00 AM' }, { v: 630, l: '10:30 AM' }, { v: 660, l: '11:00 AM' }, { v: 690, l: '11:30 AM' },
            { v: 720, l: '12:00 PM' }, { v: 750, l: '12:30 PM' }, { v: 780, l: '01:00 PM' }, { v: 810, l: '01:30 PM' },
            { v: 840, l: '02:00 PM' }, { v: 870, l: '02:30 PM' }, { v: 900, l: '03:00 PM' }, { v: 930, l: '03:30 PM' },
            { v: 960, l: '04:00 PM' }, { v: 990, l: '04:30 PM' }, { v: 1020, l: '05:00 PM' }, { v: 1050, l: '05:30 PM' },
            { v: 1080, l: '06:00 PM' }, { v: 1110, l: '06:30 PM' }, { v: 1140, l: '07:00 PM' }, { v: 1170, l: '07:30 PM' },
            { v: 1200, l: '08:00 PM' }
        ];

        const optionsHtml = times.map(t => `<option value="${t.l}">${t.l}</option>`).join('');

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

    renderSidebar(selectedCourses, isExplorerMode, currentRoutine, onRemove, onSectionChange, onEdit, onTogglePin, titleFormatter = (t) => t) {
        if (selectedCourses.length === 0) {
            this.selectedList.innerHTML = `<div class="text-center py-12 opacity-20 border-2 border-dashed border-white/5 rounded-2xl"><i data-lucide="command" class="w-8 h-8 mx-auto mb-2"></i><p class="text-[10px] font-bold uppercase tracking-widest">Awaiting Input</p></div>`;
            lucide.createIcons();
            return;
        }

        this.selectedList.innerHTML = selectedCourses.map((sc, i) => {
            const section = isExplorerMode
                ? currentRoutine.find(item => item.courseTitle === sc.course.baseTitle && item.dept === sc.course.dept).section
                : sc.course.sections[sc.selectedSectionIndex] || sc.course.sections[0];

            if (!section) return ''; // Skip if data is corrupted

            const statusClass = `tag-${(section.status || 'unknown').toLowerCase()}`;
            const hue = this.getCourseHue(sc.course.baseTitle + (sc.course.dept || ''));
            const accentStyle = document.body.getAttribute('data-theme') === 'spectrum'
                ? `style="border-left: 4px solid hsla(${hue}, 70%, 60%, 0.8)"`
                : '';

            const isManual = sc.course.code === 'MANUAL';

            return `
                <div class="sidebar-item group ${sc.isPinned ? 'border-emerald-500/30 bg-emerald-500/[0.03]' : ''}" ${accentStyle}>
                    <div class="absolute top-4 right-4 flex items-center gap-2">
                        <button class="pin-btn ${sc.isPinned ? 'text-emerald-400' : 'text-slate-600'} hover:text-emerald-500 transition-colors" data-index="${i}" title="${sc.isPinned ? 'Unfix this course' : 'Fix this course'}">
                            <i data-lucide="${sc.isPinned ? 'lock' : 'unlock'}" class="w-3.5 h-3.5"></i>
                        </button>
                        ${!isExplorerMode && isManual ? `<button class="edit-btn text-slate-600 hover:text-emerald-500 transition-colors" data-index="${i}"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>` : ''}
                        ${!isExplorerMode ? `<button class="remove-btn text-slate-600 hover:text-rose-500 transition-colors" data-index="${i}"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>` : ''}
                    </div>
                    <h3 class="text-xs font-900 uppercase text-white tracking-tight pr-12">${titleFormatter(sc.course.baseTitle)}</h3>
                    ${sc.course.dept ? `<p class="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">${sc.course.dept}</p>` : ''}
                    
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
                    <div class="select-wrapper mt-3 ${sc.course.code === 'MANUAL' ? 'hidden' : ''}">
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
        this.selectedList.querySelectorAll('.edit-btn').forEach(btn => {
            btn.onclick = () => onEdit(btn.dataset.index);
        });
        this.selectedList.querySelectorAll('.pin-btn').forEach(btn => {
            btn.onclick = () => onTogglePin(btn.dataset.index);
        });
        this.selectedList.querySelectorAll('.section-select').forEach(select => {
            select.onchange = (e) => onSectionChange(select.dataset.index, e.target.value);
        });

        lucide.createIcons();
    }

    renderRoutine(items, isExplorerMode, model, titleFormatter = (t) => t, targetDoc = document, forceFocusMode = false) {
        const focusMode = forceFocusMode || model.focusMode;
        const { twentyFourHourMode, ramadanMode } = model;
        const buckets = targetDoc.querySelectorAll('.day-bucket');
        buckets.forEach(b => b.innerHTML = '');
        let globalConflict = false;
        const dayData = {};

        // Define time range
        let minTime = 8 * 60; // Default 8 AM
        let maxTime = 20 * 60; // Default 8 PM

        if (twentyFourHourMode) {
            minTime = 7 * 60; // Start at 7 AM as requested
            maxTime = minTime + (24 * 60); // Full 24 hours
        } else if (focusMode && items.length > 0) {
            let earliest = 24 * 60;
            let latest = 0;
            items.forEach(item => {
                const section = isExplorerMode ? item.section : item.course.sections[item.selectedSectionIndex];
                section.schedules.forEach(sch => {
                    const times = model.getEffectiveTimes(sch);
                    if (times.start < earliest) earliest = times.start;
                    if (times.end > latest) latest = times.end;
                });
            });

            // Round to nearest hours for visual comfort
            minTime = Math.max(0, Math.floor(earliest / 60) * 60);
            maxTime = Math.min(24 * 60, Math.ceil(latest / 60) * 60);

            // Ensure at least some range
            if (maxTime <= minTime) maxTime = minTime + 60;
        }

        // Identify active days in Focus Mode
        const activeDays = new Set();
        if (focusMode && items.length > 0) {
            items.forEach(item => {
                const section = isExplorerMode ? item.section : item.course.sections[item.selectedSectionIndex];
                section.schedules.forEach(sch => activeDays.add(sch.day));
            });
        }

        // Handle day cropping
        const dayList = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let visibleDayCount = 0;

        dayList.forEach(day => {
            const bucket = targetDoc.querySelector(`.day-bucket[data-day="${day}"]`);
            const header = targetDoc.querySelector(`.day-label[data-day-header="${day}"]`);
            const isVisible = !focusMode || activeDays.has(day);

            if (bucket) bucket.style.display = isVisible ? 'block' : 'none';
            if (header) header.style.display = isVisible ? 'block' : 'none';
            if (isVisible) visibleDayCount++;
        });

        // Update Grid Columns
        const gridTemplate = `80px repeat(${visibleDayCount}, 1fr)`;
        const headerRow = targetDoc.getElementById('routine-header-row');
        const classContainer = targetDoc.getElementById('class-container');
        if (headerRow) headerRow.style.gridTemplateColumns = gridTemplate;
        if (classContainer) classContainer.style.gridTemplateColumns = `repeat(${visibleDayCount}, 1fr)`;

        // Handle dynamic time rail and guide lines
        const timeRail = targetDoc.getElementById('time-rail');
        const guideLinesContainer = targetDoc.getElementById('guide-lines');
        const rowHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row-height')) || 70;

        if (timeRail && guideLinesContainer) {
            timeRail.innerHTML = '';
            guideLinesContainer.innerHTML = '';

            let visibleRowCount = 0;
            const startHour = Math.floor(minTime / 60);
            const endHour = Math.ceil(maxTime / 60);

            for (let h = startHour; h < endHour; h++) {
                // Time Label
                const displayH = h % 24;
                const ampm = displayH >= 12 ? 'PM' : 'AM';
                const hour12 = displayH % 12 || 12;
                const timeLabel = document.createElement('div');
                timeLabel.className = 'flex items-start justify-end pr-4 time-label';
                timeLabel.style.height = 'var(--row-height)';
                timeLabel.innerText = `${hour12}:00 ${ampm}`;
                timeRail.appendChild(timeLabel);

                // Guide Line
                const guideLine = document.createElement('div');
                guideLine.className = 'border-b border-white/[0.03]';
                guideLine.style.height = 'var(--row-height)';
                guideLinesContainer.appendChild(guideLine);

                visibleRowCount++;
            }

            // Adjust Container Height
            const gridWrapper = targetDoc.querySelector('.relative.mt-4');
            if (gridWrapper) gridWrapper.style.height = `${visibleRowCount * rowHeight}px`;
        }

        items.forEach(item => {
            const title = isExplorerMode ? item.courseTitle : item.course.baseTitle;
            const section = isExplorerMode ? item.section : item.course.sections[item.selectedSectionIndex];

            section.schedules.forEach(sch => {
                const effective = model.getEffectiveTimes(sch);
                let start = effective.start;
                let end = effective.end;

                // Handle wrap-around for 24h mode
                if (twentyFourHourMode && start < minTime) start += 1440;
                if (twentyFourHourMode && end < minTime) end += 1440;

                const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--routine-scale')) || (window.innerWidth < 768 ? 50 / 60 : 70 / 60);

                const top = (start - minTime) * scale;
                const height = (end - start) * scale;

                if (!dayData[sch.day]) dayData[sch.day] = [];
                const conflict = !isExplorerMode && dayData[sch.day].some(e => (start < e.end && end > e.start));
                if (conflict) globalConflict = true;

                const block = document.createElement('div');
                block.className = `class-block ${sch.type.toLowerCase()}`;

                if (document.body.getAttribute('data-theme') === 'spectrum') {
                    const hue = this.getCourseHue(title + (isExplorerMode ? item.dept || '' : item.course.dept || ''));
                    block.style.background = `linear-gradient(135deg, hsla(${hue}, 70%, 60%, 0.15), rgba(255,255,255,0.02))`;
                    block.style.borderLeft = `4px solid hsla(${hue}, 70%, 60%, 0.9)`;
                    block.style.backdropFilter = 'blur(10px)';
                    block.style.webkitBackdropFilter = 'blur(10px)';
                }

                block.style.top = `${top}px`;
                block.style.height = `${height}px`;
                const timeHtml = (model.ramadanMode && !sch.isManual)
                    ? `<div class="flex flex-col items-center ramadan-time-container">
                        <div class="relative ramadan-old-time">
                            <span class="class-label opacity-40 leading-none">${sch.start} - ${sch.end}</span>
                            <div class="ramadan-strike absolute top-1/2 left-0 w-full h-[0.5px] bg-white/40 -translate-y-1/2"></div>
                        </div>
                        <div class="class-info text-amber-400 font-bold leading-tight">${effective.startStr} - ${effective.endStr}</div>
                       </div>`
                    : `<div class="class-info">${effective.startStr} - ${effective.endStr}</div>`;

                block.innerHTML = `
                    <div class="class-name">${titleFormatter(title)}</div>
                    ${timeHtml}
                    <div class="flex justify-between items-center mt-auto opacity-60">
                        <span class="class-label">SEC ${section.section}</span>
                        <span class="class-label">RM ${sch.room}</span>
                    </div>
                `;
                const b = targetDoc.querySelector(`.day-bucket[data-day="${sch.day}"]`);
                if (b && b.style.display !== 'none') {
                    b.appendChild(block);
                    dayData[sch.day].push({ start, end });
                }
            });
        });
        this.conflictBadge.classList.toggle('hidden', !globalConflict);
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let icon = 'check-circle';
        let iconColor = 'text-emerald-400';

        if (type === 'error') {
            icon = 'alert-circle';
            iconColor = 'text-rose-400';
        } else if (type === 'info') {
            icon = 'info';
            iconColor = 'text-sky-400';
        }

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
        if (updateDisplay) {
            if (lastSync) {
                const date = new Date(lastSync);
                updateDisplay.innerText = `Last Sync: ${this.getRelativeTime(date)}`;
            } else {
                updateDisplay.innerText = 'Default (Pre-loaded)';
            }
        }

        const semester = localStorage.getItem('routine-pro-semester');
        if (semester && this.semesterBadge) {
            this.semesterBadge.innerText = semester;
            this.semesterBadge.classList.remove('hidden');
        } else if (this.semesterBadge) {
            this.semesterBadge.classList.add('hidden');
        }
    }

    updateRamadanStatus(count) {
        const el = document.getElementById('ramadan-slot-count');
        if (el) el.innerText = `${count || 0} Slots`;
    }

    shuffleHues() {
        this.hueSeed = Math.random();
        this.hueMap.clear();
    }

    getCourseHue(title) {
        if (!this.hueMap.has(title)) {
            const goldRatio = 0.618033988749895;
            const count = this.hueMap.size;
            const h = (this.hueSeed + count * goldRatio) % 1;
            this.hueMap.set(title, h * 360);
        }
        return this.hueMap.get(title);
    }
    toMin(s) {
        try {
            const [t, m] = s.trim().split(' ');
            let [h, min] = t.split(':').map(Number);
            if (h === 12) h = 0; if (m === 'PM') h += 12;
            return h * 60 + min;
        } catch (e) { return 0; }
    }

    renderSuggestions(suggestions) {
        const panel = document.getElementById('ai-suggestions-panel');
        const list = document.getElementById('suggestions-list');
        if (!panel || !list) return;

        if (!suggestions || suggestions.length === 0) {
            panel.classList.add('hidden');
            return;
        }

        panel.classList.remove('hidden');
        list.innerHTML = suggestions.map(s => {
            const icon = s.type === 'risk' ? 'alert-triangle' : 'zap';
            const color = s.type === 'risk' ? 'text-rose-400' : 'text-amber-400';
            const bg = s.type === 'risk' ? 'bg-rose-500/10' : 'bg-amber-500/10';

            return `
                <div class="flex items-start gap-2.5 p-2 rounded-xl ${bg} border border-white/5 transition-all hover:bg-white/[0.05]">
                    <div class="mt-0.5 shrink-0">
                        <i data-lucide="${icon}" class="w-3 h-3 ${color}"></i>
                    </div>
                    <div>
                        <p class="text-[9px] text-white font-bold leading-tight">${s.message}</p>
                        <p class="text-[8px] text-slate-400 font-medium mt-0.5">${s.action}</p>
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    }
}
