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
    }

    async loadInitialData() {
        const localCourses = localStorage.getItem('routine-pro-courses');
        if (localCourses) {
            this.allCourses = JSON.parse(localCourses);
        } else {
            const res = await fetch('courses.json');
            if (res.ok) {
                this.allCourses = await res.json();
            }
        }
        return this.allCourses;
    }

    saveCourses(data, semesterName = null) {
        this.allCourses = data;
        localStorage.setItem('routine-pro-courses', JSON.stringify(data));
        localStorage.setItem('routine-pro-last-sync', new Date().toLocaleString());
        if (semesterName) {
            localStorage.setItem('routine-pro-semester', semesterName);
        }
        this.selectedCourses = [];
        this.possibleRoutines = [];
        this.currentRoutineIndex = 0;
    }

    addCourse(course) {
        if (!this.selectedCourses.some(sc => sc.course.baseTitle === course.baseTitle)) {
            this.selectedCourses.push({ course, selectedSectionIndex: 0 });
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

    generateRoutines(filters) {
        const { minS, maxE, maxC, allowedStatuses, allowedDays } = filters;
        this.possibleRoutines = [];

        const find = (idx, current) => {
            if (idx === this.selectedCourses.length) {
                this.possibleRoutines.push([...current]);
                return;
            }

            const course = this.selectedCourses[idx].course;
            for (const sec of course.sections) {
                if (parseInt(sec.count) > maxC && maxC < 100) continue;
                if (!allowedStatuses.includes(sec.status.toLowerCase().trim())) continue;

                let validTime = true;
                for (const s of sec.schedules) {
                    if (this.toMin(s.start) < minS || this.toMin(s.end) > maxE || !allowedDays.includes(s.day.substring(0, 3).toLowerCase())) {
                        validTime = false;
                        break;
                    }
                }
                if (!validTime) continue;
                if (this.hasConflict(sec, current)) continue;

                current.push({ courseTitle: course.baseTitle, section: sec });
                find(idx + 1, current);
                current.pop();
            }
        };

        find(0, []);
        return this.possibleRoutines;
    }

    hasConflict(secA, existing) {
        return existing.some(item => {
            const secB = item.section;
            return secA.schedules.some(schA => secB.schedules.some(schB => {
                if (schA.day !== schB.day) return false;
                return (this.toMin(schA.start) < this.toMin(schB.end) && this.toMin(schA.end) > this.toMin(schB.start));
            }));
        });
    }

    toMin(s) {
        try {
            const [t, m] = s.trim().split(' ');
            let [h, min] = t.split(':').map(Number);
            if (h === 12) h = 0;
            if (m === 'PM') h += 12;
            return h * 60 + min;
        } catch (e) { return 0; }
    }

    calculateGaps(routine) {
        let totalGaps = 0;
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        days.forEach(day => {
            let schs = [];
            routine.forEach(item => {
                item.section.schedules.forEach(s => {
                    if (s.day === day) schs.push({ start: this.toMin(s.start), end: this.toMin(s.end) });
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
            if (rowStr.includes("CLASS ID") || rowStr.includes("COURSE TITLE")) {
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
                });
                break;
            }
        }

        if (headerIdx === -1 || colMap.id === undefined) {
            throw new Error("Could not find a valid course report header structure.");
        }

        const dataRows = rows.slice(headerIdx + 1);
        const coursesMap = {};
        let currentCourseCode = "";

        dataRows.forEach(row => {
            const classId = String(row[colMap.id] || '').trim();
            if (!classId || classId === "nan" || classId.toUpperCase().includes("CLASS ID")) return;

            const rawCode = String(row[colMap.code] || '').trim();
            if (rawCode && rawCode !== "nan") currentCourseCode = rawCode;

            const status = String(row[colMap.status] || 'Open').trim();
            const capacity = String(row[colMap.capacity] || '0').trim();
            const count = String(row[colMap.count] || '0').trim();
            const fullTitle = String(row[colMap.title] || '').trim();
            const sectionName = String(row[colMap.section] || '').trim();
            const classType = String(row[colMap.type] || '').trim();
            const day = String(row[colMap.day] || '').trim();
            const startTime = String(row[colMap.start] || '').trim();
            const endTime = String(row[colMap.end] || '').trim();
            const room = String(row[colMap.room] || '').trim();

            if (!fullTitle) return;

            const baseTitle = fullTitle.replace(/\s*\[.*\]$/, '').trim();
            const key = `${baseTitle}@@@${currentCourseCode}`;

            if (!coursesMap[key]) {
                coursesMap[key] = {
                    code: currentCourseCode,
                    baseTitle: baseTitle,
                    sections: {}
                };
            }

            if (!coursesMap[key].sections[sectionName]) {
                coursesMap[key].sections[sectionName] = {
                    id: classId,
                    section: sectionName,
                    status: status,
                    capacity: capacity,
                    count: count,
                    schedules: []
                };
            }

            coursesMap[key].sections[sectionName].schedules.push({
                day: day,
                start: startTime,
                end: endTime,
                room: room,
                type: classType
            });
        });

        return Object.values(coursesMap).map(data => {
            data.sections = Object.values(data.sections).sort((a, b) => a.section.localeCompare(b.section));
            return data;
        });
    }
}
