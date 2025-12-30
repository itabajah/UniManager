/**
 * @file course-logic.js
 * @description Course CRUD operations and semester management
 */

// ============================================================================
// COURSE CRUD OPERATIONS
// ============================================================================

/**
 * Saves or updates a course from the course modal.
 */
function saveCourse() {
    const nameInput = $('course-name');
    const nameValidation = validateCourseName(nameInput.value);
    
    if (!nameValidation.valid) {
        ToastManager.error(nameValidation.error);
        nameInput.focus();
        return;
    }

    const semester = getCurrentSemester();
    if (!semester) {
        ToastManager.error('No semester selected');
        return;
    }

    const courseData = buildCourseData(nameValidation.value);

    if (editingCourseId) {
        updateExistingCourse(semester, courseData);
        ToastManager.success('Course updated');
    } else {
        createNewCourse(semester, courseData);
        ToastManager.success(`Course "${nameValidation.value}" created`);
    }

    saveData();
    renderAll();
    closeModal('course-modal');
}

/**
 * Builds course data object from modal inputs.
 * @param {string} name - Course name
 * @returns {Object} Course data object
 */
function buildCourseData(name) {
    const colorTheme = appData.settings.colorTheme || 'colorful';
    const hue = $('course-color-hue').value;
    const color = colorTheme === 'mono' ? 'hsl(0, 0%, 50%)' : `hsl(${hue}, 45%, 50%)`;
    
    return {
        name,
        color,
        number: $('course-number').value,
        points: $('course-points').value,
        lecturer: $('course-lecturer').value,
        faculty: $('course-faculty').value,
        location: $('course-location').value,
        grade: $('course-grade').value,
        syllabus: $('course-syllabus').value,
        notes: $('course-notes').value,
        exams: { 
            moedA: $('course-exam-a').value, 
            moedB: $('course-exam-b').value 
        },
        schedule: window.tempSchedule
    };
}

/**
 * Updates an existing course with new data.
 * @param {Object} semester - Current semester
 * @param {Object} courseData - Course data to apply
 */
function updateExistingCourse(semester, courseData) {
    const course = semester.courses.find(c => c.id === editingCourseId);
    if (!course) return;
    
    Object.assign(course, courseData);
    
    // Ensure required structures exist
    if (!course.homework) course.homework = [];
    if (!course.recordings) {
        course.recordings = createDefaultRecordings();
    }
}

/**
 * Creates a new course in the semester.
 * @param {Object} semester - Current semester
 * @param {Object} courseData - Course data
 */
function createNewCourse(semester, courseData) {
    semester.courses.push({
        id: generateId(),
        ...courseData,
        recordings: createDefaultRecordings(),
        homework: []
    });
}

/**
 * Creates default recordings structure for a course.
 * @returns {Object} Default recordings object
 */
function createDefaultRecordings() {
    return {
        tabs: [
            { id: 'lectures', name: 'Lectures', items: [] },
            { id: 'tutorials', name: 'Tutorials', items: [] }
        ]
    };
}

/**
 * Deletes the currently editing course after confirmation.
 */
async function deleteCourse() {
    if (!editingCourseId) return;
    
    const semester = getCurrentSemester();
    if (!semester) return;
    
    const course = semester.courses.find(c => c.id === editingCourseId);
    const courseName = course?.name || 'this course';
    
    const confirmed = await showConfirmDialog(
        `Delete "${courseName}"?`,
        {
            title: 'Delete Course',
            description: 'This will permanently delete this course and all its recordings, homework, and schedule. This action cannot be undone.',
            confirmText: 'Delete',
            dangerous: true
        }
    );
    
    if (!confirmed) return;
    
    semester.courses = semester.courses.filter(c => c.id !== editingCourseId);
    
    saveData();
    renderAll();
    closeModal('course-modal');
    ToastManager.success(`Course "${courseName}" deleted`);
}

/**
 * Moves a course up or down in the list.
 * @param {number} index - Current course index
 * @param {string} direction - 'up' or 'down'
 */
function moveCourse(index, direction) {
    const semester = getCurrentSemester();
    if (!semester) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= semester.courses.length) return;
    
    [semester.courses[index], semester.courses[newIndex]] = 
    [semester.courses[newIndex], semester.courses[index]];
    
    saveData();
    renderCourses();
}

// ============================================================================
// SEMESTER OPTIONS
// ============================================================================

/**
 * Populates the semester select dropdown with generated options.
 */
function populateSemesterOptions() {
    const select = $('new-semester-select');
    if (!select) return;
    
    select.innerHTML = '';
    
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];
    const seasons = ['Winter', 'Spring', 'Summer'];
    
    years.forEach(year => {
        seasons.forEach(season => {
            const name = season === 'Winter' ? `${season} ${year}-${year+1}` : `${season} ${year}`;
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    });

    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Custom...';
    select.appendChild(customOption);
}
