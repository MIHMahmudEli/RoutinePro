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

        // Focus Mode
        const focusBtn = document.getElementById('focus-toggle');
        if (focusBtn) {
            focusBtn.onclick = () => {
                const currentItems = this.model.isExplorerMode ? this.model.possibleRoutines[this.model.currentRoutineIndex] : this.model.selectedCourses;

                if (!this.model.focusMode && (!currentItems || currentItems.length === 0)) {
                    this.view.showToast("Add courses first to use Focus Mode", "error");
                    return;
                }

                this.model.focusMode = !this.model.focusMode;

                // Update UI toggle state
                this.updateFocusToggleUI();
                this.syncWorkspace();
            };
        }

        // Parameters Section Toggle
        const paramsToggle = document.getElementById('params-toggle');
        const paramsContent = document.getElementById('params-content');
        const paramsChevron = document.getElementById('params-chevron');
        if (paramsToggle && paramsContent) {
            paramsToggle.onclick = () => {
                const isHidden = paramsContent.classList.toggle('hidden-params');
                if (paramsChevron) {
                    paramsChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            };
        }

        // Manual Section Toggle
        const manualToggle = document.getElementById('manual-toggle');
        const manualContent = document.getElementById('manual-content');
        const manualChevron = document.getElementById('manual-chevron');
        if (manualToggle && manualContent) {
            manualToggle.onclick = () => {
                const isHidden = manualContent.classList.toggle('hidden-params');
                if (manualChevron) {
                    manualChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            };
        }

        // Queue Section Toggle
        const queueToggle = document.getElementById('queue-toggle');
        const queueContent = document.getElementById('queue-content');
        const queueChevron = document.getElementById('queue-chevron');
        if (queueToggle && queueContent) {
            queueToggle.onclick = () => {
                const isHidden = queueContent.classList.toggle('hidden-params');
                if (queueChevron) {
                    queueChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            };
        }

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

    setSectionCollapse(sectionId, chevronId, shouldCollapse) {
        const content = document.getElementById(sectionId);
        const chevron = document.getElementById(chevronId);
        if (content) {
            if (shouldCollapse) {
                content.classList.add('hidden-params');
            } else {
                content.classList.remove('hidden-params');
            }
        }
        if (chevron) {
            chevron.style.transform = shouldCollapse ? 'rotate(180deg)' : 'rotate(0deg)';
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

            // Auto collapse queue when entering manual entry
            this.setSectionCollapse('queue-content', 'queue-chevron', true);
            // Ensure manual section is expanded
            this.setSectionCollapse('manual-content', 'manual-chevron', false);

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

            // Re-expand queue when leaving manual entry
            this.setSectionCollapse('queue-content', 'queue-chevron', false);

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
                // Ensure queue is visible to see result
                this.setSectionCollapse('queue-content', 'queue-chevron', false);
            }
        } else {
            if (this.model.addManualCourse({ subject, days, start, end, section, room })) {
                this.view.showToast(`"${subject}" added!`);
                this.resetManualForm();
                // Ensure queue is visible to see result
                this.setSectionCollapse('queue-content', 'queue-chevron', false);
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
        document.getElementById('manual-section').value = sec.section;
        document.getElementById('manual-room').value = sched.room;

        // Parse time
        const [time, period] = sched.start.split(' ');
        const [h, m] = time.split(':');
        document.getElementById('man-start-h').value = h;
        document.getElementById('man-start-m').value = m;
        document.getElementById('man-start-p').value = period;

        const [etime, eperiod] = sched.end.split(' ');
        const [eh, em] = etime.split(':');
        document.getElementById('man-end-h').value = eh;
        document.getElementById('man-end-m').value = em;
        document.getElementById('man-end-p').value = eperiod;

        // Days
        const activeDays = new Set(sec.schedules.map(s => s.day));
        document.querySelectorAll('input[name="man-day"]').forEach(cb => {
            cb.checked = activeDays.has(cb.value);
        });

        this.view.manualAddBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> SAVE UPDATES`;
        this.toggleManualMode(true);
    }

    handleSearch(e) {
        const query = e.target.value.toLowerCase().trim();
        if (query.length < 2) {
            this.view.searchSuggestions.innerHTML = '';
            this.view.searchSuggestions.classList.add('hidden');
            return;
        }

        const matches = this.model.searchCourses(query);
        this.view.renderSuggestions(matches, (course) => this.handleAddCourse(course));
    }

    handleAddCourse(course) {
        this.model.isExplorerMode = false;
        if (this.model.addCourse(course)) {
            this.view.searchInput.value = '';
            this.view.searchSuggestions.classList.add('hidden');
            this.syncWorkspace();
        }
    }

    handleGenerate() {
        const filters = {
            minS: this.model.toMin(document.getElementById('filter-start').value || "08:00 AM"),
            maxE: this.model.toMin(document.getElementById('filter-end').value || "10:00 PM"),
            maxC: parseInt(document.getElementById('filter-seats').value),
            allowedStatuses: Array.from(document.querySelectorAll('.status-check:checked')).map(cb => cb.value),
            allowedDays: Array.from(document.querySelectorAll('.day-check:checked')).map(cb => cb.value),
            sortBy: document.getElementById('filter-sort').value
        };

        const results = this.model.generateRoutines(filters);
        if (results.length === 0) {
            this.view.showToast("No schedules found with these filters!", "error");
        } else {
            this.model.isExplorerMode = true;
            this.model.currentRoutineIndex = 0;
            this.syncWorkspace();
            this.view.showToast(`Found ${results.length} possible routines!`);
        }
    }

    handleExport() {
        // Find the routine container
        const routineElement = document.getElementById('routine-actual-grid');
        if (!routineElement) return;

        this.view.showToast("Preparing download...", "info");

        // Use html2canvas to capture the element
        html2canvas(routineElement, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#0f172a", // Match your slate-900 bg
            scale: 2 // Higher resolution
        }).then(canvas => {
            const dataUrl = canvas.toDataURL('image/png');

            // Check if device is mobile
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            if (isMobile) {
                // For mobile, open image in new tab so user can long-press to save
                const newTab = window.open();
                newTab.document.write(`<img src="${dataUrl}" style="width:100%; height:auto;" />`);
                this.view.showToast("Long press the image to save to gallery", "info");
            } else {
                // Desktop download
                const link = document.createElement('a');
                link.download = `RoutinePro_${new Date().getTime()}.png`;
                link.href = dataUrl;
                link.click();
                this.view.showToast("Download started!");
            }
        }).catch(err => {
            console.error("Export failed:", err);
            this.view.showToast("Failed to generate image", "error");
        });
    }

    updateFocusToggleUI() {
        const focusBtn = document.getElementById('focus-toggle');
        if (!focusBtn) return;

        const icon = focusBtn.querySelector('i');
        if (this.model.focusMode) {
            focusBtn.classList.add('!bg-[var(--accent-primary)]', '!text-black', 'shadow-[0_0_15px_var(--accent-glow)]');
            focusBtn.classList.remove('!bg-white/10', '!text-white', 'border-white/20');
            if (icon) {
                icon.setAttribute('data-lucide', 'minimize-2');
                icon.classList.add('rotate-90');
            }
        } else {
            focusBtn.classList.remove('!bg-[var(--accent-primary)]', '!text-black', 'shadow-[0_0_15px_var(--accent-glow)]');
            focusBtn.classList.add('!bg-white/10', '!text-white', 'border-white/20');
            if (icon) {
                icon.setAttribute('data-lucide', 'maximize-2');
                icon.classList.remove('rotate-90');
            }
        }
        lucide.createIcons();
    }

    syncWorkspace() {
        const { isExplorerMode, currentRoutineIndex, possibleRoutines, selectedCourses } = this.model;

        this.view.explorerNav.classList.toggle('hidden', !isExplorerMode);
        this.view.explorerNav.classList.toggle('flex', isExplorerMode);

        // Always show gap/waiting time in header
        const currentItems = isExplorerMode ? possibleRoutines[currentRoutineIndex] : selectedCourses;

        // Auto-disable Focus Mode if no courses exist
        if (this.model.focusMode && (!currentItems || currentItems.length === 0)) {
            this.model.focusMode = false;
            this.updateFocusToggleUI();
        }

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
        this.view.renderRoutine(currentItems, isExplorerMode, this.model.focusMode);
        lucide.createIcons(); // Ensure all icons are updated, including some with custom stroke if added
        this.view.totalCreditsEl.innerText = this.model.calculateCredits();
        this.view.updateSyncUI(this.model.allCourses);
    }
}
