import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** [D5] Cấm cắt ngày từ ISO (lệch múi giờ) — áp dụng mọi nơi */
const CAM_TO_ISO_SLICE = {
  selector:
    "CallExpression[callee.property.name='slice'][callee.object.callee.property.name='toISOString']",
  message: "[D5] Không dùng toISOString().slice(...) — dùng hàm trong @vsn/shared (ngay-lam-viec).",
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dev-dist/**',
      '**/coverage/**',
      'apps/api/src/generated/**',
      'ui-demo/**',
      'ui-demo-options/**',
      '_kiem-tra-may/**',
      'diagrams/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-restricted-syntax': ['error', CAM_TO_ISO_SLICE],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // ── API: nghiệp vụ không tự lấy giờ, chỉ ClockService.now() [D5] ──
  {
    files: ['apps/api/src/modules/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        CAM_TO_ISO_SLICE,
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: '[D5] Không dùng new Date() trong modules — dùng ClockService.now().',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: '[D5] Không dùng Date.now() trong modules — dùng ClockService.now().',
        },
      ],
    },
  },

  // ── Frontend ──
  {
    files: ['apps/worker/src/**/*.{ts,tsx}', 'apps/web/src/**/*.{ts,tsx}', 'packages/ui/src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // ── App công nhân: giữ bundle ≤ 180 KB gzip [TDD 14.2] ──
  {
    files: ['apps/worker/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['recharts', 'recharts/*'], message: 'apps/worker không được nạp Recharts.' },
            { group: ['@dnd-kit/*'], message: 'apps/worker không được nạp dnd-kit.' },
            { group: ['@tanstack/react-table', '@vsn/ui/data-table'], message: 'apps/worker không được nạp TanStack Table.' },
          ],
        },
      ],
    },
  },
);
