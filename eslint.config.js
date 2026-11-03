import * as tsParserModule from '@typescript-eslint/parser';
import pluginVue from 'eslint-plugin-vue';
import withNuxt from './.nuxt/eslint.config.mjs';

const tsParser = tsParserModule.default ?? tsParserModule;

export default withNuxt([
  {
    ignores: ['scripts/', '.scratch/'],
  },
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['eslint.config.js'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
      },
    },
  },
  {
    rules: {
      /* "Vue/Nuxt Recommended" Overrides */
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': ['error', { singleline: 5, multiline: 1 }],
      'vue/singleline-html-element-content-newline': 'off',
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/html-self-closing': ['error', { html: { void: 'always' } }],
      'vue/padding-line-between-blocks': 'error',
      'vue/padding-line-between-tags': 'error',

      /* Error- & Bug Prevention */
      'no-irregular-whitespace': 'error',
      'no-loss-of-precision': 'error',
      'no-unreachable-loop': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['error', { destructuredArrayIgnorePattern: '^_' }],
      'use-isnan': 'error',
      'radix': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'eqeqeq': 'error',
      'no-shadow': 'error',

      /* TypeScript Type Safety */
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-invalid-void-type': 'warn',

      /* Code Style & Maintainability */
      'arrow-body-style': ['warn', 'as-needed'],
      'camelcase': ['error', { properties: 'never' }],
      'consistent-return': 'warn',
      'func-style': ['error', 'expression'],
      'max-depth': ['error', 3],
      'max-params': ['warn', 3],
      'no-console': 'warn',
      'no-unneeded-ternary': 'error',
      'no-useless-return': 'error',
      'object-shorthand': 'warn',
      'prefer-const': 'warn',
      'prefer-destructuring': 'warn',
      'prefer-template': 'warn',

      /* Formatting (mostly @stylistic defaults) */
      '@stylistic/comma-dangle': ['error', 'only-multiline'],
      '@stylistic/curly-newline': ['error', { multiline: true, minElements: 3, consistent: true }],
      '@stylistic/object-curly-newline': ['error', { multiline: true, consistent: true }],
      '@stylistic/semi': ['error', 'always'],
    },
  },
]);
