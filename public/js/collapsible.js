/**
 * Simple reusable collapsible sections
 * Usage:
 * 1. Add class="collapsible-section" to your container
 * 2. Add class="collapsible-header" to your clickable header element
 * 3. Add class="collapsible-content" to the content you want to collapse
 * 4. Add data-collapsed="true" to start collapsed (optional)
 */

// Initialize all collapsible sections
function initCollapsibleSections() {
    // Allow a small delay for the DOM to fully render in modals
    setTimeout(() => {
        document.querySelectorAll('.collapsible-section').forEach(section => {
            setupCollapsible(section);
        });
    }, 10);

    // Add window resize handler to update expanded sections only
    if (!window._collapsibleResizeHandlerAdded) {
        window.addEventListener('resize', debounce(() => {
            // Only update sections that are explicitly expanded (not collapsed)
            document.querySelectorAll('.collapsible-section:not(.collapsed)').forEach(section => {
                const content = section.querySelector('.collapsible-content');
                if (content) {
                    // Don't use ensureContentHeight which could cause issues
                    // Just set the height directly
                    requestAnimationFrame(() => {
                        content.style.height = (content.scrollHeight + 5) + 'px';
                    });
                }
            });
        }, 250));
        window._collapsibleResizeHandlerAdded = true;
    }
}

// Debounce helper function to limit resize handler calls
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Set up a single collapsible section
function setupCollapsible(section) {
    const header = section.querySelector('.collapsible-header');
    const content = section.querySelector('.collapsible-content');
    
    if (!header || !content) return;
    
    // Store the handler in a data attribute to ensure we can properly remove it
    if (header._clickHandler) {
        header.removeEventListener('click', header._clickHandler);
    }
    
    header._clickHandler = function() {
        toggleCollapsible(section);
    };
    
    header.addEventListener('click', header._clickHandler);
    
    // Set initial state based on data attribute
    const startCollapsed = section.getAttribute('data-collapsed') === 'true';
    
    if (startCollapsed) {
        section.classList.add('collapsed');
        content.style.height = '0px';
    } else {
        section.classList.remove('collapsed');
        // Make sure the content has rendered before calculating height
        ensureContentHeight(content);
    }
}

// Toggle a collapsible section
function toggleCollapsible(section) {
    const content = section.querySelector('.collapsible-content');
    const isCollapsed = section.classList.contains('collapsed');
    
    if (isCollapsed) {
        // Expand
        section.classList.remove('collapsed');
        // Make sure the content has rendered before calculating height
        ensureContentHeight(content);
    } else {
        // Collapse
        section.classList.add('collapsed');
        // Set height to 0 immediately
        content.style.height = '0px';
    }
}

// Ensure the content height is calculated properly
function ensureContentHeight(content) {
    // Only calculate height if the parent section isn't collapsed
    const parentSection = content.closest('.collapsible-section');
    if (parentSection && parentSection.classList.contains('collapsed')) {
        return;
    }
    
    // Force a reflow to get accurate scrollHeight
    content.style.display = 'none';
    content.offsetHeight; // Trigger reflow
    content.style.display = '';
    
    // Set the height after a tiny delay to ensure rendering
    requestAnimationFrame(() => {
        // Add a bit of extra height to account for any potential rendering issues
        content.style.height = (content.scrollHeight + 5) + 'px';
    });
}

// Manually expand a section by selector
function expandSection(selector) {
    const section = document.querySelector(selector);
    if (section) {
        // Only expand if it's currently collapsed
        if (section.classList.contains('collapsed')) {
            section.classList.remove('collapsed');
            const content = section.querySelector('.collapsible-content');
            if (content) {
                requestAnimationFrame(() => {
                    content.style.height = (content.scrollHeight + 5) + 'px';
                });
            }
        }
    }
}

// Manually collapse a section by selector
function collapseSection(selector) {
    const section = document.querySelector(selector);
    if (section) {
        // Only collapse if it's not already collapsed
        if (!section.classList.contains('collapsed')) {
            section.classList.add('collapsed');
            const content = section.querySelector('.collapsible-content');
            if (content) content.style.height = '0px';
        }
    }
}

export { 
    initCollapsibleSections, 
    setupCollapsible, 
    toggleCollapsible,
    expandSection,
    collapseSection
};
