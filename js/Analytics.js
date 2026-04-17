/**
 * RoutinePro - Analytics Handler
 * Centralized tracking for user interaction and usage metrics.
 */
class RoutineAnalytics {
    constructor(measurementId = null) {
        this.measurementId = measurementId;
        this.isEnabled = !!measurementId;
    }

    /**
     * Track a custom event
     * @param {string} eventName 
     * @param {object} params 
     */
    trackEvent(eventName, params = {}) {
        if (!this.isEnabled || !window.gtag) return;

        window.gtag('event', eventName, {
            ...params,
            timestamp: new Date().toISOString()
        });

        console.log(`[Analytics] Tracked: ${eventName}`, params);
    }

    // Specific shorthand methods for key metrics
    trackRoutineGenerated(courseCount) {
        this.trackEvent('generate_routine', { course_count: courseCount });
    }

    trackExport(type) {
        this.trackEvent('export_routine', { export_type: type });
    }

    trackPortalSync(courseCount) {
        this.trackEvent('portal_sync', { new_course_count: courseCount });
    }

    trackFeatureToggle(feature, state) {
        this.trackEvent('toggle_feature', {
            feature_name: feature,
            state: state ? 'enabled' : 'disabled'
        });
    }
}

// Initialize globally (will be configured in app.js)
window.analytics = new RoutineAnalytics();
