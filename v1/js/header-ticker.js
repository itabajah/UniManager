/**
 * @file header-ticker.js
 * @description Header ticker (fun reminders) logic and message templates.
 */

'use strict';

// ============================================================================
// TICKER TEMPLATES (easy to extend)
// ============================================================================

/**
 * Add new templates by appending strings to the arrays below.
 * Supported placeholders are written as {placeholder}.
 */
const HEADER_TICKER_TEMPLATES = {
    no_semester: [
        'No active semester. You\'re driving without a map.',
        'You have zero semesters selected. That\'s… bold.',
        'Start a semester first. Then we can bully you productively.'
    ],
    no_courses: [
        'No courses yet. Add one and let the chaos begin.',
        'Your semester is empty. Feed it a course.',
        'No courses found. Click + and build your timetable empire.',
        'No courses. No problems. No degree. (Let\'s add a course.)',
        'Your course list is empty. That\'s peaceful… and incorrect.'
    ],
    no_schedule: [
        'No schedule set. You\'re free… but also in danger.',
        'Your courses have zero class times. Add schedule slots and stop living on hard mode.',
        'No lectures on the timetable. Either you\'re a genius or the schedule is missing.',
        'Schedule is empty. The calendar is offended.'
    ],
    no_classes_today: [
        'No classes today. Suspiciously peaceful.',
        'Today: no lectures. Use this power wisely.',
        'No classes today. Side quest: do homework before it becomes a boss fight.',
        'No lectures today. This is your one chance to get ahead before chaos returns.',
        'No classes today. Please do not spend this blessing on scrolling.'
    ],
    all_clear: [
        'All clear. Enjoy the calm (and maybe study anyway).',
        'Nothing urgent. This is your chance to get ahead.',
        'No immediate fires. Keep it that way.',
        'You\'re surprisingly on top of things. Who are you and what did you do with you?',
        'Nothing urgent right now. This is rare. Cherish it.',
        'The task list is quiet. Suspicious… but we\'ll take it.',
        'You\'re caught up. Don\'t panic—this feeling is allowed.',
        'Nothing urgent. Universe is buffering. Enjoy.'
    ],
    late_night: [
        'It\'s late. If you\'re still studying, respect. If not… sleep.exe?',
        'Late-night mode detected. Hydrate, stretch, and maybe close TikTok.',
        'It\'s {time}. Your brain deserves a break. Or a tiny homework sprint.',
        'Night owl energy at {time}. Keep it clean: 20 min work, then sleep.',
        'It\'s {time}. If you\'re here by choice, you\'re powerful. If not, blink twice.',
        '{time}. This is either dedication or a sleep schedule crime scene.'
    ],
    morning: [
        'Good morning. Small win: pick ONE task and finish it.',
        'Morning energy is OP. Use it before it disappears.',
        'You\'re awake! Time to do something your future self will thank you for.',
        'Morning brain is peak performance. Spend it wisely.',
        'Good morning. One tiny task now = no panic later.'
    ],
    weekend: [
        'Weekend vibes. Also: future-you would love 30 minutes of progress.',
        'It\'s the weekend. You can rest *and* do one tiny task. Balance.',
        'Weekend = side quests. Choose a homework and delete it from existence.',
        'Weekend. Recharge… then do one thing so Monday doesn\'t jump-scare you.',
        'It\'s the weekend. A little progress now = maximum peace later.'
    ],
    class_now: [
        'Lecture is live עכשיו ({start}-{end}). Be academically present™.',
        'שיעור עכשיו{courseMaybe}. פוקוס.',
        'Live right now{courseMaybe}. Notes time.',
        'Class is happening עכשיו ({start}-{end}). No disappearing.',
        'Breaking news: lecture is live. Your attendance is not.',
        'This is not a drill. This is a lecture. עכשיו{courseMaybe}.',
        'LIVE NOW{courseMaybe}. Pretend you\'re not multitasking.',
        'You are currently in a lecture. Act natural.',
        'Right now ({start}-{end}){courseMaybe}. Phone down gently.',
        'It\'s class time{courseMaybe}. We\'re going in.',
        'Lecture now. Minimize chaos. Maximize notes.',
        'Class is live. Your only job is to exist and absorb.'
    ],
    class_soon: [
        'Class in {minutes} minutes{courseMaybe}. This is your warning shot.',
        '{minutes} minutes until lecture{courseMaybe}. Shoes. Keys. Brain. Go.',
        'Incoming in {minutes} min{courseMaybe}. Leave now like you meant it.',
        'Class starts soon{courseMaybe}. Stop side quests. Start main quest.'
    ],
    class_next: [
        'Next lecture at {start}{courseMaybe}. Do not be late.',
        'Lecture starts in {minutes} minutes{courseMaybe}. Move!',
        'Reminder: lecture at {start}{courseMaybe}. You got this.',
        '{minutes} minutes until class{courseMaybe}. Shoes on. Brain on.',
        'Speedrun: arrive before {start}. (You can do it.)',
        'Upcoming at {start}{courseMaybe}. Time to switch to campus-mode.',
        'Next up: {start}{courseMaybe}. Main quest > side quests.',
        'Class at {start}{courseMaybe}. Grab water, keys, dignity.',
        'If you leave now, you can arrive like you meant to. ({start})',
        'Reminder: {start}{courseMaybe}. The bed is a liar.',
        'Next class at {start}{courseMaybe}. Don\'t let it surprise you.',
        '{start} is coming{courseMaybe}. Your backpack misses you.'
    ],
    class_tomorrow: [
        'Tomorrow at {start}{courseMaybe}. Set the alarm. Respectfully.',
        'Heads up: tomorrow {start}{courseMaybe}. Prepare your brain.',
        'Tomorrow {start}{courseMaybe}. Don\'t let it jump-scare you.',
        'PSA: tomorrow at {start}{courseMaybe}. Plan like a legend.',
        'Tomorrow\'s you called. They\'d like you to sleep on time. ({start})'
    ],
    hw_nodate: [
        '{title} has no due date. That\'s how assignments sneak-attack you.',
        'Set a due date for {title}. Your future self will thank you.',
        '{title} is floating in the void (no date). Pin it down.',
        '{title} without a due date is just anxiety in disguise.',
        'No due date for {title}. Bold strategy. Let\'s not test it.',
        '{title} has no date. That\'s how tasks become legends (and not in a good way).',
        'No due date for {title}. This is how procrastination gets a passport.'
    ],
    hw_many: [
        'You have {count} unfinished homeworks. That\'s a whole season of content.',
        '{count} homeworks pending. Pick one. Delete it. Repeat.',
        '{count} homeworks waiting. This is not a collectible set.',
        'Mission: reduce homework count from {count} to {countMinusOne}. Start now.',
        '{count} homeworks pending. This is not a personality trait.',
        'Homeworks remaining: {count}. Let\'s do some subtraction.'
    ],
    hw_all_done: [
        'All homework is done. Who are you and how can we learn your ways?',
        'Homework status: CLEAN. Enjoy the peace.',
        'No pending homework. This is suspiciously responsible.',
        'Homework: 0. You\'re living the dream.'
    ],
    hw_overdue: [
        'HAVEN\'T YOU STARTED {title} YET?? It\'s {days} day(s) overdue.',
        '{title} is overdue. Future you is not impressed.',
        'Stop procrastinating: {title} was due {days} day(s) ago.',
        '{title} is {days} day(s) late. That\'s not a flex.',
        'The deadline left without you: {title} ({days} day(s) ago).',
        'Congratulations, you unlocked: OVERDUE MODE. ({title})',
        'We\'re not saying panic… but {title} is overdue.',
        'Friendly reminder with a tiny scream: {title} is overdue.',
        '{title} is overdue. Let\'s do damage control, not self-hate.',
        'Overdue: {title}. Step 1: open it. Step 2: do literally anything.',
        '{title} is overdue. We can still clutch. Open it and do ONE thing.',
        'Overdue homework detected. Calm. Open {title}. Tiny progress. Win.'
    ],
    hw_today: [
        'TODAY: {title}. Do it. Now.',
        'Deadline today: {title}{courseMaybe}.',
        '{title} is due today. Quick win?',
        'Today\'s menu: {title}. Chef, start cooking.',
        'If you do {title} today, tomorrow-you will send a thank-you note.',
        'Today is the day. {title}. No drama, just results.',
        '{title} due today. We can do hard things.',
        'Reminder: {title} is due today. Do it messy, do it done.',
        '{title} due today. A 60% done is still 100% submitted.',
        'Due today: {title}. Your keyboard is about to see things.',
        '{title} due today. This is your montage moment.',
        'Due today: {title}. Enter goblin mode (but submit).'
    ],
    hw_tomorrow: [
        'Due tomorrow: {title}. Do future-you a favor.',
        '{title} is due tomorrow{courseMaybe}. Start now and avoid the 2am arc.',
        'Tomorrow\'s deadline is approaching: {title}. Begin the ritual.',
        '{title} due tomorrow. One small chunk today = massive relief.'
    ],
    hw_soon: [
        'Haven\'t you started {title} yet?? Due in {days} day(s).',
        '{title} due in {days} day(s). Tiny steps count.',
        'Reminder: {title}{courseMaybe} due in {days} day(s).',
        '{days} day(s) until {title}. Start with 10 minutes. That\'s it.',
        'Procrastination called. I declined. Go start {title}.',
        'Reminder: {title} in {days} day(s). Your brain will thank you.',
        '{title} is coming. You can either start now or panic later.',
        'Small progress > big panic. {title} due in {days} day(s).',
        '{title} due in {days} day(s). Open it. Stare at it. That counts as step 1.',
        '{title} due in {days} day(s). Put 10 minutes on the clock and go.',
        '{title} due in {days} day(s). Do a tiny part. Become unstoppable.',
        '{title} is approaching. You still have time. Use it.'
    ],
    exam: [
        'EXAM ALERT: Moed {examType} in {days} day(s){courseMaybe}.',
        'Exam {examType} in {days} day(s){courseMaybe}. Good luck.',
        'Exam {examType} is coming up ({date}){courseMaybe}.',
        'Countdown: {days} day(s) until exam (Moed {examType}){courseMaybe}.',
        'Exam incoming: Moed {examType}{courseMaybe}. Time to become unstoppable.',
        'Moed {examType} in {days} day(s){courseMaybe}. Start with one topic today.',
        'You vs Moed {examType} in {days} day(s){courseMaybe}. Training arc begins.',
        'Reminder: exam {examType} on {date}{courseMaybe}. You got this.',
        'Exam {examType} on {date}{courseMaybe}. Today\'s plan: one PDF, no chaos.',
        'Exam incoming: {examType} ({date}){courseMaybe}. One page at a time.',
        'Exam in {days} day(s){courseMaybe}. Do one tiny topic today. Win tomorrow.',
        'Exam countdown running{courseMaybe}. Don\'t let it spawn-camp you.'
    ],
    exam_today: [
        'EXAM TODAY (Moed {examType}){courseMaybe}. Minimal panic. Maximum focus.',
        'Today\'s boss fight: exam {examType}{courseMaybe}. You\'ve got this.',
        'Exam day{courseMaybe}. Eat. Breathe. Destroy the questions politely.'
    ],
    exam_tomorrow: [
        'Exam tomorrow (Moed {examType}){courseMaybe}. Tonight is for a calm review.',
        'Tomorrow: exam {examType}{courseMaybe}. Sleep is part of the strategy.',
        'Exam tomorrow{courseMaybe}. One last pass, then rest.'
    ],
    exam_soon: [
        'Exam (Moed {examType}) in {days} day(s){courseMaybe}. Boss-fight territory.',
        'EXAM SOON: Moed {examType} in {days} day(s){courseMaybe}. Start with the easiest topic.',
        'Your exam is close: Moed {examType} in {days} day(s){courseMaybe}. No panic. Just a plan.',
        'Exam soon{courseMaybe}. This is where the training arc becomes real.'
    ],
    recordings_backlog: [
        '{count} recordings waiting{courseMaybe}. That\'s not going to watch itself.',
        'You have {count} unwatched recordings{courseMaybe}. Snack + lecture?',
        'Reminder: {count} recordings to catch up on{courseMaybe}.',
        '{count} recordings{courseMaybe}. Congratulations, you\'re basically a streaming service.',
        '{count} recordings pending{courseMaybe}. Start one on 1.25x and pretend it\'s cardio.',
        '{count} recordings are waiting{courseMaybe}. Pick one and press play. That\'s it.',
        'Recordings backlog detected: {count}{courseMaybe}. One today = hero arc.'
    ],
    recordings_big: [
        'Backlog is HUGE ({count}){courseMaybe}. Marathon, not meltdown.',
        '{count} recordings{courseMaybe}. That\'s a whole Netflix season. Start episode 1.',
        'Ok listen. {count} recordings{courseMaybe}. One today = hero arc.',
        '{count} recordings backlog{courseMaybe}. This is a multi-episode saga. Start chapter 1.'
    ],
    recordings_clear: [
        'Recordings backlog: 0. You\'re dangerously caught up.',
        'No unwatched recordings. This is elite behavior.',
        'Recordings are all watched. Your future self is cheering.'
    ],
    general: [
        'Reminder: you don\'t need motivation. You need a timer.',
        'If you do 15 minutes now, later-you stops yelling.',
        'Your to-do list isn\'t scary. It\'s just loud.',
        'Do the smallest possible version of the task. Still counts.',
        'Open the thing. Name the thing. That\'s step one.',
        'Tiny progress beats perfect plans.',
        'You can be behind and still make progress today.',
        'Today\'s strategy: fewer tabs, more output.'
    ],
    general_course_roast: [
        'This course{courseMaybe} is a beautifully engineered obstacle.',
        'Course{courseMaybe}: confidently assigns 6 hours of work like you don\'t have a life.',
        'Course{courseMaybe} really said “time management” and meant “good luck”.',
        'Course{courseMaybe} thinks it\'s the main character. You\'re the one doing side quests.',
        'Course{courseMaybe} has the audacity to exist twice a week.',
        'Course{courseMaybe} is a hobby for people who enjoy suffering (respectfully).',
        'Course{courseMaybe}: somehow both important and impossible.',
        'Course{courseMaybe} is teaching resilience. Not on purpose. But still.'
    ]
};

// ============================================================================
// TICKER STATE
// ============================================================================

let headerTickerItems = [];
let headerTickerIndex = 0;
let headerTickerTimerId = null;
let headerTickerActiveLane = 'a';
let headerTickerOrder = [];
let headerTickerItemsSignature = '';
let headerTickerLastOrderSignature = '';
let headerTickerMessageSeed = '';
let headerTickerLastDisplayedKey = '';
let headerTickerDisplayCounter = 0;

// Tracks how many times a specific item key has been shown (for cycling templates).
const headerTickerShownCountByKey = new Map();

// Cache for deterministic per-day template shuffle bags.
const headerTickerTemplateBagCache = new Map();

const HEADER_TICKER_ROTATE_MS = 9000;

// ============================================================================
// PUBLIC API (called by main.js / render.js)
// ============================================================================

/**
 * Builds and renders the current header ticker item.
 * The ticker shows playful reminders for: current/next class, homework, and exams.
 */
function renderHeaderTicker() {
    if (typeof $ !== 'function') return;
    const container = $('header-ticker');
    if (!container) return;

    const items = buildHeaderTickerItems();
    const nextSignature = computeHeaderTickerItemsSignature(items);
    const itemsChanged = nextSignature !== headerTickerItemsSignature;

    headerTickerItems = items;

    // Only reshuffle when the *set/order* of available items changes.
    // `renderAll()` can run frequently; reshuffling here makes the rotation feel repetitive.
    if (itemsChanged) {
        headerTickerItemsSignature = nextSignature;
        rebuildHeaderTickerOrder({ avoidIndex: headerTickerIndex });
        headerTickerIndex = headerTickerOrder.length ? headerTickerOrder.shift() : 0;
    } else {
        // Clamp in case the list shrank but signature somehow remained stable.
        if (!Number.isInteger(headerTickerIndex) || headerTickerIndex < 0 || headerTickerIndex >= headerTickerItems.length) {
            headerTickerIndex = 0;
        }
    }

    renderHeaderTickerCurrent(false);
}

/**
 * Starts the rotation timer (safe to call multiple times).
 */
function startHeaderTickerRotation() {
    if (headerTickerTimerId) return;
    headerTickerTimerId = window.setInterval(() => {
        rotateHeaderTicker();
    }, HEADER_TICKER_ROTATE_MS);
}

function stopHeaderTickerRotation() {
    if (!headerTickerTimerId) return;
    window.clearInterval(headerTickerTimerId);
    headerTickerTimerId = null;
}

// ============================================================================
// RENDER + ANIMATION
// ============================================================================

function rotateHeaderTicker() {
    if (!Array.isArray(headerTickerItems) || headerTickerItems.length <= 1) return;

    if (!Array.isArray(headerTickerOrder) || headerTickerOrder.length === 0) {
        rebuildHeaderTickerOrder({ avoidIndex: headerTickerIndex });
    }

    // Avoid immediate repeat when possible
    if (headerTickerItems.length > 1 && headerTickerOrder.length > 0 && headerTickerOrder[0] === headerTickerIndex) {
        const swapIdx = headerTickerOrder.findIndex(i => i !== headerTickerIndex);
        if (swapIdx > 0) {
            const tmp = headerTickerOrder[0];
            headerTickerOrder[0] = headerTickerOrder[swapIdx];
            headerTickerOrder[swapIdx] = tmp;
        }
    }

    headerTickerIndex = headerTickerOrder.length ? headerTickerOrder.shift() : ((headerTickerIndex + 1) % headerTickerItems.length);
    renderHeaderTickerCurrent(true);
}

function rebuildHeaderTickerOrder(options) {
    const n = Array.isArray(headerTickerItems) ? headerTickerItems.length : 0;
    headerTickerOrder = [];
    for (let i = 0; i < n; i++) headerTickerOrder.push(i);

    const avoidIndex = options && Number.isInteger(options.avoidIndex) ? options.avoidIndex : null;

    // Try a few times to avoid repeating the exact same cycle order.
    // This matters a lot when n is small and repeats are noticeable.
    let attempts = 0;
    while (attempts < 4) {
        shuffleInPlace(headerTickerOrder);

        // Avoid starting with the currently visible item when possible.
        if (avoidIndex !== null && n > 1 && headerTickerOrder[0] === avoidIndex) {
            const swapIdx = headerTickerOrder.findIndex(i => i !== avoidIndex);
            if (swapIdx > 0) {
                const tmp = headerTickerOrder[0];
                headerTickerOrder[0] = headerTickerOrder[swapIdx];
                headerTickerOrder[swapIdx] = tmp;
            }
        }

        const sig = headerTickerOrder.join(',');
        if (n <= 2 || sig !== headerTickerLastOrderSignature) {
            headerTickerLastOrderSignature = sig;
            break;
        }

        attempts++;
    }
}

function computeHeaderTickerItemsSignature(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    // Keys are already built to be stable identifiers for de-dupe; include kind for safety.
    return items.map(it => `${it?.kind || ''}:${it?.key || ''}`).join('|');
}

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
}

function randomInt(maxExclusive) {
    const max = Number(maxExclusive);
    if (!Number.isFinite(max) || max <= 0) return 0;

    // Prefer crypto randomness when available
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const buf = new Uint32Array(1);
        window.crypto.getRandomValues(buf);
        return buf[0] % max;
    }

    return Math.floor(Math.random() * max);
}

function renderHeaderTickerCurrent(animate) {
    const container = $('header-ticker');
    const badgeEl = $('header-ticker-badge');
    const textA = $('header-ticker-text-a');
    const textB = $('header-ticker-text-b');
    if (!container || !badgeEl || !textA || !textB) return;

    const item = headerTickerItems[headerTickerIndex];
    if (!item) {
        container.style.display = 'none';
        container.onclick = null;
        container.style.cursor = 'default';
        return;
    }

    container.style.display = '';
    badgeEl.textContent = item.badge || 'NEXT';

    // Advance template rotation only when the displayed item changes.
    // `renderAll()` may call `renderHeaderTicker()` often; we must not bump on re-renders.
    if (item.key && item.key !== headerTickerLastDisplayedKey) {
        headerTickerLastDisplayedKey = item.key;
        headerTickerDisplayCounter++;
        bumpHeaderTickerShownCount(item.key);
    }

    const itemText = getHeaderTickerItemText(item);

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shouldAnimate = !!animate && !prefersReducedMotion;

    const activeEl = headerTickerActiveLane === 'a' ? textA : textB;
    const nextEl = headerTickerActiveLane === 'a' ? textB : textA;

    if (!shouldAnimate) {
        activeEl.textContent = itemText;
        activeEl.classList.add('is-active');
        activeEl.classList.remove('is-exiting');

        nextEl.textContent = '';
        nextEl.classList.remove('is-active');
        nextEl.classList.remove('is-exiting');
    } else {
        nextEl.textContent = itemText;
        nextEl.classList.remove('is-exiting');

        // Ensure starting positions are applied before toggling classes
        void nextEl.offsetWidth; // force reflow

        activeEl.classList.add('is-exiting');
        activeEl.classList.remove('is-active');

        nextEl.classList.add('is-active');
        nextEl.classList.remove('is-exiting');

        headerTickerActiveLane = headerTickerActiveLane === 'a' ? 'b' : 'a';

        const oldEl = activeEl;
        let cleanedUp = false;
        let cleanupTimerId = null;

        const onDone = () => {
            if (cleanedUp) return;
            cleanedUp = true;
            if (cleanupTimerId) window.clearTimeout(cleanupTimerId);
            oldEl.classList.remove('is-exiting');
            oldEl.textContent = '';
            oldEl.removeEventListener('transitionend', onDone);
        };

        oldEl.addEventListener('transitionend', onDone);
        cleanupTimerId = window.setTimeout(onDone, 1100);
    }

    if (item.kind === 'homework' && item.courseId && typeof item.hwIndex === 'number') {
        container.onclick = () => openHomeworkFromSidebar(item.courseId, item.hwIndex);
        container.style.cursor = 'pointer';
    } else if (item.kind === 'recordings' && item.courseId && typeof openRecordingsModal === 'function') {
        container.onclick = () => openRecordingsModal(item.courseId);
        container.style.cursor = 'pointer';
    } else if ((item.kind === 'class' || item.kind === 'exam') && item.courseId) {
        container.onclick = () => openCourseModal(item.courseId);
        container.style.cursor = 'pointer';
    } else {
        container.onclick = null;
        container.style.cursor = 'default';
    }
}

// ============================================================================
// UPCOMING ITEMS
// ============================================================================

function buildHeaderTickerItems() {
    const semester = getCurrentSemester();
    if (!semester) {
        return [{
            key: 'no_semester',
            kind: 'info',
            badge: 'SETUP',
            templateCategory: 'no_semester',
            templateVars: {}
        }];
    }

    if (!Array.isArray(semester.courses) || semester.courses.length === 0) {
        return [{
            key: 'no_courses',
            kind: 'info',
            badge: 'SETUP',
            templateCategory: 'no_courses',
            templateVars: {}
        }];
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const messageSeed = getHeaderTickerMessageSeed(now);
    headerTickerMessageSeed = messageSeed;

    const items = [];

    const hasScheduleAtAll = hasAnySchedule(semester);

    // 1) Classes: current + next
    const { currentClass, nextClass } = findCurrentAndNextClass(semester, now);
    if (currentClass) items.push(currentClass);
    if (nextClass) items.push(nextClass);

    // 1.5) Classes: tomorrow (only when there isn't another class later today)
    if (!currentClass && !nextClass) {
        const tomorrowClass = collectTomorrowFirstClass(semester, now);
        if (tomorrowClass) items.push(tomorrowClass);
    }

    // 1.75) If there is no schedule at all, surface that (and don't spam "no classes today")
    if (!hasScheduleAtAll) {
        items.push({
            key: 'no_schedule',
            kind: 'info',
            badge: 'SETUP',
            templateCategory: 'no_schedule',
            templateVars: {}
        });
    }

    // 2) Homework: take up to 2 most urgent incomplete items with a due date
    const homeworkItems = collectHomeworkTickerItems(semester, todayStart, messageSeed, 2);
    items.push(...homeworkItems.slice(0, 2));

    // 2.5) Homework volume nudge (when there is a pile)
    const hwMany = collectHomeworkVolumeNudge(semester);
    if (hwMany) items.push(hwMany);

    // 3) Exams: take the soonest upcoming exam (A/B)
    const examItems = collectExamTickerItems(semester, todayStart, messageSeed, 1);
    items.push(...examItems);

    // 4) Homework without due date (nudge to set one)
    const noDateHw = collectHomeworkWithoutDueDate(semester);
    if (noDateHw) items.push(noDateHw);

    // 5) Recordings backlog (pick the course with the biggest backlog)
    const recordingsBacklog = collectRecordingsBacklog(semester);
    if (recordingsBacklog) items.push(recordingsBacklog);

    // 5.5) Positive states (only when there isn't anything actionable to show)
    const hasAnyUrgentHw = homeworkItems.length > 0 || !!noDateHw || !!hwMany;
    const hasAnyExam = examItems.length > 0;
    const hasAnyRecordingBacklog = !!recordingsBacklog;

    if (!currentClass && !nextClass && !hasAnyUrgentHw && !hasAnyExam && !hasAnyRecordingBacklog) {
        const hwAllDone = collectHomeworkAllDone(semester);
        if (hwAllDone) items.push(hwAllDone);

        const recordingsClear = collectRecordingsAllCaughtUp(semester);
        if (recordingsClear) items.push(recordingsClear);
    }

    // 6) If there are no classes later today and none right now, say so
    if (hasScheduleAtAll && !currentClass && !nextClass && !hasAnyClassToday(semester, now.getDay())) {
        items.push({
            key: 'no_classes_today',
            kind: 'info',
            badge: 'FREE',
            templateCategory: 'no_classes_today',
            templateVars: {}
        });
    }

    // 7) Time-based vibes (only when nothing actionable is showing)
    const hasActionable = items.some(it => ['class', 'homework', 'exam', 'recordings'].includes(it?.kind));
    if (!hasActionable) {
        const hour = now.getHours();
        const timeStr = String(hour).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

        // Add at most ONE vibe message to avoid noise
        const day = now.getDay();
        let vibe = null;

        if (hour >= 23 || hour <= 4) {
            vibe = {
                key: `late_night:${timeStr}`,
                kind: 'info',
                badge: 'ZZZ',
                templateCategory: 'late_night',
                templateVars: { time: timeStr }
            };
        } else if (day === 5 || day === 6) {
            vibe = {
                key: 'weekend',
                kind: 'info',
                badge: 'WEEKEND',
                templateCategory: 'weekend',
                templateVars: {}
            };
        } else if (hour < 10) {
            vibe = {
                key: 'morning',
                kind: 'info',
                badge: 'AM',
                templateCategory: 'morning',
                templateVars: {}
            };
        }

        if (vibe) items.push(vibe);
    }

    // 8) Always-relevant general fillers (kept low-priority so they don't drown urgent stuff)
    // Always include them so the category is reachable in rotation.
    // Add at most 1 when there are actionable items; add up to 2 when things are quiet.
    const general = collectGeneralAlwaysItems(semester, now, messageSeed);
    if (general.length > 0) {
        const maxGeneral = hasActionable ? 1 : 2;
        items.push(...general.slice(0, maxGeneral));
    }

    // De-dupe by key (avoid repeats)
    const seen = new Set();
    const deduped = [];
    for (const it of items) {
        if (!it?.key) continue;

        const hasDirectText = it?.text && String(it.text).trim();
        const hasTemplate = !!it?.templateCategory && Array.isArray(HEADER_TICKER_TEMPLATES[it.templateCategory]) && HEADER_TICKER_TEMPLATES[it.templateCategory].length > 0;
        if (!hasDirectText && !hasTemplate) continue;

        if (seen.has(it.key)) continue;
        seen.add(it.key);
        deduped.push(it);
    }

    if (deduped.length === 0) {
        return [{
            key: 'all_clear',
            kind: 'info',
            badge: 'OK',
            templateCategory: 'all_clear',
            templateVars: {}
        }];
    }

    return deduped;
}

function collectGeneralAlwaysItems(semester, now, messageSeed) {
    const ymd = getLocalYMD(now);
    const out = [];

    // A stable “course roast of the day” so it doesn't change every render.
    const course = pickStableCourseForDay(semester, `roast|${ymd}`);
    if (course) {
        const key = `general_course_roast:${course.id}:${ymd}`;
        out.push({
            key,
            kind: 'info',
            badge: 'VIBE',
            templateCategory: 'general_course_roast',
            templateVars: {
                course: course.name,
                courseMaybe: buildCourseMaybe(course.name)
            }
        });
    }

    // General reminders (also stable per day)
    const key2 = `general:${ymd}`;
    out.push({
        key: key2,
        kind: 'info',
        badge: 'NOTE',
        templateCategory: 'general',
        templateVars: {}
    });

    return out;
}

function pickStableCourseForDay(semester, seed) {
    const courses = (semester?.courses || []).filter(c => c && c.id);
    if (courses.length === 0) return null;
    const idx = stableHashIndex(seed, courses.length);
    return courses[idx];
}

function stableHashIndex(seed, modulo) {
    const n = Number(modulo);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const str = String(seed || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % n;
}

function findCurrentAndNextClass(semester, now) {
    let current = null;
    let next = null;

    const nowDay = now.getDay();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (const course of semester.courses || []) {
        for (const slot of course.schedule || []) {
            if (!slot?.start || !slot?.end || typeof slot.day !== 'number') continue;

            const slotId = `${course.id}:${slot.day}:${slot.start}`;

            const startMin = parseHHMMToMinutes(slot.start);
            let endMin = parseHHMMToMinutes(slot.end);
            if (endMin <= startMin) endMin += 24 * 60;

            // Current class (with a small grace window)
            if (slot.day === nowDay) {
                const graceStart = startMin - 5;
                const graceEnd = endMin + 5;
                if (nowMinutes >= graceStart && nowMinutes <= graceEnd) {
                    current = {
                        key: `class_now:${slotId}`,
                        kind: 'class',
                        badge: 'NOW',
                        templateCategory: 'class_now',
                        templateVars: {
                            course: course.name,
                            courseMaybe: buildCourseMaybe(course.name),
                            start: slot.start,
                            end: slot.end,
                            location: course.location || ''
                        },
                        courseId: course.id,
                        color: course.color,
                        slotId
                    };
                }
            }

            // Next class (TODAY only)
            if (slot.day === nowDay) {
                const nextStartToday = getTodayOccurrenceStart(now, slot.start);
                if (nextStartToday && nextStartToday > now) {
                    if (!next || nextStartToday < next.when) {
                        const minutesUntil = Math.max(0, Math.round((nextStartToday - now) / (1000 * 60)));
                        const badge = minutesUntil <= 60 ? 'SOON' : 'NEXT';

                        const templateCategory = minutesUntil <= 15 ? 'class_soon' : 'class_next';

                        next = {
                            key: `class_next:${slotId}`,
                            kind: 'class',
                            badge,
                            templateCategory,
                            templateVars: {
                                course: course.name,
                                courseMaybe: buildCourseMaybe(course.name),
                                start: slot.start,
                                end: slot.end,
                                minutes: String(minutesUntil)
                            },
                            courseId: course.id,
                            color: course.color,
                            slotId,
                            when: nextStartToday
                        };
                    }
                }
            }
        }
    }

    // Avoid showing the same slot twice if it is currently ongoing
    if (current && next && current.slotId && next.slotId && current.slotId === next.slotId) {
        next = null;
    }

    // Strip helper fields
    if (current) delete current.slotId;
    if (next) {
        delete next.when;
        delete next.slotId;
    }

    return { currentClass: current, nextClass: next };
}

function collectHomeworkTickerItems(semester, todayStart, seed, maxItems) {
    const all = [];

    for (const course of semester.courses || []) {
        const hws = Array.isArray(course.homework) ? course.homework : [];
        hws.forEach((hw, hwIndex) => {
            if (!hw || hw.completed) return;
            if (!hw.dueDate) return;

            const due = parseYMDToLocalDate(hw.dueDate);
            if (!due) return;

            const dueStart = new Date(due);
            dueStart.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((dueStart - todayStart) / (1000 * 60 * 60 * 24));

            const category = diffDays < 0
                ? 'hw_overdue'
                : (diffDays === 0 ? 'hw_today' : (diffDays === 1 ? 'hw_tomorrow' : 'hw_soon'));

            const badge = diffDays < 0 ? 'HW!' : 'HW';
            const key = `hw:${course.id}:${hwIndex}:${hw.dueDate}`;

            all.push({
                key,
                kind: 'homework',
                badge,
                category,
                courseId: course.id,
                courseName: course.name,
                courseMaybe: buildCourseMaybe(course.name),
                hwIndex,
                title: hw.title || 'Homework',
                diffDays,
                dueStart
            });
        });
    }

    if (all.length === 0) return [];

    const selected = [];
    const usedKeys = new Set();

    const overdue = all.filter(x => x.diffDays < 0);
    const today = all.filter(x => x.diffDays === 0);
    const tomorrow = all.filter(x => x.diffDays === 1);
    const soon = all.filter(x => x.diffDays >= 2 && x.diffDays <= 7);
    const later = all.filter(x => x.diffDays > 7);

    // First pick: always urgency-biased, but random within the urgency bucket.
    const firstPool = overdue.length ? overdue : (today.length ? today : (tomorrow.length ? tomorrow : (soon.length ? soon : later)));
    const first = stablePickOne(firstPool, `${seed}|hw|first`);
    if (first) {
        usedKeys.add(first.key);
        selected.push(first);
    }

    // Second pick: avoid same course if possible and allow less-urgent items sometimes.
    const limit = Math.max(0, Number(maxItems) || 0);
    if (limit > 1) {
        const remaining = all.filter(x => !usedKeys.has(x.key));
        const preferDifferentCourse = selected[0]?.courseId;
        let pool = remaining;
        const diffCourse = preferDifferentCourse ? remaining.filter(x => x.courseId !== preferDifferentCourse) : remaining;
        if (diffCourse.length > 0) pool = diffCourse;

        // Build a weighted list of buckets to pick from (still urgency-aware, not always closest).
        const buckets = [];
        const pushBucket = (name, arr, weight) => {
            if (!arr || arr.length === 0) return;
            for (let i = 0; i < weight; i++) buckets.push({ name, arr });
        };

        pushBucket('overdue', pool.filter(x => x.diffDays < 0), 5);
        pushBucket('today', pool.filter(x => x.diffDays === 0), 4);
        pushBucket('tomorrow', pool.filter(x => x.diffDays === 1), 3);
        pushBucket('soon', pool.filter(x => x.diffDays >= 2 && x.diffDays <= 7), 2);
        pushBucket('later', pool.filter(x => x.diffDays > 7), 1);

        const chosenBucket = stablePickOne(buckets, `${seed}|hw|secondBucket`);
        const secondPool = chosenBucket?.arr || pool;
        const second = stablePickOne(secondPool, `${seed}|hw|second`);
        if (second) {
            usedKeys.add(second.key);
            selected.push(second);
        }
    }

    // Convert to ticker items
    return selected.map(h => ({
        key: h.key,
        kind: 'homework',
        badge: h.badge,
        templateCategory: h.category,
        templateVars: {
            title: h.title,
            course: h.courseName,
            courseMaybe: h.courseMaybe,
            days: String(Math.abs(h.diffDays))
        },
        courseId: h.courseId,
        hwIndex: h.hwIndex
    }));
}

function collectUpcomingExamItems(semester, todayStart) {
    const dateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const items = [];

    for (const course of semester.courses || []) {
        const exams = course.exams || {};
        const candidates = [
            { examType: 'A', dateStr: exams.moedA },
            { examType: 'B', dateStr: exams.moedB }
        ];

        for (const c of candidates) {
            if (!c.dateStr) continue;
            const examDate = parseYMDToLocalDate(c.dateStr);
            if (!examDate) continue;

            const examStart = new Date(examDate);
            examStart.setHours(0, 0, 0, 0);

            const diffDays = Math.ceil((examStart - todayStart) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) continue;

            const badge = diffDays <= 1 ? 'EXAM!!' : (diffDays <= 7 ? 'EXAM!' : 'EXAM');
            const prettyDate = dateFormatter.format(examStart);

            const category = diffDays === 0 ? 'exam_today' : (diffDays === 1 ? 'exam_tomorrow' : (diffDays <= 3 ? 'exam_soon' : 'exam'));

            items.push({
                key: `exam:${course.id}:${c.examType}:${c.dateStr}`,
                kind: 'exam',
                badge,
                templateCategory: category,
                templateVars: {
                    course: course.name,
                    courseMaybe: buildCourseMaybe(course.name),
                    examType: c.examType,
                    days: String(diffDays),
                    date: prettyDate
                },
                courseId: course.id,
                color: course.color,
                when: examStart
            });
        }
    }

    items.sort((a, b) => a.when - b.when);
    items.forEach(it => delete it.when);
    return items;
}

function collectExamTickerItems(semester, todayStart, seed, maxItems) {
    const all = collectUpcomingExamItems(semester, todayStart);
    if (!Array.isArray(all) || all.length === 0) return [];

    const limit = Math.max(0, Number(maxItems) || 0);
    if (limit <= 0) return [];

    // If there's an exam today/tomorrow, always show that.
    const urgent = all.filter(e => e.badge === 'EXAM!!');
    if (urgent.length > 0) return urgent.slice(0, 1);

    // Otherwise, pick among the next few upcoming exams so it doesn't always spam the closest.
    const window = all.slice(0, Math.min(4, all.length));
    const picked = stablePickOne(window, `${seed}|exam|pick`);
    return picked ? [picked] : window.slice(0, 1);
}

function collectHomeworkWithoutDueDate(semester) {
    for (const course of semester.courses || []) {
        const hws = Array.isArray(course.homework) ? course.homework : [];
        for (let hwIndex = 0; hwIndex < hws.length; hwIndex++) {
            const hw = hws[hwIndex];
            if (!hw || hw.completed) continue;
            if (hw.dueDate) continue;

            const key = `hw_nodate:${course.id}:${hwIndex}`;
            return {
                key,
                kind: 'homework',
                badge: 'HW',
                templateCategory: 'hw_nodate',
                templateVars: {
                    title: hw.title || 'Homework',
                    course: course.name,
                    courseMaybe: buildCourseMaybe(course.name)
                },
                courseId: course.id,
                hwIndex
            };
        }
    }
    return null;
}

function collectRecordingsBacklog(semester) {
    let best = null;

    for (const course of semester.courses || []) {
        const tabs = course.recordings?.tabs;
        if (!Array.isArray(tabs)) continue;

        let backlog = 0;
        for (const tab of tabs) {
            const items = Array.isArray(tab?.items) ? tab.items : [];
            backlog += items.filter(i => i && i.watched === false).length;
        }

        if (backlog <= 0) continue;

        if (!best || backlog > best.backlog) {
            const category = backlog >= 10 ? 'recordings_big' : 'recordings_backlog';
            const badge = backlog >= 10 ? 'REC!' : 'REC';
            best = {
                key: `recordings_backlog:${course.id}:${backlog}`,
                kind: 'recordings',
                badge,
                templateCategory: category,
                templateVars: {
                    course: course.name,
                    courseMaybe: buildCourseMaybe(course.name),
                    count: String(backlog)
                },
                courseId: course.id,
                backlog
            };
        }
    }

    if (!best) return null;
    delete best.backlog;
    return best;
}

function collectRecordingsAllCaughtUp(semester) {
    let total = 0;
    let backlog = 0;

    for (const course of semester.courses || []) {
        const tabs = course.recordings?.tabs;
        if (!Array.isArray(tabs)) continue;

        for (const tab of tabs) {
            const items = Array.isArray(tab?.items) ? tab.items : [];
            for (const it of items) {
                if (!it) continue;
                total++;
                if (it.watched === false) backlog++;
            }
        }
    }

    if (total <= 0) return null;
    if (backlog > 0) return null;

    return {
        key: 'recordings_clear',
        kind: 'info',
        badge: 'NICE',
        templateCategory: 'recordings_clear',
        templateVars: {}
    };
}

function collectHomeworkAllDone(semester) {
    let total = 0;
    let remaining = 0;

    for (const course of semester.courses || []) {
        const hws = Array.isArray(course.homework) ? course.homework : [];
        for (const hw of hws) {
            if (!hw) continue;
            total++;
            if (!hw.completed) remaining++;
        }
    }

    if (total <= 0) return null;
    if (remaining > 0) return null;

    return {
        key: 'hw_all_done',
        kind: 'info',
        badge: 'NICE',
        templateCategory: 'hw_all_done',
        templateVars: {}
    };
}

function hasAnySchedule(semester) {
    for (const course of semester.courses || []) {
        if (Array.isArray(course.schedule) && course.schedule.length > 0) return true;
    }
    return false;
}

function hasAnyClassToday(semester, dayOfWeek) {
    for (const course of semester.courses || []) {
        for (const slot of course.schedule || []) {
            if (slot && slot.day === dayOfWeek) return true;
        }
    }
    return false;
}

function collectTomorrowFirstClass(semester, now) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDay();

    let best = null;

    for (const course of semester.courses || []) {
        for (const slot of course.schedule || []) {
            if (!slot?.start || typeof slot.day !== 'number') continue;
            if (slot.day !== tomorrowDay) continue;

            const when = getTomorrowOccurrenceStart(now, slot.start);
            if (!when) continue;

            if (!best || when < best.when) {
                best = {
                    key: `class_tomorrow:${course.id}:${slot.day}:${slot.start}`,
                    kind: 'class',
                    badge: 'TMRW',
                    templateCategory: 'class_tomorrow',
                    templateVars: {
                        course: course.name,
                        courseMaybe: buildCourseMaybe(course.name),
                        start: slot.start
                    },
                    courseId: course.id,
                    color: course.color,
                    when
                };
            }
        }
    }

    if (!best) return null;
    delete best.when;
    return best;
}

function collectHomeworkVolumeNudge(semester) {
    let count = 0;
    for (const course of semester.courses || []) {
        const hws = Array.isArray(course.homework) ? course.homework : [];
        for (const hw of hws) {
            if (!hw || hw.completed) continue;
            count++;
        }
    }

    if (count < 6) return null;

    return {
        key: `hw_many:${count}`,
        kind: 'info',
        badge: 'HW+',
        templateCategory: 'hw_many',
        templateVars: {
            count: String(count),
            countMinusOne: String(Math.max(0, count - 1))
        }
    };
}

function stablePickOne(arr, seed) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const idx = stableHashIndex(seed, arr.length);
    return arr[idx];
}

function getHeaderTickerMessageSeed(now) {
    const d = now instanceof Date ? now : new Date();
    // Rotate selection + template choice every 30 minutes (stable within the window to avoid renderAll jitter).
    const bucket = Math.floor(d.getTime() / (1000 * 60 * 30));
    return `${getLocalYMD(d)}|${bucket}`;
}

// ============================================================================
// HELPERS
// ============================================================================

function parseHHMMToMinutes(hhmm) {
    const [h, m] = String(hhmm).split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
    return h * 60 + m;
}

function buildCourseMaybe(courseName) {
    const name = String(courseName || '').trim();
    if (!name) return '';
    // Keep the Hebrew course name visually separated from English text
    return ` (${name})`;
}

function parseYMDToLocalDate(dateStr) {
    if (!dateStr) return null;
    const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function getLocalYMD(date) {
    const d = date instanceof Date ? date : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getTodayOccurrenceStart(now, startHHMM) {
    const startMin = parseHHMMToMinutes(startHHMM);
    if (!Number.isFinite(startMin)) return null;
    const candidate = new Date(now);
    candidate.setSeconds(0, 0);
    candidate.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    return candidate;
}

function getTomorrowOccurrenceStart(now, startHHMM) {
    const today = getTodayOccurrenceStart(now, startHHMM);
    if (!today) return null;
    const candidate = new Date(today);
    candidate.setDate(candidate.getDate() + 1);
    return candidate;
}

function buildFunMessage(category, vars, key, options) {
    const templates = HEADER_TICKER_TEMPLATES[category] || [];
    if (!Array.isArray(templates) || templates.length === 0) return '';

    const dailySalt = getLocalYMD(new Date());
    const step = Number.isFinite(options?.step) ? Number(options.step) : 0;
    const template = pickTemplateFromBag(category, templates, String(key || category), dailySalt, step);
    return template
        .replace(/\{(\w+)\}/g, (_, name) => {
            const value = vars?.[name];
            return value == null ? '' : String(value);
        })
        .replace(/\s+/g, ' ')
        .trim();
}

function pickTemplateFromBag(category, templates, key, dailySalt, step) {
    const len = templates.length;
    if (len <= 1) return templates[0] || '';

    const bag = getTemplateBag(category, len, dailySalt);
    const base = stableHashIndex(`${category}|${key}`, bag.length);
    const s = Number.isFinite(step) ? step : 0;
    const idxInBag = (base + s) % bag.length;
    return templates[bag[idxInBag]];
}

function getTemplateBag(category, len, dailySalt) {
    const cacheKey = `${category}|${dailySalt}|${len}`;
    const cached = headerTickerTemplateBagCache.get(cacheKey);
    if (cached && Array.isArray(cached) && cached.length === len) return cached;

    const bag = [];
    for (let i = 0; i < len; i++) bag.push(i);

    const seed = hashStringToInt32(`${category}|${dailySalt}|${len}`);
    const rnd = createXorShift32(seed);

    for (let i = bag.length - 1; i > 0; i--) {
        const j = rnd() % (i + 1);
        const tmp = bag[i];
        bag[i] = bag[j];
        bag[j] = tmp;
    }

    headerTickerTemplateBagCache.set(cacheKey, bag);
    return bag;
}

function hashStringToInt32(str) {
    const s = String(str || '');
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = (hash * 31 + s.charCodeAt(i)) | 0;
    }
    return hash | 0;
}

function createXorShift32(seedInt) {
    let x = (seedInt | 0) || 123456789;
    return function next() {
        // xorshift32
        x ^= (x << 13);
        x ^= (x >>> 17);
        x ^= (x << 5);
        // Convert to uint32
        return (x >>> 0);
    };
}

function getHeaderTickerItemText(item) {
    if (!item) return '';
    if (item.templateCategory) {
        const shown = getHeaderTickerShownCount(item.key || '');
        const seedBump = stableHashIndex(String(headerTickerMessageSeed || ''), 1000);
        const step = shown + seedBump + headerTickerDisplayCounter;
        return buildFunMessage(item.templateCategory, item.templateVars || {}, item.key || item.templateCategory, { step });
    }
    return item.text ? String(item.text) : '';
}

function bumpHeaderTickerShownCount(key) {
    const k = String(key || '');
    if (!k) return;
    const prev = headerTickerShownCountByKey.get(k) || 0;
    headerTickerShownCountByKey.set(k, prev + 1);
}

function getHeaderTickerShownCount(key) {
    const k = String(key || '');
    if (!k) return 0;
    return headerTickerShownCountByKey.get(k) || 0;
}

function stablePickTemplate(templates, key) {
    const str = String(key || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % templates.length;
    return templates[idx];
}
