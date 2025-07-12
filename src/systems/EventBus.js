// src/systems/EventBus.js
// A simple singleton event bus for pub/sub pattern.

class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event.
     * @param {string} eventName The name of the event.
     * @param {Function} listener The callback function to execute.
     */
    on(eventName, listener) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(listener);
    }

    /**
     * Unsubscribe from an event.
     * @param {string} eventName The name of the event.
     * @param {Function} listenerToRemove The specific listener to remove.
     */
    off(eventName, listenerToRemove) {
        if (!this.events[eventName]) return;

        this.events[eventName] = this.events[eventName].filter(
            listener => listener !== listenerToRemove
        );
    }

    /**
     * Dispatch an event to all subscribed listeners.
     * @param {string} eventName The name of the event.
     * @param {*} data The data to pass to the listeners.
     */
    dispatch(eventName, data) {
        if (!this.events[eventName]) return;

        // Create a copy of the listeners array in case a listener modifies the original array (e.g., unsubscribes)
        const listeners = this.events[eventName].slice();
        listeners.forEach(listener => listener(data));
    }
}

export const eventBus = new EventBus();