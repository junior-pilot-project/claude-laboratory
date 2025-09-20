# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

프로덕션 레벨의 CMS 상품등록 시스템입니다. 순수 HTML, CSS, JavaScript로 구현된 SPA(Single Page Application)이며, localStorage를 사용한 로컬 데이터 저장 방식을 사용합니다.

**주요 기능:**

- 카테고리별 동적 상품 등록 폼
- CSV 일괄 등록 및 데이터 내보내기
- 비즈니스 대시보드 및 KPI 모니터링
- 고급 검색/필터링 및 벌크 액션
- 자동저장 및 키보드 단축키 지원

## 개발 환경

이 프로젝트는 빌드 과정 없이 브라우저에서 직접 실행되는 정적 웹 애플리케이션입니다.

### 실행 방법

```bash
# HTTP 서버를 통한 실행 (권장)
npx http-server . -p 8080

# 또는 Python을 사용한 간단한 서버
python -m http.server 8080

# 또는 브라우저에서 index.html 직접 열기
open index.html
```

## 아키텍처

### 파일 구조

```
├── index.html          # 메인 HTML 구조
├── style.css           # 반응형 CSS 스타일
└── script.js           # JavaScript 애플리케이션 로직
```

### 핵심 아키텍처 패턴

**클래스 기반 JavaScript 구조:**

- `ProductManager` 클래스가 전체 애플리케이션의 중심
- 생성자에서 localStorage 데이터 로드 및 초기화
- 메서드 기반으로 기능 분리 (CRUD, 뷰 관리, 이벤트 처리)

**SPA 뷰 시스템:**

- `showProductForm()`, `showProductList()`, `showDashboard()` 메서드로 뷰 전환
- CSS `display` 속성으로 섹션 토글
- `currentView` 상태로 현재 뷰 추적 (form/list/dashboard)

**동적 폼 생성 시스템:**

- `handleCategoryChange()`: 카테고리 선택 시 동적 필드 생성
- `getCategoryFields()`: 카테고리별 전용 속성 정의
- `createDynamicField()`: 필드 타입별 DOM 요소 생성

**데이터 관리:**

- localStorage 기반 영구 저장
- `products` 배열: 상품 데이터
- `categories` 배열: 카테고리 데이터
- JSON 직렬화/역직렬화로 데이터 저장/로드

### 주요 컴포넌트

**ProductManager 클래스 핵심 메서드:**

_상품 관리:_

- `handleFormSubmit()`: 상품 등록/수정 처리
- `getFormData()`: 폼 데이터 수집 (기본 + 동적 필드)
- `loadProductList()`: 상품 목록 렌더링 및 필터링
- `populateForm()`: 수정 시 폼 데이터 채우기

_일괄 처리:_

- `showBulkImportModal()`: CSV 일괄 등록 모달
- `parseCSV()`: CSV 파일 파싱 및 데이터 변환
- `validateBulkRow()`: 벌크 데이터 유효성 검사
- `processBulkImport()`: 일괄 등록 실행

_대시보드 및 분석:_

- `updateDashboard()`: KPI 및 차트 업데이트
- `calculateAnalytics()`: 비즈니스 메트릭 계산
- `createBarChart()`: 동적 차트 생성

_사용자 경험:_

- `autoSave()`: 30초마다 자동저장
- `setupKeyboardShortcuts()`: 키보드 단축키 지원
- `validateField()`: 실시간 유효성 검사

**이미지 처리:**

- 드래그 앤 드롭 업로드 지원
- 자동 이미지 압축 (최대 800px, 80% 품질)
- Base64 인코딩으로 localStorage 저장
- `handleImageFiles()`, `createImagePreview()`, `compressImage()` 메서드

**카테고리별 동적 필드 시스템:**
각 카테고리는 고유한 필드 세트를 가짐:

- `electronics`: 모델명, 보증기간, 소비전력, 에너지효율등급
- `clothing`: 사이즈, 색상, 소재, 시즌
- `food`: 유통기한, 원산지, 영양성분, 유기농 여부
- `books`: 저자, 출판사, 출간일, ISBN, 페이지수
- `beauty`: 피부타입, 주요성분, 용량, 유통기한
- `sports`: 운동종목, 사이즈, 무게, 소재
- `home`: 크기, 무게, 소재, 사용공간

## 데이터 구조

**상품 객체 구조:**

```javascript
{
  id: "unique_id",
  productName: "상품명",
  categorySelect: "category_code",
  originalPrice: 10000,
  salePrice: 8000,
  discount: 20,
  stockQuantity: 100,
  minStock: 10,
  stockStatus: "in-stock|low-stock|out-of-stock",
  status: "active|draft|inactive",
  images: ["base64_string"],
  createdAt: "ISO_date",
  updatedAt: "ISO_date",
  // ... 카테고리별 동적 필드
}
```

**카테고리 객체 구조:**

```javascript
{
  code: "electronics",
  name: "전자제품"
}
```

## 개발 시 주의사항

### 동적 필드 추가

새로운 카테고리나 필드 추가 시:

1. `getCategoryFields()` 메서드에 필드 정의 추가
2. `createDynamicField()` 메서드에서 새 필드 타입 처리 (필요한 경우)
3. `getFormData()` 메서드가 새 필드를 올바르게 수집하는지 확인

### localStorage 데이터 호환성

- 기존 데이터 구조 변경 시 마이그레이션 로직 필요
- `constructor()`에서 데이터 유효성 검사 및 기본값 설정

### 반응형 디자인

- CSS Grid와 Flexbox 기반 레이아웃
- 768px, 480px 브레이크포인트 사용
- 모바일에서 폼 구조 단순화

### 고급 기능 관리

**일괄 등록 시스템:**

- CSV 템플릿 다운로드: `downloadTemplate()`
- CSV 파싱: `parseCSV()`, `parseCSVLine()`
- 데이터 유효성 검사: `validateBulkRow()`
- 미리보기 테이블: `displayPreview()`

**비즈니스 대시보드:**

- KPI 계산: 총 상품 수, 재고 가치, 마진율, 성장률
- 동적 차트: 카테고리별/가격대별 분포
- 비즈니스 인사이트: 재고 최적화, 가격 경쟁력 분석

**벌크 액션:**

- 다중 선택: `toggleSelectAll()`, `updateBulkActionButtons()`
- 일괄 상태 변경: `bulkUpdateStatus()`
- 일괄 삭제: `bulkDelete()`

**사용자 경험 기능:**

- 자동저장: 30초마다, 데이터 복구 제안
- 키보드 단축키: Ctrl+S(저장), Ctrl+N(새상품), Esc(취소)
- 실시간 유효성 검사 및 시각적 피드백

### 이미지 처리 제한

- Base64 저장으로 인한 localStorage 용량 제한 (5-10MB)
- 자동 압축 시스템으로 성능 최적화
- 대용량 이미지 처리 시 로딩 인디케이터 표시

### 데이터 관리 모범 사례

- 상품 등록 시 자동 ID 생성 및 타임스탬프 추가
- 카테고리 추가 시 `categories` 배열 및 localStorage 동기화
- 데이터 내보내기 시 CSV 형식으로 변환 및 다운로드
- 포롱 수정 시 `updatedAt` 필드 자동 업데이트
