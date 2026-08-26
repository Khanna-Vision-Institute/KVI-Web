(function() {
    'use strict';
    
    function initHeaderMenu() {
    const headerInner = document.querySelector('.header-inner');
    const toggleButton = document.querySelector('.menu-toggle');
    const navPrimary = document.querySelector('.nav-primary');
        const navItems = document.querySelectorAll('.nav-item.has-mega, .nav-item.has-dropdown');

    if (!headerInner || !toggleButton || !navPrimary) {
            console.warn('Header elements not found, retrying...');
            setTimeout(initHeaderMenu, 100);
        return;
    }

        // Toggle main mobile menu
        toggleButton.addEventListener('click', function(e) {
            e.stopPropagation();
            headerInner.classList.toggle('is-open');
        });

        // Handle dropdown toggle on mobile
        navItems.forEach(function(navItem) {
            const navLink = navItem.querySelector('.nav-link');
            if (!navLink) return;

            navLink.addEventListener('click', function(e) {
                if (window.innerWidth <= 1024) {
                    e.preventDefault();
                    
                    const wasExpanded = navItem.classList.contains('is-expanded');
                    
                    // Close all other dropdowns
                    navItems.forEach(function(item) {
                        item.classList.remove('is-expanded');
                    });
                    
                    // Toggle this dropdown
                    if (!wasExpanded) {
                        navItem.classList.add('is-expanded');
                    }
                }
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 1024 && 
            headerInner.classList.contains('is-open') &&
                !headerInner.contains(e.target)) {
                headerInner.classList.remove('is-open');
                navItems.forEach(function(item) {
                    item.classList.remove('is-expanded');
                });
        }
    });

        // Close on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && headerInner.classList.contains('is-open')) {
                headerInner.classList.remove('is-open');
                navItems.forEach(function(item) {
                    item.classList.remove('is-expanded');
                });
            toggleButton.focus();
        }
    });
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderMenu);
            } else {
        initHeaderMenu();
    }
})();
