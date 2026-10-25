import nextVitals from 'eslint-config-next/core-web-vitals';
const config = [...nextVitals, { ignores: ['test-results/**', 'playwright-report/**'] }];
export default config;
