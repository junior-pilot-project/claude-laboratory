class ProductManager {
    constructor() {
        this.products = JSON.parse(localStorage.getItem('products')) || [];
        this.categories = JSON.parse(localStorage.getItem('categories')) || [
            { code: 'electronics', name: '전자제품' },
            { code: 'clothing', name: '의류' },
            { code: 'food', name: '식품' },
            { code: 'books', name: '도서' },
            { code: 'beauty', name: '뷰티' },
            { code: 'sports', name: '스포츠' },
            { code: 'home', name: '생활용품' }
        ];
        this.currentView = 'form';
        this.editingProduct = null;
        this.bulkImportData = [];
        this.currentDetailProduct = null;
        this.currentImageIndex = 0;
        this.zoomLevel = 1;

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateCategorySelectors();
        this.setupImageUpload();
        this.loadProductList();
        this.setupKeyboardShortcuts();
        this.restoreAutoSavedData();
        this.setupImageZoom();
        this.setupRichEditor();
    }

    bindEvents() {
        // 메인 네비게이션
        document.getElementById('addProductBtn').addEventListener('click', () => this.showProductForm());
        document.getElementById('bulkImportBtn').addEventListener('click', () => this.showBulkImportModal());
        document.getElementById('viewProductsBtn').addEventListener('click', () => this.showProductList());
        document.getElementById('viewDashboardBtn').addEventListener('click', () => this.showDashboard());
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());

        // 폼 이벤트
        document.getElementById('categorySelect').addEventListener('change', (e) => this.handleCategoryChange(e.target.value));
        document.getElementById('generateCodeBtn').addEventListener('click', () => this.generateProductCode());
        document.getElementById('productForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
        document.getElementById('cancelBtn').addEventListener('click', () => this.resetForm());
        document.getElementById('saveAsDraftBtn').addEventListener('click', () => this.saveAsDraft());

        // 실시간 유효성 검사
        document.getElementById('productName').addEventListener('blur', () => this.validateField('productName'));
        document.getElementById('originalPrice').addEventListener('blur', () => this.validateField('originalPrice'));

        // 자동저장 (30초마다)
        setInterval(() => this.autoSave(), 30000);

        // 가격 계산 이벤트
        document.getElementById('originalPrice').addEventListener('input', () => this.calculateSalePrice());
        document.getElementById('discount').addEventListener('input', () => this.calculateSalePrice());
        document.getElementById('salePrice').addEventListener('input', () => this.calculateDiscount());

        // 카테고리 관리
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.showCategoryModal());
        document.getElementById('closeCategoryModal').addEventListener('click', () => this.hideCategoryModal());
        document.getElementById('cancelCategoryBtn').addEventListener('click', () => this.hideCategoryModal());
        document.getElementById('saveCategoryBtn').addEventListener('click', () => this.saveNewCategory());

        // 검색 및 필터
        document.getElementById('searchInput').addEventListener('input', () => this.filterProducts());
        document.getElementById('categoryFilter').addEventListener('change', () => this.filterProducts());
        document.getElementById('statusFilter').addEventListener('change', () => this.filterProducts());

        // 고급 필터
        document.getElementById('advancedFilterBtn').addEventListener('click', () => this.toggleAdvancedFilters());
        document.getElementById('applyFiltersBtn').addEventListener('click', () => this.applyAdvancedFilters());
        document.getElementById('clearFiltersBtn').addEventListener('click', () => this.clearAdvancedFilters());

        // 대시보드 필터
        document.getElementById('dashboardPeriod').addEventListener('change', () => this.updateDashboard());

        // 일괄 등록 모달
        document.getElementById('closeBulkImportModal').addEventListener('click', () => this.hideBulkImportModal());
        document.getElementById('cancelBulkImportBtn').addEventListener('click', () => this.hideBulkImportModal());
        document.getElementById('downloadTemplateBtn').addEventListener('click', () => this.downloadTemplate());
        document.getElementById('processBulkImportBtn').addEventListener('click', () => this.processBulkImport());
        document.getElementById('removeBulkFile').addEventListener('click', () => this.removeBulkFile());

        // 일괄 등록 파일 업로드
        this.setupBulkFileUpload();

        // 상품 상세페이지
        document.getElementById('backToListBtn').addEventListener('click', () => this.showProductList());
        document.getElementById('editProductFromDetailBtn').addEventListener('click', () => this.editCurrentDetailProduct());
        document.getElementById('duplicateFromDetailBtn').addEventListener('click', () => this.duplicateCurrentDetailProduct());
        document.getElementById('deleteFromDetailBtn').addEventListener('click', () => this.deleteCurrentDetailProduct());

        // 이미지 갤러리
        document.getElementById('prevImageBtn').addEventListener('click', () => this.previousImage());
        document.getElementById('nextImageBtn').addEventListener('click', () => this.nextImage());
        document.getElementById('zoomImageBtn').addEventListener('click', () => this.openImageZoom());

        // 이미지 확대보기
        document.getElementById('closeImageZoomModal').addEventListener('click', () => this.closeImageZoom());
        document.getElementById('zoomPrevBtn').addEventListener('click', () => this.zoomPreviousImage());
        document.getElementById('zoomNextBtn').addEventListener('click', () => this.zoomNextImage());
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoomOut());
        document.getElementById('zoomResetBtn').addEventListener('click', () => this.resetZoom());

        // 모달 클릭 외부 닫기
        document.getElementById('categoryModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideCategoryModal();
            }
        });
    }

    // 카테고리별 동적 필드 생성
    handleCategoryChange(categoryCode) {
        const fieldsContainer = document.getElementById('categorySpecificFields');
        fieldsContainer.innerHTML = '';

        if (!categoryCode) return;

        const categoryFields = this.getCategoryFields(categoryCode);

        categoryFields.forEach(field => {
            const fieldElement = this.createDynamicField(field);
            fieldsContainer.appendChild(fieldElement);
        });
    }

    getCategoryFields(categoryCode) {
        const fieldSets = {
            electronics: [
                { type: 'text', name: 'model', label: '모델명', required: false },
                { type: 'text', name: 'warranty', label: '보증기간', required: false },
                { type: 'text', name: 'power', label: '소비전력', required: false },
                { type: 'select', name: 'energyRating', label: '에너지효율등급', options: ['1등급', '2등급', '3등급', '4등급', '5등급'] }
            ],
            clothing: [
                { type: 'select', name: 'size', label: '사이즈', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], required: true },
                { type: 'select', name: 'color', label: '색상', options: ['블랙', '화이트', '그레이', '네이비', '베이지', '기타'], required: true },
                { type: 'text', name: 'material', label: '소재', required: false },
                { type: 'select', name: 'season', label: '시즌', options: ['봄/여름', '가을/겨울', '사계절'] }
            ],
            food: [
                { type: 'date', name: 'expiryDate', label: '유통기한', required: true },
                { type: 'text', name: 'origin', label: '원산지', required: true },
                { type: 'text', name: 'nutrition', label: '영양성분', required: false },
                { type: 'checkbox', name: 'organic', label: '유기농 제품' }
            ],
            books: [
                { type: 'text', name: 'author', label: '저자', required: true },
                { type: 'text', name: 'publisher', label: '출판사', required: true },
                { type: 'date', name: 'publishDate', label: '출간일', required: false },
                { type: 'text', name: 'isbn', label: 'ISBN', required: false },
                { type: 'number', name: 'pages', label: '페이지수', required: false }
            ],
            beauty: [
                { type: 'text', name: 'skinType', label: '피부타입', required: false },
                { type: 'text', name: 'ingredients', label: '주요성분', required: false },
                { type: 'text', name: 'volume', label: '용량', required: true },
                { type: 'date', name: 'expiryDate', label: '유통기한', required: true }
            ],
            sports: [
                { type: 'select', name: 'sportType', label: '운동종목', options: ['헬스', '러닝', '요가', '수영', '등산', '기타'] },
                { type: 'text', name: 'size', label: '사이즈', required: false },
                { type: 'text', name: 'weight', label: '무게', required: false },
                { type: 'text', name: 'material', label: '소재', required: false }
            ],
            home: [
                { type: 'text', name: 'dimensions', label: '크기(가로x세로x높이)', required: false },
                { type: 'text', name: 'weight', label: '무게', required: false },
                { type: 'text', name: 'material', label: '소재', required: false },
                { type: 'select', name: 'roomType', label: '사용공간', options: ['거실', '침실', '주방', '욕실', '기타'] }
            ]
        };

        return fieldSets[categoryCode] || [];
    }

    createDynamicField(field) {
        const div = document.createElement('div');
        div.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = field.label + (field.required ? ' *' : '');
        label.setAttribute('for', field.name);
        div.appendChild(label);

        let input;

        switch (field.type) {
            case 'select':
                input = document.createElement('select');
                input.className = 'form-select';

                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '선택하세요';
                input.appendChild(defaultOption);

                field.options.forEach(option => {
                    const opt = document.createElement('option');
                    opt.value = option;
                    opt.textContent = option;
                    input.appendChild(opt);
                });
                break;

            case 'checkbox':
                input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'form-checkbox';
                break;

            case 'textarea':
                input = document.createElement('textarea');
                input.className = 'form-textarea';
                input.rows = 3;
                break;

            default:
                input = document.createElement('input');
                input.type = field.type || 'text';
                input.className = 'form-input';
        }

        input.name = field.name;
        input.id = field.name;
        if (field.required) input.required = true;

        div.appendChild(input);
        return div;
    }

    // 상품코드 자동 생성
    generateProductCode() {
        const category = document.getElementById('categorySelect').value;
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();

        let prefix = 'PRD';
        if (category) {
            prefix = category.substring(0, 3).toUpperCase();
        }

        const productCode = `${prefix}-${timestamp}-${random}`;
        document.getElementById('productCode').value = productCode;
    }

    // 가격 계산
    calculateSalePrice() {
        const originalPrice = parseFloat(document.getElementById('originalPrice').value) || 0;
        const discount = parseFloat(document.getElementById('discount').value) || 0;

        if (originalPrice > 0 && discount > 0) {
            const salePrice = originalPrice * (1 - discount / 100);
            document.getElementById('salePrice').value = Math.round(salePrice);
        }
    }

    calculateDiscount() {
        const originalPrice = parseFloat(document.getElementById('originalPrice').value) || 0;
        const salePrice = parseFloat(document.getElementById('salePrice').value) || 0;

        if (originalPrice > 0 && salePrice > 0 && salePrice < originalPrice) {
            const discount = ((originalPrice - salePrice) / originalPrice) * 100;
            document.getElementById('discount').value = Math.round(discount * 100) / 100;
        }
    }

    // 이미지 업로드 설정
    setupImageUpload() {
        const uploadZone = document.getElementById('imageUploadZone');
        const fileInput = document.getElementById('imageUpload');
        const previewContainer = document.getElementById('imagePreviewContainer');

        uploadZone.addEventListener('click', () => fileInput.click());

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            this.handleImageFiles(files);
        });

        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleImageFiles(files);
        });
    }

    handleImageFiles(files) {
        const previewContainer = document.getElementById('imagePreviewContainer');

        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imagePreview = this.createImagePreview(e.target.result, file.name);
                    previewContainer.appendChild(imagePreview);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    createImagePreview(src, filename) {
        const div = document.createElement('div');
        div.className = 'image-preview';

        const img = document.createElement('img');
        img.src = src;
        img.alt = filename;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'image-remove';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', () => div.remove());

        div.appendChild(img);
        div.appendChild(removeBtn);

        return div;
    }

    // 폼 제출 처리
    handleFormSubmit(e) {
        e.preventDefault();

        if (!this.validateForm()) return;

        const productData = this.getFormData();
        productData.status = 'active';
        productData.createdAt = new Date().toISOString();

        if (this.editingProduct) {
            productData.id = this.editingProduct.id;
            productData.updatedAt = new Date().toISOString();
            this.updateProduct(productData);
        } else {
            productData.id = this.generateId();
            this.addProduct(productData);
        }

        this.saveProducts();
        this.resetForm();
        this.showSuccessMessage(this.editingProduct ? '상품이 수정되었습니다.' : '상품이 등록되었습니다.');
        this.showProductList();
    }

    saveAsDraft() {
        if (!this.validateBasicInfo()) return;

        const productData = this.getFormData();
        productData.status = 'draft';
        productData.createdAt = new Date().toISOString();

        if (this.editingProduct) {
            productData.id = this.editingProduct.id;
            productData.updatedAt = new Date().toISOString();
            this.updateProduct(productData);
        } else {
            productData.id = this.generateId();
            this.addProduct(productData);
        }

        this.saveProducts();
        this.showSuccessMessage('상품이 임시저장되었습니다.');
    }

    validateForm() {
        const requiredFields = ['productName', 'originalPrice'];
        let isValid = true;

        requiredFields.forEach(fieldName => {
            const field = document.getElementById(fieldName);
            if (!field.value.trim()) {
                field.style.borderColor = '#ef4444';
                isValid = false;
            } else {
                field.style.borderColor = '#d1d5db';
            }
        });

        return isValid;
    }

    validateBasicInfo() {
        const productName = document.getElementById('productName').value.trim();
        if (!productName) {
            document.getElementById('productName').style.borderColor = '#ef4444';
            this.showErrorMessage('상품명을 입력해주세요.');
            return false;
        }
        return true;
    }

    getFormData() {
        const formData = new FormData(document.getElementById('productForm'));
        const data = {};

        // 기본 필드
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }

        // 동적 필드
        const dynamicFields = document.querySelectorAll('#categorySpecificFields input, #categorySpecificFields select, #categorySpecificFields textarea');
        dynamicFields.forEach(field => {
            if (field.type === 'checkbox') {
                data[field.name] = field.checked;
            } else {
                data[field.name] = field.value;
            }
        });

        // 메인 이미지
        const images = [];
        const imagePreview = document.querySelectorAll('.image-preview img');
        imagePreview.forEach(img => {
            images.push(img.src);
        });
        data.images = images;

        // 리치 콘텐츠 데이터 수집
        data = this.collectRichContentData(data);

        return data;
    }

    addProduct(product) {
        this.products.push(product);
    }

    updateProduct(updatedProduct) {
        const index = this.products.findIndex(p => p.id === updatedProduct.id);
        if (index !== -1) {
            this.products[index] = updatedProduct;
        }
    }

    deleteProduct(productId) {
        if (confirm('정말로 이 상품을 삭제하시겠습니까?')) {
            this.products = this.products.filter(p => p.id !== productId);
            this.saveProducts();
            this.loadProductList();
            this.showSuccessMessage('상품이 삭제되었습니다.');
        }
    }

    saveProducts() {
        localStorage.setItem('products', JSON.stringify(this.products));
    }

    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    // 뷰 관리
    showProductForm(product = null) {
        document.getElementById('productFormSection').style.display = 'block';
        document.getElementById('productListSection').style.display = 'none';

        this.currentView = 'form';
        this.editingProduct = product;

        if (product) {
            this.populateForm(product);
            document.querySelector('.form-header h2').textContent = '상품 수정';
        } else {
            this.resetForm();
            document.querySelector('.form-header h2').textContent = '상품 등록';
        }
    }

    showProductList() {
        document.getElementById('productFormSection').style.display = 'none';
        document.getElementById('productListSection').style.display = 'block';
        document.getElementById('dashboardSection').style.display = 'none';

        this.currentView = 'list';
        this.loadProductList();
        this.updateCategoryFilter();
    }

    showDashboard() {
        document.getElementById('productFormSection').style.display = 'none';
        document.getElementById('productListSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'block';

        this.currentView = 'dashboard';
        this.updateDashboard();
    }

    populateForm(product) {
        // 기본 필드 채우기
        Object.keys(product).forEach(key => {
            const field = document.getElementById(key);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = product[key];
                } else {
                    field.value = product[key] || '';
                }
            }
        });

        // 카테고리별 필드 다시 생성
        if (product.categorySelect) {
            document.getElementById('categorySelect').value = product.categorySelect;
            this.handleCategoryChange(product.categorySelect);

            // 동적 필드 값 설정
            setTimeout(() => {
                Object.keys(product).forEach(key => {
                    const field = document.getElementById(key);
                    if (field && field.closest('#categorySpecificFields')) {
                        if (field.type === 'checkbox') {
                            field.checked = product[key];
                        } else {
                            field.value = product[key] || '';
                        }
                    }
                });
            }, 100);
        }

        // 이미지 미리보기
        if (product.images && product.images.length > 0) {
            const previewContainer = document.getElementById('imagePreviewContainer');
            previewContainer.innerHTML = '';
            product.images.forEach(imageSrc => {
                const imagePreview = this.createImagePreview(imageSrc, 'image');
                previewContainer.appendChild(imagePreview);
            });
        }

        // 리치 콘텐츠 로드
        this.loadRichContentForEdit(product);
    }

    resetForm() {
        document.getElementById('productForm').reset();
        document.getElementById('categorySpecificFields').innerHTML = '';
        document.getElementById('imagePreviewContainer').innerHTML = '';
        this.editingProduct = null;

        // 리치 콘텐츠 영역 초기화
        const richContentFields = ['detailedDescription', 'usageGuide', 'importantNotices', 'deliveryInfo'];
        richContentFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.innerHTML = '';
            }
        });

        // 추가 이미지 미리보기 초기화
        const additionalImagePreview = document.getElementById('additionalImagePreview');
        if (additionalImagePreview) {
            additionalImagePreview.innerHTML = '';
        }

        // 테두리 색상 초기화
        const inputs = document.querySelectorAll('.form-input, .form-select, .form-textarea');
        inputs.forEach(input => {
            input.style.borderColor = '#d1d5db';
        });
    }

    // 상품 목록 관리
    loadProductList() {
        const tbody = document.getElementById('productTableBody');
        tbody.innerHTML = '';

        let filteredProducts = [...this.products];

        // 기본 필터 적용
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const categoryFilter = document.getElementById('categoryFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;

        if (searchTerm) {
            filteredProducts = filteredProducts.filter(product =>
                product.productName?.toLowerCase().includes(searchTerm) ||
                product.brand?.toLowerCase().includes(searchTerm) ||
                product.productCode?.toLowerCase().includes(searchTerm)
            );
        }

        if (categoryFilter) {
            filteredProducts = filteredProducts.filter(product =>
                product.categorySelect === categoryFilter
            );
        }

        if (statusFilter) {
            filteredProducts = filteredProducts.filter(product =>
                product.status === statusFilter
            );
        }

        // 고급 필터 적용
        const priceMin = parseFloat(document.getElementById('priceRangeMin').value);
        const priceMax = parseFloat(document.getElementById('priceRangeMax').value);
        const stockFilter = document.getElementById('stockFilter').value;
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;

        if (!isNaN(priceMin)) {
            filteredProducts = filteredProducts.filter(product =>
                parseFloat(product.originalPrice || 0) >= priceMin
            );
        }

        if (!isNaN(priceMax)) {
            filteredProducts = filteredProducts.filter(product =>
                parseFloat(product.originalPrice || 0) <= priceMax
            );
        }

        if (stockFilter) {
            filteredProducts = filteredProducts.filter(product =>
                product.stockStatus === stockFilter
            );
        }

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            filteredProducts = filteredProducts.filter(product =>
                product.createdAt && new Date(product.createdAt) >= fromDate
            );
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999); // 하루 끝까지 포함
            filteredProducts = filteredProducts.filter(product =>
                product.createdAt && new Date(product.createdAt) <= toDate
            );
        }

        // 정렬 적용
        const sortBy = document.getElementById('sortBy').value;
        const [sortField, sortOrder] = sortBy.split('-');

        filteredProducts.sort((a, b) => {
            let aValue = a[sortField];
            let bValue = b[sortField];

            // 날짜 필드 처리
            if (sortField === 'createdAt') {
                aValue = new Date(aValue || 0);
                bValue = new Date(bValue || 0);
            }
            // 숫자 필드 처리
            else if (['originalPrice', 'salePrice', 'stockQuantity'].includes(sortField)) {
                aValue = parseFloat(aValue || 0);
                bValue = parseFloat(bValue || 0);
            }
            // 문자열 필드 처리
            else {
                aValue = (aValue || '').toString().toLowerCase();
                bValue = (bValue || '').toString().toLowerCase();
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        filteredProducts.forEach(product => {
            const row = this.createProductRow(product);
            tbody.appendChild(row);
        });

        if (filteredProducts.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="10" class="text-center" style="padding: 40px;">등록된 상품이 없습니다.</td>';
            tbody.appendChild(emptyRow);
        }
    }

    createProductRow(product) {
        const row = document.createElement('tr');

        const categoryName = this.categories.find(cat => cat.code === product.categorySelect)?.name || '-';
        const mainImage = product.images && product.images.length > 0 ? product.images[0] : '';
        const createdDate = product.createdAt ? new Date(product.createdAt).toLocaleDateString() : '-';

        row.innerHTML = `
            <td>
                <input type="checkbox" class="product-checkbox" data-product-id="${product.id}" onchange="productManager.updateBulkActionButtons()">
            </td>
            <td>
                ${mainImage ? `<img src="${mainImage}" alt="${product.productName}" />` : '<div style="width:50px;height:50px;background:#f3f4f6;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#9ca3af;">📷</div>'}
            </td>
            <td><strong><a href="#" class="product-link" onclick="productManager.showProductDetail('${product.id}'); return false;">${product.productName || '-'}</a></strong></td>
            <td>${categoryName}</td>
            <td>${product.brand || '-'}</td>
            <td>${product.originalPrice ? Number(product.originalPrice).toLocaleString() + '원' : '-'}</td>
            <td>${product.salePrice ? Number(product.salePrice).toLocaleString() + '원' : '-'}</td>
            <td>${product.stockQuantity || '-'}</td>
            <td><span class="status-badge status-${product.status}">${this.getStatusText(product.status)}</span></td>
            <td>${createdDate}</td>
            <td>
                <div class="product-actions">
                    <button class="btn btn-sm btn-secondary" onclick="productManager.editProduct('${product.id}')" title="수정">✏️</button>
                    <button class="btn btn-sm btn-secondary" onclick="productManager.duplicateProduct('${product.id}')" title="복제">📋</button>
                    <button class="btn btn-sm btn-danger" onclick="productManager.deleteProduct('${product.id}')" title="삭제">🗑️</button>
                </div>
            </td>
        `;

        return row;
    }

    getStatusText(status) {
        const statusMap = {
            'active': '활성',
            'draft': '임시저장',
            'inactive': '비활성'
        };
        return statusMap[status] || status;
    }

    editProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            this.showProductForm(product);
        }
    }

    filterProducts() {
        this.loadProductList();
    }

    // 카테고리 관리
    updateCategorySelectors() {
        const selectors = ['categorySelect', 'categoryFilter'];

        selectors.forEach(selectorId => {
            const selector = document.getElementById(selectorId);
            if (!selector) return;

            // 기존 옵션 제거 (첫 번째 옵션 제외)
            while (selector.children.length > 1) {
                selector.removeChild(selector.lastChild);
            }

            // 새 옵션 추가
            this.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.code;
                option.textContent = category.name;
                selector.appendChild(option);
            });
        });
    }

    updateCategoryFilter() {
        this.updateCategorySelectors();
    }

    showCategoryModal() {
        document.getElementById('categoryModal').classList.add('active');
        document.getElementById('newCategoryName').value = '';
        document.getElementById('newCategoryCode').value = '';
    }

    hideCategoryModal() {
        document.getElementById('categoryModal').classList.remove('active');
    }

    saveNewCategory() {
        const name = document.getElementById('newCategoryName').value.trim();
        const code = document.getElementById('newCategoryCode').value.trim();

        if (!name || !code) {
            this.showErrorMessage('카테고리명과 코드를 모두 입력해주세요.');
            return;
        }

        if (this.categories.find(cat => cat.code === code)) {
            this.showErrorMessage('이미 존재하는 카테고리 코드입니다.');
            return;
        }

        this.categories.push({ code, name });
        localStorage.setItem('categories', JSON.stringify(this.categories));

        this.updateCategorySelectors();
        this.hideCategoryModal();
        this.showSuccessMessage('새 카테고리가 추가되었습니다.');
    }

    // 메시지 표시
    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }

    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 1001;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
        `;

        if (type === 'success') {
            messageDiv.style.backgroundColor = '#10b981';
        } else if (type === 'error') {
            messageDiv.style.backgroundColor = '#ef4444';
        } else {
            messageDiv.style.backgroundColor = '#3b82f6';
        }

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => messageDiv.remove(), 300);
        }, 3000);

        // 애니메이션 스타일 추가
        if (!document.querySelector('#message-animations')) {
            const style = document.createElement('style');
            style.id = 'message-animations';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // 비즈니스 대시보드 관련 메서드들
    updateDashboard() {
        const period = parseInt(document.getElementById('dashboardPeriod').value);
        const analytics = this.calculateAnalytics(period);

        this.updateKPICards(analytics);
        this.updateCharts(analytics);
        this.updateInsights(analytics);
    }

    calculateAnalytics(days) {
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

        // 기간 내 상품 필터링
        const periodProducts = this.products.filter(product => {
            if (!product.createdAt) return false;
            return new Date(product.createdAt) >= cutoffDate;
        });

        // 전체 상품 분석
        const totalProducts = this.products.length;
        const activeProducts = this.products.filter(p => p.status === 'active').length;
        const draftProducts = this.products.filter(p => p.status === 'draft').length;

        // 재고 분석
        const lowStockItems = this.products.filter(p => {
            if (!p.stockQuantity || !p.minStock) return false;
            return parseInt(p.stockQuantity) <= parseInt(p.minStock);
        }).length;

        const outOfStockItems = this.products.filter(p =>
            p.stockStatus === 'out-of-stock' || parseInt(p.stockQuantity || 0) === 0
        ).length;

        // 가치 분석
        const totalInventoryValue = this.products.reduce((sum, product) => {
            const price = parseFloat(product.originalPrice || 0);
            const quantity = parseInt(product.stockQuantity || 0);
            return sum + (price * quantity);
        }, 0);

        // 평균 마진율 계산
        const marginsData = this.products.filter(p => p.originalPrice && p.salePrice).map(p => {
            const original = parseFloat(p.originalPrice);
            const sale = parseFloat(p.salePrice);
            return original > 0 ? ((original - sale) / original) * 100 : 0;
        });
        const avgMargin = marginsData.length > 0 ?
            marginsData.reduce((sum, margin) => sum + margin, 0) / marginsData.length : 0;

        // 카테고리별 분포
        const categoryDistribution = {};
        this.products.forEach(product => {
            const category = product.categorySelect || 'unknown';
            const categoryName = this.categories.find(cat => cat.code === category)?.name || '미분류';
            categoryDistribution[categoryName] = (categoryDistribution[categoryName] || 0) + 1;
        });

        // 가격대별 분포
        const priceRanges = {
            '~10만원': 0,
            '10~50만원': 0,
            '50~100만원': 0,
            '100만원+': 0
        };

        this.products.forEach(product => {
            const price = parseFloat(product.originalPrice || 0);
            if (price <= 100000) priceRanges['~10만원']++;
            else if (price <= 500000) priceRanges['10~50만원']++;
            else if (price <= 1000000) priceRanges['50~100만원']++;
            else priceRanges['100만원+']++;
        });

        // 성장률 계산 (이전 기간 대비)
        const previousPeriodProducts = this.products.filter(product => {
            if (!product.createdAt) return false;
            const productDate = new Date(product.createdAt);
            const previousCutoff = new Date(cutoffDate.getTime() - (days * 24 * 60 * 60 * 1000));
            return productDate >= previousCutoff && productDate < cutoffDate;
        });

        const productGrowthRate = previousPeriodProducts.length > 0 ?
            ((periodProducts.length - previousPeriodProducts.length) / previousPeriodProducts.length) * 100 : 0;

        return {
            totalProducts,
            activeProducts,
            draftProducts,
            lowStockItems,
            outOfStockItems,
            totalInventoryValue,
            avgMargin,
            categoryDistribution,
            priceRanges,
            productGrowthRate,
            periodProducts: periodProducts.length
        };
    }

    updateKPICards(analytics) {
        // 총 상품 수
        document.getElementById('totalProducts').textContent = analytics.totalProducts.toLocaleString();
        document.getElementById('productsChange').textContent =
            `${analytics.productGrowthRate >= 0 ? '+' : ''}${analytics.productGrowthRate.toFixed(1)}%`;
        document.getElementById('productsChange').className =
            analytics.productGrowthRate >= 0 ? 'kpi-change positive' : 'kpi-change negative';

        // 총 재고 가치
        document.getElementById('totalValue').textContent =
            '₩' + analytics.totalInventoryValue.toLocaleString();

        // 재고 부족 상품
        document.getElementById('lowStockItems').textContent = analytics.lowStockItems;
        document.getElementById('lowStockChange').textContent = analytics.lowStockItems;

        // 평균 마진율
        document.getElementById('avgMargin').textContent = analytics.avgMargin.toFixed(1) + '%';
    }

    updateCharts(analytics) {
        // 카테고리별 분포 차트
        const categoryChart = document.getElementById('categoryChart');
        categoryChart.innerHTML = this.createBarChart(analytics.categoryDistribution, '개');

        // 가격대별 분포 차트
        const priceChart = document.getElementById('priceDistributionChart');
        priceChart.innerHTML = this.createBarChart(analytics.priceRanges, '개');
    }

    createBarChart(data, unit) {
        const maxValue = Math.max(...Object.values(data));
        const chartHtml = Object.entries(data).map(([label, value]) => {
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            return `
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                    <div style="width: 100px; font-size: 12px; color: #64748b;">${label}</div>
                    <div style="flex: 1; margin: 0 12px;">
                        <div style="background: #e2e8f0; height: 20px; border-radius: 4px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #3b82f6, #1e40af); height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                    <div style="width: 40px; text-align: right; font-weight: 600; color: #1e293b;">${value}${unit}</div>
                </div>
            `;
        }).join('');

        return chartHtml || '<div style="text-align: center; color: #64748b;">데이터가 없습니다.</div>';
    }

    updateInsights(analytics) {
        // 재고 최적화 인사이트
        const stockOptimization = document.getElementById('stockOptimization');
        let stockInsights = [];

        if (analytics.lowStockItems > 0) {
            stockInsights.push(`• ${analytics.lowStockItems}개 상품이 최소 재고 수준에 도달했습니다.`);
        }
        if (analytics.outOfStockItems > 0) {
            stockInsights.push(`• ${analytics.outOfStockItems}개 상품이 품절 상태입니다.`);
        }
        if (stockInsights.length === 0) {
            stockInsights.push('• 현재 재고 상태가 양호합니다.');
        }
        stockOptimization.innerHTML = stockInsights.join('<br>');

        // 가격 경쟁력 분석
        const priceAnalysis = document.getElementById('priceAnalysis');
        let priceInsights = [];

        if (analytics.avgMargin > 30) {
            priceInsights.push(`• 평균 마진율 ${analytics.avgMargin.toFixed(1)}%로 양호한 수준입니다.`);
        } else if (analytics.avgMargin > 15) {
            priceInsights.push(`• 평균 마진율 ${analytics.avgMargin.toFixed(1)}%로 적정 수준입니다.`);
        } else {
            priceInsights.push(`• 평균 마진율 ${analytics.avgMargin.toFixed(1)}%로 개선이 필요합니다.`);
        }
        priceAnalysis.innerHTML = priceInsights.join('<br>');

        // 카테고리 성과
        const categoryPerformance = document.getElementById('categoryPerformance');
        const topCategory = Object.entries(analytics.categoryDistribution)
            .sort(([,a], [,b]) => b - a)[0];

        let categoryInsights = [];
        if (topCategory) {
            categoryInsights.push(`• ${topCategory[0]} 카테고리가 ${topCategory[1]}개로 가장 많습니다.`);
            const totalProducts = Object.values(analytics.categoryDistribution).reduce((a, b) => a + b, 0);
            const percentage = ((topCategory[1] / totalProducts) * 100).toFixed(1);
            categoryInsights.push(`• 전체의 ${percentage}%를 차지합니다.`);
        } else {
            categoryInsights.push('• 등록된 상품이 없습니다.');
        }
        categoryPerformance.innerHTML = categoryInsights.join('<br>');
    }

    // 고급 필터링 기능
    toggleAdvancedFilters() {
        const filtersPanel = document.getElementById('advancedFilters');
        filtersPanel.style.display = filtersPanel.style.display === 'none' ? 'block' : 'none';
    }

    applyAdvancedFilters() {
        this.loadProductList();
    }

    clearAdvancedFilters() {
        document.getElementById('priceRangeMin').value = '';
        document.getElementById('priceRangeMax').value = '';
        document.getElementById('stockFilter').value = '';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        this.loadProductList();
    }

    // 데이터 내보내기 기능
    exportData() {
        const csvData = this.convertToCSV(this.products);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `products_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        this.showSuccessMessage('상품 데이터가 CSV 파일로 다운로드되었습니다.');
    }

    convertToCSV(products) {
        if (products.length === 0) return '';

        // CSV 헤더
        const headers = [
            '상품ID', '상품명', '상품코드', '카테고리', '브랜드', '제조사',
            '정가', '판매가', '할인율', '재고수량', '최소재고', '재고상태',
            '상태', '등록일', '수정일'
        ];

        // CSV 데이터 변환
        const csvRows = [headers.join(',')];

        products.forEach(product => {
            const categoryName = this.categories.find(cat => cat.code === product.categorySelect)?.name || '';
            const row = [
                product.id || '',
                `"${(product.productName || '').replace(/"/g, '""')}"`,
                product.productCode || '',
                categoryName,
                `"${(product.brand || '').replace(/"/g, '""')}"`,
                `"${(product.manufacturer || '').replace(/"/g, '""')}"`,
                product.originalPrice || '',
                product.salePrice || '',
                product.discount || '',
                product.stockQuantity || '',
                product.minStock || '',
                product.stockStatus || '',
                this.getStatusText(product.status),
                product.createdAt ? new Date(product.createdAt).toLocaleString() : '',
                product.updatedAt ? new Date(product.updatedAt).toLocaleString() : ''
            ];
            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    }

    // 사용자 경험 개선 메서드들
    validateField(fieldName) {
        const field = document.getElementById(fieldName);
        const value = field.value.trim();
        let isValid = true;
        let message = '';

        switch (fieldName) {
            case 'productName':
                if (!value) {
                    isValid = false;
                    message = '상품명을 입력해주세요.';
                } else if (value.length < 2) {
                    isValid = false;
                    message = '상품명은 2글자 이상 입력해주세요.';
                }
                break;

            case 'originalPrice':
                if (!value) {
                    isValid = false;
                    message = '정가를 입력해주세요.';
                } else if (parseFloat(value) <= 0) {
                    isValid = false;
                    message = '정가는 0보다 큰 값을 입력해주세요.';
                }
                break;
        }

        // UI 업데이트
        if (isValid) {
            field.style.borderColor = '#10b981';
            this.removeFieldError(fieldName);
        } else {
            field.style.borderColor = '#ef4444';
            this.showFieldError(fieldName, message);
        }

        return isValid;
    }

    showFieldError(fieldName, message) {
        // 기존 에러 메시지 제거
        this.removeFieldError(fieldName);

        const field = document.getElementById(fieldName);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.id = `${fieldName}-error`;
        errorDiv.style.cssText = `
            color: #ef4444;
            font-size: 12px;
            margin-top: 4px;
            animation: fadeIn 0.2s ease;
        `;
        errorDiv.textContent = message;

        field.parentNode.appendChild(errorDiv);
    }

    removeFieldError(fieldName) {
        const errorDiv = document.getElementById(`${fieldName}-error`);
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    // 자동저장 기능
    autoSave() {
        if (this.currentView !== 'form') return;

        const productName = document.getElementById('productName').value.trim();
        if (!productName) return; // 상품명이 없으면 자동저장 안함

        // 폼 데이터가 변경되었는지 확인
        const currentData = this.getFormData();
        const lastSavedData = localStorage.getItem('autoSavedProduct');

        if (JSON.stringify(currentData) !== lastSavedData) {
            localStorage.setItem('autoSavedProduct', JSON.stringify(currentData));
            localStorage.setItem('autoSavedTime', new Date().toISOString());

            // 자동저장 알림 (작은 알림)
            this.showAutoSaveNotification();
        }
    }

    showAutoSaveNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 1001;
            animation: fadeInOut 2s ease;
        `;
        notification.textContent = '자동저장됨';

        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 2000);

        // 애니메이션 추가
        if (!document.querySelector('#autosave-animation')) {
            const style = document.createElement('style');
            style.id = 'autosave-animation';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(10px); }
                    20% { opacity: 1; transform: translateY(0); }
                    80% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-10px); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // 폼 데이터 복구
    restoreAutoSavedData() {
        const autoSavedData = localStorage.getItem('autoSavedProduct');
        const autoSavedTime = localStorage.getItem('autoSavedTime');

        if (autoSavedData && autoSavedTime) {
            const savedTime = new Date(autoSavedTime);
            const timeDiff = (new Date() - savedTime) / (1000 * 60); // 분 단위

            if (timeDiff < 60) { // 1시간 이내
                if (confirm(`${Math.round(timeDiff)}분 전에 자동저장된 데이터가 있습니다. 복구하시겠습니까?`)) {
                    const data = JSON.parse(autoSavedData);
                    this.populateFormWithData(data);
                    this.showSuccessMessage('자동저장된 데이터가 복구되었습니다.');
                }
            }
        }
    }

    populateFormWithData(data) {
        Object.keys(data).forEach(key => {
            const field = document.getElementById(key);
            if (field && data[key] !== undefined) {
                if (field.type === 'checkbox') {
                    field.checked = data[key];
                } else {
                    field.value = data[key];
                }
            }
        });

        // 카테고리 변경 트리거
        if (data.categorySelect) {
            this.handleCategoryChange(data.categorySelect);
        }
    }

    // 성능 최적화: 이미지 압축
    async compressImage(file, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // 비율 유지하면서 크기 조정
                const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;

                // 이미지 그리기
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // 압축된 이미지를 blob으로 변환
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };

            img.src = URL.createObjectURL(file);
        });
    }

    // 개선된 이미지 업로드 처리
    async handleImageFiles(files) {
        const previewContainer = document.getElementById('imagePreviewContainer');
        const loadingIndicator = this.createLoadingIndicator();
        previewContainer.appendChild(loadingIndicator);

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                try {
                    // 이미지 압축
                    const compressedFile = await this.compressImage(file);

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const imagePreview = this.createImagePreview(e.target.result, file.name);
                        previewContainer.appendChild(imagePreview);
                    };
                    reader.readAsDataURL(compressedFile);
                } catch (error) {
                    console.error('이미지 처리 오류:', error);
                    this.showErrorMessage('이미지 처리 중 오류가 발생했습니다.');
                }
            }
        }

        // 로딩 인디케이터 제거
        loadingIndicator.remove();
    }

    createLoadingIndicator() {
        const loading = document.createElement('div');
        loading.className = 'loading-indicator';
        loading.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 120px;
            height: 120px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: #f8fafc;
        `;
        loading.innerHTML = `
            <div style="
                width: 20px;
                height: 20px;
                border: 2px solid #e2e8f0;
                border-top: 2px solid #3b82f6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
        `;

        // 스핀 애니메이션 추가
        if (!document.querySelector('#spin-animation')) {
            const style = document.createElement('style');
            style.id = 'spin-animation';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        return loading;
    }

    // 상품 복제 기능
    duplicateProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        const duplicatedProduct = { ...product };
        duplicatedProduct.id = this.generateId();
        duplicatedProduct.productName = product.productName + ' (복사본)';
        duplicatedProduct.productCode = '';
        duplicatedProduct.status = 'draft';
        duplicatedProduct.createdAt = new Date().toISOString();
        delete duplicatedProduct.updatedAt;

        this.showProductForm(duplicatedProduct);
        this.showSuccessMessage('상품이 복제되었습니다. 필요한 정보를 수정 후 저장해주세요.');
    }

    // 벌크 액션을 위한 다중 선택 기능
    toggleSelectAll() {
        const checkboxes = document.querySelectorAll('.product-checkbox');
        const selectAllCheckbox = document.getElementById('selectAllProducts');

        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });

        this.updateBulkActionButtons();
    }

    updateBulkActionButtons() {
        const selectedCheckboxes = document.querySelectorAll('.product-checkbox:checked');
        const bulkActions = document.getElementById('bulkActions');

        if (selectedCheckboxes.length > 0) {
            bulkActions.style.display = 'flex';
            document.getElementById('selectedCount').textContent = selectedCheckboxes.length;
        } else {
            bulkActions.style.display = 'none';
        }
    }

    // 키보드 단축키 지원
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+S: 저장
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (this.currentView === 'form') {
                    document.getElementById('productForm').dispatchEvent(new Event('submit'));
                }
            }

            // Ctrl+N: 새 상품
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.showProductForm();
            }

            // Escape: 취소/닫기
            if (e.key === 'Escape') {
                if (this.currentView === 'form') {
                    this.resetForm();
                    this.showProductList();
                }
            }
        });
    }

    // 벌크 액션 메서드들
    bulkUpdateStatus(newStatus) {
        const selectedCheckboxes = document.querySelectorAll('.product-checkbox:checked');
        const productIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.productId);

        if (productIds.length === 0) {
            this.showErrorMessage('선택된 상품이 없습니다.');
            return;
        }

        if (confirm(`선택한 ${productIds.length}개 상품의 상태를 ${this.getStatusText(newStatus)}로 변경하시겠습니까?`)) {
            productIds.forEach(id => {
                const product = this.products.find(p => p.id === id);
                if (product) {
                    product.status = newStatus;
                    product.updatedAt = new Date().toISOString();
                }
            });

            this.saveProducts();
            this.loadProductList();
            this.showSuccessMessage(`${productIds.length}개 상품의 상태가 변경되었습니다.`);
        }
    }

    bulkDelete() {
        const selectedCheckboxes = document.querySelectorAll('.product-checkbox:checked');
        const productIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.productId);

        if (productIds.length === 0) {
            this.showErrorMessage('선택된 상품이 없습니다.');
            return;
        }

        if (confirm(`선택한 ${productIds.length}개 상품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            this.products = this.products.filter(product => !productIds.includes(product.id));
            this.saveProducts();
            this.loadProductList();
            this.showSuccessMessage(`${productIds.length}개 상품이 삭제되었습니다.`);
        }
    }

    // 일괄 등록 기능
    showBulkImportModal() {
        document.getElementById('bulkImportModal').classList.add('active');
        this.resetBulkImportModal();
    }

    hideBulkImportModal() {
        document.getElementById('bulkImportModal').classList.remove('active');
        this.resetBulkImportModal();
    }

    resetBulkImportModal() {
        document.getElementById('bulkFileInput').value = '';
        document.getElementById('bulkFileInfo').style.display = 'none';
        document.getElementById('bulkPreviewContainer').style.display = 'none';
        document.getElementById('processBulkImportBtn').disabled = true;
        this.bulkImportData = [];
    }

    setupBulkFileUpload() {
        const uploadZone = document.getElementById('bulkUploadZone');
        const fileInput = document.getElementById('bulkFileInput');

        uploadZone.addEventListener('click', () => fileInput.click());

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.handleBulkFile(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleBulkFile(e.target.files[0]);
            }
        });
    }

    handleBulkFile(file) {
        const allowedTypes = ['.csv', '.xlsx', '.xls'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(fileExtension)) {
            this.showErrorMessage('지원되지 않는 파일 형식입니다. CSV 또는 Excel 파일만 업로드 가능합니다.');
            return;
        }

        // 파일 정보 표시
        document.getElementById('bulkFileName').textContent = file.name;
        document.getElementById('bulkFileSize').textContent = this.formatFileSize(file.size);
        document.getElementById('bulkFileInfo').style.display = 'flex';

        // 파일 파싱
        this.parseFile(file);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    parseFile(file) {
        const reader = new FileReader();
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        reader.onload = (e) => {
            try {
                let data;
                if (fileExtension === '.csv') {
                    data = this.parseCSV(e.target.result);
                } else {
                    // Excel 파일 처리 (간단한 CSV 변환)
                    this.showErrorMessage('Excel 파일 지원은 현재 개발 중입니다. CSV 파일을 사용해주세요.');
                    return;
                }
                this.validateAndPreviewData(data);
            } catch (error) {
                console.error('파일 파싱 오류:', error);
                this.showErrorMessage('파일을 읽는 도중 오류가 발생했습니다.');
            }
        };

        reader.readAsText(file, 'UTF-8');
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('유효한 데이터가 없습니다.');
        }

        const headers = this.parseCSVLine(lines[0]);
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = this.parseCSVLine(lines[i]);
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                data.push(row);
            }
        }

        return data;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"' && !inQuotes) {
                inQuotes = true;
            } else if (char === '"' && inQuotes) {
                if (nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    validateAndPreviewData(data) {
        const validatedData = [];
        let validCount = 0;
        let errorCount = 0;

        data.forEach((row, index) => {
            const validation = this.validateBulkRow(row, index + 1);
            validatedData.push(validation);

            if (validation.isValid) {
                validCount++;
            } else {
                errorCount++;
            }
        });

        this.bulkImportData = validatedData;
        this.displayPreview(validatedData, validCount, errorCount);

        // 유효한 데이터가 있으면 등록 버튼 활성화
        document.getElementById('processBulkImportBtn').disabled = validCount === 0;
    }

    validateBulkRow(row, rowNumber) {
        const errors = [];
        const processedRow = { ...row };

        // 필수 필드 검증
        if (!row['상품명'] || !row['상품명'].trim()) {
            errors.push('상품명이 비어있습니다');
        }

        if (!row['정가'] || isNaN(parseFloat(row['정가']))) {
            errors.push('정가가 유효하지 않습니다');
        }

        // 카테고리 검증
        if (row['카테고리']) {
            const categoryCode = this.getCategoryCodeByName(row['카테고리']);
            if (!categoryCode) {
                errors.push('유효하지 않은 카테고리입니다');
            } else {
                processedRow.categorySelect = categoryCode;
            }
        }

        // 재고 수량 검증
        if (row['재고수량'] && isNaN(parseInt(row['재고수량']))) {
            errors.push('재고수량이 유효하지 않습니다');
        }

        // 판매가 검증
        if (row['판매가'] && isNaN(parseFloat(row['판매가']))) {
            errors.push('판매가가 유효하지 않습니다');
        }

        return {
            row: processedRow,
            rowNumber,
            isValid: errors.length === 0,
            errors
        };
    }

    getCategoryCodeByName(categoryName) {
        const category = this.categories.find(cat => cat.name === categoryName.trim());
        return category ? category.code : null;
    }

    displayPreview(data, validCount, errorCount) {
        document.getElementById('previewCount').textContent = data.length;
        document.getElementById('validCount').textContent = validCount;
        document.getElementById('errorCount').textContent = errorCount;

        const tbody = document.getElementById('bulkPreviewTableBody');
        tbody.innerHTML = '';

        data.slice(0, 50).forEach(item => { // 최대 50개만 미리보기
            const row = document.createElement('tr');
            row.className = item.isValid ? 'preview-row-valid' : 'preview-row-error';

            row.innerHTML = `
                <td>
                    <span class="preview-status ${item.isValid ? 'valid' : 'error'}">
                        ${item.isValid ? '유효' : '오류'}
                    </span>
                </td>
                <td>${item.row['상품명'] || '-'}</td>
                <td>${item.row['카테고리'] || '-'}</td>
                <td>${item.row['브랜드'] || '-'}</td>
                <td>${item.row['정가'] || '-'}</td>
                <td>
                    <div class="error-message">
                        ${item.errors.join(', ') || '-'}
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });

        if (data.length > 50) {
            const moreRow = document.createElement('tr');
            moreRow.innerHTML = `
                <td colspan="6" style="text-align: center; color: #64748b; padding: 16px;">
                    ... 외 ${data.length - 50}개 행 더 있음
                </td>
            `;
            tbody.appendChild(moreRow);
        }

        document.getElementById('bulkPreviewContainer').style.display = 'block';
    }

    removeBulkFile() {
        document.getElementById('bulkFileInput').value = '';
        document.getElementById('bulkFileInfo').style.display = 'none';
        document.getElementById('bulkPreviewContainer').style.display = 'none';
        document.getElementById('processBulkImportBtn').disabled = true;
        this.bulkImportData = [];
    }

    downloadTemplate() {
        const headers = [
            '상품명', '카테고리', '브랜드', '제조사', '정가', '판매가',
            '재고수량', '상품코드', '상품설명'
        ];

        const sampleData = [
            [
                '샘플 상품', '전자제품', '샘플 브랜드', '샘플 제조사',
                '100000', '80000', '50', 'SAMPLE-001', '이것은 샘플 상품입니다.'
            ]
        ];

        const csvContent = [headers, ...sampleData]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'product_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showSuccessMessage('상품 등록 템플릿이 다운로드되었습니다.');
    }

    processBulkImport() {
        const validData = this.bulkImportData.filter(item => item.isValid);

        if (validData.length === 0) {
            this.showErrorMessage('등록할 수 있는 유효한 데이터가 없습니다.');
            return;
        }

        const confirmMessage = `${validData.length}개의 상품을 일괄 등록하시게습니까?`;
        if (!confirm(confirmMessage)) {
            return;
        }

        let successCount = 0;
        validData.forEach(item => {
            const productData = this.convertRowToProductData(item.row);
            productData.id = this.generateId();
            productData.status = 'active';
            productData.createdAt = new Date().toISOString();

            this.addProduct(productData);
            successCount++;
        });

        this.saveProducts();
        this.hideBulkImportModal();
        this.showProductList();
        this.showSuccessMessage(`${successCount}개 상품이 성공적으로 등록되었습니다.`);
    }

    convertRowToProductData(row) {
        return {
            productName: row['상품명'] || '',
            categorySelect: row.categorySelect || '',
            brand: row['브랜드'] || '',
            manufacturer: row['제조사'] || '',
            originalPrice: row['정가'] || '',
            salePrice: row['판매가'] || '',
            stockQuantity: row['재고수량'] || '',
            productCode: row['상품코드'] || '',
            description: row['상품설명'] || '',
            images: []
        };
    }

    // 상품 상세페이지 기능
    showProductDetail(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            this.showErrorMessage('상품을 찾을 수 없습니다.');
            return;
        }

        this.currentDetailProduct = product;
        this.currentImageIndex = 0;

        // 조회수 증가
        product.viewCount = (product.viewCount || 0) + 1;
        product.lastViewed = new Date().toISOString();
        this.saveProducts();

        // 뷰 전환
        document.getElementById('productFormSection').style.display = 'none';
        document.getElementById('productListSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'none';
        document.getElementById('productDetailSection').style.display = 'block';

        this.currentView = 'detail';
        this.populateProductDetail(product);
        this.updateRelatedProducts(product);
    }

    populateProductDetail(product) {
        // 기본 정보
        const categoryName = this.categories.find(cat => cat.code === product.categorySelect)?.name || '미분류';
        document.getElementById('detailCategory').textContent = categoryName;
        document.getElementById('detailTitle').textContent = product.productName || '-';
        document.getElementById('detailBrand').textContent = product.brand ? `브랜드: ${product.brand}` : '';
        document.getElementById('detailCode').textContent = product.productCode ? `상품코드: ${product.productCode}` : '';

        // 가격 정보
        const originalPrice = parseFloat(product.originalPrice || 0);
        const salePrice = parseFloat(product.salePrice || 0);
        const discount = parseFloat(product.discount || 0);

        document.getElementById('detailOriginalPrice').textContent = originalPrice ? `${originalPrice.toLocaleString()}원` : '';

        if (salePrice && salePrice !== originalPrice) {
            document.getElementById('detailSalePrice').textContent = `${salePrice.toLocaleString()}원`;
            document.getElementById('detailSalePrice').style.display = 'inline';

            if (discount) {
                document.getElementById('detailDiscountRate').textContent = `${discount}% 할인`;
                document.getElementById('detailDiscountRate').style.display = 'inline';
            }

            const savings = originalPrice - salePrice;
            document.getElementById('detailSavings').textContent = `${savings.toLocaleString()}원 절약`;
            document.getElementById('detailSavings').style.display = 'block';
        } else {
            document.getElementById('detailSalePrice').style.display = 'none';
            document.getElementById('detailDiscountRate').style.display = 'none';
            document.getElementById('detailSavings').style.display = 'none';
        }

        // 재고 정보
        const stockStatus = this.getStockStatusText(product.stockStatus);
        const stockQuantity = product.stockQuantity;

        document.getElementById('detailStockStatus').textContent = stockStatus;
        document.getElementById('detailStockStatus').className = `stock-status status-${product.stockStatus || 'unknown'}`;

        if (stockQuantity) {
            document.getElementById('detailStockQuantity').textContent = `재고 ${stockQuantity}개`;
        } else {
            document.getElementById('detailStockQuantity').textContent = '';
        }

        // 이미지 갤러리
        this.updateImageGallery(product.images || []);

        // 카테고리별 사양
        this.updateProductSpecs(product);

        // 상품 설명
        document.getElementById('detailDescription').innerHTML = product.description ?
            product.description.replace(/\n/g, '<br>') : '상품 설명이 없습니다.';

        // 관리 정보
        document.getElementById('detailCreatedAt').textContent = product.createdAt ?
            new Date(product.createdAt).toLocaleString() : '-';

        if (product.updatedAt) {
            document.getElementById('detailUpdatedAt').textContent = new Date(product.updatedAt).toLocaleString();
            document.getElementById('detailUpdatedAtRow').style.display = 'flex';
        } else {
            document.getElementById('detailUpdatedAtRow').style.display = 'none';
        }

        document.getElementById('detailViewCount').textContent = `${product.viewCount || 0}회`;
    }

    getStockStatusText(status) {
        const statusMap = {
            'in-stock': '재고 있음',
            'low-stock': '재고 부족',
            'out-of-stock': '품절'
        };
        return statusMap[status] || '상태 알 수 없음';
    }

    updateImageGallery(images) {
        const mainImage = document.getElementById('detailMainImage');
        const thumbnailContainer = document.getElementById('thumbnailContainer');

        if (images.length === 0) {
            mainImage.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23f3f4f6"%3E%3C/rect%3E%3Ctext x="50%25" y="50%25" font-family="Arial, sans-serif" font-size="16" fill="%23a3a3a3" text-anchor="middle" dy=".3em"%3E이미지 없음%3C/text%3E%3C/svg%3E';
            mainImage.alt = '이미지 없음';
            thumbnailContainer.innerHTML = '';
            return;
        }

        // 메인 이미지 설정
        mainImage.src = images[0];
        mainImage.alt = this.currentDetailProduct.productName;

        // 섬네일 생성
        thumbnailContainer.innerHTML = '';
        images.forEach((imageSrc, index) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = `thumbnail ${index === 0 ? 'active' : ''}`;
            thumbnail.innerHTML = `<img src="${imageSrc}" alt="상품 이미지 ${index + 1}">`;
            thumbnail.addEventListener('click', () => this.selectImage(index));
            thumbnailContainer.appendChild(thumbnail);
        });

        // 네비게이션 버튼 표시/숨김
        const prevBtn = document.getElementById('prevImageBtn');
        const nextBtn = document.getElementById('nextImageBtn');

        if (images.length > 1) {
            prevBtn.style.display = 'block';
            nextBtn.style.display = 'block';
        } else {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }
    }

    selectImage(index) {
        const images = this.currentDetailProduct.images || [];
        if (index < 0 || index >= images.length) return;

        this.currentImageIndex = index;

        // 메인 이미지 업데이트
        document.getElementById('detailMainImage').src = images[index];

        // 섬네일 활성 상태 업데이트
        const thumbnails = document.querySelectorAll('.thumbnail');
        thumbnails.forEach((thumb, i) => {
            thumb.classList.toggle('active', i === index);
        });
    }

    previousImage() {
        const images = this.currentDetailProduct.images || [];
        if (images.length <= 1) return;

        const newIndex = this.currentImageIndex > 0 ? this.currentImageIndex - 1 : images.length - 1;
        this.selectImage(newIndex);
    }

    nextImage() {
        const images = this.currentDetailProduct.images || [];
        if (images.length <= 1) return;

        const newIndex = this.currentImageIndex < images.length - 1 ? this.currentImageIndex + 1 : 0;
        this.selectImage(newIndex);
    }

    updateProductSpecs(product) {
        const specsGrid = document.getElementById('specsGrid');
        specsGrid.innerHTML = '';

        // 기본 사양
        const basicSpecs = [
            { label: '브랜드', value: product.brand },
            { label: '제조사', value: product.manufacturer },
            { label: '상품코드', value: product.productCode },
            { label: '과세구분', value: this.getTaxTypeText(product.taxType) }
        ];

        basicSpecs.forEach(spec => {
            if (spec.value) {
                this.addSpecRow(specsGrid, spec.label, spec.value);
            }
        });

        // 카테고리별 사양
        if (product.categorySelect) {
            const categoryFields = this.getCategoryFields(product.categorySelect);
            categoryFields.forEach(field => {
                const value = product[field.name];
                if (value !== undefined && value !== '' && value !== false) {
                    let displayValue = value;
                    if (field.type === 'checkbox') {
                        displayValue = value ? '예' : '아니오';
                    } else if (field.type === 'date' && value) {
                        displayValue = new Date(value).toLocaleDateString();
                    }
                    this.addSpecRow(specsGrid, field.label, displayValue);
                }
            });
        }

        if (specsGrid.children.length === 0) {
            specsGrid.innerHTML = '<p class="no-specs">등록된 사양 정보가 없습니다.</p>';
        }
    }

    addSpecRow(container, label, value) {
        const row = document.createElement('div');
        row.className = 'spec-row';
        row.innerHTML = `
            <span class="spec-label">${label}</span>
            <span class="spec-value">${value}</span>
        `;
        container.appendChild(row);
    }

    getTaxTypeText(taxType) {
        const taxMap = {
            'taxable': '과세',
            'tax-free': '면세',
            'zero-rate': '영세율'
        };
        return taxMap[taxType] || taxType;
    }

    updateRelatedProducts(currentProduct) {
        const relatedGrid = document.getElementById('relatedProductsGrid');

        // 같은 카테고리의 다른 상품들 찾기
        const relatedProducts = this.products
            .filter(p => p.id !== currentProduct.id && p.categorySelect === currentProduct.categorySelect)
            .slice(0, 4); // 최대 4개

        if (relatedProducts.length === 0) {
            relatedGrid.innerHTML = '<p class="no-related">관련 상품이 없습니다.</p>';
            return;
        }

        relatedGrid.innerHTML = '';
        relatedProducts.forEach(product => {
            const productCard = this.createRelatedProductCard(product);
            relatedGrid.appendChild(productCard);
        });
    }

    createRelatedProductCard(product) {
        const card = document.createElement('div');
        card.className = 'related-product-card';

        const mainImage = product.images && product.images.length > 0 ? product.images[0] : '';
        const categoryName = this.categories.find(cat => cat.code === product.categorySelect)?.name || '';
        const price = product.salePrice || product.originalPrice;

        card.innerHTML = `
            <div class="related-image">
                ${mainImage ?
                    `<img src="${mainImage}" alt="${product.productName}">` :
                    '<div class="no-image">📷</div>'
                }
            </div>
            <div class="related-info">
                <div class="related-category">${categoryName}</div>
                <div class="related-name">${product.productName}</div>
                <div class="related-price">${price ? Number(price).toLocaleString() + '원' : '가격 미정'}</div>
            </div>
        `;

        card.addEventListener('click', () => this.showProductDetail(product.id));
        return card;
    }

    // 상세페이지에서 상품 액션
    editCurrentDetailProduct() {
        if (this.currentDetailProduct) {
            this.showProductForm(this.currentDetailProduct);
        }
    }

    duplicateCurrentDetailProduct() {
        if (this.currentDetailProduct) {
            this.duplicateProduct(this.currentDetailProduct.id);
        }
    }

    deleteCurrentDetailProduct() {
        if (this.currentDetailProduct) {
            if (confirm('이 상품을 삭제하시겠습니까?')) {
                this.products = this.products.filter(p => p.id !== this.currentDetailProduct.id);
                this.saveProducts();
                this.showProductList();
                this.showSuccessMessage('상품이 삭제되었습니다.');
            }
        }
    }

    // 이미지 확대보기 기능
    setupImageZoom() {
        document.getElementById('imageZoomModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('image-modal')) {
                this.closeImageZoom();
            }
        });
    }

    openImageZoom() {
        if (!this.currentDetailProduct || !this.currentDetailProduct.images || this.currentDetailProduct.images.length === 0) {
            return;
        }

        const modal = document.getElementById('imageZoomModal');
        const zoomedImage = document.getElementById('zoomedImage');

        zoomedImage.src = this.currentDetailProduct.images[this.currentImageIndex];
        zoomedImage.alt = this.currentDetailProduct.productName;

        modal.classList.add('active');
        this.resetZoom();
    }

    closeImageZoom() {
        document.getElementById('imageZoomModal').classList.remove('active');
        this.resetZoom();
    }

    zoomPreviousImage() {
        this.previousImage();
        if (this.currentDetailProduct && this.currentDetailProduct.images) {
            document.getElementById('zoomedImage').src = this.currentDetailProduct.images[this.currentImageIndex];
        }
        this.resetZoom();
    }

    zoomNextImage() {
        this.nextImage();
        if (this.currentDetailProduct && this.currentDetailProduct.images) {
            document.getElementById('zoomedImage').src = this.currentDetailProduct.images[this.currentImageIndex];
        }
        this.resetZoom();
    }

    zoomIn() {
        this.zoomLevel = Math.min(this.zoomLevel * 1.2, 3);
        this.applyZoom();
    }

    zoomOut() {
        this.zoomLevel = Math.max(this.zoomLevel / 1.2, 0.5);
        this.applyZoom();
    }

    resetZoom() {
        this.zoomLevel = 1;
        this.applyZoom();
    }

    applyZoom() {
        const zoomedImage = document.getElementById('zoomedImage');
        zoomedImage.style.transform = `scale(${this.zoomLevel})`;
    }

    // 리치 에디터 기능
    setupRichEditor() {
        // 에디터 툴바 이벤트 설정
        const editorToolbars = document.querySelectorAll('.editor-toolbar');
        editorToolbars.forEach(toolbar => {
            toolbar.addEventListener('click', this.handleEditorCommand.bind(this));
            toolbar.addEventListener('change', this.handleEditorCommand.bind(this));
        });

        // 추가 이미지 업로드 설정
        this.setupAdditionalImageUpload();

        // 탭 네비게이션 설정
        this.setupTabNavigation();
    }

    handleEditorCommand(e) {
        const command = e.target.dataset.command;
        if (!command) return;

        e.preventDefault();

        switch (command) {
            case 'bold':
            case 'italic':
            case 'underline':
                document.execCommand(command, false, null);
                break;
            case 'formatBlock':
                if (e.target.value) {
                    document.execCommand(command, false, e.target.value);
                    e.target.value = '';
                }
                break;
            case 'insertUnorderedList':
            case 'insertOrderedList':
                document.execCommand(command, false, null);
                break;
            case 'createLink':
                const url = prompt('링크 URL을 입력하세요:');
                if (url) {
                    document.execCommand(command, false, url);
                }
                break;
            case 'insertImage':
                const imageUrl = prompt('이미지 URL을 입력하세요:');
                if (imageUrl) {
                    document.execCommand(command, false, imageUrl);
                }
                break;
        }

        // 버튼 활성화 상태 업데이트
        this.updateEditorButtons();
    }

    updateEditorButtons() {
        const editorBtns = document.querySelectorAll('.editor-btn');
        editorBtns.forEach(btn => {
            const command = btn.dataset.command;
            if (command && document.queryCommandState(command)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // 추가 이미지 업로드 기능
    setupAdditionalImageUpload() {
        const uploadZone = document.getElementById('additionalImageUploadZone');
        const fileInput = document.getElementById('additionalImageUpload');

        if (!uploadZone || !fileInput) return;

        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadZone.addEventListener('drop', this.handleAdditionalImageDrop.bind(this));
        fileInput.addEventListener('change', this.handleAdditionalImageSelect.bind(this));
    }

    handleAdditionalImageSelect(e) {
        const files = Array.from(e.target.files);
        this.processAdditionalImages(files);
    }

    handleAdditionalImageDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadZone = e.currentTarget;
        uploadZone.classList.remove('dragover');

        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        this.processAdditionalImages(files);
    }

    processAdditionalImages(files) {
        const preview = document.getElementById('additionalImagePreview');

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.addAdditionalImageItem(e.target.result, file.name);
            };
            reader.readAsDataURL(file);
        });
    }

    addAdditionalImageItem(imageUrl, fileName) {
        const preview = document.getElementById('additionalImagePreview');
        const imageId = Date.now() + Math.random();

        const imageItem = document.createElement('div');
        imageItem.className = 'additional-image-item';
        imageItem.dataset.id = imageId;

        imageItem.innerHTML = `
            <img src="${imageUrl}" alt="${fileName}">
            <div class="additional-image-actions">
                <button type="button" onclick="productManager.removeAdditionalImage('${imageId}')">×</button>
            </div>
            <div class="additional-image-caption">
                <input type="text" placeholder="이미지 설명 입력..." data-id="${imageId}">
            </div>
        `;

        preview.appendChild(imageItem);
    }

    removeAdditionalImage(imageId) {
        const imageItem = document.querySelector(`[data-id="${imageId}"]`);
        if (imageItem) {
            imageItem.remove();
        }
    }

    getAdditionalImagesData() {
        const imageItems = document.querySelectorAll('.additional-image-item');
        const additionalImages = [];

        imageItems.forEach(item => {
            const img = item.querySelector('img');
            const captionInput = item.querySelector('input');

            if (img && img.src) {
                additionalImages.push({
                    url: img.src,
                    caption: captionInput ? captionInput.value : '',
                    id: item.dataset.id
                });
            }
        });

        return additionalImages;
    }

    // 탭 네비게이션 기능
    setupTabNavigation() {
        // 상품 상세페이지 탭 이벤트 설정
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // 상품 액션 버튼 이벤트
        this.setupProductActionButtons();
    }

    switchTab(tabName) {
        // 모든 탭 버튼 비활성화
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => btn.classList.remove('active'));

        // 모든 탭 패널 숨기기
        const tabPanels = document.querySelectorAll('.tab-panel');
        tabPanels.forEach(panel => panel.classList.remove('active'));

        // 선택된 탭 활성화
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const activePanel = document.getElementById(`${tabName}Tab`);

        if (activeBtn) activeBtn.classList.add('active');
        if (activePanel) activePanel.classList.add('active');

        // 탭별 콘텐츠 로드
        this.loadTabContent(tabName);
    }

    loadTabContent(tabName) {
        if (!this.currentDetailProduct) return;

        switch (tabName) {
            case 'description':
                this.loadDetailedDescription();
                break;
            case 'specifications':
                this.loadDetailedSpecifications();
                break;
            case 'guide':
                this.loadUsageGuide();
                break;
            case 'notice':
                this.loadImportantNotices();
                break;
            case 'delivery':
                this.loadDeliveryInfo();
                break;
            case 'reviews':
                this.loadCustomerReviews();
                break;
        }
    }

    loadDetailedDescription() {
        const richContent = document.getElementById('detailRichContent');
        const additionalImages = document.getElementById('additionalImages');
        const contentToc = document.getElementById('contentToc');

        // 상세 설명 로드
        const detailedDescription = this.currentDetailProduct.detailedDescription || '<p>상세 설명이 등록되지 않았습니다.</p>';
        richContent.innerHTML = detailedDescription;

        // 추가 이미지 로드
        this.loadAdditionalImagesDisplay();

        // 목차 생성
        this.generateTableOfContents();
    }

    loadAdditionalImagesDisplay() {
        const additionalImages = document.getElementById('additionalImages');
        const product = this.currentDetailProduct;

        if (!product.additionalImages || product.additionalImages.length === 0) {
            additionalImages.innerHTML = '';
            return;
        }

        const imageGrid = document.createElement('div');
        imageGrid.className = 'image-grid';

        product.additionalImages.forEach(image => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            imageItem.innerHTML = `
                <img src="${image.url}" alt="${image.caption || '상품 이미지'}" onclick="productManager.openImageInModal('${image.url}')">
                ${image.caption ? `<div class="image-caption">${image.caption}</div>` : ''}
            `;
            imageGrid.appendChild(imageItem);
        });

        additionalImages.innerHTML = '<h3>추가 이미지</h3>';
        additionalImages.appendChild(imageGrid);
    }

    generateTableOfContents() {
        const richContent = document.getElementById('detailRichContent');
        const tocList = document.getElementById('tocList');
        const contentToc = document.getElementById('contentToc');

        const headings = richContent.querySelectorAll('h2, h3, h4');

        if (headings.length === 0) {
            contentToc.style.display = 'none';
            return;
        }

        contentToc.style.display = 'block';
        tocList.innerHTML = '';

        headings.forEach((heading, index) => {
            const id = `heading-${index}`;
            heading.id = id;

            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = `#${id}`;
            a.textContent = heading.textContent;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                heading.scrollIntoView({ behavior: 'smooth' });
            });

            li.appendChild(a);
            tocList.appendChild(li);
        });
    }

    loadDetailedSpecifications() {
        const specificationsDetailed = document.getElementById('specificationsDetailed');
        const product = this.currentDetailProduct;

        // 기본 사양
        const basicSection = this.createSpecSection('기본 정보', [
            { label: '브랜드', value: product.brand },
            { label: '제조사', value: product.manufacturer },
            { label: '상품코드', value: product.productCode },
            { label: '과세구분', value: this.getTaxTypeText(product.taxType) }
        ]);

        // 카테고리별 사양
        let categorySection = '';
        if (product.categorySelect) {
            const categoryFields = this.getCategoryFields(product.categorySelect);
            const categorySpecs = categoryFields
                .map(field => {
                    const value = product[field.name];
                    if (value !== undefined && value !== '' && value !== false) {
                        let displayValue = value;
                        if (field.type === 'checkbox') {
                            displayValue = value ? '예' : '아니오';
                        } else if (field.type === 'date' && value) {
                            displayValue = new Date(value).toLocaleDateString();
                        }
                        return { label: field.label, value: displayValue };
                    }
                    return null;
                })
                .filter(spec => spec !== null);

            if (categorySpecs.length > 0) {
                const categoryName = this.categories.find(cat => cat.code === product.categorySelect)?.name || '카테고리별 사양';
                categorySection = this.createSpecSection(categoryName, categorySpecs);
            }
        }

        specificationsDetailed.innerHTML = basicSection + categorySection;
    }

    createSpecSection(title, specs) {
        if (!specs || specs.length === 0) return '';

        const validSpecs = specs.filter(spec => spec.value);
        if (validSpecs.length === 0) return '';

        const specItems = validSpecs
            .map(spec => `
                <div class="spec-item">
                    <span class="spec-label">${spec.label}</span>
                    <span class="spec-value">${spec.value}</span>
                </div>
            `)
            .join('');

        return `
            <div class="spec-section">
                <h4>${title}</h4>
                <div class="spec-grid">
                    ${specItems}
                </div>
            </div>
        `;
    }

    loadUsageGuide() {
        const usageGuide = document.getElementById('usageGuide');
        const guideContent = this.currentDetailProduct.usageGuide || '<p>사용법 가이드가 등록되지 않았습니다.</p>';
        usageGuide.innerHTML = guideContent;
    }

    loadImportantNotices() {
        const importantNotices = document.getElementById('importantNotices');
        const noticeContent = this.currentDetailProduct.importantNotices || '<p>주의사항이 등록되지 않았습니다.</p>';
        importantNotices.innerHTML = noticeContent;
    }

    loadDeliveryInfo() {
        const deliveryInfoDetailed = document.getElementById('deliveryInfoDetailed');
        const deliveryContent = this.currentDetailProduct.deliveryInfo || `
            <div class="delivery-policy">
                <h4>배송 정보</h4>
                <ul>
                    <li>무료배송 (주문금액 30,000원 이상)</li>
                    <li>배송기간: 주문 후 1-3일 (영업일 기준)</li>
                    <li>배송지역: 전국 (일부 도서산간 지역 제외)</li>
                </ul>

                <h4>교환/반품 정책</h4>
                <ul>
                    <li>교환/반품 가능기간: 상품 수령 후 7일 이내</li>
                    <li>교환/반품 비용: 고객 부담 (단, 상품 하자 시 무료)</li>
                    <li>교환/반품 불가 상품: 개봉된 식품, 화장품 등</li>
                </ul>
            </div>
        `;
        deliveryInfoDetailed.innerHTML = deliveryContent;
    }

    loadCustomerReviews() {
        const customerReviews = document.getElementById('customerReviews');

        // 임시 리뷰 데이터 (실제로는 서버에서 가져와야 함)
        const reviews = this.currentDetailProduct.reviews || [];
        const averageRating = reviews.length > 0 ?
            reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;

        this.renderReviewsSummary(averageRating, reviews.length);
        this.renderReviewsList(reviews);
    }

    renderReviewsSummary(averageRating, reviewCount) {
        const ratingStars = document.getElementById('ratingStars');
        const reviewCountElement = document.getElementById('reviewCount');
        const averageRatingElement = document.getElementById('averageRating');
        const ratingDistribution = document.getElementById('ratingDistribution');

        // 평균 평점 표시
        averageRatingElement.textContent = averageRating.toFixed(1);
        reviewCountElement.textContent = reviewCount;

        // 별점 표시
        const stars = '★'.repeat(Math.floor(averageRating)) + '☆'.repeat(5 - Math.floor(averageRating));
        ratingStars.textContent = stars;

        // 평점 분포 (임시 데이터)
        const distribution = [
            { rating: 5, count: Math.floor(reviewCount * 0.6) },
            { rating: 4, count: Math.floor(reviewCount * 0.2) },
            { rating: 3, count: Math.floor(reviewCount * 0.1) },
            { rating: 2, count: Math.floor(reviewCount * 0.05) },
            { rating: 1, count: Math.floor(reviewCount * 0.05) }
        ];

        ratingDistribution.innerHTML = distribution
            .map(item => `
                <div class="rating-bar">
                    <span class="rating-number">${item.rating}</span>
                    <div class="rating-progress">
                        <div class="rating-progress-fill" style="width: ${reviewCount > 0 ? (item.count / reviewCount) * 100 : 0}%"></div>
                    </div>
                    <span class="rating-count">${item.count}</span>
                </div>
            `)
            .join('');
    }

    renderReviewsList(reviews) {
        const reviewsList = document.getElementById('reviewsList');

        if (reviews.length === 0) {
            reviewsList.innerHTML = '<p class="no-reviews">아직 리뷰가 없습니다.</p>';
            return;
        }

        reviewsList.innerHTML = reviews
            .map(review => `
                <div class="review-item">
                    <div class="review-header">
                        <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                        <div class="review-author">${review.author}</div>
                        <div class="review-date">${new Date(review.date).toLocaleDateString()}</div>
                    </div>
                    <div class="review-content">${review.content}</div>
                </div>
            `)
            .join('');
    }

    // 상품 액션 버튼 기능
    setupProductActionButtons() {
        // 찜하기 버튼
        const wishlistBtn = document.getElementById('addToWishlistBtn');
        if (wishlistBtn) {
            wishlistBtn.addEventListener('click', this.addToWishlist.bind(this));
        }

        // 공유하기 버튼
        const shareBtn = document.getElementById('shareProductBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', this.showShareModal.bind(this));
        }

        // 장바구니 버튼
        const cartBtn = document.getElementById('addToCartBtn');
        if (cartBtn) {
            cartBtn.addEventListener('click', this.addToCart.bind(this));
        }

        // 공유 모달 닫기
        const shareCloseBtn = document.getElementById('shareCloseBtn');
        if (shareCloseBtn) {
            shareCloseBtn.addEventListener('click', this.hideShareModal.bind(this));
        }

        // 공유 플랫폼 버튼들
        const shareBtns = document.querySelectorAll('.share-btn');
        shareBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const platform = e.target.dataset.platform;
                this.shareProduct(platform);
            });
        });
    }

    addToWishlist() {
        // 찜하기 기능 (localStorage에 저장)
        const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
        const productId = this.currentDetailProduct.id;

        if (!wishlist.includes(productId)) {
            wishlist.push(productId);
            localStorage.setItem('wishlist', JSON.stringify(wishlist));
            this.showSuccessMessage('상품이 찜 목록에 추가되었습니다.');
        } else {
            this.showInfoMessage('이미 찜 목록에 있는 상품입니다.');
        }
    }

    showShareModal() {
        const shareModal = document.getElementById('shareModal');
        shareModal.style.display = 'flex';
    }

    hideShareModal() {
        const shareModal = document.getElementById('shareModal');
        shareModal.style.display = 'none';
    }

    shareProduct(platform) {
        const product = this.currentDetailProduct;
        const productUrl = window.location.href;
        const productTitle = product.productName;
        const productDescription = product.description || '';

        let shareUrl = '';

        switch (platform) {
            case 'kakao':
                // 카카오톡 공유 (실제 구현시 Kakao SDK 필요)
                alert('카카오톡 공유 기능은 Kakao SDK 연동이 필요합니다.');
                break;
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(productTitle)}&url=${encodeURIComponent(productUrl)}`;
                break;
            case 'copy':
                navigator.clipboard.writeText(productUrl).then(() => {
                    this.showSuccessMessage('링크가 클립보드에 복사되었습니다.');
                });
                this.hideShareModal();
                return;
        }

        if (shareUrl) {
            window.open(shareUrl, '_blank', 'width=600,height=400');
            this.hideShareModal();
        }
    }

    addToCart() {
        // 장바구니 기능 (localStorage에 저장)
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const productId = this.currentDetailProduct.id;

        const existingItem = cart.find(item => item.productId === productId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                productId: productId,
                quantity: 1,
                addedAt: new Date().toISOString()
            });
        }

        localStorage.setItem('cart', JSON.stringify(cart));
        this.showSuccessMessage('상품이 장바구니에 추가되었습니다.');
    }

    // 이미지 모달에서 열기
    openImageInModal(imageUrl) {
        const modal = document.getElementById('imageZoomModal');
        const zoomedImage = document.getElementById('zoomedImage');

        zoomedImage.src = imageUrl;
        modal.classList.add('active');
        this.resetZoom();
    }

    // 상품 등록/수정 시 리치 콘텐츠 데이터 수집
    collectRichContentData(product) {
        // 상세 설명
        const detailedDescription = document.getElementById('detailedDescription');
        if (detailedDescription) {
            product.detailedDescription = detailedDescription.innerHTML;
        }

        // 사용법 가이드
        const usageGuide = document.getElementById('usageGuide');
        if (usageGuide) {
            product.usageGuide = usageGuide.innerHTML;
        }

        // 주의사항
        const importantNotices = document.getElementById('importantNotices');
        if (importantNotices) {
            product.importantNotices = importantNotices.innerHTML;
        }

        // 배송/교환 정보
        const deliveryInfo = document.getElementById('deliveryInfo');
        if (deliveryInfo) {
            product.deliveryInfo = deliveryInfo.innerHTML;
        }

        // 추가 이미지
        product.additionalImages = this.getAdditionalImagesData();

        return product;
    }

    // 상품 수정 시 리치 콘텐츠 로드
    loadRichContentForEdit(product) {
        // 상세 설명
        const detailedDescription = document.getElementById('detailedDescription');
        if (detailedDescription && product.detailedDescription) {
            detailedDescription.innerHTML = product.detailedDescription;
        }

        // 사용법 가이드
        const usageGuide = document.getElementById('usageGuide');
        if (usageGuide && product.usageGuide) {
            usageGuide.innerHTML = product.usageGuide;
        }

        // 주의사항
        const importantNotices = document.getElementById('importantNotices');
        if (importantNotices && product.importantNotices) {
            importantNotices.innerHTML = product.importantNotices;
        }

        // 배송/교환 정보
        const deliveryInfo = document.getElementById('deliveryInfo');
        if (deliveryInfo && product.deliveryInfo) {
            deliveryInfo.innerHTML = product.deliveryInfo;
        }

        // 추가 이미지 로드
        this.loadAdditionalImagesForEdit(product.additionalImages || []);
    }

    loadAdditionalImagesForEdit(additionalImages) {
        const preview = document.getElementById('additionalImagePreview');
        preview.innerHTML = '';

        additionalImages.forEach(image => {
            this.addAdditionalImageItem(image.url, image.caption || '');

            // 캡션 설정
            const lastItem = preview.lastElementChild;
            if (lastItem) {
                const captionInput = lastItem.querySelector('input');
                if (captionInput && image.caption) {
                    captionInput.value = image.caption;
                }
            }
        });
    }
}

// 앱 초기화
let productManager;

document.addEventListener('DOMContentLoaded', () => {
    productManager = new ProductManager();
});