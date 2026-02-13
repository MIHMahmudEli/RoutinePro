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
        // Theme Management
        window.setTheme = (theme, customColor = null) => {
            const root = document.body;

            // Clear active states
            document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
            const pickerContainer = document.querySelector('#custom-theme-picker')?.parentElement;
            pickerContainer?.classList.remove('ring-2', 'ring-white');

            // Remove inline overrides first
            // Remove inline overrides first
            ['--accent-primary', '--accent-secondary', '--accent-glow', '--bg-base', '--bg-surface'].forEach(v => root.style.removeProperty(v));

            if (theme === 'custom' && customColor) {
                // Helper for RGBA
                const hexToRgba = (hex, alpha) => {
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };

                // Apply custom variables
                root.style.setProperty('--accent-primary', customColor);
                root.style.setProperty('--accent-secondary', customColor); // Unified for custom
                root.style.setProperty('--accent-glow', hexToRgba(customColor, 0.15));

                // Mix custom color with black for base/surface to ensure visibility
                const mixWithBlack = (hex, amount) => {
                    const r = parseInt(hex.slice(1, 3), 16) * amount;
                    const g = parseInt(hex.slice(3, 5), 16) * amount;
                    const b = parseInt(hex.slice(5, 7), 16) * amount;
                    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
                };

                // Dynamic Background Tint based on custom color (very dark)
                root.style.setProperty('--bg-base', mixWithBlack(customColor, 0.08));
                root.style.setProperty('--bg-surface', mixWithBlack(customColor, 0.15));
                root.style.setProperty('--border-glass', hexToRgba(customColor, 0.2));

                root.removeAttribute('data-theme'); // Fallback to root (default dark) base

                localStorage.setItem('routine-pro-theme', 'custom');
                localStorage.setItem('routine-pro-custom-color', customColor);

                if (pickerContainer) pickerContainer.classList.add('ring-2', 'ring-white');
            } else {
                root.setAttribute('data-theme', theme);
                localStorage.setItem('routine-pro-theme', theme);

                const btn = document.querySelector(`button[onclick="setTheme('${theme}')"]`);
                if (btn) btn.classList.add('active');
            }
            this.syncWorkspace();
        };

        // Initialize Saved Theme
        const savedTheme = localStorage.getItem('routine-pro-theme') || 'default';
        const savedColor = localStorage.getItem('routine-pro-custom-color');

        if (savedTheme === 'custom' && savedColor) {
            window.setTheme('custom', savedColor);
            const picker = document.getElementById('custom-theme-picker');
            if (picker) picker.value = savedColor;
        } else {
            window.setTheme(savedTheme);
        }

        // Custom Picker Listener
        const colorPicker = document.getElementById('custom-theme-picker');
        if (colorPicker) {
            colorPicker.addEventListener('input', (e) => {
                window.setTheme('custom', e.target.value);
            });
        }

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

        // Zoom Sliders (Sync between Manual and Parameters)
        const routineZoom = document.getElementById('routine-zoom');
        const routineZoomManual = document.getElementById('routine-zoom-manual');
        const zoomValDisplay = document.getElementById('zoom-val');
        const zoomValManualDisplay = document.getElementById('zoom-val-manual');
        const zoomSliderFill = document.getElementById('zoom-slider-fill');
        const zoomSliderFillManual = document.getElementById('zoom-slider-fill-manual');

        const updateZoom = (val) => {
            // Update UI Labels
            if (zoomValDisplay) zoomValDisplay.innerText = val;
            if (zoomValManualDisplay) zoomValManualDisplay.innerText = val;

            // Update Sliders
            if (routineZoom) routineZoom.value = val;
            if (routineZoomManual) routineZoomManual.value = val;

            // Update Fill Bars
            const pct = ((val - 40) / (120 - 40)) * 100;
            if (zoomSliderFill) zoomSliderFill.style.width = `${pct}%`;
            if (zoomSliderFillManual) zoomSliderFillManual.style.width = `${pct}%`;

            // Update CSS Variables
            document.documentElement.style.setProperty('--row-height', `${val}px`);
            document.documentElement.style.setProperty('--routine-scale', val / 60);

            // Re-render
            this.syncWorkspace();
        };

        if (routineZoom) routineZoom.oninput = (e) => updateZoom(e.target.value);
        if (routineZoomManual) routineZoomManual.oninput = (e) => updateZoom(e.target.value);

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
        ['man-start-h', 'man-start-m', 'man-start-p'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    const sh = document.getElementById('man-start-h').value;
                    const sm = document.getElementById('man-start-m').value;
                    const sp = document.getElementById('man-start-p').value;
                    const eh = document.getElementById('man-end-h').value;
                    const em = document.getElementById('man-end-m').value;
                    const ep = document.getElementById('man-end-p').value;

                    const startMin = this.model.toMin(`${sh}:${sm} ${sp}`);
                    const endMin = this.model.toMin(`${eh}:${em} ${ep}`);

                    if (endMin <= startMin) {
                        // Suggest +90 mins
                        let sugMin = startMin + 90;
                        if (sugMin >= 1440) sugMin -= 1440; // Wrap day

                        let h = Math.floor(sugMin / 60);
                        const m = sugMin % 60;
                        const p = h >= 12 ? 'PM' : 'AM';
                        h = h % 12 || 12;

                        document.getElementById('man-end-h').value = String(h).padStart(2, '0');
                        document.getElementById('man-end-m').value = String(Math.round(m / 5) * 5).padStart(2, '0').replace('60', '55');
                        document.getElementById('man-end-p').value = p;
                    }
                });
            }
        });

        // Time Input Formatting (Clamp & Pad)
        const formatTimeInput = (el, max) => {
            let v = parseInt(el.value);
            if (isNaN(v)) return; // Don't wipe if empty yet or partial
            if (v < 0) v = 0;
            if (v > max) v = max;
            // Special case for hours 1-12
            if (max === 12 && v === 0) v = 1;

            el.value = String(v).padStart(2, '0');
            el.dispatchEvent(new Event('change', { bubbles: true })); // Trigger smart suggest
        };

        ['man-start-h', 'man-end-h'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('blur', () => formatTimeInput(el, 12));
                // Datalist selection triggers input/change
                el.addEventListener('input', (e) => {
                    if (e.inputType === 'insertReplacementText' || !e.inputType) {
                        // Likely datalist selection
                        formatTimeInput(el, 12);
                    }
                });
            }
        });

        ['man-start-m', 'man-end-m'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('blur', () => formatTimeInput(el, 59));
                el.addEventListener('input', (e) => {
                    if (e.inputType === 'insertReplacementText' || !e.inputType) {
                        formatTimeInput(el, 59);
                    }
                });
            }
        });
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

        // Reset time selects to defaults
        document.getElementById('man-start-h').value = '08';
        document.getElementById('man-start-m').value = '00';
        document.getElementById('man-start-p').value = 'AM';
        document.getElementById('man-end-h').value = '09';
        document.getElementById('man-end-m').value = '30';
        document.getElementById('man-end-p').value = 'AM';

        document.querySelectorAll('input[name="man-day"]').forEach((cb, i) => cb.checked = i === 0);
        this.view.manualAddBtn.innerHTML = `<i data-lucide="plus-circle" class="w-4 h-4"></i> ADD TO ROUTINE`;
        document.getElementById('manual-entry-section').classList.remove('ring-2', 'ring-emerald-500/50', 'ring-offset-4', 'ring-offset-slate-900');
        lucide.createIcons();
    }



    handleAddManual() {
        const subject = document.getElementById('manual-subject').value.trim();
        const days = Array.from(document.querySelectorAll('input[name="man-day"]:checked')).map(cb => cb.value);
        const section = document.getElementById('manual-section').value.trim();
        const room = document.getElementById('manual-room').value.trim();

        // Get time components
        const sh = document.getElementById('man-start-h').value;
        const sm = document.getElementById('man-start-m').value;
        const sp = document.getElementById('man-start-p').value;
        const eh = document.getElementById('man-end-h').value;
        const em = document.getElementById('man-end-m').value;
        const ep = document.getElementById('man-end-p').value;

        if (!subject || days.length === 0) {
            return this.view.showToast("Subject and at least one Day are required!", "error");
        }

        const start = `${sh}:${sm} ${sp}`;
        const end = `${eh}:${em} ${ep}`;

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

        // Split and set start time
        const [st, sp] = sched.start.split(' ');
        const [sh, sm] = st.split(':');
        document.getElementById('man-start-h').value = sh;
        document.getElementById('man-start-m').value = sm;
        document.getElementById('man-start-p').value = sp;

        // Split and set end time
        const [et, ep] = sched.end.split(' ');
        const [eh, em] = et.split(':');
        document.getElementById('man-end-h').value = eh;
        document.getElementById('man-end-m').value = em;
        document.getElementById('man-end-p').value = ep;

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
        this.view.exportBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>`;
        lucide.createIcons();

        try {
            // Get proper background color and ensure it's not transparent
            const style = getComputedStyle(document.body);
            const themeBg = style.getPropertyValue('--bg-surface').trim() || '#0a0d14';

            const canvas = await html2canvas(el, {
                scale: 3, // High resolution for crisp mobile/desktop exports
                backgroundColor: themeBg,
                useCORS: true,
                allowTaint: true,
                logging: false,
                onclone: (clonedDoc) => {
                    // Fix the -4px/-6px alignment shift in the exported image
                    const labels = clonedDoc.querySelectorAll('.time-label');
                    const isMob = window.innerWidth < 768;
                    labels.forEach(l => {
                        const actualHeight = getComputedStyle(document.documentElement).getPropertyValue('--row-height');
                        l.style.position = 'relative';
                        l.style.display = 'flex';
                        l.style.alignItems = 'flex-start';
                        l.style.height = actualHeight;
                    });
                }
            });

            // Conversion to PNG
            const dataUrl = canvas.toDataURL('image/png');

            // For mobile, we sometimes need a direct blob or open in new tab
            // Mobile Download Strategy
            if (/Android|WebOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                // Try direct download first (modern mobile browsers)
                try {
                    const link = document.createElement('a');
                    link.download = `RoutinePro_${Date.now()}.png`;
                    link.href = dataUrl;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    this.view.showToast("Downloading Routine...", "success");
                } catch (e) {
                    // Fallback to new window if direct download is blocked
                    const newWindow = window.open();
                    if (newWindow) {
                        newWindow.document.write(`<img src="${dataUrl}" style="max-width:100%;">`);
                        this.view.showToast("Long-press image to save", "success");
                    } else {
                        window.location.href = dataUrl; // Last resort
                    }
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

        this.view.renderSidebar(
            selectedCourses,
            isExplorerMode,
            currentItems,
            (i) => this.handleRemoveCourse(i),
            (ci, si) => this.handleSectionChange(ci, si),
            (i) => this.handleEditManual(i),
            (i) => {
                if (isExplorerMode) {
                    // Apply the current explorer section to the main list before pinning
                    const explorerSection = currentItems.find(item => item.courseTitle === selectedCourses[i].course.baseTitle).section;
                    const sectionIdx = selectedCourses[i].course.sections.findIndex(s => s.section === explorerSection.section);
                    if (sectionIdx !== -1) {
                        this.model.updateSectionSelection(i, sectionIdx);
                    }
                }
                this.model.togglePin(i);
                this.syncWorkspace();
            }
        );
        this.view.renderRoutine(currentItems, isExplorerMode);
        lucide.createIcons(); // Ensure all icons are updated, including some with custom stroke if added
        this.view.totalCreditsEl.innerText = this.model.calculateCredits();
        this.view.updateSyncUI(this.model.allCourses);
    }
}
