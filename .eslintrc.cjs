module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: ['react', 'react-hooks', '@typescript-eslint', 'electron'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:electron/recommended'
  ],
  settings: {
    react: {
      version: 'detect'
    }
  },
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname
      },
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking'
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off'
      }
    },
    {
      files: ['electron/**/*.{js,jsx,ts,tsx}'],
      env: {
        browser: false,
        node: true
      }
    },
    {
      files: ['electron/preload.js'],
      env: {
        browser: true,
        node: true
      }
    },
    {
      files: ['src/**/*.{js,jsx}'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ],
  rules: {
    'react/prop-types': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }
    ]
  },
  ignorePatterns: ['dist/', 'app/', 'app-bin/', 'build/']
};
