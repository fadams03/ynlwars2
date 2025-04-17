document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('spaceBackground');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const stars = [];
    const starCount = 2500;

    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: (Math.random() - 0.5) * canvas.width * 1.5 + canvas.width / 2,
            y: (Math.random() - 0.5) * canvas.height * 1.5 + canvas.height / 2,
            radius: Math.random() * 1.5,
            alpha: Math.random(),
            speed: Math.random() * 0.3 + 0.1
        });
    }

    function animateStars() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        stars.forEach(star => {
            star.y += star.speed;
            if (star.y > canvas.height) star.y = 0;

            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2, false);
            ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
            ctx.fill();
        });

        requestAnimationFrame(animateStars);
    }

    animateStars();
});
