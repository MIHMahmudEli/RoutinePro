/**
 * RoutinePro - Model
 * Handles data management, filtering logic, and generation engine.
 */
class RoutineModel {
    constructor() {
        this.allCourses = [];
        this.selectedCourses = [];
        this.possibleRoutines = [];
        this.currentRoutineIndex = 0;
        this.isExplorerMode = false;
        this.focusMode = false;
        this.twentyFourHourMode = false;
        this.ramadanMode = false;
        this.compactMode = false;
        // Check local storage FIRST (for admin persistence), default to false
        this.ramadanFeatureEnabled = localStorage.getItem('routine-pro-ramadan-admin-feature') === 'true';
        this.globalRamadanMap = null;
        this.customRamadanMap = this.loadRamadanMappings();
    }

    loadRamadanMappings() {
        try {
            const saved = localStorage.getItem('routine-pro-ramadan-map');
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    }

    saveRamadanMappings(map) {
        this.customRamadanMap = map;
        localStorage.setItem('routine-pro-ramadan-map', JSON.stringify(map));
    }

    async loadInitialData() {
        // Load shared routine first if hash exists
        const hash = window.location.hash;
        if (hash && hash.startsWith('#share=')) {
            const sharedData = hash.substring(7);
            this.loadFromSharedData(sharedData);
            // Clear hash after loading to avoid re-loading on refresh if user wants to change it
            // window.history.replaceState(null, null, ' ');
        }

        // Load cached global data first for instant startup
        try {
            const cachedCourses = localStorage.getItem('routine-pro-global-courses');
            const cachedMeta = localStorage.getItem('routine-pro-global-metadata');
            const cachedRamadan = localStorage.getItem('routine-pro-global-ramadan');
            
            if (cachedCourses) this.allCourses = JSON.parse(cachedCourses);
            if (cachedMeta) this.metadata = JSON.parse(cachedMeta);
            if (cachedRamadan) this.globalRamadanMap = JSON.parse(cachedRamadan);
        } catch (e) { console.warn("Failed to load cached global data"); }

        // Start all fetches in parallel to reduce sequential delay
        // We add a timestamp to bypass aggressive browser/Vercel caching for global updates
        const t = Date.now();
        const fetchPromises = [
            fetch(`/api/get-config?t=${t}`).catch(() => null),
            fetch(`/api/get-ramadan?t=${t}`).catch(() => null),
            fetch(`/api/get-metadata?t=${t}`).catch(() => null),
            fetch(`/api/get-courses?t=${t}`).catch(() => null)
        ];

        try {
            const [configRes, ramRes, metaRes, coursesRes] = await Promise.all(fetchPromises);

            // 1. Process Config
            if (configRes && configRes.ok) {
                const configData = await configRes.json();
                this.ramadanFeatureEnabled = configData.ramadanFeatureEnabled;
            }

            // 2. Process Ramadan Mapping
            let ramData = null;
            if (ramRes && ramRes.ok) {
                ramData = await ramRes.json();
            } else {
                const localRamRes = await fetch('data/ramadan-mappings.json');
                if (localRamRes.ok) ramData = await localRamRes.json();
            }

            if (ramData) {
                this.globalRamadanMap = ramData.mappings || null;
                localStorage.setItem('routine-pro-global-ramadan', JSON.stringify(this.globalRamadanMap));
                
                const hasLocalOverride = localStorage.getItem('routine-pro-ramadan-admin-feature') !== null;
                if (!hasLocalOverride) {
                    this.ramadanFeatureEnabled = ramData.featureEnabled !== false;
                }
            }

            // 3. Process Metadata
            if (metaRes && metaRes.ok) {
                this.metadata = await metaRes.json();
                localStorage.setItem('routine-pro-global-metadata', JSON.stringify(this.metadata));
            }

            // 4. Process Courses
            // Strategy: Personal local uploads always take priority.
            // For Global users, compare server metadata lastUpdate with cached version
            // to auto-refresh when admin publishes new data.
            const dataSource = localStorage.getItem('routine-pro-data-source') || '';
            const isPersonalUpload = dataSource === 'Local';
            const localCourses = localStorage.getItem('routine-pro-courses');

            if (isPersonalUpload && localCourses) {
                // User has a personal upload — never override it with global data
                this.allCourses = JSON.parse(localCourses);
                this.dataSource = 'Local';
                this.lastLocalSync = localStorage.getItem('routine-pro-last-sync');
            } else {
                // For Global users: check if server has newer data than our cache
                const cachedGlobalUpdate = localStorage.getItem('routine-pro-global-last-update');
                const serverUpdate = this.metadata && this.metadata.lastUpdate;
                const serverHasNewerData = serverUpdate && (!cachedGlobalUpdate || new Date(serverUpdate) > new Date(cachedGlobalUpdate));

                if (serverHasNewerData && coursesRes && coursesRes.ok) {
                    // Admin pushed new data — fetch fresh courses for this user
                    console.info('[RoutinePro] Global data updated by admin. Refreshing...');
                    this.allCourses = await coursesRes.json();
                    this.dataSource = 'Global';
                    localStorage.setItem('routine-pro-data-source', 'Global');
                    localStorage.setItem('routine-pro-global-courses', JSON.stringify(this.allCourses));
                    localStorage.setItem('routine-pro-global-last-update', serverUpdate);
                    // Clear stale local course cache if it was from global
                    localStorage.removeItem('routine-pro-courses');
                } else if (this.allCourses && this.allCourses.length > 0) {
                    // Cache is still fresh — use what we loaded at startup
                    this.dataSource = dataSource || 'Global';
                } else if (coursesRes && coursesRes.ok) {
                    // No cache at all — first visit or cleared storage
                    this.allCourses = await coursesRes.json();
                    this.dataSource = 'Global';
                    localStorage.setItem('routine-pro-data-source', 'Global');
                    localStorage.setItem('routine-pro-global-courses', JSON.stringify(this.allCourses));
                    if (serverUpdate) localStorage.setItem('routine-pro-global-last-update', serverUpdate);
                } else {
                    // Last resort: bundled static file
                    const staticRes = await fetch('data/courses.json');
                    if (staticRes.ok) {
                        this.allCourses = await staticRes.json();
                        this.dataSource = 'Default (Static)';
                    }
                }
            }
        } catch (err) {
            console.error("Critical Sync Error:", err);
            // Ensure some data is loaded if possible
            if (!this.allCourses || this.allCourses.length === 0) {
                const staticRes = await fetch('data/courses.json');
                if (staticRes.ok) this.allCourses = await staticRes.json();
            }
        }
        return this.allCourses;
    }

    saveCourses(data, semesterName = null) {
        this.allCourses = data;
        this.dataSource = 'Local';
        const now = new Date().toISOString();
        this.lastLocalSync = now;
        localStorage.setItem('routine-pro-data-source', 'Local');
        localStorage.setItem('routine-pro-courses', JSON.stringify(data));
        localStorage.setItem('routine-pro-last-sync', now);
        if (semesterName) {
            this.semester = semesterName;
            localStorage.setItem('routine-pro-semester', semesterName);
        }
        this.selectedCourses = [];
        this.possibleRoutines = [];
        this.currentRoutineIndex = 0;
    }

    addCourse(course) {
        if (!this.selectedCourses.some(sc => sc.course.baseTitle === course.baseTitle)) {
            this.selectedCourses.unshift({ course, selectedSectionIndex: 0, isPinned: false });
            return true;
        }
        return false;
    }

    addManualCourse(data) {
        const { subject, days, start, end, section, room } = data;
        const manualCourse = {
            baseTitle: subject,
            code: "MANUAL",
            sections: [{
                id: "M-" + Date.now(),
                section: section || "1",
                status: "Open",
                capacity: "99",
                count: "0",
                schedules: days.map(day => ({
                    day: day,
                    start: start,
                    end: end,
                    room: room || "N/A",
                    type: "Theory",
                    isManual: true
                }))
            }]
        };

        this.selectedCourses.unshift({ course: manualCourse, selectedSectionIndex: 0, isPinned: false });
        return true;
    }

    updateManualCourse(idx, data) {
        if (this.selectedCourses[idx]) {
            const { subject, days, start, end, section, room } = data;
            const course = this.selectedCourses[idx].course;
            course.baseTitle = subject;
            const sec = course.sections[0];
            sec.section = section || "1";
            sec.schedules = days.map(day => ({
                day: day,
                start: start,
                end: end,
                room: room || "N/A",
                type: "Theory",
                isManual: true
            }));
            return true;
        }
        return false;
    }

    removeCourse(idx) {
        this.selectedCourses.splice(idx, 1);
    }

    updateSectionSelection(cIdx, sIdx) {
        this.selectedCourses[cIdx].selectedSectionIndex = sIdx;
    }

    togglePin(idx) {
        if (this.selectedCourses[idx]) {
            this.selectedCourses[idx].isPinned = !this.selectedCourses[idx].isPinned;
        }
    }

    generateRoutines(filters) {
        const { minS, maxE, maxC, allowedStatuses, allowedDays, sortBy } = filters;
        this.possibleRoutines = [];

        const find = (idx, current) => {
            if (idx === this.selectedCourses.length) {
                this.possibleRoutines.push([...current]);
                return;
            }

            const sc = this.selectedCourses[idx];
            const course = sc.course;
            const sectionsToTry = sc.isPinned ? [course.sections[sc.selectedSectionIndex]] : course.sections;

            for (const sec of sectionsToTry) {
                if (!sec) continue; // Safety check
                if (parseInt(sec.count) > maxC && maxC < 100) continue;
                if (!allowedStatuses.includes(sec.status.toLowerCase().trim())) continue;

                let validTime = true;
                for (const s of sec.schedules) {
                    const times = this.getEffectiveTimes(s);
                    if (times.start < minS || times.end > maxE || !allowedDays.includes(s.day.substring(0, 3).toLowerCase())) {
                        validTime = false;
                        break;
                    }
                }
                if (!validTime) continue;
                if (this.hasConflict(sec, current)) continue;

                current.push({ courseTitle: course.baseTitle, dept: course.dept, section: sec });
                find(idx + 1, current);
                current.pop();
            }
        };

        find(0, []);

        if (sortBy === 'gaps') {
            // Sort to bring most compact routines to the top
            this.possibleRoutines.sort((a, b) => {
                const gapsA = this.calculateGaps(a);
                const gapsB = this.calculateGaps(b);
                if (gapsA !== gapsB) return gapsA - gapsB;

                // If gaps are equal, prefer fewer days on campus
                return this.countDays(a) - this.countDays(b);
            });

            // Apply strict filter: only show routines with <= 5h 40m (340 mins) of waiting time
            this.possibleRoutines = this.possibleRoutines.filter(r => this.calculateGaps(r) <= 340);
        } else if (sortBy === 'max2hr') {
            this.possibleRoutines = this.possibleRoutines.filter(r => this.calculateGaps(r) <= 120);
            this.possibleRoutines.sort((a, b) => {
                const gapsA = this.calculateGaps(a);
                const gapsB = this.calculateGaps(b);
                if (gapsA !== gapsB) return gapsA - gapsB;
                return this.countDays(a) - this.countDays(b);
            });
        } else if (sortBy === 'best') {
            // First, see if any zero-gap routines exist
            const zeroGaps = this.possibleRoutines.filter(r => this.calculateGaps(r) === 0);

            if (zeroGaps.length > 0) {
                this.possibleRoutines = zeroGaps;
            } else {
                // If no zero-gap routines, find the minimum gap possible in the set
                const minGap = Math.min(...this.possibleRoutines.map(r => this.calculateGaps(r)));
                this.possibleRoutines = this.possibleRoutines.filter(r => this.calculateGaps(r) === minGap);
            }

            // Always sort by days (fewest days on campus)
            this.possibleRoutines.sort((a, b) => this.countDays(a) - this.countDays(b));
        }

        return this.possibleRoutines;
    }

    hasConflict(secA, existing) {
        return existing.some(item => {
            const secB = item.section;
            return secA.schedules.some(schA => secB.schedules.some(schB => {
                const dayA = this.normalizeDay(schA.day);
                const dayB = this.normalizeDay(schB.day);
                if (dayA !== dayB) return false;
                const timesA = this.getEffectiveTimes(schA);
                const timesB = this.getEffectiveTimes(schB);
                return (timesA.start < timesB.end && timesA.end > timesB.start);
            }));
        });
    }

    normalizeDay(dayStr) {
        if (!dayStr) return "";
        const raw = dayStr.trim().toUpperCase();
        const dayMap = { 'SUN': 'Sunday', 'MON': 'Monday', 'TUE': 'Tuesday', 'WED': 'Wednesday', 'THU': 'Thursday', 'FRI': 'Friday', 'SAT': 'Saturday' };
        for (const k in dayMap) {
            if (raw.startsWith(k)) return dayMap[k];
        }
        return dayStr;
    }

    toMin(s) {
        try {
            if (!s || typeof s !== 'string') return 0;
            const parts = s.trim().split(' ');
            if (parts.length < 2) {
                // Handle 24h format (HH:MM or HH.MM)
                const separator = parts[0].includes(':') ? ':' : '.';
                const [h, m] = parts[0].split(separator).map(Number);
                return (h || 0) * 60 + (m || 0);
            }
            const [t, m] = parts;
            const separator = t.includes(':') ? ':' : '.';
            let [h, min] = t.split(separator).map(Number);
            if (h === 12) h = 0;
            if (m.toUpperCase().includes('PM')) h += 12;
            return (h || 0) * 60 + (min || 0);
        } catch (e) { return 0; }
    }

    // Helper to get effective start/end minutes
    getEffectiveTimes(schedule) {
        if (!this.ramadanMode || schedule.isManual) {
            return {
                start: this.toMin(schedule.start),
                end: this.toMin(schedule.end),
                startStr: schedule.start,
                endStr: schedule.end
            };
        }

        const start = schedule.start.trim().toUpperCase();
        const end = schedule.end.trim().toUpperCase();
        const slotKey = `${this.formatTime(start)} - ${this.formatTime(end)}`;

        // Priority Logic: Try each map for a specific key match
        const findMapping = (key) => {
            let result = null;

            // 1. Check Custom Map (User Uploaded)
            if (this.customRamadanMap && this.customRamadanMap[key]) {
                const custom = this.customRamadanMap[key];
                // Only use if it actually defines a shift (different from key)
                if (key !== `${this.formatTime(custom[0])} - ${this.formatTime(custom[1])}`) {
                    result = custom;
                }
            }

            // 2. Check Global Admin Map
            if (!result && this.globalRamadanMap && this.globalRamadanMap[key]) {
                result = this.globalRamadanMap[key];
            }

            if (result) return result;

            const defaults = {
                // Lecture (1h 30min) -> 1h
                "08:00 AM - 09:30 AM": ["09:00 AM", "10:00 AM"],
                "09:40 AM - 11:10 AM": ["10:00 AM", "11:00 AM"],
                "11:20 AM - 12:50 PM": ["11:00 AM", "12:00 PM"],
                "01:00 PM - 02:30 PM": ["12:00 PM", "01:00 PM"],
                "02:40 PM - 04:10 PM": ["01:20 PM", "02:20 PM"],
                "04:20 PM - 05:50 PM": ["02:20 PM", "03:20 PM"],
                "08:00 AM - 09:20 AM": ["09:00 AM", "10:00 AM"],
                "09:40 AM - 11:00 AM": ["10:00 AM", "11:00 AM"],
                "11:20 AM - 12:40 PM": ["11:00 AM", "12:00 PM"],
                "01:00 PM - 02:20 PM": ["12:00 PM", "01:00 PM"],
                "02:40 PM - 04:00 PM": ["01:00 PM", "02:00 PM"],
                "08:00 AM - 10:00 AM": ["09:00 AM", "10:20 AM"],
                "10:20 AM - 12:20 PM": ["10:30 AM", "11:50 AM"],
                "12:40 PM - 02:40 PM": ["12:00 PM", "01:20 PM"],
                "03:00 PM - 05:00 PM": ["01:30 PM", "02:50 PM"],
                "08:00 AM - 09:00 AM": ["09:00 AM", "09:40 AM"],
                "09:10 AM - 10:10 AM": ["09:40 AM", "10:20 AM"],
                "10:20 AM - 11:20 AM": ["10:20 AM", "11:00 AM"],
                "11:30 AM - 12:30 PM": ["11:10 AM", "11:50 AM"],
                "12:40 PM - 01:40 PM": ["12:00 PM", "12:40 PM"],
                "01:50 PM - 02:50 PM": ["12:40 PM", "01:20 PM"],
                "08:00 AM - 10:20 AM": ["09:00 AM", "10:30 AM"],
                "10:20 AM - 12:40 PM": ["10:30 AM", "12:00 PM"],
                "12:40 PM - 03:00 PM": ["12:00 PM", "01:30 PM"],
                "03:00 PM - 05:20 PM": ["01:30 PM", "03:00 PM"],
                "08:00 AM - 11:00 AM": ["09:00 AM", "11:00 AM"],
                "11:00 AM - 02:00 PM": ["11:00 AM", "01:00 PM"],
                "02:00 PM - 05:00 PM": ["01:00 PM", "03:00 PM"],
                "08:30 AM - 11:30 AM": ["09:00 AM", "11:00 AM"],
                "08:30 AM - 01:00 PM": ["09:00 AM", "12:20 PM"],
                "08:30 AM - 02:00 PM": ["09:00 AM", "01:00 PM"],
                "02:00 PM - 05:00 PM": ["01:00 PM", "03:00 PM"],

                // Common 3h and 1.5h postgraduate/specialized shifts
                "10:00 AM - 01:00 PM": ["11:00 AM", "01:00 PM"],
                "01:00 PM - 04:00 PM": ["12:00 PM", "02:00 PM"],
                "04:00 PM - 07:00 PM": ["02:00 PM", "04:00 PM"],
                "01:30 PM - 03:00 PM": ["01:20 PM", "02:20 PM"],
                "06:30 PM - 09:30 PM": ["03:30 PM", "05:30 PM"],
                "06:30 PM - 08:00 PM": ["03:30 PM", "04:30 PM"],
                "08:00 PM - 09:30 PM": ["04:30 PM", "05:30 PM"]
            };
            return defaults[key];
        };

        const result = findMapping(slotKey);
        if (result) {
            return {
                start: this.toMin(result[0]),
                end: this.toMin(result[1]),
                startStr: result[0],
                endStr: result[1]
            };
        }

        // Fallback: If no exact slot match, shift by 1 hour later if it starts at 8:00 AM
        let shift = 0;
        const startMin = this.toMin(start);
        if (startMin >= 480 && startMin <= 900) { // 8 AM to 3 PM
            // Standard shift: most classes start 1 hour later (9:00 instead of 8:00)
            // But let's just return original if no clear mapping to avoid mess
        }

        return {
            start: this.toMin(schedule.start),
            end: this.toMin(schedule.end),
            startStr: schedule.start,
            endStr: schedule.end
        };
    }

    formatTime(s) {
        if (!s) return "";
        let [t, p] = s.trim().split(' ');
        const separator = t.includes(':') ? ':' : '.';
        let [h, m] = t.split(separator);
        return `${h.padStart(2, '0')}:${m.padStart(2, '0')} ${p}`;
    }

    countDays(routine) {
        const days = new Set();
        routine.forEach(item => {
            item.section.schedules.forEach(s => {
                if (s.day) days.add(this.normalizeDay(s.day));
            });
        });
        return days.size;
    }

    calculateGaps(routine) {
        let totalGaps = 0;
        const dayKeys = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

        dayKeys.forEach(day => {
            let schs = [];
            routine.forEach(item => {
                // Handle both generated routine items and direct selections
                const section = item.section || (item.course && item.course.sections[item.selectedSectionIndex]);
                if (!section) return;

                section.schedules.forEach(s => {
                    if (s.day && s.day.toUpperCase().startsWith(day)) {
                        const times = this.getEffectiveTimes(s);
                        schs.push({ start: times.start, end: times.end });
                    }
                });
            });

            if (schs.length > 1) {
                schs.sort((a, b) => a.start - b.start);
                for (let i = 0; i < schs.length - 1; i++) {
                    const gap = schs[i + 1].start - schs[i].end;
                    if (gap > 0) totalGaps += gap;
                }
            }
        });
        return totalGaps;
    }

    calculateCredits() {
        const target = this.isExplorerMode ? this.possibleRoutines[this.currentRoutineIndex] : this.selectedCourses;
        return target.reduce((s, it) => s + ((it.courseTitle || it.course.baseTitle).toLowerCase().includes('lab') ? 1 : 3), 0);
    }

    parseExcelData(rows) {
        let headerIdx = -1;
        let colMap = {};

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !Array.isArray(row)) continue;
            const rowStr = row.map(c => String(c || '').toUpperCase().trim());
            // Support both AIUB standard formats
            if (rowStr.includes("CLASS ID") || rowStr.includes("COURSE CODE") || rowStr.includes("SECTION")) {
                headerIdx = i;
                rowStr.forEach((cell, idx) => {
                    if (cell.includes("CLASS ID")) colMap.id = idx;
                    if (cell.includes("COURSE CODE")) colMap.code = idx;
                    if (cell.includes("STATUS")) colMap.status = idx;
                    if (cell.includes("CAPACITY")) colMap.capacity = idx;
                    if (cell.includes("COUNT")) colMap.count = idx;
                    if (cell.includes("COURSE TITLE")) colMap.title = idx;
                    if (cell.includes("SECTION")) colMap.section = idx;
                    if (cell.includes("TYPE")) colMap.type = idx;
                    if (cell.includes("DAY")) colMap.day = idx;
                    if (cell.includes("START TIME")) colMap.start = idx;
                    if (cell.includes("END TIME")) colMap.end = idx;
                    if (cell.includes("ROOM")) colMap.room = idx;
                    if (cell.includes("DEPARTMENT")) colMap.dept = idx;
                });
                break;
            }
        }

        if (headerIdx === -1 || colMap.id === undefined) {
            throw new Error("Could not find a valid course report header structure.");
        }

        const dataRows = rows.slice(headerIdx + 1);
        const coursesMap = {};
        
        // Track context across rows
        let lastCode = "";
        let lastTitle = "";
        let lastDept = "";

        dataRows.forEach(row => {
            const classId = String(row[colMap.id] || '').trim();
            // Skip empty rows, header repeats, or summary rows
            if (!classId || classId === "nan" || isNaN(classId) || classId.toUpperCase().includes("CLASS ID")) return;

            const rawCode = String(row[colMap.code] || '').trim();
            const rawTitle = String(row[colMap.title] || '').trim();
            const rawDept = String(row[colMap.dept] || '').trim();

            if (rawCode && rawCode !== "nan") lastCode = rawCode;
            if (rawTitle && rawTitle !== "nan") lastTitle = rawTitle;
            if (rawDept && rawDept !== "nan") lastDept = rawDept;

            if (!lastTitle || lastTitle.toUpperCase().includes("CLOSED SECTION")) return;

            const status = String(row[colMap.status] || 'Open').trim();
            const capacity = String(row[colMap.capacity] || '0').trim();
            const count = String(row[colMap.count] || '0').trim();
            const startTime = String(row[colMap.start] || '').trim();
            const endTime = String(row[colMap.end] || '').trim();
            const room = String(row[colMap.room] || '').trim();
            const classType = String(row[colMap.type] || 'Theory').trim();
            const day = this.normalizeDay(String(row[colMap.day] || ''));

            // ADVANCED TITLE PARSING based on USER Rules
            let fullTitle = lastTitle.trim();
            let sectionName = String(row[colMap.section] || '').trim();
            let baseTitle = fullTitle;

            // Rule: Identify section from last bracket and clean baseTitle
            // Identify patterns like [A], [B], [AA], [1], [L1], etc.
            const lastBracketRegex = /\s*\[([^\]]+)\]\s*$/;
            const match = fullTitle.match(lastBracketRegex);

            if (match) {
                const bracketContent = match[1].trim();
                // Heuristic: If it's the last bracket AND (it matches the section column OR it's a short section identifier)
                // Short identifiers like A, AA, B1, 1, 2 are common. Tags like [FST/FE] or [SOCIAL SCIENCE] are longer.
                const isProbablySection = bracketContent.length <= 3 || 
                                         bracketContent.toUpperCase() === sectionName.toUpperCase() ||
                                         /^[A-Z]{1,2}\d?$/.test(bracketContent) ||
                                         /^\d+$/.test(bracketContent);

                if (isProbablySection) {
                    baseTitle = fullTitle.replace(lastBracketRegex, '').trim();
                    // If Excel section is missing, use the one from the bracket
                    if (!sectionName || sectionName === "nan") {
                        sectionName = bracketContent;
                    }
                }
            }
            
            // Clean up any double spaces
            baseTitle = baseTitle.replace(/\s+/g, ' ');

            // Group solely by the unique, cleaned baseTitle
            const key = baseTitle.toUpperCase();

            if (!coursesMap[key]) {
                coursesMap[key] = {
                    code: lastCode,
                    baseTitle: baseTitle,
                    dept: lastDept,
                    sections: {}
                };
            }

            // Standardize section name for grouping
            const finalSectionName = sectionName || "N/A";

            // Create or update section
            if (!coursesMap[key].sections[finalSectionName]) {
                coursesMap[key].sections[finalSectionName] = {
                    id: classId,
                    section: finalSectionName,
                    status: status,
                    capacity: capacity,
                    count: count,
                    schedules: []
                };
            }

            coursesMap[key].sections[finalSectionName].schedules.push({
                day: day,
                start: startTime,
                end: endTime,
                room: room,
                type: classType
            });
        });

        return Object.values(coursesMap).map(data => {
            data.sections = Object.values(data.sections).sort((a, b) => a.section.localeCompare(b.section, undefined, {numeric: true}));
            return data;
        });
    }

    getShareableData() {
        const data = this.selectedCourses.map(sc => {
            if (sc.course.code === 'MANUAL') {
                return {
                    m: 1, // manual
                    t: sc.course.baseTitle,
                    s: sc.course.sections[0].section,
                    r: sc.course.sections[0].schedules[0].room,
                    sh: sc.course.sections[0].schedules[0].start,
                    eh: sc.course.sections[0].schedules[0].end,
                    d: sc.course.sections[0].schedules.map(s => s.day)
                };
            } else {
                return {
                    c: sc.course.code,
                    s: sc.course.sections[sc.selectedSectionIndex].section,
                    p: sc.isPinned ? 1 : 0
                };
            }
        });

        // Add settings
        const settings = {
            r: this.ramadanMode ? 1 : 0,
            f: this.focusMode ? 1 : 0,
            t: this.twentyFourHourMode ? 1 : 0,
            c: this.compactMode ? 1 : 0
        };

        const payload = { items: data, config: settings };
        return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    }

    loadFromSharedData(base64) {
        try {
            const json = decodeURIComponent(escape(atob(base64)));
            const payload = JSON.parse(json);
            
            if (payload && payload.items) {
                // We'll process items AFTER allCourses is loaded
                this.pendingSharedItems = payload.items;
                if (payload.config) {
                    this.ramadanMode = !!payload.config.r;
                    this.focusMode = !!payload.config.f;
                    this.twentyFourHourMode = !!payload.config.t;
                    this.compactMode = !!payload.config.c;
                }
            }
        } catch (e) {
            console.error("Failed to decode shared routine:", e);
        }
    }

    applySharedItems() {
        if (!this.pendingSharedItems || !this.allCourses.length) return;

        this.selectedCourses = [];
        this.pendingSharedItems.forEach(item => {
            if (item.m) {
                // Manual Course
                this.addManualCourse({
                    subject: item.t,
                    days: item.d,
                    start: item.sh,
                    end: item.eh,
                    section: item.s,
                    room: item.r
                });
            } else {
                // Library Course
                const course = this.allCourses.find(c => c.code === item.c);
                if (course) {
                    const sIdx = course.sections.findIndex(s => s.section === item.s);
                    if (sIdx !== -1) {
                        this.selectedCourses.push({
                            course: course,
                            selectedSectionIndex: sIdx,
                            isPinned: !!item.p
                        });
                    }
                }
            }
        });

        this.pendingSharedItems = null;
    }
}
