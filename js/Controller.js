/**
 * RoutinePro - Controller
 * Coordinates interaction between Model and View.
 */
class RoutineController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.editingIndex = null;

        this.init();
    }

    async init() {
        await this.model.loadInitialData();
        this.view.populateTimeFilters();
        this.view.updateSyncUI(this.model.allCourses);
        this.setupEventListeners();
        this.syncWorkspace();
    }

    setupEventListeners() {
        // Theme
        window.setTheme = (theme) => {
            document.body.setAttribute('data-theme', theme);
            localStorage.setItem('routine-pro-theme', theme);
            this.syncWorkspace();
        };

        // Search
        this.view.searchInput.oninput = (e) => this.handleSearch(e);

        // Sidebar Actions (delegated through View)
        this.handleRemoveCourse = (idx) => {
            this.model.isExplorerMode = false;
            this.model.removeCourse(idx);
            this.syncWorkspace();
        };

        this.handleSectionChange = (cIdx, sIdx) => {
            this.model.isExplorerMode = false;
            this.model.updateSectionSelection(cIdx, parseInt(sIdx));
            this.syncWorkspace();
        };

        // Generation
        this.view.generateAllBtn.onclick = () => this.handleGenerate();

        // Explorer Nav
        document.getElementById('prev-routine').onclick = () => {
            if (this.model.currentRoutineIndex > 0) {
                this.model.currentRoutineIndex--;
                this.syncWorkspace();
            }
        };
        document.getElementById('next-routine').onclick = () => {
            if (this.model.currentRoutineIndex < this.model.possibleRoutines.length - 1) {
                this.model.currentRoutineIndex++;
                this.syncWorkspace();
            }
        };
        document.getElementById('exit-explorer').onclick = () => {
            this.model.isExplorerMode = false;
            this.syncWorkspace();
        };

        // Export
        this.view.exportBtn.onclick = () => this.handleExport();

        // Slider
        const filterSeats = document.getElementById('filter-seats');
        const seatValDisplay = document.getElementById('seat-val');
        const sliderFill = document.getElementById('slider-fill');
        if (filterSeats) {
            filterSeats.oninput = (e) => {
                seatValDisplay.innerText = e.target.value;
                if (sliderFill) sliderFill.style.width = `${e.target.value}%`;
            };
        }

        // File Upload
        const fileInput = document.getElementById('course-file-input');
        if (fileInput) {
            fileInput.onchange = (e) => this.handleFileUpload(e);
        }

        // Manual Entry
        if (this.view.manualAddBtn) {
            this.view.manualAddBtn.onclick = () => this.handleAddManual();
        }

        const btnToggleManual = document.getElementById('toggle-manual-mode');
        const btnBackSmart = document.getElementById('back-to-smart');

        if (btnToggleManual) {
            btnToggleManual.onclick = () => this.toggleManualMode(true);
        }
        if (btnBackSmart) {
            btnBackSmart.onclick = () => this.toggleManualMode(false);
        }

        // UX Improvements: Clear Button
        const btnClearManual = document.getElementById('clear-manual-btn');
        if (btnClearManual) {
            btnClearManual.onclick = () => this.resetManualForm();
        }

        // UX Improvements: Enter key submission
        ['manual-subject', 'manual-section', 'manual-room'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') this.handleAddManual();
                });
            }
        });

        // UX Improvements: Smart Time End suggest
        const startSelect = document.getElementById('manual-start');
        const endSelect = document.getElementById('manual-end');
        if (startSelect && endSelect) {
            startSelect.addEventListener('change', () => {
                const startMin = this.model.toMin(startSelect.value);
                const endMin = this.model.toMin(endSelect.value);
                if (endMin <= startMin) {
                    // Try to suggest +90 mins
                    const suggestMin = startMin + 90;
                    // Find closest available option
                    let bestIdx = 0;
                    let minDiff = Infinity;
                    for (let i = 0; i < endSelect.options.length; i++) {
                        const optMin = this.model.toMin(endSelect.options[i].value);
                        const diff = Math.abs(optMin - suggestMin);
                        if (diff < minDiff) {
                            minDiff = diff;
                            bestIdx = i;
                        }
                    }
                    endSelect.selectedIndex = bestIdx;
                }
            });
        }
    }

    toggleManualMode(show) {
        const manualSection = document.getElementById('manual-entry-section');
        const paramsSection = document.getElementById('parameters-section');
        const btnToggleManual = document.getElementById('toggle-manual-mode');

        if (show) {
            manualSection.classList.remove('hidden');
            paramsSection.classList.add('hidden');
            btnToggleManual.classList.add('hidden');
            if (this.editingIndex !== null) {
                manualSection.classList.add('ring-2', 'ring-emerald-500/50', 'ring-offset-4', 'ring-offset-slate-900');
            } else {
                manualSection.classList.remove('ring-2', 'ring-emerald-500/50', 'ring-offset-4', 'ring-offset-slate-900');
            }
            document.getElementById('manual-subject').focus();
        } else {
            manualSection.classList.add('hidden');
            paramsSection.classList.remove('hidden');
            btnToggleManual.classList.remove('hidden');
            this.resetManualForm();
        }
        lucide.createIcons();
    }

    resetManualForm() {
        this.editingIndex = null;
        document.getElementById('manual-subject').value = '';
        document.getElementById('manual-section').value = '';
        document.getElementById('manual-room').value = '';
        document.querySelectorAll('input[name="man-day"]').forEach((cb, i) => cb.checked = i === 0);
        this.view.manualAddBtn.innerHTML = `<i data-lucide="plus-circle" class="w-4 h-4"></i> ADD TO ROUTINE`;
        document.getElementById('manual-entry-section').classList.remove('ring-2', 'ring-emerald-500/50', 'ring-offset-4', 'ring-offset-slate-900');
        lucide.createIcons();
    }

    handleAddManual() {
        const subject = document.getElementById('manual-subject').value.trim();
        const days = Array.from(document.querySelectorAll('input[name="man-day"]:checked')).map(cb => cb.value);
        const start = document.getElementById('manual-start').value;
        const end = document.getElementById('manual-end').value;
        const section = document.getElementById('manual-section').value.trim();
        const room = document.getElementById('manual-room').value.trim();

        if (!subject || days.length === 0 || !start || !end) {
            return this.view.showToast("Subject, at least one Day, and Times are required!", "error");
        }

        if (this.model.toMin(start) >= this.model.toMin(end)) {
            return this.view.showToast("Start time must be before end time!", "error");
        }

        this.model.isExplorerMode = false;

        if (this.editingIndex !== null) {
            if (this.model.updateManualCourse(this.editingIndex, { subject, days, start, end, section, room })) {
                this.view.showToast("Updates saved!");
                this.resetManualForm();
            }
        } else {
            if (this.model.addManualCourse({ subject, days, start, end, section, room })) {
                this.view.showToast(`"${subject}" added!`);
                this.resetManualForm();
            }
        }

        document.getElementById('manual-subject').focus();
        this.syncWorkspace();
    }

    handleEditManual(idx) {
        const item = this.model.selectedCourses[idx];
        if (!item || item.course.code !== 'MANUAL') return;

        this.editingIndex = parseInt(idx);
        const course = item.course;
        const sec = course.sections[0];
        const sched = sec.schedules[0];

        // Populate fields
        document.getElementById('manual-subject').value = course.baseTitle;
        document.getElementById('manual-section').value = sec.section || '';
        document.getElementById('manual-room').value = sched.room || '';
        document.getElementById('manual-start').value = sched.start;
        document.getElementById('manual-end').value = sched.end;

        // Select days
        const selectedDays = sec.schedules.map(s => s.day);
        document.querySelectorAll('input[name="man-day"]').forEach(cb => {
            cb.checked = selectedDays.includes(cb.value);
        });

        // Visual update
        this.view.manualAddBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> SAVE CHANGES`;
        this.toggleManualMode(true);
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const btn = this.view.syncModal.querySelector('.prism-btn');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> PROCESSING...`;
        lucide.createIcons();

        try {
            const semesterInput = document.getElementById('semester-input');
            const targetSemester = semesterInput?.value || 'Updated Semester';

            if (file.name.endsWith('.json')) {
                const text = await file.text();
                const data = JSON.parse(text);
                this.model.saveCourses(data, targetSemester);
                this.view.showToast(`${data.length} courses loaded from ${file.name}`);
            } else if (file.name.endsWith('.xlsx')) {
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    const dataArr = new Uint8Array(evt.target.result);
                    const wb = XLSX.read(dataArr, { type: 'array' });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                    // Auto-detect semester
                    let detectedSemester = "";
                    const headerPeek = JSON.stringify(data.slice(0, 10)).toUpperCase();
                    const wsUpper = wsname.toUpperCase();
                    const combinedSearch = wsUpper + " " + headerPeek;

                    if (combinedSearch.includes('SPRING') || combinedSearch.includes('SPRI')) detectedSemester = 'SPRING';
                    else if (combinedSearch.includes('FALL') || combinedSearch.includes('FAL')) detectedSemester = 'FALL';
                    else if (combinedSearch.includes('SUMMER') || combinedSearch.includes('SUMM')) detectedSemester = 'SUMMER';

                    const yearMatch = combinedSearch.match(/\d{4}-\d{2,4}/);
                    if (yearMatch && detectedSemester) detectedSemester += ` ${yearMatch[0]}`;
                    else if (yearMatch && !detectedSemester) detectedSemester = yearMatch[0];

                    const finalSemester = detectedSemester || targetSemester || 'Updated Semester';
                    const courses = this.model.parseExcelData(data);

                    this.model.saveCourses(courses, finalSemester);
                    if (semesterInput) semesterInput.value = finalSemester;
                    this.view.showToast(`${courses.length} courses loaded from ${file.name}`);
                    this.syncWorkspace();
                };
                reader.readAsArrayBuffer(file);
            }
        } catch (err) {
            console.error(err);
            this.view.showToast("Failed to process file.", "error");
        } finally {
            setTimeout(() => {
                btn.disabled = false;
                btn.innerText = originalText;
                lucide.createIcons();
                this.view.syncModal.classList.add('hidden');
            }, 1500);
        }
    }

    handleSearch(e) {
        const q = e.target.value.toLowerCase().trim();
        if (q.length < 2) { this.view.suggestions.classList.add('hidden'); return; }

        const results = this.model.allCourses.filter(c =>
            c.baseTitle.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q))
        ).slice(0, 15);

        if (results.length > 0) {
            this.view.suggestions.innerHTML = results.map(c => `
                <div class="p-4 hover:bg-emerald-500/5 cursor-pointer border-b border-white/5 group transition-colors" onclick="app.controller.handleAddCourse('${c.baseTitle.replace(/'/g, "\\'")}', '${c.code}')">
                    <div class="flex justify-between items-center text-sm font-bold group-hover:text-emerald-400 uppercase">${c.baseTitle}</div>
                </div>
            `).join('');
            this.view.suggestions.classList.remove('hidden');
        } else {
            this.view.suggestions.classList.add('hidden');
        }
    }

    handleAddCourse(title, code) {
        this.model.isExplorerMode = false;
        const course = this.model.allCourses.find(c => c.baseTitle === title && c.code === code);
        if (course && this.model.addCourse(course)) {
            this.view.searchInput.value = '';
            this.view.suggestions.classList.add('hidden');
            this.syncWorkspace();
        } else {
            this.view.showToast("Course already added or not found", "error");
        }
    }

    handleGenerate() {
        if (this.model.selectedCourses.length < 1) return this.view.showToast("Select courses first.", "error");

        const filters = {
            minS: parseInt(document.getElementById('filter-start').value),
            maxE: parseInt(document.getElementById('filter-end').value),
            maxC: parseInt(document.getElementById('filter-seats').value),
            sortBy: document.getElementById('filter-sort').value,
            allowedStatuses: Array.from(document.querySelectorAll('.status-check:checked')).map(el => el.value.toLowerCase().trim()),
            allowedDays: Array.from(document.querySelectorAll('.day-check:checked')).map(el => el.value.substring(0, 3).toLowerCase())
        };

        const results = this.model.generateRoutines(filters);
        if (results.length === 0) return this.view.showToast("No valid scenarios found.", "error");

        this.model.isExplorerMode = true;
        this.model.currentRoutineIndex = 0;
        this.view.showToast(`Found ${results.length} scenarios!`);
        this.syncWorkspace();
        this.view.explorerNav.scrollIntoView({ behavior: 'smooth' });
    }

    async handleExport() {
        const el = document.getElementById('routine-actual-grid');
        const originalHTML = this.view.exportBtn.innerHTML;
        this.view.exportBtn.disabled = true;
        this.view.exportBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> GENERATING...`;
        lucide.createIcons();

        try {
            // Get proper background color and ensure it's not transparent
            const style = getComputedStyle(document.body);
            const themeBg = style.getPropertyValue('--bg-surface').trim() || '#0a0d14';

            const canvas = await html2canvas(el, {
                scale: window.innerWidth < 768 ? 1.5 : 2, // Slightly lower scale on mobile for memory
                backgroundColor: themeBg,
                useCORS: true,
                allowTaint: true,
                logging: false,
                onclone: (clonedDoc) => {
                    // Fix the -4px/-6px alignment shift in the exported image
                    const labels = clonedDoc.querySelectorAll('.time-label');
                    const isMob = window.innerWidth < 768;
                    labels.forEach(l => {
                        // On mobile we use 50px scale, desktop 70px. 
                        // html2canvas needs different offset than browser sometimes
                        l.style.position = 'relative';
                        l.style.top = isMob ? '-2px' : '-4px';
                        l.style.display = 'flex';
                        l.style.alignItems = 'flex-start';
                        l.style.height = isMob ? '50px' : '70px';
                    });
                }
            });

            // Conversion to PNG
            const dataUrl = canvas.toDataURL('image/png');

            // For mobile, we sometimes need a direct blob or open in new tab
            if (/Android|WebOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                // On mobile, opening in new window is often most reliable
                // The user can then long-press to save
                const newWindow = window.open();
                if (newWindow) {
                    newWindow.document.write(`<img src="${dataUrl}" style="max-width:100%;">`);
                    this.view.showToast("Image opened! Long-press to save.", "success");
                } else {
                    // If popup blocked, try regular download
                    const link = document.createElement('a');
                    link.download = `RoutinePro_${Date.now()}.png`;
                    link.href = dataUrl;
                    link.click();
                }
            } else {
                // Desktop regular download
                const link = document.createElement('a');
                link.download = `RoutinePro_${Date.now()}.png`;
                link.href = dataUrl;
                link.click();
            }
        } catch (err) {
            this.view.showToast("Export failed. Try a desktop", "error");
            console.error(err);
        } finally {
            this.view.exportBtn.disabled = false;
            this.view.exportBtn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    syncWorkspace() {
        const { isExplorerMode, currentRoutineIndex, possibleRoutines, selectedCourses } = this.model;

        this.view.explorerNav.classList.toggle('hidden', !isExplorerMode);
        this.view.explorerNav.classList.toggle('flex', isExplorerMode);

        // Always show gap/waiting time in header
        const currentItems = isExplorerMode ? possibleRoutines[currentRoutineIndex] : selectedCourses;
        const totalGapMin = this.model.calculateGaps(currentItems);
        this.view.headerGapDisplay.innerText = this.view.formatGap(totalGapMin);

        if (isExplorerMode) {
            this.view.routineCounter.innerText = `${currentRoutineIndex + 1} / ${possibleRoutines.length}`;
            this.view.gapDisplay.innerText = totalGapMin === 0 ? "No Waiting Gaps!" : `${this.view.formatGap(totalGapMin)} Waiting Time`;
        }

        this.view.renderSidebar(selectedCourses, isExplorerMode, currentItems, (i) => this.handleRemoveCourse(i), (ci, si) => this.handleSectionChange(ci, si), (i) => this.handleEditManual(i));
        this.view.renderRoutine(currentItems, isExplorerMode);
        this.view.totalCreditsEl.innerText = this.model.calculateCredits();
        this.view.updateSyncUI(this.model.allCourses);
    }
}
