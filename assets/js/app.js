import { AppDatabase } from './database/indexDB.js';
import { getPersianDateString, daysBetween } from './utils/date.js';
import { formatCurrency } from './utils/format.js';
import { WizardManager } from './modules/wizard.js';
import { EmergencyManager } from './modules/emergency.js';
import { ShopManager } from './modules/store.js';

class SmartFinanceApp {
    constructor() {
        this.db = new AppDatabase();
        this.currentView = 'dashboard';
        
        // Modules
        this.wizard = null;
        this.emergency = null;
        this.shop = null;
    }

    async start() {
        await this.db.init();
        this.initDOM();
        this.initRouter();
        
        // Instantiating Modules
        this.wizard = new WizardManager(this);
        this.emergency = new EmergencyManager(this);
        this.shop = new ShopManager(this);

        // Render standard outputs
        document.getElementById('current-persian-date').innerText = getPersianDateString();
        
        await this.loadDashboardData();
        await this.checkEmergencyStatus();
        
        // PWA Service Worker Registration
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./service-worker.js').catch(console.error);
        }
    }

    initDOM() {
        // Floating Action Button to instantly enter step-by-step wizard
        document.getElementById('fab-trigger-wizard').addEventListener('click', () => {
            this.switchView('wizard');
            this.wizard.start();
        });

        // Wallet modal handlers
        document.getElementById('btn-add-wallet').addEventListener('click', () => {
            document.getElementById('wallet-modal').classList.add('active');
        });
        document.getElementById('btn-close-wallet-modal').addEventListener('click', () => {
            document.getElementById('wallet-modal').classList.remove('active');
        });
        document.getElementById('btn-save-wallet').addEventListener('click', () => this.handleSaveWallet());

        // Backup mechanics
        document.getElementById('btn-export-json').addEventListener('click', () => this.exportBackup());
        document.getElementById('file-import').addEventListener('change', (e) => this.importBackup(e));
        document.getElementById('btn-reset-db').addEventListener('click', () => this.resetApp());
    }

    initRouter() {
        document.querySelectorAll('#bottom-nav .nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const targetView = e.currentTarget.dataset.view;
                this.switchView(targetView);
            });
        });
    }

    switchView(viewName) {
        this.currentView = viewName;
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('#bottom-nav .nav-item').forEach(i => i.classList.remove('active'));
        
        const activeViewElement = document.getElementById(`view-${viewName}`);
        if(activeViewElement) activeViewElement.classList.add('active');
        
        const activeNavItem = document.querySelector(`#bottom-nav .nav-item[data-view="${viewName}"]`);
        if(activeNavItem) activeNavItem.classList.add('active');

        // Module lifecycles trigger inside navigation hooks
        if (viewName === 'dashboard') this.loadDashboardData();
        if (viewName === 'wallets') this.loadWalletsData();
        if (viewName === 'emergency') this.emergency.setupView();
        if (viewName === 'shop') this.shop.setupView();
        if (viewName === 'budgets') this.loadBudgetsView();
    }

    async loadDashboardData() {
        const wallets = await this.db.getAll('wallets');
        const txs = await this.db.getAll('transactions');
        
        let totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0);
        document.getElementById('dash-total-balance').innerText = totalBalance.toLocaleString('fa-IR');

        // Calculate current month statistics
        let income = 0, expense = 0;
        txs.forEach(t => {
            if(t.type === 'expense') expense += t.amount;
            if(t.type === 'income') income += t.amount;
        });

        document.getElementById('dash-month-income').innerText = income.toLocaleString('fa-IR');
        document.getElementById('dash-month-expense').innerText = expense.toLocaleString('fa-IR');
        document.getElementById('dash-net-profit').innerText = (income - expense).toLocaleString('fa-IR');

        // Render Recent 5 Transactions
        const recentContainer = document.getElementById('dash-recent-tx');
        const top5 = txs.reverse().slice(0, 5);
        if(top5.length === 0) {
            recentContainer.innerHTML = '<div class="empty-state">هنوز تراکنشی ثبت نشده است.</div>';
        } else {
            recentContainer.innerHTML = top5.map(t => `
                <div class="tx-row">
                    <div class="tx-info-block">
                        <span class="tx-desc">${t.description}</span>
                        <span class="tx-meta">${t.category || 'بدون دسته‌بندی'}</span>
                    </div>
                    <span class="${t.type === 'income' ? 'text-profit' : 'text-loss'}">
                        ${t.type === 'income' ? '＋' : '－'}${t.amount.toLocaleString('fa-IR')}
                    </span>
                </div>
            `).join('');
        }
        
        this.renderSimpleDashboardChart(income, expense);
    }

    renderSimpleDashboardChart(income, expense) {
        const canvas = document.getElementById('dashboardChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Simple HTML5 Canvas visual implementation matching minimalist standard
        const max = Math.max(income, expense, 1000);
        const h1 = (income / max) * 120;
        const h2 = (expense / max) * 120;

        ctx.fillStyle = '#34c759'; // Profit Blue/Green
        ctx.fillRect(80, 140 - h1, 60, h1);
        ctx.fillStyle = '#1c1c1e';
        ctx.font = '12px system-ui';
        ctx.fillText('درآمد', 95, 155);

        ctx.fillStyle = '#ff3b30'; // Loss Red
        ctx.fillRect(220, 140 - h2, 60, h2);
        ctx.fillStyle = '#1c1c1e';
        ctx.fillText('هزینه', 235, 155);
    }

    async loadWalletsData() {
        const wallets = await this.db.getAll('wallets');
        const container = document.getElementById('wallets-container');
        if(wallets.length === 0) {
            container.innerHTML = '<div class="card" style="grid-column: 1/-1; text-align:center;">کیف پولی وجود ندارد، یکی بسازید!</div>';
            return;
        }
        container.innerHTML = wallets.map(w => `
            <div class="card wallet-card-item">
                <h3>${w.name}</h3>
                <div class="balance-amount" style="font-size:20px; margin: 10px 0 0 0;">${w.balance.toLocaleString('fa-IR')} ت</div>
            </div>
        `).join('');
    }

    async handleSaveWallet() {
        const name = document.getElementById('wallet-name').value;
        const balance = parseFloat(document.getElementById('wallet-balance').value) || 0;
        const type = document.getElementById('wallet-type').value;

        if(!name) return alert('لطفاً نام کیف پول را وارد کنید');

        await this.db.add('wallets', { name, balance, type });
        document.getElementById('wallet-modal').classList.remove('active');
        
        // Clear forms
        document.getElementById('wallet-name').value = '';
        document.getElementById('wallet-balance').value = '';

        this.loadWalletsData();
    }

    async checkEmergencyStatus() {
        const configs = await this.db.getAll('config');
        const config = configs.find(c => c.key === 'emergency');
        
        const alertBadge = document.getElementById('emergency-badge');
        const callout = document.getElementById('dash-emergency-callout');
        const calloutText = document.getElementById('dash-emergency-text');
        
        if (config && config.value.active) {
            alertBadge.style.display = 'inline-block';
            callout.style.display = 'block';

            const wallets = await this.db.getAll('wallets');
            const targetWallet = wallets.find(w => w.id == config.value.walletId);
            const daysLeft = daysBetween(new Date(config.value.targetDate), new Date());

            if(daysLeft <= 0) {
                calloutText.innerText = "دوره اضطراری منقضی شده است. لطفا آن را خاموش یا بروز کنید.";
                return;
            }
            const currentBal = targetWallet ? targetWallet.balance : 0;
            const allowance = Math.floor(currentBal / daysLeft);

            if(allowance <= 0) {
                calloutText.innerHTML = `🚨 <strong>بحران خرج‌کرد اضافی!</strong> شما مجاز به هیچ خرجی تا ${daysLeft} روز آینده نیستید.`;
            } else {
                calloutText.innerText = `سهمیه خرج مجاز روزانه شما: ${allowance.toLocaleString('fa-IR')} تومان (تا ${daysLeft} روز باقی مانده)`;
            }
        } else {
            alertBadge.style.display = 'none';
            callout.style.display = 'none';
        }
    }

    async loadBudgetsView() {
        const container = document.getElementById('budgets-container');
        // Preset mock structure showing responsive progress bars for goals
        container.innerHTML = `
            <div class="card">
                <div style="display:flex; justify-content:space-between">
                    <strong>بودجه خوراک شخصی</strong>
                    <span class="text-loss">باقی‌مانده: ۳۰۰,۰۰۰ ت</span>
                </div>
                <div class="progress-container">
                    <div class="progress-fill-bar" style="width: 75%; background: var(--color-warning);"></div>
                </div>
                <small style="color:var(--text-secondary)">۷۵٪ مصرف شده از سقف ۱,۲۰۰,۰۰۰ تومان</small>
            </div>
            <div class="card">
                <div style="display:flex; justify-content:space-between">
                    <strong>اقساط وام مسکن</strong>
                    <span class="text-profit">قسط ۴ از ۱۲</span>
                </div>
                <div class="progress-container">
                    <div class="progress-fill-bar" style="width: 33.3%;"></div>
                </div>
                <small style="color:var(--text-secondary)">موعد قسط بعدی: ۵ روز آینده</small>
            </div>
        `;
    }

    exportBackup() {
        // Full offline capability backup functionality
        Promise.all([
            this.db.getAll('wallets'),
            this.db.getAll('transactions'),
            this.db.getAll('budgets'),
            this.db.getAll('shop_records'),
            this.db.getAll('config')
        ]).then(([wallets, transactions, budgets, shop_records, config]) => {
            const fullData = { wallets, transactions, budgets, shop_records, config };
            const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `finance_backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
        });
    }

    importBackup(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                await this.db.clearAll();
                
                if(data.wallets) for (let w of data.wallets) delete w.id, await this.db.add('wallets', w);
                if(data.transactions) for (let t of data.transactions) delete t.id, await this.db.add('transactions', t);
                if(data.budgets) for (let b of data.budgets) delete b.id, await this.db.add('budgets', b);
                if(data.shop_records) for (let s of data.shop_records) delete s.id, await this.db.add('shop_records', s);
                if(data.config) for (let c of data.config) await this.db.put('config', c);
                
                alert('پشتیبان با موفقیت بازیابی شد! ♻️');
                window.location.reload();
            } catch(err) {
                alert('خطا در خواندن فایل پشتیبان');
            }
        };
        reader.readAsText(file);
    }

    async resetApp() {
        if(confirm('آیا از حذف کامل تمام اطلاعات ثبت شده مطمئن هستید؟ این عمل غیرقابل بازگشت است.')) {
            await this.db.clearAll();
            window.location.reload();
        }
    }
}

// Global App Initialization
document.addEventListener('DOMContentLoaded', () => {
    const app = new SmartFinanceApp();
    app.start();
});
