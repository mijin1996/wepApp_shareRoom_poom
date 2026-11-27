// 아티팩트용 한 파일 만들기: dist-artifact 의 CSS · JS 를 HTML 하나에 넣는다 (기획서 · 문서 · 테스트는 넣지 않음)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = 'dist-artifact';
const ASSETS = join(OUT_DIR, 'assets');
const files = readdirSync(ASSETS);
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(ASSETS, f), 'utf8')).join('\n');
const jsFiles = files.filter((f) => f.endsWith('.js'));
if (jsFiles.length !== 1)
{
    throw new Error('JS 파일이 하나여야 해요: ' + jsFiles.join(', '));
}
const js = readFileSync(join(ASSETS, jsFiles[0]), 'utf8').replace(/<\/script/gi, '<\/script');

const page = `<title>품 Poom 테스트판</title>
<meta name="theme-color" content="#c8623f">
<style>
${css.replace(/<\/style/gi, '<\/style')}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
writeFileSync(join(OUT_DIR, 'poom-artifact.html'), page);
// 로컬 확인용: 아티팩트가 게시할 때 씌우는 기본 틀(문자셋 · 화면 폭)을 똑같이 씌운 사본
writeFileSync(join(OUT_DIR, 'preview.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + page + '</body></html>');
console.log('poom-artifact.html', Math.round(page.length / 1024) + 'KB');
