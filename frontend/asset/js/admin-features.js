(function () {
    'use strict';

    if (!window.LostLink) return;

    const {
        request,
        escapeHTML,
        formatDateTime
    } = window.LostLink;

    let claims = [];
    let securityReports = [];

    function claimStatusLabel(status) {
        const labels = {
            pending: 'Chờ xác minh',
            approved: 'Đã duyệt',
            rejected: 'Từ chối',
            completed: 'Đã bàn giao'
        };

        return labels[status] || status;
    }

    function securityStatusLabel(status) {
        const labels = {
            investigating: 'Đang điều tra',
            patrol_dispatched: 'Đã cử tuần tra',
            resolved: 'Đã xử lý'
        };

        return labels[status] || status;
    }

    function renderClaimAnswers(claim) {
        const questions = Array.isArray(claim.verification_questions)
            ? claim.verification_questions
            : [];
        const answers = Array.isArray(claim.answers)
            ? claim.answers
            : [];

        if (questions.length === 0 && answers.length === 0) {
            return '<p>Không có câu hỏi xác minh riêng.</p>';
        }

        return answers.map((item, index) => {
            const question = questions[index] || {};
            const hint = question.hint
                ? `<small>Gợi ý nội bộ: ${escapeHTML(question.hint)}</small>`
                : '';

            return `
                <div class="claim-answer-row">
                    <strong>${escapeHTML(item.question || question.question || `Câu ${index + 1}`)}</strong>
                    <span>${escapeHTML(item.answer || '—')}</span>
                    ${hint}
                </div>
            `;
        }).join('');
    }

    function renderClaims() {
        const list = document.getElementById('adminClaimsList');
        if (!list) return;

        const search = (document.getElementById('adminClaimSearch')?.value || '').trim().toLowerCase();
        const status = (document.getElementById('adminClaimStatus')?.value || 'ALL').toLowerCase();

        let items = [...claims];

        if (search) {
            items = items.filter((claim) => {
                const text = `${claim.tracking_code} ${claim.post_title} ${claim.claimer_name} ${claim.student_id}`.toLowerCase();
                return text.includes(search);
            });
        }

        if (status !== 'all') {
            items = items.filter((claim) => claim.status === status);
        }

        list.innerHTML = items.length > 0
            ? items.map((claim) => `
                <article class="admin-feature-card">
                    <div class="admin-feature-card-head">
                        <div>
                            <span class="management-code">${escapeHTML(claim.tracking_code)}</span>
                            <h3>${escapeHTML(claim.post_title)}</h3>
                            <p>${escapeHTML(claim.claimer_name)} · ${escapeHTML(claim.student_id)} · ${escapeHTML(claim.contact)}</p>
                        </div>
                        <span class="admin-badge">${escapeHTML(claimStatusLabel(claim.status))}</span>
                    </div>
                    <div class="admin-feature-detail">
                        <p><strong>Bằng chứng sở hữu:</strong> ${escapeHTML(claim.message)}</p>
                        ${renderClaimAnswers(claim)}
                    </div>
                    ${claim.status === 'approved' && claim.pickup_code ? `<div class="verification-token"><span>MÃ NHẬN ĐỒ</span><strong>${escapeHTML(claim.pickup_code)}</strong></div>` : ''}
                    <label class="admin-reply-box">
                        <span>Ghi chú Admin</span>
                        <textarea data-claim-note="${claim.id}">${escapeHTML(claim.admin_note || '')}</textarea>
                    </label>
                    <div class="admin-actions">
                        ${claim.status === 'pending' ? `<button class="admin-btn primary" data-claim-status="approved" data-claim-id="${claim.id}">Duyệt</button>` : ''}
                        ${['pending', 'approved'].includes(claim.status) ? `<button class="admin-btn warning" data-claim-status="rejected" data-claim-id="${claim.id}">Từ chối</button>` : ''}
                        ${claim.status === 'approved' ? `<button class="admin-btn" data-claim-status="completed" data-claim-id="${claim.id}">Đã bàn giao</button>` : ''}
                    </div>
                    <small>Tạo lúc ${escapeHTML(formatDateTime(claim.created_at))}</small>
                </article>
            `).join('')
            : '<div class="empty-admin"><h3>Không có hồ sơ phù hợp</h3></div>';

        bindClaimActions();
    }

    async function loadClaims() {
        if (!document.getElementById('adminClaimsList')) return;

        try {
            claims = await request('/api/claims');
            renderClaims();
        } catch (error) {
            console.error(error);
        }
    }

    function bindClaimActions() {
        document.querySelectorAll('[data-claim-status]').forEach((button) => {
            button.addEventListener('click', async () => {
                const id = button.dataset.claimId;
                const status = button.dataset.claimStatus;
                const adminNote = document.querySelector(`[data-claim-note="${id}"]`)?.value.trim() || '';

                try {
                    await request(`/api/claims/${id}/status`, {
                        method: 'PUT',
                        body: { status, adminNote }
                    });
                    loadClaims();
                } catch (error) {
                    alert(error.message);
                }
            });
        });
    }

    function setupClaimFilters() {
        document.getElementById('adminClaimSearch')?.addEventListener('input', renderClaims);
        document.getElementById('adminClaimStatus')?.addEventListener('change', renderClaims);
    }

    function renderSecurityReports() {
        const list = document.getElementById('adminSecurityList');
        if (!list) return;

        const status = (document.getElementById('adminSecurityStatus')?.value || 'ALL').toLowerCase();
        const items = status === 'all'
            ? securityReports
            : securityReports.filter((report) => report.status === status);

        list.innerHTML = items.length > 0
            ? items.map((report) => `
                <article class="admin-feature-card">
                    <div class="admin-feature-card-head">
                        <div>
                            <span class="management-code">${escapeHTML(report.tracking_code)}</span>
                            <h3>${escapeHTML(report.location)}</h3>
                            <p>${escapeHTML(report.category)} · ${escapeHTML(report.urgency)}</p>
                        </div>
                        <span class="admin-badge">${escapeHTML(securityStatusLabel(report.status))}</span>
                    </div>
                    <div class="admin-feature-detail">
                        <p><strong>Vị trí:</strong> ${escapeHTML(report.specific_location)}</p>
                        <p><strong>Mô tả:</strong> ${escapeHTML(report.description)}</p>
                        <p><strong>Người báo:</strong> ${report.anonymous ? 'Ẩn danh' : escapeHTML(report.reporter_name || '')}</p>
                    </div>
                    <label class="admin-reply-box">
                        <span>Ghi chú Admin</span>
                        <textarea data-security-note="${report.id}">${escapeHTML(report.admin_note || '')}</textarea>
                    </label>
                    <div class="admin-actions">
                        <button class="admin-btn" data-security-status="investigating" data-security-id="${report.id}">Điều tra</button>
                        <button class="admin-btn warning" data-security-status="patrol_dispatched" data-security-id="${report.id}">Cử tuần tra</button>
                        <button class="admin-btn primary" data-security-status="resolved" data-security-id="${report.id}">Đã xử lý</button>
                    </div>
                    <small>Tạo lúc ${escapeHTML(formatDateTime(report.created_at))}</small>
                </article>
            `).join('')
            : '<div class="empty-admin"><h3>Không có báo cáo phù hợp</h3></div>';

        bindSecurityActions();
    }

    async function loadSecurityReports() {
        if (!document.getElementById('adminSecurityList')) return;

        try {
            securityReports = await request('/api/security-reports');
            renderSecurityReports();
        } catch (error) {
            console.error(error);
        }
    }

    function bindSecurityActions() {
        document.querySelectorAll('[data-security-status]').forEach((button) => {
            button.addEventListener('click', async () => {
                const id = button.dataset.securityId;
                const status = button.dataset.securityStatus;
                const adminNote = document.querySelector(`[data-security-note="${id}"]`)?.value.trim() || '';

                try {
                    await request(`/api/security-reports/${id}/status`, {
                        method: 'PUT',
                        body: { status, adminNote }
                    });
                    loadSecurityReports();
                } catch (error) {
                    alert(error.message);
                }
            });
        });
    }

    function setupSecurityFilter() {
        document.getElementById('adminSecurityStatus')?.addEventListener('change', renderSecurityReports);
    }

    document.addEventListener('DOMContentLoaded', () => {
        setupClaimFilters();
        setupSecurityFilter();
        loadClaims();
        loadSecurityReports();
        window.lucide?.createIcons();
    });
})();
