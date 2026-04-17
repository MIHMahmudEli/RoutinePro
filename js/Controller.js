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
        this.view.renderLibraryMetadata(this.model.metadata);
        this.setupEventListeners();
        this.syncWorkspace();

        // Reveal Admin Features if ?admin=true with Password Security
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('admin') === 'true') {
            const isAuthenticated = sessionStorage.getItem('routine-pro-admin-auth') === 'true';

            if (isAuthenticated) {
                this.revealAdminFeatures();
            } else {
                const passwordModal = document.getElementById('admin-password-modal');
                const passwordInput = document.getElementById('admin-password-input');
                const loginBtn = document.getElementById('admin-login-btn');

                if (passwordModal) passwordModal.classList.remove('hidden');

                const attemptLogin = async () => {
                    const password = passwordInput.value;
                    try {
                        const res = await fetch('/api/check-auth', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ password })
                        });

                        const result = await res.json();
                        if (res.ok && result.authenticated) {
                            sessionStorage.setItem('routine-pro-admin-auth', 'true');
                            sessionStorage.setItem('routine-pro-admin-key', password); // Store encrypted-ish session
                            if (passwordModal) passwordModal.classList.add('hidden');
                            this.revealAdminFeatures();
                            this.view.showToast("Admin access granted", "success");
                        } else {
                            throw new Error(result.error || "Invalid key");
                        }
                    } catch (e) {
                        this.view.showToast(e.message, "error");
                        passwordInput.value = '';
                    }
                };

                if (loginBtn) loginBtn.onclick = attemptLogin;
                if (passwordInput) {
                    passwordInput.onkeypress = (e) => {
                        if (e.key === 'Enter') attemptLogin();
                    };
                }
            }
        }

        // Global Ramadan Visibility
        const ramadanToggle = document.getElementById('ramadan-toggle');
        if (ramadanToggle) {
            ramadanToggle.classList.toggle('hidden', !this.model.ramadanFeatureEnabled);
        }

        this.updateCompactToggleUI();

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

        // Apply shared routine if data exists
        if (this.model.pendingSharedItems) {
            this.model.applySharedItems();
            
            if (this.model.wasExplorer) {
                this.model.isExplorerMode = true;
                // Create a single-scenario routine list from the shared selection
                this.model.possibleRoutines = [this.model.selectedCourses.map(sc => ({
                    courseTitle: sc.course.baseTitle,
                    dept: sc.course.dept,
                    section: sc.course.sections[sc.selectedSectionIndex]
                }))];
                this.model.currentRoutineIndex = 0;
            }

            this.view.showToast("Shared scenario loaded!", "success");
            this.syncWorkspace();
            // Clear hash to prevent reloading on every sync
            window.location.hash = '';
        }
    }

    revealAdminFeatures() {
        const syncBtn = document.getElementById('ramadan-sync-btn');
        if (syncBtn) syncBtn.classList.remove('hidden');

        const exportLibBtn = document.getElementById('export-library-btn');
        if (exportLibBtn) exportLibBtn.classList.remove('hidden');

        const featureToggle = document.getElementById('admin-ramadan-feature-toggle');
        if (featureToggle) {
            featureToggle.checked = this.model.ramadanFeatureEnabled;
            featureToggle.classList.remove('hidden');

            // Restore the change listener
            featureToggle.onchange = async (e) => {
                const isEnabled = e.target.checked;
                this.model.ramadanFeatureEnabled = isEnabled;
                localStorage.setItem('routine-pro-ramadan-admin-feature', isEnabled);
                this.view.showToast(`Ramadan Feature ${isEnabled ? 'Enabled' : 'Disabled'} Locally`, "info");
                this.syncWorkspace();

                // Global Sync Prompt
                if (confirm(`Do you want to ${isEnabled ? 'ENABLE' : 'DISABLE'} Ramadan Mode GLOBALLY for every user?`)) {
                    this.view.showToast("Updating Global Config...", "info");
                    try {
                        const response = await fetch('/api/update-config', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': sessionStorage.getItem('routine-pro-admin-key')
                            },
                            body: JSON.stringify({ ramadanFeatureEnabled: isEnabled })
                        });

                        const result = await response.json();
                        if (response.ok) {
                            this.view.showToast(result.message, "success");
                        } else {
                            throw new Error(result.error || "Sync failed");
                        }
                    } catch (err) {
                        console.error("Global Config Error:", err);
                        this.view.showToast(`Global sync failed: ${err.message}`, "error");
                    }
                }
            };

            const container = featureToggle.closest('div');
            if (container) container.classList.remove('hidden');
        }
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

                if (theme === 'spectrum') this.view.shuffleHues();

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

        // Compact Mode
        const compactBtn = document.getElementById('compact-toggle');
        if (compactBtn) {
            compactBtn.onclick = () => {
                this.model.compactMode = !this.model.compactMode;
                this.updateCompactToggleUI();
                const status = this.model.compactMode ? "Enabled" : "Disabled";
                const type = this.model.compactMode ? "success" : "info";
                this.view.showToast(`Compact Mode ${status}`, type);
                this.syncWorkspace();
            };
        }

        // Initialize Modes from local storage
        this.model.ramadanMode = false;
        this.updateRamadanToggleUI();

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

        // Share
        if (this.view.shareBtn) {
            this.view.shareBtn.onclick = () => this.handleShare();
        }

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

        // Font Size Control
        const routineFont = document.getElementById('routine-font');
        const routineFontManual = document.getElementById('routine-font-manual');
        const routineFontFocus = document.getElementById('routine-font-focus');
        const fontValDisplay = document.getElementById('font-val');
        const fontValManualDisplay = document.getElementById('font-val-manual');
        const fontValFocusDisplay = document.getElementById('font-val-focus');
        const fontSliderFill = document.getElementById('font-slider-fill');
        const fontSliderFillManual = document.getElementById('font-slider-fill-manual');
        const fontSliderFillFocus = document.getElementById('font-slider-fill-focus');

        const updateFont = (val) => {
            if (fontValDisplay) fontValDisplay.innerText = val;
            if (fontValManualDisplay) fontValManualDisplay.innerText = val;
            if (fontValFocusDisplay) fontValFocusDisplay.innerText = val;

            if (routineFont) routineFont.value = val;
            if (routineFontManual) routineFontManual.value = val;
            if (routineFontFocus) routineFontFocus.value = val;

            const pct = ((val - 6) / (24 - 6)) * 100;
            const fillWidth = `calc(${pct}% + ${(0.5 - pct / 100) * 20}px)`;
            if (fontSliderFill) fontSliderFill.style.width = fillWidth;
            if (fontSliderFillManual) fontSliderFillManual.style.width = fillWidth;
            if (fontSliderFillFocus) fontSliderFillFocus.style.width = fillWidth;

            // Apply Font Change
            document.documentElement.style.setProperty('--class-font-size', `${val}px`);
        };

        if (routineFont) routineFont.oninput = (e) => updateFont(e.target.value);
        if (routineFontManual) routineFontManual.oninput = (e) => updateFont(e.target.value);
        if (routineFontFocus) routineFontFocus.oninput = (e) => updateFont(e.target.value);

        // Initial Calls to set UI states correctly
        updateZoom(70);
        updateWidth(100);
        updateFont(10);
        if (filterSeats) filterSeats.dispatchEvent(new Event('input', { bubbles: true }));

        // File Upload
        const fileInput = document.getElementById('course-file-input');
        if (fileInput) {
            fileInput.onchange = (e) => this.handleFileUpload(e);
        }

        // Portal Image Sync
        const portalImageInput = document.getElementById('portal-image-input');
        if (portalImageInput) {
            portalImageInput.onchange = (e) => this.handlePortalImageUpload(e);
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
            if (el.value === '') return; // Allow empty state
            let v = parseInt(el.value);
            if (isNaN(v)) return; // Don't wipe if partial

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

        // Reset time selects to defaults (Blank for placeholders)
        document.getElementById('man-start-h').value = '';
        document.getElementById('man-start-m').value = '';
        document.getElementById('man-start-p').value = 'AM';
        document.getElementById('man-end-h').value = '';
        document.getElementById('man-end-m').value = '';
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

        if (!sh || !sm || !eh || !em) {
            return this.view.showToast("Please enter complete start and end times!", "error");
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

        const btn = document.getElementById('process-update-btn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> PROCESSING...`;
        lucide.createIcons();

        try {
            let finalSemester = 'Updated Semester';

            let coursesToSync = null;

            if (file.name.endsWith('.json')) {
                const text = await file.text();
                coursesToSync = JSON.parse(text);
                
                // Detection for JSON
                finalSemester = this.detectSemester(file.name, text);
                
                this.model.saveCourses(coursesToSync, finalSemester);
                this.view.showToast(`Successfully synced ${coursesToSync.length} courses!`);
                
                // Add Cloud Sync check
                await this.maybeSyncToCloud(coursesToSync);

                document.getElementById('sync-modal').classList.add('hidden');
                window.analytics.trackPortalSync(coursesToSync.length);
                this.syncWorkspace();
            } else if (file.name.endsWith('.xlsx')) {
                // Wrap FileReader in a Promise to await it properly
                await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                        try {
                            const dataArr = new Uint8Array(evt.target.result);
                            const wb = XLSX.read(dataArr, { type: 'array' });
                            const wsname = wb.SheetNames[0];
                            const ws = wb.Sheets[wsname];
                            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                            // Auto-detect semester
                            finalSemester = this.detectSemester(file.name + " " + wsname, JSON.stringify(data.slice(0, 10)));
                            const courses = this.model.parseExcelData(data);

                            this.model.saveCourses(courses, finalSemester);
                            this.view.showToast(`${courses.length} courses loaded from ${file.name}`);

                            // Add Cloud Sync check
                            await this.maybeSyncToCloud(courses);
                            
                            window.analytics.trackPortalSync(courses.length);
                            this.syncWorkspace();
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    };
                    reader.onerror = () => reject(new Error("File read error"));
                    reader.readAsArrayBuffer(file);
                });
            }
        } catch (err) {
            console.error(err);
            this.view.showToast("Failed to process file.", "error");
        } finally {
            // Reset input so the same file can be selected again
            if (e.target) e.target.value = '';
            
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalText;
                lucide.createIcons();
                this.view.syncModal.classList.add('hidden');
            }, 1000);
        }
    }

    detectSemester(fileName, contentSnippet) {
        const searchPool = (fileName + " " + contentSnippet).toUpperCase();
        let detected = "";

        if (searchPool.includes('SPRING') || searchPool.includes('SPRI')) detected = 'SPRING';
        else if (searchPool.includes('FALL') || searchPool.includes('FAL')) detected = 'FALL';
        else if (searchPool.includes('SUMMER') || searchPool.includes('SUMM')) detected = 'SUMMER';

        // More robust year matching (2024-25, 2024-2025, 2024 25, etc.)
        const yearMatch = searchPool.match(/\d{4}[\s-]\d{2,4}/) || searchPool.match(/\d{4}/);
        
        if (yearMatch) {
            const yearStr = yearMatch[0].replace(/\s/g, '-');
            if (detected) return `${detected} ${yearStr}`;
            return yearStr;
        }

        return detected || 'Updated Semester';
    }

    async maybeSyncToCloud(data) {
        const isAdmin = sessionStorage.getItem('routine-pro-admin-auth') === 'true';
        if (!isAdmin) return;

        if (confirm("You are an Admin. Do you want to upload this to the GLOBAL database for EVERY user?")) {
            this.view.showToast("Uploading to Global Cloud...", "info");
            
            const semester = this.model.semester || 'Updated Semester';

            try {
                const password = sessionStorage.getItem('routine-pro-admin-key');
                const response = await fetch('/api/update-courses', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': password
                    },
                    body: JSON.stringify({ data, semester })
                });

                const result = await response.json();
                if (response.ok) {
                    this.view.showToast(result.message || "Global database updated!", "success");
                    // Refresh metadata locally after cloud sync
                    const metaRes = await fetch('/api/get-metadata', { cache: 'no-store' });
                    if (metaRes.ok) {
                        this.model.metadata = await metaRes.json();
                        this.syncWorkspace();
                    }
                } else {
                    throw new Error(result.error || `Server Error ${response.status}`);
                }
            } catch (err) {
                console.error("Cloud Sync Error:", err);
                this.view.showToast(`Global Cloud Sync failed: ${err.message}`, "error");
            }
        }
    }

    async handleSyncFromCloud() {
        const btn = document.getElementById('sync-from-cloud-btn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> SYNCING...`;
        lucide.createIcons();

        try {
            this.view.showToast("Fetching latest cloud data...", "info");
            
            // Reload everything from cloud
            localStorage.removeItem('routine-pro-courses'); 
            localStorage.removeItem('routine-pro-data-source');
            await this.model.loadInitialData();
            
            this.view.showToast("Successfully synced with cloud!", "success");
            this.syncWorkspace();
            
            setTimeout(() => {
                this.view.syncModal.classList.add('hidden');
            }, 1000);
        } catch (err) {
            console.error(err);
            this.view.showToast("Cloud sync failed.", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
            lucide.createIcons();
        }
    }

    handleSearch(e) {
        const q = e.target.value.toLowerCase().trim();
        if (q.length < 2) { this.view.suggestions.classList.add('hidden'); return; }

        let matches = this.model.allCourses.filter(c =>
            c.baseTitle.toLowerCase().includes(q) || (c.code && c.code.toLowerCase().includes(q))
        );

        const seenKeys = new Set();
        const results = [];
        
        for (const c of matches) {
            const key = c.baseTitle.toUpperCase();
            
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                results.push(c);
            }
            if (results.length >= 15) break;
        }

        if (results.length > 0) {
            this.view.suggestions.innerHTML = results.map(c => `
                <div class="p-4 hover:bg-emerald-500/5 cursor-pointer border-b border-white/5 group transition-all" onclick="app.controller.handleAddCourse(\`${c.baseTitle.replace(/`/g, "\\`").replace(/'/g, "\\'")}\`, \`${c.code}\`)">
                    <div class="flex justify-between items-center text-sm font-bold group-hover:text-emerald-400 uppercase tracking-tight">${c.baseTitle}</div>
                </div>
            `).join('');
            this.view.suggestions.classList.remove('hidden');
        } else {
            this.view.suggestions.classList.add('hidden');
        }
    }

    handleAddCourse(title, code, sectionName = null, classId = null) {
        this.model.isExplorerMode = false;
        
        let targetCourse = null;
        let targetSectionIdx = -1;

        // 1. HIGHEST PRIORITY: Exact Class ID Matching (Unique across all courses/sections)
        if (classId) {
            const cleanId = String(classId).trim().padStart(5, '0');
            for (const c of this.model.allCourses) {
                const sIdx = c.sections.findIndex(s => String(s.id).trim().padStart(5, '0') === cleanId);
                if (sIdx !== -1) {
                    targetCourse = c;
                    targetSectionIdx = sIdx;
                    break;
                }
            }
        }

        // 2. SECOND PRIORITY: Title + Section Matching
        if (!targetCourse) {
            const cleanTitle = String(title).trim().toUpperCase();
            
            // Try exact match first (case-insensitive)
            targetCourse = this.model.allCourses.find(c => c.baseTitle.trim().toUpperCase() === cleanTitle);
            
            // Try startsWith/Includes fallback (fuzzy)
            if (!targetCourse) {
                targetCourse = this.model.allCourses.find(c => 
                    c.baseTitle.toUpperCase().includes(cleanTitle) || 
                    cleanTitle.includes(c.baseTitle.toUpperCase())
                );
            }
            
            if (targetCourse && sectionName) {
                const sName = String(sectionName).trim().toUpperCase();
                targetSectionIdx = targetCourse.sections.findIndex(s => s.section.toUpperCase() === sName);
            }
        }

        if (targetCourse) {
            let activeIdx = this.model.selectedCourses.findIndex(sc => sc.course.baseTitle === targetCourse.baseTitle);
            let isNew = false;

            if (activeIdx === -1) {
                // Course is new, add it
                this.model.addCourse(targetCourse);
                activeIdx = 0; // New courses are unshifted to index 0
                isNew = true;
            }

            // Always update to the section identifying by AI/User and PIN IT
            if (targetSectionIdx !== -1) {
                this.model.updateSectionSelection(activeIdx, targetSectionIdx);
                this.model.selectedCourses[activeIdx].isPinned = true; // High priority: keep registered section
            }

            if (isNew) {
                this.view.searchInput.value = '';
                this.view.suggestions.classList.add('hidden');
                this.syncWorkspace();
                return true;
            } else {
                // If it wasn't new, we still sync to reflect the section change
                this.syncWorkspace();
                return true; 
            }
        }

        // Only show toast if it was a manual user action (not bulk extraction)
        if (!sectionName && !classId) {
            this.view.showToast("Course already added or not found", "error");
        }
        return false;
    }

    handleExportLibrary() {
        if (!this.model.allCourses || this.model.allCourses.length === 0) {
            this.view.showToast("No courses to export!", "error");
            return;
        }

        const dataStr = JSON.stringify(this.model.allCourses, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', 'courses.json');
        linkElement.click();

        this.view.showToast("Library exported successfully!");
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

    handleShare() {
        if (this.model.selectedCourses.length === 0) {
            this.view.showToast("Add some courses before sharing!", "error");
            return;
        }

        try {
            const shareData = this.model.getShareableData();
            const shareUrl = `${window.location.origin}${window.location.pathname}#share=${shareData}`;
            
            // Try to use Web Share API
            if (navigator.share) {
                navigator.share({
                    title: 'My Routine - RoutinePro',
                    text: 'Check out my routine on RoutinePro!',
                    url: shareUrl
                }).catch(err => {
                    // Fallback to clipboard
                    this.copyToClipboard(shareUrl);
                });
            } else {
                this.copyToClipboard(shareUrl);
            }

            window.analytics.trackFeatureToggle('share_routine', true);
        } catch (e) {
            console.error("Sharing failed", e);
            this.view.showToast("Failed to generate share link", "error");
        }
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.view.showToast("Share link copied to clipboard!");
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.view.showToast("Share link copied to clipboard!");
            } catch (err) {
                this.view.showToast("Failed to copy link", "error");
            }
            document.body.removeChild(textArea);
        }
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
                    // Force Focus Mode for the export
                    const { isExplorerMode, currentRoutineIndex, possibleRoutines, selectedCourses } = this.model;
                    const currentItems = isExplorerMode ? possibleRoutines[currentRoutineIndex] : selectedCourses;
                    this.view.renderRoutine(currentItems, isExplorerMode, this.model, (t) => this.getDisplayTitle(t), clonedDoc, true);

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

                    // Add branding and info overlays (requested by user)
                    const clonedGrid = clonedDoc.getElementById('routine-actual-grid');
                    if (clonedGrid) {
                        const overlayStyles = "position: absolute; z-index: 100; font-family: inherit; pointer-events: none;";
                        
                        // Top Right: Semester Name
                        const semName = this.model.semester 
                            || (this.model.metadata ? this.model.metadata.semester : null)
                            || localStorage.getItem('routine-pro-semester') 
                            || "SPRING 24-25";

                        const semEl = clonedDoc.createElement('div');
                        semEl.style.cssText = overlayStyles + "top: 25px; right: 30px; text-align: right;";
                        semEl.innerHTML = `
                            <div style="font-size: 7px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 1px; opacity: 0.8;">Academic Session</div>
                            <div style="font-size: 11px; font-weight: 900; color: #10b981; text-transform: uppercase;">${semName}</div>
                        `;
                        clonedGrid.appendChild(semEl);

                        // Top Left: Weekly Gap
                        const gapText = this.view.headerGapDisplay.innerText || "0m";
                        const gapEl = clonedDoc.createElement('div');
                        gapEl.style.cssText = overlayStyles + "top: 25px; left: 30px;";
                        gapEl.innerHTML = `
                            <div style="font-size: 7px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 1px; opacity: 0.8;">Weekly Waiting</div>
                            <div style="font-size: 11px; font-weight: 900; color: #fff; text-transform: uppercase;">${gapText}</div>
                        `;
                        clonedGrid.appendChild(gapEl);

                        // Bottom Right: Branding
                        const brandEl = clonedDoc.createElement('div');
                        brandEl.style.cssText = overlayStyles + "bottom: 25px; right: 30px; text-align: right;";
                        brandEl.innerHTML = `
                            <div style="font-size: 7px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 2px; opacity: 0.8;">Generated via RoutinePro</div>
                            <div style="font-size: 10px; font-weight: 500; color: #475569; letter-spacing: 0.02em; opacity: 0.6;">https://routine-pro-fawn.vercel.app</div>
                        `;
                        clonedGrid.appendChild(brandEl);
                        
                        // Add padding to create a header/footer area in the export
                        clonedGrid.style.paddingTop = '70px';
                        clonedGrid.style.paddingBottom = '70px';
                    }
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
            this.view.showToast("Routine Image Exported Successfully!");
        } catch (err) {
            this.view.showToast("Export failed. Try a desktop", "error");
            console.error(err);
        } finally {
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
            },
            (t) => this.getDisplayTitle(t)
        );
        this.view.renderRoutine(currentItems, isExplorerMode, this.model, (t) => this.getDisplayTitle(t));
        lucide.createIcons(); // Ensure all icons are updated, including some with custom stroke if added
        this.view.totalCreditsEl.innerText = this.model.calculateCredits();
        this.view.updateSyncUI(this.model.allCourses);
        if (this.model.metadata) {
            const displayTime = this.model.dataSource === 'Local' ? this.model.lastLocalSync : this.model.metadata.lastUpdate;
            this.view.renderLibraryMetadata(this.model.metadata, this.model.dataSource, displayTime);
        }
    }

    updateFocusToggleUI() {
        const focusBtn = document.getElementById('focus-toggle');
        if (!focusBtn) return;

        const icon = focusBtn.querySelector('i');
        if (this.model.focusMode) {
            focusBtn.setAttribute('data-active', 'true');
            if (icon) {
                icon.setAttribute('data-lucide', 'minimize-2');
                icon.classList.add('rotate-90');
            }
        } else {
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
            btn.setAttribute('data-active', 'true');
            if (icon) icon.setAttribute('data-lucide', 'sun');
        } else {
            btn.removeAttribute('data-active');
            if (icon) icon.setAttribute('data-lucide', 'moon-star');
        }
        lucide.createIcons();
    }

    updateCompactToggleUI() {
        const btn = document.getElementById('compact-toggle');
        if (!btn) return;

        if (this.model.compactMode) {
            btn.setAttribute('data-active', 'true');
        } else {
            btn.removeAttribute('data-active');
        }
    }

    getDisplayTitle(title) {
        if (!this.model.compactMode) return title;
        
        // Rule: Ignore all bracketed parts [] and ()
        let cleanTitle = title.replace(/\[.*?\]|\(.*?\)/g, '').trim();
        
        // Clean leftover characters and symbols (pure letters and spaces only)
        cleanTitle = cleanTitle.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
        
        const words = cleanTitle.split(' ').filter(word => word.length > 0);
        
        if (words.length === 0) return "C"; // Fallback
        
        // If single word, take first two letters as is common
        if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
        
        // Important: Still filter common short conjunctions for cleaner abbreviations unless user says otherwise
        const ignoredWords = ['and', 'of', 'to', 'for', 'in', 'with', 'a', 'the', '&'];
        
        const abbreviation = words
            .filter(word => words.length <= 2 || !ignoredWords.includes(word.toLowerCase()))
            .map(word => word[0].toUpperCase())
            .join('');

        return abbreviation;
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

            // Add Cloud Sync check for Ramadan
            await this.maybeSyncRamadanToCloud(mappings);

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

    async maybeSyncRamadanToCloud(data) {
        const isAdmin = sessionStorage.getItem('routine-pro-admin-auth') === 'true';
        if (!isAdmin) return;

        if (confirm("You are an Admin. Do you want to sync these RAMADAN MAPPINGS globally for everyone?")) {
            this.view.showToast("Updating Global Ramadan Data...", "info");
            try {
                const password = sessionStorage.getItem('routine-pro-admin-key');
                const response = await fetch('/api/update-ramadan', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': password
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                if (response.ok) {
                    this.view.showToast(result.message || "Global Ramadan Mappings updated!", "success");
                } else {
                    throw new Error(result.error || `Server Error ${response.status}`);
                }
            } catch (err) {
                console.error("Ramadan Cloud Sync Error:", err);
                this.view.showToast(`Ramadan Cloud Sync failed: ${err.message}`, "error");
            }
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
            btn.setAttribute('data-active', 'true');
            if (icon) icon.classList.add('scale-110');
        } else {
            btn.removeAttribute('data-active');
            if (icon) icon.classList.remove('scale-110');
        }
        lucide.createIcons();
    }

    async handlePortalImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.view.showToast("Analyzing Image with AI...", "info");
        document.getElementById('sync-modal').classList.add('hidden');

        try {
            const coursesFound = await this.processImageWithAI(file);

            if (!coursesFound || coursesFound.length === 0) {
                this.view.showToast("No courses identified in screenshot", "error");
                return;
            }

            let addedCount = 0;
            coursesFound.forEach(item => {
                // The AI returns { title: "...", section: "...", classId: "..." }
                const success = this.handleAddCourse(item.title, null, item.section, item.classId);
                if (success) addedCount++;
            });

            if (addedCount > 0) {
                this.view.showToast(`AI extracted ${addedCount} courses from portal!`, "success");
            } else {
                this.view.showToast("AI found courses but they are already in queue or missing from library", "info");
            }
        } catch (err) {
            console.error("AI Sync Error:", err);
            this.view.showToast(`Extraction failed: ${err.message}`, "error");
        } finally {
            e.target.value = ''; // Reset input
        }
    }

    async processImageWithAI(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const base64Image = reader.result.split(',')[1];

                    const response = await fetch('/api/extract', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: base64Image })
                    });

                    if (!response.ok) {
                        const errBody = await response.json();
                        throw new Error(errBody.error || "Extraction Service Error");
                    }

                    const result = await response.json();
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("File read error"));
            reader.readAsDataURL(file);
        });
    }
}
