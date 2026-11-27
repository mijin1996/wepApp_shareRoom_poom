/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_CHANNEL__: 'test' | 'prod';
declare const __APP_BUILD_DATE__: string;
// 아티팩트(정적 페이지) 빌드: Mock 서버를 브라우저 안에서 같이 돌린다
declare const __IN_BROWSER_API__: boolean;
