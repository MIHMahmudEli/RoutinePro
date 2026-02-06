/**
 * RoutinePro - Controller
 * Coordinates interaction between Model and View.
 */
class RoutineController {
    constructor(model, view) {
        this.model = model;
        this.view = view;

        this.init();
    }

    async init() {
        await this.model.loadInitialData();
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
            const themeBg = getComputedStyle(document.body).getPropertyValue('--bg-surface').trim() || '#0a0d14';
            const canvas = await html2canvas(el, { scale: 2, backgroundColor: themeBg });
            const link = document.createElement('a');
            link.download = `RoutinePro_${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();
        } catch (err) {
            this.view.showToast("Export failed", "error");
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

        if (isExplorerMode) {
            this.view.routineCounter.innerText = `${currentRoutineIndex + 1} / ${possibleRoutines.length}`;
            const totalGapMin = this.model.calculateGaps(possibleRoutines[currentRoutineIndex]);
            const hrs = Math.floor(totalGapMin / 60);
            const mins = totalGapMin % 60;
            this.view.gapDisplay.innerText = totalGapMin === 0 ? "No Waiting Gaps!" : `${hrs > 0 ? hrs + 'h ' : ''}${mins}m Waiting Time`;
        }

        const currentItems = isExplorerMode ? possibleRoutines[currentRoutineIndex] : selectedCourses;
        this.view.renderSidebar(selectedCourses, isExplorerMode, currentItems, (i) => this.handleRemoveCourse(i), (ci, si) => this.handleSectionChange(ci, si));
        this.view.renderRoutine(currentItems, isExplorerMode);
        this.view.totalCreditsEl.innerText = this.model.calculateCredits();
        this.view.updateSyncUI(this.model.allCourses);
    }
}
