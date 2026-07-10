import { daysBetween } from '../utils/date.js';

export class EmergencyManager {
    constructor(app) {
        this.app = app;
        this.isActive = false;
        this.config = null;
        this.initDOM();
    }

    async initDOM() {
        this.btnToggle = document.getElementById('btn-toggle-emergency');
        this.walletSelect = document.getElementById('emergency-wallet-select');
        this.dateInput = document.getElementById('emergency-target-date');

        this.btnToggle.addEventListener('click', () => this.toggleEmergency());
    }

    async setupView() {
        const wallets = await this.app.db.getAll('wallets');
        this.walletSelect.innerHTML = wallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        
        const configs = await this.app.db.getAll('config');
        this.config = configs.find(c => c.key === 'emergency');
        
        if (this.config && this.config.value.active) {
            this.isActive = true;
            this.btnToggle.innerText = 'غیرفعال‌سازی حالت اضطراری';
            this.btnToggle.className = 'btn-secondary';
        } else {
            this.isActive = false;
            this.btnToggle.innerText = 'فعال‌سازی حالت اضطراری 🚨';
            this.btnToggle.className = 'btn-loss';
        }
    }

    async toggleEmergency() {
        if (this.isActive) {
            // Deactivate
            await this.app.db.put('config', { key: 'emergency', value: { active: false } });
            alert('حالت اضطراری غیرفعال شد.');
        } else {
            // Activate
            const walletId = this.walletSelect.value;
            const targetDateStr = this.dateInput.value;
            if(!targetDateStr) return alert('لطفاً تاریخ پایان قرنطینه را مشخص کنید');

            const wallets = await this.app.db.getAll('wallets');
            const wallet = wallets.find(w => w.id == walletId);

            const configPayload = {
                active: true,
                walletId: walletId,
                initialBalance: wallet ? wallet.balance : 0,
                targetDate: targetDateStr
            };
            await this.app.db.put('config', { key: 'emergency', value: configPayload });
            alert('🚨 حالت اضطراری هوشمند فعال گردید!');
        }
        this.app.checkEmergencyStatus();
        this.setupView();
    }
}
