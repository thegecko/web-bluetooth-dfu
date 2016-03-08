var gulp = require('gulp');
var jshint = require('gulp-jshint');

gulp.task('lint', function() {
    return gulp.src(['dist/*.js'])
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

gulp.task('default', ['lint']);