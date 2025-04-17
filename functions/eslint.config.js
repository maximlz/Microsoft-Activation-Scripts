// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals'; // Необходим для определения глобальных переменных NodeJS

export default [
  // Глобальные исключения
  {
    ignores: ["lib/**", "generated/**", "node_modules/**"],
  },

  // Базовые рекомендуемые правила ESLint
  eslint.configs.recommended,

  // Конфигурация TypeScript
  {
    files: ["**/*.ts"], // Применять правила TS только к файлам .ts
    languageOptions: {
      parser: tseslint.parser, // Использовать парсер TS
      parserOptions: {
        // Указываем путь к tsconfig для правил, требующих информацию о типах
        // Если такие правила не используются, это можно закомментировать/удалить
        project: true, 
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node, // Добавляем глобальные переменные Node.js
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin, // Регистрируем плагин TS
    },
    rules: {
      // Убираем наследование правил из плагина, так как оно вызывает ошибку
      // ...tseslint.plugin.configs.recommended.rules,

      // Явно убеждаемся, что проблемное правило ОТКЛЮЧЕНО
      "@typescript-eslint/no-unused-expressions": "off",

      // Ваши кастомные правила
      "quotes": ["error", "double"],
      "indent": ["error", 2],

      // Можно добавить/изменить правила по необходимости
      // Например, ослабить частое строгое правило:
      // '@typescript-eslint/no-explicit-any': 'warn',
      // Например, предупреждать о console.log:
      // 'no-console': 'warn',
    },
  },
]; 