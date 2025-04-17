document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chatHeader').addEventListener('click', () => {
        document.getElementById('chatContainer').classList.toggle('collapsed');
    });
});
