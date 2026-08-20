// ESLint flat config
// Note: ESLint is only ever installed in CI (via npx). The shipped application
// has zero third-party runtime dependencies.

const browserGlobals = {
    window: "readonly",
    document: "readonly",
    console: "readonly",
    fetch: "readonly",
    Blob: "readonly",
    URL: "readonly",
    FileReader: "readonly",
    BigInt: "readonly",
    setTimeout: "readonly"
};

const sharedRules = {
    // Correctness
    "no-undef": "error",
    "no-unused-vars": ["warn", { args: "none" }],
    "no-redeclare": "error",
    "no-dupe-keys": "error",
    "no-dupe-args": "error",
    "no-unreachable": "error",
    "no-fallthrough": "error",
    "valid-typeof": "error",
    "use-isnan": "error",

    // Security-adjacent
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-script-url": "error",

    // Style / consistency
    "eqeqeq": ["error", "always"],
    "no-var": "error",
    "prefer-const": "warn"
};

export default [
    {
        // Defines the IPUtils global
        files: ["js/ip-utils.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: browserGlobals
        },
        rules: {
            ...sharedRules,
            // IPUtils is intentionally exposed as a cross-file global
            "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^IPUtils$" }]
        }
    },
    {
        // Consumes the IPUtils global
        files: ["js/app.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: {
                ...browserGlobals,
                IPUtils: "readonly"
            }
        },
        rules: sharedRules
    }
];
