// utils/storage.js

export function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

export function load(key, fallback = null) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
}
