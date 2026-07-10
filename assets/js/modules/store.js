export class ShopManager {
    constructor(app) {
        this.app = app;
        this.currentAction = 'sale';
        this.initDOM();
    }

    initDOM() {
        const saleBtn = document.getElementById('shop-action-sale');
        const expenseBtn = document.getElementById('shop-action-expense');
        
        saleBtn.addEventListener('click', () => {
            this.currentAction = 'sale';
            saleBtn.classList.add('active');
            expenseBtn.classList.remove('active');
        });

        expenseBtn.addEventListener('click', () => {
            this.currentAction = 'expense';
            expenseBtn.classList.add('active');
            saleBtn.classList.remove('active');
        });

        document.getElementById('btn-shop-submit').addEventListener('click', () => this.handleSubmit());
    }

    async setupView() {
        const records = await this.app.db.getAll('shop_records');
        let sales = 0;
        let expenses = 0;

        records.forEach(r => {
            if(r.action === 'sale') sales += r.amount;
            if(r.action === 'expense') expenses += r.amount;
        });

        document.getElementById('shop-total-sales').innerText = sales.toLocaleString('fa-IR') + ' تومان';
        document.getElementById('shop-total-expenses').innerText = expenses.toLocaleString('fa-IR') + ' تومان';
        document.getElementById('shop-net-profit').innerText = (sales - expenses).toLocaleString('fa-IR') + ' تومان';
    }

    async handleSubmit() {
        const amountEl = document.getElementById('shop-amount');
        const descEl = document.getElementById('shop-desc');
        
        const amount = parseFloat(amountEl.value);
        const desc = descEl.value || 'رویداد فروشگاه';

        if(!amount || amount <= 0) return alert('مبلغ را وارد کنید');

        const payload = {
            action: this.currentAction,
            amount: amount,
            description: desc,
            date: new Date().toISOString()
        };

        await this.app.db.add('shop_records', payload);
        alert('رویداد فروشگاهی با موفقیت ثبت شد 🏪');
        
        amountEl.value = '';
        descEl.value = '';
        this.setupView();
    }
}
