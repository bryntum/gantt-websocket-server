// API Client
class APIClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
    }

    async fetch(endpoint) {
        try {
            const response = await fetch(`${this.baseUrl}/api/${endpoint}`);
            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error(`Error fetching ${endpoint}:`, error);
            throw error;
        }
    }

    async getStatus() {
        return this.fetch('status');
    }

    async getSessions() {
        return this.fetch('sessions');
    }

    async getProjects() {
        return this.fetch('projects');
    }

    async getProjectDetails(projectId) {
        return this.fetch(`projects/${projectId}`);
    }

    async getMessages() {
        return this.fetch('messages');
    }

    async getPhantomIds() {
        return this.fetch('phantom-ids');
    }
}

// JSON Tree Viewer - renders JSON like browser console
class JSONTreeViewer {
    constructor(data) {
        this.data = data;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'json-tree';
        this.renderValue(this.data, container, '', true);
        return container;
    }

    renderValue(value, container, key = '', isRoot = false) {
        const type = this.getType(value);
        const node = document.createElement('div');
        node.className = isRoot ? 'json-tree-node' : 'json-tree-node nested';

        if (type === 'object' || type === 'array') {
            this.renderComplexType(value, node, key, type, isRoot);
        }
 else {
            this.renderSimpleType(value, node, key, type);
        }

        container.appendChild(node);
    }

    renderComplexType(value, node, key, type, isRoot = false) {
        const row = document.createElement('div');
        row.className = 'json-tree-row';

        const isArray = Array.isArray(value);
        const isEmpty = isArray ? value.length === 0 : Object.keys(value).length === 0;
        const size = isArray ? value.length : Object.keys(value).length;

        // Toggle button — collapse large nodes by default (unless root)
        const startCollapsed = !isRoot && size > 5;
        const toggle = document.createElement('span');
        toggle.className = isEmpty ? 'json-toggle empty' : (startCollapsed ? 'json-toggle collapsed' : 'json-toggle expanded');
        row.appendChild(toggle);

        // Key (if exists)
        if (key) {
            const keySpan = document.createElement('span');
            keySpan.className = 'json-key';
            keySpan.textContent = key;
            row.appendChild(keySpan);
            row.appendChild(document.createTextNode(' '));
        }

        // Opening bracket
        const openBracket = document.createElement('span');
        openBracket.className = 'json-bracket';
        openBracket.textContent = isArray ? '[' : '{';
        row.appendChild(openBracket);

        // Preview when collapsed
        const preview = document.createElement('span');
        preview.className = 'json-preview-text';
        preview.textContent = isEmpty ? '' : `${size} ${isArray ? 'items' : 'properties'}`;
        preview.style.display = startCollapsed ? 'inline' : 'none';
        row.appendChild(preview);

        // Closing bracket (for collapsed state)
        const closeBracket = document.createElement('span');
        closeBracket.className = 'json-bracket';
        closeBracket.textContent = isArray ? ']' : '}';
        closeBracket.style.display = startCollapsed ? 'inline' : 'none';
        row.appendChild(closeBracket);

        node.appendChild(row);

        // Children container
        const children = document.createElement('div');
        children.className = startCollapsed ? 'json-tree-children collapsed' : 'json-tree-children';

        if (!isEmpty) {
            if (isArray) {
                value.forEach((item, index) => {
                    this.renderValue(item, children, index.toString());
                });
            }
 else {
                Object.keys(value).forEach(k => {
                    this.renderValue(value[k], children, k);
                });
            }

            // Closing bracket on new line
            const closingRow = document.createElement('div');
            closingRow.className = 'json-tree-row';
            const closingBracket = document.createElement('span');
            closingBracket.className = 'json-bracket';
            closingBracket.textContent = isArray ? ']' : '}';
            closingRow.appendChild(closingBracket);
            children.appendChild(closingRow);
        }

        node.appendChild(children);

        // Toggle functionality
        if (!isEmpty) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isCollapsed = toggle.classList.contains('collapsed');

                if (isCollapsed) {
                    toggle.classList.remove('collapsed');
                    toggle.classList.add('expanded');
                    children.classList.remove('collapsed');
                    preview.style.display = 'none';
                    closeBracket.style.display = 'none';
                }
 else {
                    toggle.classList.remove('expanded');
                    toggle.classList.add('collapsed');
                    children.classList.add('collapsed');
                    preview.style.display = 'inline';
                    closeBracket.style.display = 'inline';
                }
            });
        }
    }

    renderSimpleType(value, node, key, type) {
        const row = document.createElement('div');
        row.className = 'json-tree-row';

        // Empty toggle space for alignment
        const toggleSpace = document.createElement('span');
        toggleSpace.className = 'json-toggle empty';
        row.appendChild(toggleSpace);

        // Key
        if (key) {
            const keySpan = document.createElement('span');
            keySpan.className = 'json-key';
            keySpan.textContent = key;
            row.appendChild(keySpan);
            row.appendChild(document.createTextNode(' '));
        }

        // Value
        const valueSpan = document.createElement('span');
        valueSpan.className = `json-value ${type}`;

        if (type === 'string') {
            valueSpan.textContent = value;
        }
 else if (type === 'null') {
            valueSpan.textContent = 'null';
        }
 else {
            valueSpan.textContent = String(value);
        }

        // Copy to clipboard on click
        valueSpan.style.cursor = 'pointer';
        valueSpan.title = 'Click to copy';
        valueSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = value === null ? 'null' : String(value);

            navigator.clipboard.writeText(text).then(() => {
                const original = valueSpan.textContent;

                valueSpan.classList.add('copied');
                valueSpan.textContent = 'Copied!';
                setTimeout(() => {
                    valueSpan.textContent = original;
                    valueSpan.classList.remove('copied');
                }, 800);
            });
        });

        row.appendChild(valueSpan);
        node.appendChild(row);
    }

    getType(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        const type = typeof value;
        if (type === 'object') return 'object';
        return type;
    }

    static expandAll(container) {
        container.querySelectorAll('.json-toggle.collapsed').forEach(toggle => toggle.click());
    }

    static collapseAll(container) {
        container.querySelectorAll('.json-toggle.expanded').forEach(toggle => toggle.click());
    }
}

// UI Manager
class UIManager {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.currentView = 'messages';
        this.autoRefreshInterval = null;
        this.messagesData = [];
        this.allPhantomIds = [];
        this.expandedMessages = new Set();
        this.jsonModalData = null;
        this.lastMessageCount = 0;
        this.lastMessageTimestamp = 0;
        this.modalOpen = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupJsonModalListeners();
        this.startAutoRefresh();
        this.loadAll();
    }

    setupEventListeners() {
        // Refresh current view button
        document.getElementById('refresh-current').addEventListener('click', () => {
            this.loadView(this.currentView);
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal(btn.closest('.modal').id);
            });
        });

        // Close modal on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Phantom ID search
        document.getElementById('phantom-search').addEventListener('input', (e) => {
            this.filterPhantomIds(e.target.value);
        });
    }

    setupJsonModalListeners() {
        document.getElementById('json-expand-all').addEventListener('click', () => {
            const content = document.getElementById('json-modal-content');
            JSONTreeViewer.expandAll(content);
        });

        document.getElementById('json-collapse-all').addEventListener('click', () => {
            const content = document.getElementById('json-modal-content');
            JSONTreeViewer.collapseAll(content);
        });

        document.getElementById('json-copy-all').addEventListener('click', (e) => {
            if (this.jsonModalData) {
                navigator.clipboard.writeText(JSON.stringify(this.jsonModalData, null, 2)).then(() => {
                    const btn = e.target;
                    const original = btn.textContent;
                    btn.textContent = 'Copied!';
                    btn.classList.add('btn-copied');
                    setTimeout(() => {
                        btn.textContent = original;
                        btn.classList.remove('btn-copied');
                    }, 1000);
                });
            }
        });
    }

    openJsonModal(title, data) {
        this.jsonModalData = data;

        document.getElementById('json-modal-title').textContent = title;
        const content = document.getElementById('json-modal-content');
        content.innerHTML = '';

        const viewer = new JSONTreeViewer(data);
        content.appendChild(viewer.render());

        this.openModal('json-modal');
    }

    switchView(view) {
        this.currentView = view;

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });

        // Update views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.toggle('active', v.id === `${view}-view`);
        });

        // Load view if needed
        this.loadView(view);
    }

    startAutoRefresh() {
        // Auto-refresh every 5 seconds
        this.autoRefreshInterval = setInterval(() => {
            this.loadAll();
        }, 5000);
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    async loadAll() {
        await Promise.all([
            this.loadStatus(),
            this.loadView(this.currentView)
        ]);
    }

    async loadView(view) {
        switch (view) {
            case 'messages':
                await this.loadMessages();
                break;
            case 'sessions':
                await this.loadSessions();
                break;
            case 'projects':
                await this.loadProjects();
                break;
            case 'phantom-ids':
                await this.loadPhantomIds();
                break;
        }
    }

    async loadStatus() {
        try {
            const data = await this.apiClient.getStatus();
            document.querySelector('.status-text').textContent = `Server Online (${data.port})`;
        }
        catch {
            document.querySelector('.status-text').textContent = 'Server Offline';
            document.querySelector('.status-indicator').style.background = '#e74c3c';
        }
    }

    async loadMessages() {
        const content = document.getElementById('messages-content');
        const navBadge = document.getElementById('nav-messages-count');

        try {
            const data = await this.apiClient.getMessages();
            navBadge.textContent = data.count;

            // Skip re-render if nothing changed
            const lastTs = data.messages.length > 0 ? data.messages[data.messages.length - 1].timestamp : 0;
            if (data.count === this.lastMessageCount && lastTs === this.lastMessageTimestamp) {
                return;
            }
            this.lastMessageCount = data.count;
            this.lastMessageTimestamp = lastTs;
            this.messagesData = data.messages;

            if (data.count === 0) {
                content.innerHTML = '<div class="empty">No messages logged yet</div>';
                return;
            }

            // Show only last 10 messages
            const recentMessages = [...data.messages].reverse().slice(0, 10);

            const list = document.createElement('div');
            list.className = 'messages-list';

            recentMessages.forEach((msg, displayIndex) => {
                const actualIndex = data.count - 1 - displayIndex;
                const messageCard = this.createMessageCard(msg, actualIndex);
                list.appendChild(messageCard);
            });

            content.innerHTML = '';
            content.appendChild(list);
        }
        catch {
            content.innerHTML = '<div class="error">Error loading messages</div>';
        }
    }

    createMessageCard(msg, index) {
        const card = document.createElement('div');
        card.className = `message-card ${msg.direction}`;
        card.dataset.messageIndex = index;

        // Header
        const header = document.createElement('div');
        header.className = 'message-header';
        header.innerHTML = `
            <div class="message-meta">
                <span class="direction-badge ${msg.direction}">${msg.direction}</span>
                <span class="message-client">${this.escapeHtml(msg.clientId)}</span>
                <span>•</span>
                <span class="message-client">${this.escapeHtml(msg.userName)}</span>
            </div>
            <span class="message-time">${this.formatTime(msg.timestamp)}</span>
        `;
        card.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'message-body';

        // Command row with View JSON button
        const commandRow = document.createElement('div');
        commandRow.className = 'message-command-row';

        const command = document.createElement('span');
        command.className = 'message-command';
        command.textContent = msg.command;
        commandRow.appendChild(command);

        if (msg.data !== undefined && msg.data !== null) {
            const viewBtn = document.createElement('button');
            viewBtn.className = 'btn-view-json';
            viewBtn.textContent = 'View JSON';
            viewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const title = `${msg.direction} ${msg.command} — ${msg.clientId}`;
                this.openJsonModal(title, msg.data);
            });
            commandRow.appendChild(viewBtn);
        }

        body.appendChild(commandRow);

        // Preview (read-only, click opens JSON modal)
        if (msg.dataPreview) {
            const preview = document.createElement('div');
            preview.className = 'message-preview';
            preview.textContent = msg.dataPreview;

            if (msg.data !== undefined && msg.data !== null) {
                preview.classList.add('clickable');
                preview.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const title = `${msg.direction} ${msg.command} — ${msg.clientId}`;
                    this.openJsonModal(title, msg.data);
                });
            }

            body.appendChild(preview);
        }

        card.appendChild(body);

        return card;
    }

    async loadSessions() {
        const content = document.getElementById('sessions-content');
        const navBadge = document.getElementById('nav-sessions-count');

        try {
            const data = await this.apiClient.getSessions();
            navBadge.textContent = data.count;

            if (data.count === 0) {
                content.innerHTML = '<div class="empty">No active sessions</div>';
                return;
            }

            const table = document.createElement('table');
            table.className = 'sessions-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Status</th>
                        <th>IP Address</th>
                        <th>Project</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.sessions.map(session => `
                        <tr>
                            <td>${this.escapeHtml(session.id)}</td>
                            <td>${this.escapeHtml(session.userName)}</td>
                            <td class="status-${session.readyState.toLowerCase()}">${session.readyState}</td>
                            <td>${this.escapeHtml(session.remoteAddress)}</td>
                            <td>${session.subscribedProject || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
            content.innerHTML = '';
            content.appendChild(table);
        }
        catch {
            content.innerHTML = '<div class="error">Error loading sessions</div>';
        }
    }

    async loadProjects() {
        const content = document.getElementById('projects-content');
        const navBadge = document.getElementById('nav-projects-count');

        try {
            const data = await this.apiClient.getProjects();
            navBadge.textContent = data.projects.length;

            if (data.projects.length === 0) {
                content.innerHTML = '<div class="empty">No projects found</div>';
                return;
            }

            const grid = document.createElement('div');
            grid.className = 'projects-grid';
            grid.innerHTML = data.projects.map(project => `
                <div class="project-card" data-project-id="${project.id}">
                    <h3>${this.escapeHtml(project.name)} <span style="color: #9ca3af; font-weight: normal; font-size: 0.9rem;">(ID: ${project.id})</span></h3>
                    <div class="project-meta">
                        <span>👥 ${project.subscriberCount} subscribers</span>
                        <span>📝 ${project.revisionCount} revisions</span>
                    </div>
                    <div class="project-stats">
                        ${Object.entries(project.stats || {}).map(([key, value]) => `
                            <div class="stat-item">
                                <span class="stat-label">${key}:</span>
                                <span class="stat-value">${value}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
            content.innerHTML = '';
            content.appendChild(grid);

            // Add click handlers
            grid.querySelectorAll('.project-card').forEach(card => {
                card.addEventListener('click', () => {
                    const projectId = parseInt(card.dataset.projectId);
                    this.showProjectModal(projectId);
                });
            });
        }
        catch {
            content.innerHTML = '<div class="error">Error loading projects</div>';
        }
    }

    async showProjectModal(projectId) {
        const modalTitle = document.getElementById('project-modal-title');
        const modalBody = document.getElementById('project-details-content');

        modalTitle.textContent = `Project ${projectId} Details`;
        modalBody.innerHTML = '<div class="loading">Loading project details...</div>';
        this.openModal('project-modal');

        try {
            const project = await this.apiClient.getProjectDetails(projectId);

            modalBody.innerHTML = `
                <div class="project-details">
                    <div class="detail-section">
                        <h4>Overview</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <div class="detail-label">Project ID</div>
                                <div class="detail-value">${project.id}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Project Name</div>
                                <div class="detail-value">${this.escapeHtml(project.name)}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Active Subscribers</div>
                                <div class="detail-value">${project.subscribers.length}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Total Revisions</div>
                                <div class="detail-value">${project.revisions.length}</div>
                            </div>
                        </div>
                    </div>

                    ${project.subscribers.length > 0 ? `
                        <div class="detail-section">
                            <h4>Subscribers</h4>
                            <div class="detail-grid">
                                ${project.subscribers.map(sub => `
                                    <div class="detail-item">
                                        <div class="detail-label">${this.escapeHtml(sub.id)}</div>
                                        <div class="detail-value">${this.escapeHtml(sub.userName)}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${project.revisions.length > 0 ? `
                        <div class="detail-section">
                            <div class="detail-section-header">
                                <h4>Recent Revisions (Last ${Math.min(5, project.revisions.length)})</h4>
                                <button class="btn-view-json" id="revisions-view-json">View JSON</button>
                            </div>
                            <div id="revisions-json-tree"></div>
                        </div>
                    ` : ''}

                    <div class="detail-section">
                        <div class="detail-section-header">
                            <h4>Project Data</h4>
                            <button class="btn-view-json" id="project-data-view-json">View JSON</button>
                        </div>
                        <div id="project-data-json-tree"></div>
                    </div>
                </div>
            `;

            // Render JSON trees
            if (project.revisions.length > 0) {
                const revisionsContainer = modalBody.querySelector('#revisions-json-tree');
                const revisionsViewer = new JSONTreeViewer(project.revisions.slice(-5));
                revisionsContainer.appendChild(revisionsViewer.render());
            }

            const projectDataContainer = modalBody.querySelector('#project-data-json-tree');
            const projectDataViewer = new JSONTreeViewer(project.data);
            projectDataContainer.appendChild(projectDataViewer.render());

            // View JSON button handlers
            if (project.revisions.length > 0) {
                const revData = project.revisions.slice(-5);
                modalBody.querySelector('#revisions-view-json').addEventListener('click', () => {
                    this.openJsonModal(`Revisions — Project ${project.name}`, revData);
                });
            }

            modalBody.querySelector('#project-data-view-json').addEventListener('click', () => {
                this.openJsonModal(`Project Data — ${project.name}`, project.data);
            });

        }
        catch {
            modalBody.innerHTML = '<div class="error">Error loading project details</div>';
        }
    }

    async loadPhantomIds() {
        const content = document.getElementById('phantom-ids-content');
        const navBadge = document.getElementById('nav-phantom-ids-count');

        try {
            const data = await this.apiClient.getPhantomIds();
            this.allPhantomIds = data.mappings;
            navBadge.textContent = data.count;

            this.renderPhantomIds(this.allPhantomIds);
        }
        catch {
            content.innerHTML = '<div class="error">Error loading phantom IDs</div>';
        }
    }

    renderPhantomIds(mappings) {
        const content = document.getElementById('phantom-ids-content');
        const searchInput = document.getElementById('phantom-search');

        if (mappings.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty';
            emptyDiv.textContent = searchInput.value ? 'No matching phantom IDs' : 'No phantom IDs yet';
            content.innerHTML = '';
            content.appendChild(emptyDiv);
            return;
        }

        const table = document.createElement('table');
        table.className = 'phantom-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Phantom ID</th>
                    <th>Real ID</th>
                </tr>
            </thead>
            <tbody>
                ${mappings.map(mapping => `
                    <tr>
                        <td>${this.escapeHtml(mapping.phantomId)}</td>
                        <td>${this.escapeHtml(mapping.realId)}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        content.innerHTML = '';
        content.appendChild(table);
    }

    filterPhantomIds(searchTerm) {
        if (!searchTerm) {
            this.renderPhantomIds(this.allPhantomIds);
            return;
        }

        const filtered = this.allPhantomIds.filter(mapping =>
            mapping.phantomId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            mapping.realId.toLowerCase().includes(searchTerm.toLowerCase())
        );

        this.renderPhantomIds(filtered);
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
        this.modalOpen = true;
        this.stopAutoRefresh();
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        if (modalId === 'json-modal') {
            this.jsonModalData = null;
        }
        // Resume auto-refresh only if no modals are still open
        if (!document.querySelector('.modal.active')) {
            this.modalOpen = false;
            this.startAutoRefresh();
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    }

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

// Initialize the app
const apiClient = new APIClient();
window.uiManager = new UIManager(apiClient);
