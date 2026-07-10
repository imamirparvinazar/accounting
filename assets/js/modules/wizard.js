export class WizardManager {
    constructor(app) {
        this.app = app;
        this.currentStep = 1;
        this.totalSteps = 5;
        this.data = {};
        
        this.initDOM();
    }

    initDOM() {
        this.track = document.getElementById('wizard-track');
        this.progressBar = document.getElementById('wizard-progress-bar');
        
        // Next buttons
        document.getElementById('wiz-btn-amount').addEventListener('click', () => this.next());
        document.getElementById('wiz-submit').addEventListener('click', () => this.submit());
        
        // Prev buttons
        document.querySelectorAll('.wiz-prev').forEach(btn => {
            btn.addEventListener('click', () => this.prev());
        });

        // Setup static event delegation for option clicks
        this.track.addEventListener('click', (e) => {
            const optionBtn = e.target.closest('.btn-option');
            if (!optionBtn) return;
            
            const field = optionBtn.dataset.field;
            const value = optionBtn.dataset.value;
            
            this.data[field] = value;
            
            // Auto advance on step 1, 3, 4
            if (this.currentStep === 1 || this.currentStep === 3 || this.currentStep === 4) {
                this.next();
            }
        });
        
        document.getElementById('wizard-back').addEventListener('click', () => {
            this.app.switchView('dashboard');
        });
    }

    start() {
        this.currentStep = 1;
        this.data = {};
        document.getElementById('wiz-amount').value = '';
        document.getElementById('wiz-description').value = '';
        this.renderWallets();
        this.renderCategories();
        this.updateUI();
    }

    async renderWallets() {
        const wallets = await this.app.db.getAll('wallets');
        const listContainer = document.getElementById('wiz-wallets-list');
        if(wallets.length === 0) {
            listContainer.innerHTML = '<p>ابتدا یک کیف پول در منوی اصلی بسازید.</p>';
            return;
        }
        listContainer.innerHTML = wallets.map(w => `
            <button class="btn-option" data-field="walletId" data-value="${w.id}">💳 ${w.name}</button>
        `).join('');
    }

    renderCategories() {
        const cats = ['خوراک', 'حمل و نقل', 'قبوض', 'تفریح', 'پزشکی', 'آموزش', 'فروشگاه', 'غیره'];
        const listContainer = document.getElementById('wiz-categories-list');
        listContainer.innerHTML = cats.map(c => `
            <button class="btn-option" data-field="category" data-value="${c}">${c}</button>
        `).join('');
    }

    updateUI() {
        // Move track horizontally based on current step
        const offset = (this.currentStep - 1) * -20; // 20% width per step
        this.track.style.transform = `translateX(${offset}%)`;
        
        // Toggle step active class
        document.querySelectorAll('.wizard-step').forEach((step, idx) => {
            if (idx + 1 === this.currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });

        // Progress bar
        const progressPercent = (this.currentStep / this.totalSteps) * 100;
        this.progressBar.style.width = `${progressPercent}%`;
    }

    next() {
        if (this.currentStep === 2) {
            const amt = document.getElementById('wiz-amount').value;
            if (!amt || amt <= 0) return alert('لطفاً مبلغ معتبری وارد کنید');
            this.data.amount = parseFloat(amt);
        }
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.updateUI();
        }
    }

    prev() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateUI();
        }
    }

    async submit() {
        this.data.description = document.getElementById('wiz-description').value || 'بدون توضیح';
        this.data.date = new Date().toISOString();
        
        // Save to IndexedDB via App Main Controller
        await this.app.db.add('transactions', this.data);
        
        // Deduct/Add money to wallet
        if (this.data.walletId) {
            const wallets = await this.app.db.getAll('wallets');
            const wallet = wallets.find(w => w.id == this.data.walletId);
            if (wallet) {
                if (this.data.type === 'expense') wallet.balance -= this.data.amount;
                if (this.data.type === 'income') wallet.balance += this.data.amount;
                await this.app.db.put('wallets', wallet);
            }
        }

        alert('تراکنش با موفقیت ثبت شد ✨');
        this.app.switchView('dashboard');
        this.app.loadDashboardData();
    }
}
