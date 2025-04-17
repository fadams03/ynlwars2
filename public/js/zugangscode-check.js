function submitMasterzugangscode() {
    const zugangscode = document.getElementById('masterzugangscodeInput').value;

    fetch('/verify-zugangscode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zugangscode })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('zugangscodeOverlay').style.display = 'none';
        } else {
            document.getElementById('masterzugangscodeError').style.display = 'block';
        }
    })
    .catch(err => {
        console.error('Fehler bei zugangscodeprüfung:', err);
        document.getElementById('masterzugangscodeError').style.display = 'block';
    });
}
