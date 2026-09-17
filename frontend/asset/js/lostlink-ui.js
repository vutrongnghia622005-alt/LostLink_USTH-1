(function () {
    'use strict';

    function normalizeHomeLinks() {
        document.querySelectorAll('a[href]').forEach((link) => {
            const href = link.getAttribute('href');
            if (!href) return;

            if (href === 'Index.html') {
                link.setAttribute('href', 'index.html');
            }

            if (href === '../Index.html') {
                link.setAttribute('href', '../index.html');
            }

            if (href.includes('Index.html#how-it-works')) {
                link.remove();
            }
        });
    }

    function setupMobileMenu() {
        const button = document.querySelector('.menu-btn');
        const nav = document.querySelector('.main-nav');

        if (!button || !nav) return;

        button.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('mobile-open');
            button.setAttribute('aria-expanded', String(isOpen));
        });
    }

    function setupUtilityMenu() {
        const menu = document.querySelector('.utility-menu');
        if (!menu) return;

        document.addEventListener('click', (event) => {
            if (!menu.contains(event.target)) {
                menu.removeAttribute('open');
            }
        });
    }

    function injectAccountLinks() {
        if (location.pathname.includes('/admin/')) return;

        document.querySelectorAll(
            'a[href="login.html"], a[href="./login.html"], a[href="register.html"], a[href="./register.html"]'
        ).forEach((link) => link.remove());

        const utilityLinks = document.querySelector('.utility-links');
        if (!utilityLinks || !window.LostLink) return;

        const user = window.LostLink.getStoredUser();

        if (user?.role === 'admin') {
            const adminLink = document.createElement('a');
            adminLink.href = 'admin/dashboard.html';
            adminLink.textContent = 'Admin Dashboard';

            const logout = document.createElement('button');
            logout.type = 'button';
            logout.textContent = 'Đăng xuất Admin';
            logout.className = 'utility-logout-button';
            logout.addEventListener('click', () => {
                window.LostLink.clearSession();
                location.href = 'index.html';
            });

            utilityLinks.append(adminLink, logout);
        }
    }

    function setupImageFallbacks() {
        document.querySelectorAll('img').forEach((image) => {
            image.addEventListener('error', () => {
                if (image.src.includes('placeholder.svg')) return;

                const prefix = location.pathname.includes('/admin/') ? '../' : '';
                image.src = `${prefix}asset/images/placeholder.svg`;
            }, { once: true });
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;

        document.querySelector('.main-nav')?.classList.remove('mobile-open');
        document.querySelector('.menu-btn')?.setAttribute('aria-expanded', 'false');
        document.querySelector('.utility-menu')?.removeAttribute('open');
    });

    document.addEventListener('DOMContentLoaded', () => {
        normalizeHomeLinks();
        setupMobileMenu();
        setupUtilityMenu();
        injectAccountLinks();
        setupImageFallbacks();
        window.lucide?.createIcons();
    });
})();
