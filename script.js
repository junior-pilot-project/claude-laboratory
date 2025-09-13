let projects = [];
let projectData = null;
let isGroupedView = false;

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    loadProjectsFromJSON();
}

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const developerFilter = document.getElementById('developerFilter');
    const viewModeToggle = document.getElementById('viewModeToggle');

    searchInput.addEventListener('input', handleSearch);
    categoryFilter.addEventListener('change', handleFilters);
    developerFilter.addEventListener('change', handleFilters);
    viewModeToggle.addEventListener('click', toggleViewMode);
}

async function loadProjectsFromJSON() {
    console.log('🔍 서버에서 프로젝트 데이터 로드 중...');
    
    try {
        const response = await fetch('/api/projects');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        projectData = await response.json();
        projects = projectData.projects || [];
        
        console.log(`📁 서버에서 ${projectData.totalCount}개 프로젝트 로드됨 (${projectData.developerCount}명 개발자)`);
        console.log(`🕒 마지막 스캔: ${new Date(projectData.generated).toLocaleString('ko-KR')}`);
        
        updateStats();
        populateDeveloperFilter();
        renderProjects();
        
    } catch (error) {
        console.error('Error loading projects from server:', error);
        showEmptyState('서버에서 프로젝트를 불러오는 중 오류가 발생했습니다', 'node server.js 명령어로 서버를 시작해주세요');
    }
}

function updateStats() {
    const totalProjects = document.getElementById('totalProjects');
    const totalDevelopers = document.getElementById('totalDevelopers');
    
    totalProjects.textContent = `${projectData.totalCount}개 프로젝트`;
    totalDevelopers.textContent = `${projectData.developerCount}명 개발자`;
}

function populateDeveloperFilter() {
    const developerFilter = document.getElementById('developerFilter');
    
    // 기존 옵션 제거 (첫 번째 제외)
    while (developerFilter.children.length > 1) {
        developerFilter.removeChild(developerFilter.lastChild);
    }
    
    // 개발자 목록을 알파벳 순으로 정렬해서 추가
    const developers = Object.keys(projectData.developerStats).sort();
    
    developers.forEach(developer => {
        const option = document.createElement('option');
        option.value = developer;
        option.textContent = `${developer} (${projectData.developerStats[developer]}개)`;
        developerFilter.appendChild(option);
    });
}

function handleSearch() {
    handleFilters();
}

function handleFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedCategory = document.getElementById('categoryFilter').value;
    const selectedDeveloper = document.getElementById('developerFilter').value;
    
    let filteredProjects = projects.filter(project => {
        // 검색어 필터
        const matchesSearch = searchTerm === '' || 
            project.folderName.toLowerCase().includes(searchTerm) ||
            project.developer.toLowerCase().includes(searchTerm);
        
        // 카테고리 필터
        const matchesCategory = selectedCategory === 'all' || project.category === selectedCategory;
        
        // 개발자 필터
        const matchesDeveloper = selectedDeveloper === 'all' || project.developer === selectedDeveloper;
        
        return matchesSearch && matchesCategory && matchesDeveloper;
    });
    
    renderProjects(filteredProjects);
}

function toggleViewMode() {
    const toggle = document.getElementById('viewModeToggle');
    const projectList = document.getElementById('projectList');
    
    isGroupedView = !isGroupedView;
    
    if (isGroupedView) {
        toggle.textContent = '목록 보기';
        toggle.classList.add('active');
        projectList.classList.add('grouped');
    } else {
        toggle.textContent = '그룹 보기';
        toggle.classList.remove('active');
        projectList.classList.remove('grouped');
    }
    
    handleFilters(); // 현재 필터 상태로 다시 렌더링
}

function renderProjects(projectsToRender = projects) {
    const projectList = document.getElementById('projectList');
    
    if (projectsToRender.length === 0) {
        showEmptyState('표시할 프로젝트가 없습니다', '다른 검색어나 필터를 시도해보세요');
        return;
    }
    
    if (isGroupedView) {
        renderGroupedView(projectsToRender);
    } else {
        renderListView(projectsToRender);
    }
}

function renderListView(projectsToRender) {
    const projectList = document.getElementById('projectList');
    
    projectList.innerHTML = projectsToRender.map(project => 
        createProjectCard(project)
    ).join('');
}

function renderGroupedView(projectsToRender) {
    const projectList = document.getElementById('projectList');
    
    // 개발자별로 그룹핑
    const groupedProjects = {};
    projectsToRender.forEach(project => {
        if (!groupedProjects[project.developer]) {
            groupedProjects[project.developer] = [];
        }
        groupedProjects[project.developer].push(project);
    });
    
    // 개발자명 기준으로 정렬
    const sortedDevelopers = Object.keys(groupedProjects).sort();
    
    projectList.innerHTML = sortedDevelopers.map(developer => `
        <div class="developer-group">
            <div class="developer-group-header">
                <h3>${developer}</h3>
                <span class="project-count">${groupedProjects[developer].length}개 프로젝트</span>
            </div>
            <div class="developer-projects">
                ${groupedProjects[developer].map(project => 
                    createProjectCard(project, true)
                ).join('')}
            </div>
        </div>
    `).join('');
}

function createProjectCard(project, hideDevBadge = false) {
    const clickHandler = project.indexPath ? `onclick="openProject('${project.indexPath}')"` : '';
    const statusTag = project.indexPath ? '프로젝트' : '프로젝트 (개발중)';
    
    return `
        <div class="project-card" data-developer="${project.developer}" ${clickHandler}>
            <div class="project-header">
                <h3>${project.folderName}</h3>
                ${!hideDevBadge ? `<span class="developer-badge">${project.developer}</span>` : ''}
            </div>
            <div class="project-meta">
                <span class="category-tag">${statusTag}</span>
                <span class="date">${new Date(project.lastModified).toLocaleDateString('ko-KR')}</span>
            </div>
            <div class="project-description">${project.folderName} 프로젝트</div>
            <div class="tech-stack">
                <span class="tech-tag">HTML</span>
                <span class="tech-tag">CSS</span>
                <span class="tech-tag">JavaScript</span>
            </div>
        </div>
    `;
}

function openProject(indexPath) {
    window.open(indexPath, '_blank');
}

function showEmptyState(title, subtitle) {
    const projectList = document.getElementById('projectList');
    projectList.innerHTML = `
        <div class="empty-state">
            <p class="highlight">${title}</p>
            <p>${subtitle}</p>
        </div>
    `;
}