var path        = require("path");
var browserify  = require("browserify");
var del         = require("del");
var merge       = require("merge2");
var tslint      = require("tslint");
var buffer      = require("vinyl-buffer");
var source      = require("vinyl-source-stream");
var gulp        = require("gulp");
var sourcemaps  = require("gulp-sourcemaps");
var gulpTs      = require("gulp-typescript");
var gulpTslint  = require("gulp-tslint");
var uglify      = require("gulp-uglify");

// Source
var srcDir = "src";
var srcFiles = srcDir + "/**/*.ts";

// Node
var nodeDir = "lib";
var typesDir = "types";

// Browser bundles
var bundleDir = "dist";
var bundleGlobal = "SecureDfu";
var bundleIgnore = "webbluetooth";

var watching = false;

// Error handler suppresses exists during watch
function handleError() {
    if (watching) this.emit("end");
    else process.exit(1);
}

// Set watching
gulp.task("setWatch", () => {
    watching = true;
});

// Clear built directories
gulp.task("clean", () => {
    return del([nodeDir, typesDir, bundleDir]);
});

// Lint the source
gulp.task("lint", () => {
    var program = tslint.Linter.createProgram("./");

    gulp.src(srcFiles)
    .pipe(gulpTslint({
        program: program,
        formatter: "stylish"
    }))
    .pipe(gulpTslint.report({
        emitError: !watching
    }))
});

// Build TypeScript source into CommonJS Node modules
gulp.task("compile", ["clean"], () => {
    var tsResult = gulp.src(srcFiles)
    .pipe(sourcemaps.init())
    .pipe(gulpTs.createProject("tsconfig.json")())
    .on("error", handleError);

    return merge([
        tsResult.js.pipe(sourcemaps.write(".", {
            sourceRoot: path.relative(nodeDir, srcDir)
        })).pipe(gulp.dest(nodeDir)),
        tsResult.dts.pipe(gulp.dest(typesDir))
    ]);
});

// Build CommonJS modules into browser bundles
gulp.task("bundle", ["compile"], () => {
    var fileName = bundleGlobal.replace(/([A-Z]+)/g, (match, submatch, offset) => {
        return `${offset > 0 ? "-" : ""}${match.toLowerCase()}`;
    });

    return browserify(nodeDir, {
        standalone: bundleGlobal
    })
    .ignore(bundleIgnore)
    .bundle()
    .on("error", handleError)
    .pipe(source(`${fileName}.js`))
    .pipe(buffer())
    .pipe(sourcemaps.init({
        loadMaps: true
    }))
    .pipe(uglify())
    .pipe(sourcemaps.write(".", {
        sourceRoot: path.relative(bundleDir, nodeDir)
    }))
    .pipe(gulp.dest(bundleDir));
});

gulp.task("watch", ["setWatch", "default"], () => {
    gulp.watch(srcFiles, ["default"]);
});

gulp.task("default", ["lint", "bundle"]);
