// ui/notifications.js

export function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'alert alert-danger alert-dismissible fade show';
    toast.innerHTML = `
        <strong>Error:</strong> ${message}
        <button class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.prepend(toast);
    setTimeout(() => toast.remove(), 5000);
}
