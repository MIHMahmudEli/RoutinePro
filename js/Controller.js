/**
 * RoutinePro - Controller
 * Coordinates interaction between Model and View.
 */
class RoutineController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.editingIndex = null;

        this.currentThemeSet = 1;
        this.init();
    }

    async init() {
        await this.model.loadInitialData();
        this.view.populateTimeFilters();
        this.view.updateSyncUI(this.model.allCourses);
        this.setupEventListeners();
        this.syncWorkspace();

        // Reveal Admin Features if ?admin=true
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('admin') === 'true') {
            const syncBtn = document.getElementById('ramadan-sync-btn');
            if (syncBtn) syncBtn.classList.remove('hidden');

            const featureToggle = document.getElementById('admin-ramadan-feature-toggle');
            if (featureToggle) {
                // Initialize toggle from Model (which now checks localStorage)
                featureToggle.checked = this.model.ramadanFeatureEnabled;

                featureToggle.onchange = (e) => {
                    this.model.ramadanFeatureEnabled = e.target.checked;
                    // Save locally so it persists after refresh for the admin
                    localStorage.setItem('routine-pro-ramadan-admin-feature', e.target.checked);

                    this.view.showToast(`Ramadan Feature ${e.target.checked ? 'Enabled' : 'Disabled'} Locally (Push JSON to go Global)`, "info");
                    this.syncWorkspace();
                };
            }
        }

        // Global Ramadan Visibility
        const ramadanToggle = document.getElementById('ramadan-toggle');
        if (ramadanToggle) {
            ramadanToggle.classList.toggle('hidden', !this.model.ramadanFeatureEnabled);
        }

        // Initialize Theme Sets Logic
        window.cycleThemeSet = () => {
            this.currentThemeSet = (this.currentThemeSet % 3) + 1;
            this.updateThemeSetDisplay();
        };

        this.updateThemeSetDisplay = () => {
            document.querySelectorAll('.theme-group').forEach((group, idx) => {
                group.classList.toggle('hidden', (idx + 1) !== this.currentThemeSet);
            });
            lucide.createIcons();
        };

        // Auto-show group with active theme
        const savedTheme = localStorage.getItem('routine-pro-theme') || 'default';
        if (['nebula', 'crimson', 'ocean'].includes(savedTheme)) this.currentThemeSet = 2;
        else if (['sandstone', 'spectrum', 'custom'].includes(savedTheme)) this.currentThemeSet = 3;
        this.updateThemeSetDisplay();
    }

    setupEventListeners() {
        // Theme Management
        window.setTheme = (theme, customColor = null) => {
            const root = document.body;

            // Clear active states
            document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
            const pickerContainer = document.querySelector('#custom-theme-picker')?.parentElement;

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

                if (pickerContainer) {
                    const btn = pickerContainer.querySelector('.theme-btn');
                    if (btn) btn.classList.add('active');
                    const icon = pickerContainer.querySelector('i');
                    if (icon) {
                        icon.style.color = customColor;
                        icon.classList.remove('text-slate-400');
                    }
                }
            } else {
                root.setAttribute('data-theme', theme);
                localStorage.setItem('routine-pro-theme', theme);

                // Update Active State Visuals
                document.querySelectorAll('.theme-btn').forEach(btn => {
                    const onclick = btn.getAttribute('onclick');
                    const isMatch = onclick ? onclick.includes(`'${theme}'`) : false;
                    btn.classList.toggle('active', isMatch);
                });

                // Reset Palette icon
                const pickerContainer = document.querySelector('#custom-theme-picker')?.parentElement;
                if (pickerContainer) {
                    const icon = pickerContainer.querySelector('i');
                    if (icon) {
                        icon.style.removeProperty('color');
                        icon.classList.add('text-slate-400');
                    }
                }
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

        // Custom Picker Listener (Debounced for performance)
        const colorPicker = document.getElementById('custom-theme-picker');
        let colorPickerTimer;
        if (colorPicker) {
            colorPicker.addEventListener('input', (e) => {
                const color = e.target.value;

                // 1. Instant variable update for smooth visual feedback
                document.body.style.setProperty('--accent-primary', color);
                document.body.style.setProperty('--accent-glow', `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.15)`);

                // 2. Debounce the heavy full state sync
                clearTimeout(colorPickerTimer);
                colorPickerTimer = setTimeout(() => {
                    window.setTheme('custom', color);
                }, 50); // 50ms is enough to feel instant but batch redundant calls
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
                    this.view.showToast("Please select at least one course first!", "error");
                    return;
                }

                this.model.focusMode = !this.model.focusMode;

                // Disable 24h mode if focus is enabled
                if (this.model.focusMode) {
                    this.model.twentyFourHourMode = false;
                    this.updateTwentyFourToggleUI();
                }

                // Update UI toggle state
                this.updateFocusToggleUI();
                const status = this.model.focusMode ? "Enabled" : "Disabled";
                const type = this.model.focusMode ? "success" : "info";
                this.view.showToast(`Focus Mode ${status}`, type);

                // Track Analytics
                window.analytics.trackFeatureToggle('focus_mode', this.model.focusMode);

                this.syncWorkspace();
            };
        }

        // 24-Hour Mode
        const twentyFourBtn = document.getElementById('twenty-four-toggle');
        if (twentyFourBtn) {
            twentyFourBtn.onclick = () => {
                this.model.twentyFourHourMode = !this.model.twentyFourHourMode;

                // If 24h mode is enabled, disable focus mode for a clear view
                if (this.model.twentyFourHourMode) {
                    this.model.focusMode = false;
                    this.updateFocusToggleUI();
                }

                this.updateTwentyFourToggleUI();
                const status = this.model.twentyFourHourMode ? "Enabled" : "Disabled";
                const type = this.model.twentyFourHourMode ? "success" : "info";
                this.view.showToast(`24-Hour Mode ${status}`, type);

                // Track Analytics
                window.analytics.trackFeatureToggle('24h_mode', this.model.twentyFourHourMode);

                this.syncWorkspace();
            };
        }

        // Initialize Modes from local storage
        const savedRamadan = localStorage.getItem('routine-pro-ramadan') === 'true';
        if (savedRamadan) {
            this.model.ramadanMode = true;
            this.updateRamadanToggleUI();
        }

        // Ramadan Mode
        const ramadanBtn = document.getElementById('ramadan-toggle');
        if (ramadanBtn) {
            ramadanBtn.onclick = () => {
                this.model.ramadanMode = !this.model.ramadanMode;
                localStorage.setItem('routine-pro-ramadan', this.model.ramadanMode);
                this.updateRamadanToggleUI();
                const status = this.model.ramadanMode ? "Enabled" : "Disabled";
                const type = this.model.ramadanMode ? "success" : "info";
                this.view.showToast(`Ramadan Mode ${status}`, type);

                window.analytics.trackFeatureToggle('ramadan_mode', this.model.ramadanMode);
                this.syncWorkspace();
            };
        }

        // Ramadan Sync Modal Logic
        const ramadanUpload = document.getElementById('ramadan-pdf-upload');
        const processRamadanBtn = document.getElementById('process-ramadan-btn');
        if (ramadanUpload) {
            ramadanUpload.onchange = (e) => this.handleRamadanUpload(e);
        }
        if (processRamadanBtn) {
            processRamadanBtn.onclick = () => ramadanUpload && ramadanUpload.click();
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
                const val = e.target.value;
                seatValDisplay.innerText = val;
                if (sliderFill) {
                    const pct = val; // 0-100 range
                    sliderFill.style.width = `calc(${pct}% + ${(0.5 - pct / 100) * 20}px)`;
                }
            };
        }

        // Zoom Sliders (Sync between Manual, Parameters, and Focus sections)
        const routineZoom = document.getElementById('routine-zoom');
        const routineZoomManual = document.getElementById('routine-zoom-manual');
        const routineZoomFocus = document.getElementById('routine-zoom-focus');
        const zoomValDisplay = document.getElementById('zoom-val');
        const zoomValManualDisplay = document.getElementById('zoom-val-manual');
        const zoomValFocusDisplay = document.getElementById('zoom-val-focus');
        const zoomSliderFill = document.getElementById('zoom-slider-fill');
        const zoomSliderFillManual = document.getElementById('zoom-slider-fill-manual');
        const zoomSliderFillFocus = document.getElementById('zoom-slider-fill-focus');

        const updateZoom = (val) => {
            // Update UI Labels
            if (zoomValDisplay) zoomValDisplay.innerText = val;
            if (zoomValManualDisplay) zoomValManualDisplay.innerText = val;
            if (zoomValFocusDisplay) zoomValFocusDisplay.innerText = val;

            // Update Sliders
            if (routineZoom) routineZoom.value = val;
            if (routineZoomManual) routineZoomManual.value = val;
            if (routineZoomFocus) routineZoomFocus.value = val;

            // Update Fill Bars
            const pct = ((val - 40) / (150 - 40)) * 100;
            const fillWidth = `calc(${pct}% + ${(0.5 - pct / 100) * 20}px)`;
            if (zoomSliderFill) zoomSliderFill.style.width = fillWidth;
            if (zoomSliderFillManual) zoomSliderFillManual.style.width = fillWidth;
            if (zoomSliderFillFocus) zoomSliderFillFocus.style.width = fillWidth;

            // Update CSS Variables
            document.documentElement.style.setProperty('--row-height', `${val}px`);
            document.documentElement.style.setProperty('--routine-scale', val / 60);

            // Re-render
            this.syncWorkspace();
        };

        if (routineZoom) routineZoom.oninput = (e) => updateZoom(e.target.value);
        if (routineZoomManual) routineZoomManual.oninput = (e) => updateZoom(e.target.value);
        if (routineZoomFocus) routineZoomFocus.oninput = (e) => updateZoom(e.target.value);

        // Width Zoom Control
        const routineWidthFocus = document.getElementById('routine-width-focus');
        const widthValFocusDisplay = document.getElementById('width-val-focus');
        const widthSliderFillFocus = document.getElementById('width-slider-fill-focus');

        const updateWidth = (val) => {
            if (widthValFocusDisplay) widthValFocusDisplay.innerText = val;
            const pct = ((val - 50) / (100 - 50)) * 100;
            if (widthSliderFillFocus) widthSliderFillFocus.style.width = `calc(${pct}% + ${(0.5 - pct / 100) * 20}px)`;

            // Apply Width Change
            const grid = document.getElementById('routine-actual-grid');
            if (grid) {
                grid.style.width = `${val}%`;
                grid.style.minWidth = 'unset'; // Override the 600px min-width
            }
        };

        if (routineWidthFocus) routineWidthFocus.oninput = (e) => updateWidth(e.target.value);

        // Initial Calls to set UI states correctly
        updateZoom(70);
        updateWidth(100);
        if (filterSeats) filterSeats.dispatchEvent(new Event('input', { bubbles: true }));

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

    updateRamadanToggleUI() {
        const btn = document.getElementById('ramadan-toggle');
        const icon = document.getElementById('ramadan-icon');
        if (btn && icon) {
            if (this.model.ramadanMode) {
                btn.classList.add('!bg-amber-500/20', '!text-amber-400', '!border-amber-500/30');
                icon.setAttribute('data-lucide', 'sun');
            } else {
                btn.classList.remove('!bg-amber-500/20', '!text-amber-400', '!border-amber-500/30');
                icon.setAttribute('data-lucide', 'moon-star');
            }
            lucide.createIcons();
        }
    }

    toggleManualMode(show) {
        const manualSection = document.getElementById('manual-entry-section');
        const selectionPanel = document.getElementById('selection-panel');
        const paramsSection = document.getElementById('parameters-section');
        const queueContent = document.getElementById('queue-content');
        const queueChevron = document.getElementById('queue-chevron');

        if (show) {
            manualSection.classList.remove('hidden');
            selectionPanel.classList.add('hidden');
            paramsSection.classList.add('hidden');

            if (this.editingIndex !== null) {
                manualSection.classList.add('ring-2', 'ring-emerald-500/50', 'ring-offset-4', 'ring-offset-slate-900');
            } else {
                manualSection.classList.remove('ring-2', 'ring-emerald-500/50', 'ring-offset-4', 'ring-offset-slate-900');
            }
            document.getElementById('manual-subject').focus();
        } else {
            manualSection.classList.add('hidden');
            selectionPanel.classList.remove('hidden');
            paramsSection.classList.remove('hidden');

            // Auto-expand queue content when returning
            if (queueContent) {
                queueContent.classList.remove('hidden-params');
                if (queueChevron) queueChevron.style.transform = 'rotate(0deg)';
            }

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

        // Show and expand Course Queue so user sees the addition
        const selectionPanel = document.getElementById('selection-panel');
        const queueContent = document.getElementById('queue-content');
        const queueChevron = document.getElementById('queue-chevron');

        if (selectionPanel) selectionPanel.classList.remove('hidden');
        if (queueContent) {
            queueContent.classList.remove('hidden-params');
            if (queueChevron) queueChevron.style.transform = 'rotate(0deg)';
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
                this.view.showToast(`Successfully synced ${data.length} courses!`);
                document.getElementById('sync-modal').classList.add('hidden');

                // Track Analytics
                window.analytics.trackPortalSync(data.length);

                this.syncWorkspace();
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
                <div class="p-3 hover:bg-emerald-500/5 cursor-pointer border-b border-white/5 group transition-colors" onclick="app.controller.handleAddCourse('${c.baseTitle.replace(/'/g, "\\'")}', '${c.code}')">
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
                    labels.forEach(l => {
                        const actualHeight = getComputedStyle(document.documentElement).getPropertyValue('--row-height');
                        l.style.position = 'relative';
                        l.style.display = 'flex';
                        l.style.alignItems = 'flex-start';
                        l.style.height = actualHeight;
                    });

                    // Hide original timings in export if Ramadan mode is active
                    clonedDoc.querySelectorAll('.ramadan-old-time').forEach(el => {
                        el.style.display = 'none';
                    });

                    // Ensure the shifted time is centered and bold in the export
                    clonedDoc.querySelectorAll('.ramadan-time-container .class-info').forEach(info => {
                        info.style.fontSize = '10px';
                        info.style.marginTop = '0px';
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
            this.view.showToast("Routine Image Exported Successfully!");

            // Track Analytics
            window.analytics.trackExport('image');

            this.view.exportBtn.disabled = false;
            this.view.exportBtn.innerHTML = originalHTML;
            lucide.createIcons();
        }
    }

    syncWorkspace() {
        const { isExplorerMode, currentRoutineIndex, possibleRoutines, selectedCourses, focusMode, ramadanFeatureEnabled } = this.model;

        // Force disable Ramadan Mode if feature is disabled globally
        if (!ramadanFeatureEnabled) {
            this.model.ramadanMode = false;
        }
        this.updateRamadanToggleUI();

        const ramadanToggle = document.getElementById('ramadan-toggle');
        if (ramadanToggle) {
            ramadanToggle.classList.toggle('hidden', !ramadanFeatureEnabled);
        }

        this.view.explorerNav.classList.toggle('hidden', !isExplorerMode);
        this.view.explorerNav.classList.toggle('flex', isExplorerMode);

        // Visibility Logic Based on Focus Mode
        const paramsSection = document.getElementById('parameters-section');
        const manualSection = document.getElementById('manual-entry-section');
        const focusSection = document.getElementById('focus-controls-section');
        const queueNavManualBtn = document.getElementById('toggle-manual-mode');

        if (focusMode) {
            if (paramsSection) paramsSection.classList.add('hidden');
            if (manualSection) manualSection.classList.add('hidden');
            if (focusSection) focusSection.classList.remove('hidden');
            if (queueNavManualBtn) queueNavManualBtn.classList.add('hidden'); // Hide manual toggle in focus mode

            // Apply Width Zoom from slider
            const widthSlider = document.getElementById('routine-width-focus');
            const grid = document.getElementById('routine-actual-grid');
            if (widthSlider && grid) {
                grid.style.width = `${widthSlider.value}%`;
                grid.style.minWidth = 'unset';
            }
        } else {
            // Only show params/manual-toggle if not in actual manual entry mode
            if (!manualSection || manualSection.classList.contains('hidden')) {
                if (paramsSection) paramsSection.classList.remove('hidden');
                if (queueNavManualBtn) queueNavManualBtn.classList.remove('hidden');
            }
            if (focusSection) focusSection.classList.add('hidden');

            // Reset Width when exiting Focus Mode
            const grid = document.getElementById('routine-actual-grid');
            if (grid) {
                grid.style.width = '100%';
                grid.style.minWidth = '600px';
            }
        }

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
        this.view.renderRoutine(currentItems, isExplorerMode, this.model);
        lucide.createIcons(); // Ensure all icons are updated, including some with custom stroke if added
        this.view.totalCreditsEl.innerText = this.model.calculateCredits();
        this.view.updateSyncUI(this.model.allCourses);
    }

    updateFocusToggleUI() {
        const focusBtn = document.getElementById('focus-toggle');
        if (!focusBtn) return;

        const icon = focusBtn.querySelector('i');
        if (this.model.focusMode) {
            focusBtn.classList.add('!bg-[var(--accent-primary)]', '!text-black', 'shadow-[0_0_15px_var(--accent-glow)]');
            focusBtn.classList.remove('!bg-white/10', '!text-white', 'border-white/20');
            focusBtn.setAttribute('data-active', 'true');
            if (icon) {
                icon.setAttribute('data-lucide', 'minimize-2');
                icon.classList.add('rotate-90');
            }
        } else {
            focusBtn.classList.remove('!bg-[var(--accent-primary)]', '!text-black', 'shadow-[0_0_15px_var(--accent-glow)]');
            focusBtn.classList.add('!bg-white/10', '!text-white', 'border-white/20');
            focusBtn.removeAttribute('data-active');
            if (icon) {
                icon.setAttribute('data-lucide', 'maximize-2');
                icon.classList.remove('rotate-90');
            }
        }
        lucide.createIcons();
    }

    updateRamadanToggleUI() {
        const btn = document.getElementById('ramadan-toggle');
        if (!btn) return;

        const icon = btn.querySelector('i');
        if (this.model.ramadanMode) {
            btn.classList.add('!bg-[var(--accent-primary)]', '!text-black', 'shadow-[0_0_15px_var(--accent-glow)]');
            btn.classList.remove('!bg-white/10', '!text-white', 'border-white/20');
            btn.setAttribute('data-active', 'true');
            if (icon) icon.classList.add('scale-110');
        } else {
            btn.classList.remove('!bg-[var(--accent-primary)]', '!text-black', 'shadow-[0_0_15px_var(--accent-glow)]');
            btn.classList.add('!bg-white/10', '!text-white', 'border-white/20');
            btn.removeAttribute('data-active');
            if (icon) icon.classList.remove('scale-110');
        }
        lucide.createIcons();
    }

    async handleRamadanUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const statusContainer = document.getElementById('ramadan-sync-status');
        const statusText = document.getElementById('ramadan-status-text');
        const btn = document.getElementById('process-ramadan-btn');

        if (statusContainer) statusContainer.classList.remove('hidden');
        if (statusText) statusText.innerText = "Reading PDF...";
        if (btn) btn.disabled = true;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = "";

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();

                // Sort items by Y (top to bottom) then X (left to right)
                // This correctly reconstructs rows even in multi-column PDFs
                const items = textContent.items.sort((a, b) => {
                    const yDiff = b.transform[5] - a.transform[5];
                    if (Math.abs(yDiff) > 5) return yDiff; // Different rows
                    return a.transform[4] - b.transform[4]; // Same row, left to right
                });

                const pageText = items.map(item => item.str).join(' ');
                fullText += pageText + "\n";
            }

            // Extract timing slots
            // Pattern: Looking for pairs of "HH:MM - HH:MM" slots
            // The AIUB format is usually "Regular Ramadan" side by side
            // 8:00 - 9:30 9:00 - 10:00

            // Handle both ":" and "." as separators (allowing spaces around them), and various dash types
            const timeRangeRegex = /(\d{1,2}\s*[:.]\s*\d{2})\s*[-û–—]\s*(\d{1,2}\s*[:.]\s*\d{2})/g;
            const matches = [...fullText.matchAll(timeRangeRegex)];

            const mappings = {};
            // We expect pairs: [RegularSlot, RamadanSlot]
            for (let i = 0; i < matches.length - 1; i += 2) {
                const reg = matches[i];
                const ram = matches[i + 1];

                // Helper to detect AM/PM based on context
                const normalize = (timeStr) => {
                    const cleanStr = timeStr.replace(/\s+/g, ''); // Remove spaces inside time
                    const separator = cleanStr.includes(':') ? ':' : '.';
                    let [h, m] = cleanStr.split(separator).map(Number);
                    let period = "AM";
                    if (h >= 12) period = "PM";
                    if (h < 8) period = "PM"; // Classes before 8 AM are PM
                    return this.formatTimeWithPadding(`${h}:${m} ${period}`);
                };

                const regStart = normalize(reg[1]);
                const regEnd = normalize(reg[2]);
                const ramStart = normalize(ram[1]);
                const ramEnd = normalize(ram[2]);

                mappings[`${regStart} - ${regEnd}`] = [ramStart, ramEnd];
            }

            if (Object.keys(mappings).length === 0) {
                throw new Error("No timing slots detected. Is this an official AIUB notice?");
            }

            this.model.saveRamadanMappings(mappings);
            this.view.showToast(`Successfully synced ${Object.keys(mappings).length} timing slots!`);

            if (statusText) statusText.innerText = `Success: ${Object.keys(mappings).length} slots found`;
            setTimeout(() => {
                document.getElementById('ramadan-sync-modal').classList.add('hidden');
                if (statusContainer) statusContainer.classList.add('hidden');
            }, 1000);

        } catch (err) {
            console.error(err);
            this.view.showToast(err.message || "Failed to parse PDF.", "error");
            if (statusText) statusText.innerText = "Error parsing file";
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    formatTimeWithPadding(s) {
        if (!s) return "";
        let [t, p] = s.trim().split(' ');
        const separator = t.includes(':') ? ':' : '.';
        let [h, m] = t.split(separator);
        return `${h.padStart(2, '0')}:${m.padStart(2, '0')} ${p}`;
    }

    downloadRamadanJSON() {
        const mappings = this.model.customRamadanMap || this.model.globalRamadanMap;
        if (!mappings) return this.view.showToast("No mappings found. Upload a PDF first.", "info");

        const exportData = {
            featureEnabled: this.model.ramadanFeatureEnabled,
            mappings: mappings
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ramadan-mappings.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    updateTwentyFourToggleUI() {
        const btn = document.getElementById('twenty-four-toggle');
        if (!btn) return;

        const icon = btn.querySelector('i');
        if (this.model.twentyFourHourMode) {
            btn.classList.add('!bg-[var(--accent-primary)]', '!text-black', 'shadow-[0_0_15px_var(--accent-glow)]');
            btn.classList.remove('!bg-white/10', '!text-white', 'border-white/20');
            btn.setAttribute('data-active', 'true');
            if (icon) icon.classList.add('scale-110');
        } else {
            btn.classList.remove('!bg-[var(--accent-primary)]', '!text-black', 'shadow-[0_0_15px_var(--accent-glow)]');
            btn.classList.add('!bg-white/10', '!text-white', 'border-white/20');
            btn.removeAttribute('data-active');
            if (icon) icon.classList.remove('scale-110');
        }
        lucide.createIcons();
    }
}
