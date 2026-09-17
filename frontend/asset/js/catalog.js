(function (root, factory) {
    const catalog = factory();
    if (typeof module === 'object' && module.exports) module.exports = catalog;
    if (root) root.LostLinkCatalog = catalog;
})(typeof window === 'undefined' ? null : window, function () {
    const categories = [
        'Giấy tờ tùy thân', 'Thiết bị điện tử', 'Chìa khóa & Thẻ từ',
        'Túi xách, balo', 'Ví, tiền bạc', 'Sách vở & Dụng cụ học tập',
        'Phụ kiện cá nhân', 'Quần áo', 'Thiết bị thể thao', 'Khác'
    ];
    const locations = [
        'Tòa A21 - USTH Main Building', 'Thư viện A11', 'Tòa A10 - CNTT',
        'Căng tin A2', 'Tòa A1', 'Tòa A4', 'Tòa A18', 'Tòa A22',
        'Hồ sinh thái trung tâm', 'Cổng 18 Hoàng Quốc Việt',
        'Cổng Phùng Chí Kiên', 'Bãi xe', 'Khác'
    ];
    const categoryAliases = {
        'Sách vở': 'Sách vở & Dụng cụ học tập',
        'Phụ kiện': 'Phụ kiện cá nhân'
    };
    const locationAliases = {
        'Tòa A21 - USTH': 'Tòa A21 - USTH Main Building',
        'Tòa A11': 'Thư viện A11',
        'Tòa A10 - Tầng 4': 'Tòa A10 - CNTT'
    };
    function canonicalCategory(value) {
        return categoryAliases[value] || value;
    }
    function canonicalLocation(value) {
        return locationAliases[value] || value;
    }
    return { categories, locations, canonicalCategory, canonicalLocation };
});
