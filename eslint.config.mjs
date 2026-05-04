import { defineConfig } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    extends: compat.extends("eslint:recommended"),

    languageOptions: {
        globals: {
            ...globals.node,
        },

        ecmaVersion: "latest",
        sourceType: "commonjs",
    },

    rules: {
        "no-console": "off",
        "brace-style": ["error", "stroustrup"],
    },
}, {
    files: ["tests/**"],

    languageOptions: {
        globals: {
            ...globals.jest,
        },
    },
}, {
    files: ["src/ui/**"],

    languageOptions: {
        globals: {
            ...globals.browser,
        },
    },
}, {
    files: ["eslint.config.mjs"],

    languageOptions: {
        sourceType : "module",
    },
},]);