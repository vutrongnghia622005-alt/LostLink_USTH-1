(function () {
    'use strict';

    if (!window.LostLink) return;

    const {
        request,
        getToken,
        getStoredUser,
        saveSession,
        clearSession,
        escapeHTML,
        formatDateTime
    } = window.LostLink;

    function statusBadge(status) {
        const css = {
            active: 'badge-active',
            hidden: 'badge-hidden',
            resolved: 'badge-done',
            closed: 'badge-read'
        };

        return css[status] || 'badge-read';
    }

    function feedbackStatusBadge(status) {
        const css = {
            new: 'badge-new',
            read: 'badge-read',
            resolved: 'badge-done'
        };

        return css[status] || 'badge-read';
    }

    function toast(message) {
        let element = document.querySelector('.toast-admin');

        if (!element) {
            element = document.createElement('div');
            element.className = 'toast-admin';
            document.body.appendChild(element);
        }

        element.textContent = message;
        element.classList.add('show');

        clearTimeout(window.__adminToast);
        window.__adminToast = setTimeout(() => {
            element.classList.remove('show');
        }, 1800);
    }

    async function handleAdminLogin(event) {
        event.preventDefault();

        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        const errorBox = document.getElementById('loginError');

        try {
            const data = await request('/api/auth/login', {
                method: 'POST',
                body: { email, password }
            });

            if (data.user.role !== 'admin') {
                clearSession();
                throw new Error('Tài khoản này không có quyền Admin.');
            }

            saveSession(data.token, data.user);
            location.href = 'dashboard.html';
        } catch (error) {
            if (errorBox) {
                errorBox.textContent = error.message;
                errorBox.classList.add('show');
            }
        }
    }

    async function requireAdminPage() {
        const page = location.pathname.split('/').pop();
        if (page === 'login.html') return true;

        if (!getToken()) {
            location.replace('login.html');
            return false;
        }

        try {
            const user = await request('/api/auth/me');

            if (user.role !== 'admin') {
                clearSession();
                location.replace('login.html');
                return false;
            }

            localStorage.setItem('lostlink_user', JSON.stringify(user));
            renderAdminIdentity(user);
            return true;
        } catch (error) {
            clearSession();
            location.replace('login.html');
            return false;
        }
    }

    function renderAdminIdentity(user) {
        document.querySelectorAll('.admin-topbar-right > span').forEach((element) => {
            element.textContent = user.full_name || 'Quản trị viên';
        });

        document.querySelectorAll('.admin-avatar').forEach((element) => {
            element.textContent = String(user.full_name || 'A').trim().charAt(0).toUpperCase();
        });
    }

    function setupLogout() {
        document.querySelectorAll('[data-admin-logout]').forEach((button) => {
            button.addEventListener('click', () => {
                clearSession();
                location.href = 'login.html';
            });
        });
    }

    function injectAdminNavigation() {
        document.querySelectorAll('.admin-nav').forEach((nav) => {
            const items = [
                ['claims.html', 'badge-check', 'Yêu cầu nhận đồ'],
                ['security.html', 'shield-alert', 'Báo cáo an ninh']
            ];

            items.forEach(([href, icon, label]) => {
                if (nav.querySelector(`a[href="${href}"]`)) return;

                const link = document.createElement('a');
                link.href = href;
                link.innerHTML = `<i data-lucide="${icon}"></i><span>${label}</span>`;
                nav.appendChild(link);
            });

            const currentPage = location.pathname.split('/').pop();
            nav.querySelectorAll('a').forEach((link) => {
                link.classList.toggle('active', link.getAttribute('href') === currentPage);
            });
        });
    }

    async function renderDashboard() {
        if (document.body.dataset.adminPage !== 'dashboard') return;

        try {
            const data = await request('/api/admin/dashboard');

            const values = {
                adminTotalPosts: data.totalPosts,
                adminLostPosts: data.lostPosts,
                adminFoundPosts: data.foundPosts,
                adminNewFeedback: data.newFeedback
            };

            Object.entries(values).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            });

            const posts = document.getElementById('recentAdminPosts');
            if (posts) {
                posts.innerHTML = data.recentPosts.length > 0
                    ? data.recentPosts.map((post) => `
                        <div class="recent-row">
                            <div>
                                <strong>${escapeHTML(post.title)}</strong>
                                <span>${post.type === 'found' ? 'Nhặt được' : 'Thất lạc'} · ${escapeHTML(post.location || 'USTH')}</span>
                            </div>
                            <div style="text-align:right">
                                <strong>${escapeHTML(post.management_code)}</strong>
                                <span>${escapeHTML(formatDateTime(post.created_at))}</span>
                            </div>
                        </div>
                    `).join('')
                    : '<div class="empty-admin"><h3>Chưa có bài đăng</h3></div>';
            }

            const feedback = document.getElementById('recentAdminFeedback');
            if (feedback) {
                feedback.innerHTML = data.recentFeedback.length > 0
                    ? data.recentFeedback.map((item) => `
                        <div class="recent-row">
                            <div>
                                <strong>${escapeHTML(item.subject)}</strong>
                                <span>${escapeHTML(item.name)} · ${escapeHTML(item.email)}</span>
                            </div>
                            <div style="text-align:right">
                                <span class="admin-badge ${feedbackStatusBadge(item.status)}">${escapeHTML(item.status)}</span>
                                <span>${escapeHTML(formatDateTime(item.created_at))}</span>
                            </div>
                        </div>
                    `).join('')
                    : '<div class="empty-admin"><h3>Chưa có phản hồi</h3></div>';
            }
        } catch (error) {
            console.error(error);
        }

        window.lucide?.createIcons();
    }

    let adminPosts = [];

    function renderPostsTable() {
        const tbody = document.getElementById('adminPostsBody');
        if (!tbody) return;

        const search = (document.getElementById('adminPostSearch')?.value || '').trim().toLowerCase();
        const type = (document.getElementById('adminPostType')?.value || 'ALL').toLowerCase();
        const status = (document.getElementById('adminPostStatus')?.value || 'ALL').toLowerCase();

        let posts = [...adminPosts];

        if (search) {
            posts = posts.filter((post) => {
                const text = `${post.title} ${post.location} ${post.category} ${post.management_code}`.toLowerCase();
                return text.includes(search);
            });
        }

        if (type !== 'all') {
            posts = posts.filter((post) => post.type === type);
        }

        if (status !== 'all') {
            posts = posts.filter((post) => post.status === status);
        }

        tbody.innerHTML = posts.length > 0
            ? posts.map((post) => `
                <tr>
                    <td class="admin-title-cell">
                        <strong>${escapeHTML(post.title)}</strong>
                        <span>${escapeHTML(post.location || 'USTH')} · ${escapeHTML(post.category || 'Khác')}</span>
                    </td>
                    <td><span class="admin-badge ${post.type === 'found' ? 'badge-found' : 'badge-lost'}">${post.type.toUpperCase()}</span></td>
                    <td><span class="admin-badge ${statusBadge(post.status)}">${escapeHTML(post.status.toUpperCase())}</span></td>
                    <td><span class="management-code">${escapeHTML(post.management_code)}</span></td>
                    <td>${escapeHTML(formatDateTime(post.created_at))}</td>
                    <td>
                        <div class="admin-actions">
                            <button class="admin-btn" type="button" data-view-post="${post.id}">
                                <i data-lucide="eye"></i>Xem
                            </button>
                            <button class="admin-btn warning" type="button" data-toggle-post="${post.id}">
                                <i data-lucide="${post.status === 'hidden' ? 'eye' : 'eye-off'}"></i>
                                ${post.status === 'hidden' ? 'Hiện' : 'Ẩn'}
                            </button>
                            <button class="admin-btn danger" type="button" data-delete-post="${post.id}">
                                <i data-lucide="trash-2"></i>Xóa
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('')
            : '<tr><td colspan="6"><div class="empty-admin"><h3>Không có bài phù hợp</h3></div></td></tr>';

        bindPostActions();
        window.lucide?.createIcons();
    }

    async function loadAdminPosts() {
        if (!document.getElementById('adminPostsBody')) return;

        try {
            adminPosts = await request('/api/admin/posts');
            renderPostsTable();
        } catch (error) {
            console.error(error);
        }
    }

    function openPostModal(post) {
        const modal = document.getElementById('postDetailModal');
        const body = document.getElementById('postDetailBody');
        if (!modal || !body) return;

        body.innerHTML = `
            <dl class="detail-grid">
                <dt>ID bài</dt><dd>${escapeHTML(post.id)}</dd>
                <dt>Tiêu đề</dt><dd>${escapeHTML(post.title)}</dd>
                <dt>Người đăng</dt><dd>${escapeHTML(post.author_name || '')} · ${escapeHTML(post.author_email || '')}</dd>
                <dt>Loại</dt><dd>${escapeHTML(post.type.toUpperCase())}</dd>
                <dt>Trạng thái</dt><dd>${escapeHTML(post.status.toUpperCase())}</dd>
                <dt>Danh mục</dt><dd>${escapeHTML(post.category || '')}</dd>
                <dt>Địa điểm</dt><dd>${escapeHTML(post.location || '')}</dd>
                <dt>Ngày đăng</dt><dd>${escapeHTML(formatDateTime(post.created_at))}</dd>
                <dt>Mã quản lý</dt><dd>${escapeHTML(post.management_code || '')}</dd>
                <dt>Mô tả</dt><dd>${escapeHTML(post.description || '')}</dd>
            </dl>
        `;

        modal.classList.add('show');
    }

    function bindPostActions() {
        document.querySelectorAll('[data-view-post]').forEach((button) => {
            button.addEventListener('click', () => {
                const post = adminPosts.find((item) => item.id === button.dataset.viewPost);
                if (post) openPostModal(post);
            });
        });

        document.querySelectorAll('[data-toggle-post]').forEach((button) => {
            button.addEventListener('click', async () => {
                const post = adminPosts.find((item) => item.id === button.dataset.togglePost);
                if (!post) return;

                const nextStatus = post.status === 'hidden' ? 'active' : 'hidden';

                try {
                    await request(`/api/admin/posts/${post.id}/status`, {
                        method: 'PATCH',
                        body: { status: nextStatus }
                    });
                    toast(nextStatus === 'hidden' ? 'Đã ẩn bài.' : 'Đã hiện bài.');
                    loadAdminPosts();
                } catch (error) {
                    alert(error.message);
                }
            });
        });

        document.querySelectorAll('[data-delete-post]').forEach((button) => {
            button.addEventListener('click', async () => {
                const post = adminPosts.find((item) => item.id === button.dataset.deletePost);
                if (!post) return;
                if (!confirm(`Xóa bài “${post.title}”?`)) return;

                try {
                    await request(`/api/posts/${post.id}`, { method: 'DELETE' });
                    toast('Đã xóa bài.');
                    loadAdminPosts();
                } catch (error) {
                    alert(error.message);
                }
            });
        });
    }

    function setupPostFilters() {
        const ids = ['adminPostSearch', 'adminPostType', 'adminPostStatus'];

        ids.forEach((id) => {
            const element = document.getElementById(id);
            if (!element) return;
            element.addEventListener(element.tagName === 'INPUT' ? 'input' : 'change', renderPostsTable);
        });
    }

    let feedbackItems = [];

    function renderFeedback() {
        const list = document.getElementById('adminFeedbackList');
        if (!list) return;

        const filter = (document.getElementById('feedbackStatus')?.value || 'ALL').toLowerCase();
        const items = filter === 'all'
            ? feedbackItems
            : feedbackItems.filter((item) => item.status === filter);

        list.innerHTML = items.length > 0
            ? items.map((item) => `
                <article class="feedback-card ${item.status === 'new' ? 'new' : ''}">
                    <div class="feedback-head">
                        <div>
                            <span class="management-code">${escapeHTML(item.tracking_code)}</span>
                            <h4>${escapeHTML(item.subject)}</h4>
                            <div class="feedback-meta">${escapeHTML(item.name)} · ${escapeHTML(item.email)} · ${escapeHTML(formatDateTime(item.created_at))}</div>
                        </div>
                        <span class="admin-badge ${feedbackStatusBadge(item.status)}">${escapeHTML(item.status.toUpperCase())}</span>
                    </div>
                    <div class="feedback-message">${escapeHTML(item.message)}</div>
                    <div class="admin-reply-box">
                        <label>Phản hồi của Admin</label>
                        <textarea data-feedback-reply="${item.id}">${escapeHTML(item.admin_reply || '')}</textarea>
                    </div>
                    <div class="admin-actions">
                        <button class="admin-btn" data-feedback-status="read" data-feedback-id="${item.id}">Đã đọc</button>
                        <button class="admin-btn primary" data-feedback-status="resolved" data-feedback-id="${item.id}">Đã xử lý</button>
                    </div>
                </article>
            `).join('')
            : '<div class="empty-admin"><h3>Chưa có phản hồi phù hợp</h3></div>';

        bindFeedbackActions();
    }

    async function loadFeedback() {
        if (!document.getElementById('adminFeedbackList')) return;

        try {
            feedbackItems = await request('/api/feedback');
            renderFeedback();
        } catch (error) {
            console.error(error);
        }
    }

    function bindFeedbackActions() {
        document.querySelectorAll('[data-feedback-status]').forEach((button) => {
            button.addEventListener('click', async () => {
                const id = button.dataset.feedbackId;
                const status = button.dataset.feedbackStatus;
                const reply = document.querySelector(`[data-feedback-reply="${id}"]`)?.value.trim() || '';

                try {
                    await request(`/api/feedback/${id}`, {
                        method: 'PUT',
                        body: {
                            status,
                            adminReply: reply
                        }
                    });
                    toast('Đã cập nhật phản hồi.');
                    loadFeedback();
                } catch (error) {
                    alert(error.message);
                }
            });
        });
    }

    function setupFeedbackFilter() {
        document.getElementById('feedbackStatus')?.addEventListener('change', renderFeedback);
    }

    function setupModals() {
        document.querySelectorAll('[data-close-modal]').forEach((button) => {
            button.addEventListener('click', () => {
                button.closest('.admin-modal')?.classList.remove('show');
            });
        });

        document.querySelectorAll('.admin-modal').forEach((modal) => {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        document.getElementById('adminLoginForm')?.addEventListener('submit', handleAdminLogin);

        const allowed = await requireAdminPage();
        if (!allowed) return;

        setupLogout();
        injectAdminNavigation();
        setupPostFilters();
        setupFeedbackFilter();
        setupModals();

        await Promise.all([
            renderDashboard(),
            loadAdminPosts(),
            loadFeedback()
        ]);

        window.lucide?.createIcons();
    });
})();
