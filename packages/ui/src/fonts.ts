/**
 * Font tự host qua @fontsource (không phụ thuộc Google Fonts) [TDD 5].
 * Chỉ nạp subset latin + vietnamese — đủ cho tiếng Việt (gồm Đ/đ, Ơ/ơ, Ư/ư),
 * tránh PWA precache font cyrillic/greek không dùng tới.
 */
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/latin-500.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@fontsource/be-vietnam-pro/latin-700.css';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-500.css';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/vietnamese-700.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-600.css';
