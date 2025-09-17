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

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateCategorySelectors();
        this.setupImageUpload();
        this.loadProductList();
    }

    bindEvents() {
        // 메인 네비게이션
        document.getElementById('addProductBtn').addEventListener('click', () => this.showProductForm());
        document.getElementById('viewProductsBtn').addEventListener('click', () => this.showProductList());

        // 폼 이벤트
        document.getElementById('categorySelect').addEventListener('change', (e) => this.handleCategoryChange(e.target.value));
        document.getElementById('generateCodeBtn').addEventListener('click', () => this.generateProductCode());
        document.getElementById('productForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
        document.getElementById('cancelBtn').addEventListener('click', () => this.resetForm());
        document.getElementById('saveAsDraftBtn').addEventListener('click', () => this.saveAsDraft());

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

        // 이미지
        const images = [];
        const imagePreview = document.querySelectorAll('.image-preview img');
        imagePreview.forEach(img => {
            images.push(img.src);
        });
        data.images = images;

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

        this.currentView = 'list';
        this.loadProductList();
        this.updateCategoryFilter();
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
    }

    resetForm() {
        document.getElementById('productForm').reset();
        document.getElementById('categorySpecificFields').innerHTML = '';
        document.getElementById('imagePreviewContainer').innerHTML = '';
        this.editingProduct = null;

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

        // 필터 적용
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
                ${mainImage ? `<img src="${mainImage}" alt="${product.productName}" />` : '<div style="width:50px;height:50px;background:#f3f4f6;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#9ca3af;">📷</div>'}
            </td>
            <td><strong>${product.productName || '-'}</strong></td>
            <td>${categoryName}</td>
            <td>${product.brand || '-'}</td>
            <td>${product.originalPrice ? Number(product.originalPrice).toLocaleString() + '원' : '-'}</td>
            <td>${product.salePrice ? Number(product.salePrice).toLocaleString() + '원' : '-'}</td>
            <td>${product.stockQuantity || '-'}</td>
            <td><span class="status-badge status-${product.status}">${this.getStatusText(product.status)}</span></td>
            <td>${createdDate}</td>
            <td>
                <div class="product-actions">
                    <button class="btn btn-sm btn-secondary" onclick="productManager.editProduct('${product.id}')">수정</button>
                    <button class="btn btn-sm btn-secondary" onclick="productManager.deleteProduct('${product.id}')">삭제</button>
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
}

// 앱 초기화
let productManager;

document.addEventListener('DOMContentLoaded', () => {
    productManager = new ProductManager();
});