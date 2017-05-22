var gulp = require("gulp");
var eslint = require("gulp-eslint");

gulp.task("lint", function() {
    return gulp.src([
        "dist/*.js",
        "examples/*.js"
    ])
    .pipe(eslint(".eslintrc"))
    .pipe(eslint.format())
    .pipe(eslint.failOnError());
});

gulp.task("default", ["lint"]);
