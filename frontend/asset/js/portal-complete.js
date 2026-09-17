(function () {
    'use strict';

    if (!window.LostLink) return;

    const {
        request,
        escapeHTML,
        formatRelativeTime
    } = window.LostLink;

    const searchState = {
        posts: []
    };

    function searchResultHTML(post) {
        const image = post.image_url || 'asset/images/placeholder.svg';

        return `
            <article class="search-result-card">
                <a class="search-result-image" href="detail.html?id=${encodeURIComponent(post.id)}">
                    <img src="${escapeHTML(image)}" alt="${escapeHTML(post.title)}">
                </a>
                <div class="search-result-copy">
                    <div class="search-result-meta">
                        <span class="badge ${post.type === 'found' ? 'found' : 'lost'}">
                            ${post.type === 'found' ? 'Nhặt được' : 'Thất lạc'}
                        </span>
                        ${post.high_value ? '<span class="portal-kicker">GIÁ TRỊ CAO</span>' : ''}
                    </div>
                    <h3><a href="detail.html?id=${encodeURIComponent(post.id)}">${escapeHTML(post.title)}</a></h3>
                    <p>${escapeHTML(post.description || '')}</p>
                    <div class="search-result-bottom">
                        <span><i data-lucide="map-pin"></i>${escapeHTML(post.location || 'USTH')}</span>
                        <span>${escapeHTML(post.category || 'Khác')}</span>
                        <span>${escapeHTML(formatRelativeTime(post.created_at))}</span>
                    </div>
                </div>
            </article>
        `;
    }

    function renderSearchResults() {
        const results = document.getElementById('completeSearchResults');
        if (!results) return;

        const query = (document.getElementById('completeSearchQuery')?.value || '').trim().toLowerCase();
        const category = document.getElementById('completeSearchCategory')?.value || '';
        const locationValue = document.getElementById('completeSearchLocation')?.value || '';
        const type = document.getElementById('completeSearchStatus')?.value || '';
        const highValueOnly = Boolean(document.getElementById('completeSearchHigh')?.checked);
        const sort = document.getElementById('completeSearchSort')?.value || 'newest';

        let posts = [...searchState.posts];

        if (query) {
            posts = posts.filter((post) => {
                const text = `${post.title} ${post.description} ${post.location} ${post.category}`.toLowerCase();
                return text.includes(query);
            });
        }

        if (category) {
            posts = posts.filter((post) => post.category === category);
        }

        if (locationValue) {
            posts = posts.filter((post) => post.location === locationValue);
        }

        if (type) {
            posts = posts.filter((post) => post.type === type.toLowerCase());
        }

        if (highValueOnly) {
            posts = posts.filter((post) => post.high_value);
        }

        posts.sort((a, b) => {
            if (sort === 'oldest') {
                return new Date(a.created_at) - new Date(b.created_at);
            }

            if (sort === 'title') {
                return String(a.title).localeCompare(String(b.title), 'vi');
            }

            return new Date(b.created_at) - new Date(a.created_at);
        });

        const count = document.getElementById('completeSearchCount');
        if (count) count.textContent = `${posts.length} tài sản`;

        results.innerHTML = posts.length > 0
            ? posts.map(searchResultHTML).join('')
            : `
                <div class="portal-empty-state">
                    <i data-lucide="search-x"></i>
                    <h3>Không tìm thấy tài sản phù hợp</h3>
                    <p>Thử đổi từ khóa hoặc xóa bớt bộ lọc.</p>
                </div>
            `;

        window.lucide?.createIcons();
    }

    async function setupSearchPage() {
        const results = document.getElementById('completeSearchResults');
        if (!results) return;

        try {
            searchState.posts = await request('/api/posts?status=active&sort=newest');
            renderSearchResults();
        } catch (error) {
            results.innerHTML = `
                <div class="portal-empty-state is-error">
                    <h3>Không thể tải dữ liệu tìm kiếm</h3>
                    <p>${escapeHTML(error.message)}</p>
                </div>
            `;
        }

        const ids = [
            'completeSearchQuery',
            'completeSearchCategory',
            'completeSearchLocation',
            'completeSearchStatus',
            'completeSearchHigh',
            'completeSearchSort'
        ];

        ids.forEach((id) => {
            const element = document.getElementById(id);
            if (!element) return;

            const eventName = element.tagName === 'INPUT' ? 'input' : 'change';
            element.addEventListener(eventName, renderSearchResults);
        });

        document.getElementById('completeSearchReset')?.addEventListener('click', () => {
            const query = document.getElementById('completeSearchQuery');
            const category = document.getElementById('completeSearchCategory');
            const locationSelect = document.getElementById('completeSearchLocation');
            const type = document.getElementById('completeSearchStatus');
            const high = document.getElementById('completeSearchHigh');
            const sort = document.getElementById('completeSearchSort');

            if (query) query.value = '';
            if (category) category.value = '';
            if (locationSelect) locationSelect.value = '';
            if (type) type.value = '';
            if (high) high.checked = false;
            if (sort) sort.value = 'newest';

            renderSearchResults();
        });
    }

    function applySavedAppearance() {
        try {
            const saved = JSON.parse(localStorage.getItem('lostlink_ui_preferences') || '{}');

            if (saved.theme) {
                document.body.dataset.portalTheme = saved.theme;
            }

            if (saved.clarity) {
                document.body.dataset.portalClarity = saved.clarity;
            }
        } catch (error) {
            // Appearance preferences are optional UI-only data.
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        applySavedAppearance();
        setupSearchPage();
        window.lucide?.createIcons();
    });
})();
