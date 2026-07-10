export function formatCurrency(amount) {
    return Number(amount).toLocaleString('fa-IR') + ' تومان';
}

export function toPersianDigits(num) {
    const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().replace(/[0-9]/g, function (w) {
        return id[+w];
    });
}
