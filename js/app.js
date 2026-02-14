/**
 * RoutinePro - Main Entry Point
 */
window.app = {};

document.addEventListener('DOMContentLoaded', () => {
    app.model = new RoutineModel();
    window.analytics = new RoutineAnalytics('G-N12SPXZJ8H');
    app.view = new RoutineView();
    app.controller = new RoutineController(app.model, app.view);

    // Initial lucide setup
    lucide.createIcons();
});

// Helper for search suggestions (needs global scope for onclick)
window.handleAddCourse = (title, code) => app.controller.handleAddCourse(title, code);
