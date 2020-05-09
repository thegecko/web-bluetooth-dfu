const path        = require("path");
const browserify  = require("browserify");
const del         = require("del");
const merge       = require("merge2");
const buffer      = require("vinyl-buffer");
const source      = require("vinyl-source-stream");
const gulp        = require("gulp");
const sourcemaps  = require("gulp-sourcemaps");
const typescript  = require("gulp-typescript");
const tslint      = require("gulp-tslint");
const uglify      = require("gulp-uglify");

// Source
const srcDir = "src";
const srcFiles = srcDir + "/**/*.ts";

// Node
const nodeDir = "lib";
const typesDir = "types";

// Browser bundles
const bundleDir = "dist";
const bundleGlobal = "SecureDfu";

let watching = false;

// Error handler suppresses exists during watch
const handleError = error => {
    console.log(error.message);
    if (watching) this.emit("end");
    else process.exit(1);
}

// Set watching
const taskSetWatchFlag = done => {
    watching = true;
    done();
};

// Clear built directories
const taskClean = done => {
    if (!watching) del([nodeDir, typesDir, bundleDir]);
    done();
};

// Lint the source
const taskLint = () => {
    return gulp.src(srcFiles)
    .pipe(tslint({
        formatter: "stylish"
    }))
    .pipe(tslint.report({
        emitError: !watching
    }))
};

// Build TypeScript source into CommonJS Node modules
const taskCompile = () => {
    var tsResult = gulp.src(srcFiles)
    .pipe(sourcemaps.init())
    .pipe(typescript.createProject("tsconfig.json")())
    .on("error", handleError);

    return merge([
        tsResult.js.pipe(sourcemaps.write(".", {
            sourceRoot: path.relative(nodeDir, srcDir)
        })).pipe(gulp.dest(nodeDir)),
        tsResult.dts.pipe(gulp.dest(typesDir))
    ]);
};

// Build CommonJS modules into browser bundles
const taskBundle = () => {
    var fileName = bundleGlobal.replace(/([A-Z]+)/g, (match, submatch, offset) => {
        return `${offset > 0 ? "-" : ""}${match.toLowerCase()}`;
    });

    return browserify(nodeDir, {
        standalone: bundleGlobal
    })
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
};

exports.bundle = gulp.series(taskClean, taskCompile, taskBundle);
exports.default = gulp.series(taskLint, exports.bundle);

const taskSetWatch = done => {
  gulp.watch(srcFiles, exports.default);
  done();
};

exports.watch = gulp.series(taskSetWatchFlag, exports.default, taskSetWatch);
