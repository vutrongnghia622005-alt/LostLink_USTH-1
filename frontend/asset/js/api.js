(function () {
    'use strict';

    const API_URL = window.LOSTLINK_API_URL || 'http://localhost:3000';
    const TOKEN_KEY = 'lostlink_token';
    const USER_KEY = 'lostlink_user';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY) || '';
    }

    function getStoredUser() {
        try {
            return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        } catch (error) {
            return null;
        }
    }

    function saveSession(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    async function request(path, options = {}) {
        const headers = {
            ...(options.headers || {})
        };

        const token = getToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const requestOptions = {
            method: options.method || 'GET',
            headers
        };

        if (options.body !== undefined) {
            if (options.body instanceof FormData) {
                requestOptions.body = options.body;
            } else {
                headers['Content-Type'] = 'application/json';
                requestOptions.body = JSON.stringify(options.body);
            }
        }

        const response = await fetch(`${API_URL}${path}`, requestOptions);

        let data = null;
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            data = await response.json();
        }

        if (!response.ok) {
            const message = data?.message || `Request failed with status ${response.status}.`;
            const error = new Error(message);
            error.status = response.status;
            throw error;
        }

        return data;
    }

    function escapeHTML(value = '') {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function formatDateTime(value) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return 'Chưa xác định';
        }

        return new Intl.DateTimeFormat('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    function formatRelativeTime(value) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return 'Vừa đăng';
        }

        const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
        if (seconds < 60) return 'Vừa đăng';

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} phút trước`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} giờ trước`;

        const days = Math.floor(hours / 24);
        if (days < 7) return `${days} ngày trước`;

        return new Intl.DateTimeFormat('vi-VN').format(date);
    }

    window.LostLink = {
        API_URL,
        request,
        getToken,
        getStoredUser,
        saveSession,
        clearSession,
        escapeHTML,
        formatDateTime,
        formatRelativeTime
    };
})();
