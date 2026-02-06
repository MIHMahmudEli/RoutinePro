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
}
