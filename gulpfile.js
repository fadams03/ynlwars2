import gulp from "gulp";
import babel from "gulp-babel";
import uglify from "gulp-uglify";
import rename from "gulp-rename";
import cleanCSS from "gulp-clean-css";
import sourcemaps from "gulp-sourcemaps";

const { src, dest, series, parallel } = gulp;
// Loooooooooos gehts: npx gulp build
// 🔹 JavaScript (src/**/*.js) transpiliert & minifiziert
function transpileJS() {
  return src("src/**/*.js")
    .pipe(sourcemaps.init()) // Debugging mit Sourcemaps
    .pipe(babel({ presets: ["@babel/preset-env"] })) // Modernes JS -> ältere Versionen
    .pipe(uglify()) // Minifizierung
    .pipe(rename({ suffix: ".min" })) // Umbenennen: game.js → game.min.js
    .pipe(sourcemaps.write(".")) // Speichert die Source Map
    .pipe(dest("dist/src"));
}

// 🔹 HTML (public/index.html) einfach kopieren
function copyHTML() {
  return src("public/index.html").pipe(dest("dist/public"));
}

// 🔹 CSS (public/styles.css) minifizieren
function minifyCSS() {
  return src("public/styles.css")
    .pipe(cleanCSS()) // Minifiziert CSS
    .pipe(rename({ suffix: ".min" })) // styles.css → styles.min.css
    .pipe(dest("dist/public"));
}

// 🔹 Server.js transpiliert
function transpileServer() {
  return src("server.js")
    .pipe(sourcemaps.init())
    .pipe(babel({ presets: ["@babel/preset-env"] }))
    .pipe(uglify())
    .pipe(rename({ suffix: ".min" }))
    .pipe(sourcemaps.write("."))
    .pipe(dest("dist"));
}

// 🔹 Mock-Dateien kopieren
function copyMocks() {
  return src(["mockclient.js", "mockserver.js"])
    .pipe(dest("dist"));
}

// 🔹 Alles zusammenbauen
export const build = series(
  parallel(
    transpileJS,
    copyHTML,
    minifyCSS,
    transpileServer,
    copyMocks
  )
);
